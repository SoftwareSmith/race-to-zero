import { Entity } from "./Entity";
import { drawBugSprite } from "@game/utils/bugSprite";
import { DEFAULT_GAME_CONFIG } from "./types";
import { getCodex, type CrawlProfile, type BugType } from "./bugCodex";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function getAngleDelta(from: number, to: number) {
  return normalizeAngle(to - from);
}

function getLength(x: number, y: number) {
  return Math.hypot(x, y);
}

function normalizeVector(x: number, y: number) {
  const length = getLength(x, y);
  if (!length) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function gradient1D(index: number, seed: number) {
  const hashed = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return (hashed - Math.floor(hashed)) * 2 - 1;
}

function perlin1D(position: number, seed: number) {
  const left = Math.floor(position);
  const right = left + 1;
  const local = position - left;
  const leftGradient = gradient1D(left, seed);
  const rightGradient = gradient1D(right, seed);
  const leftInfluence = leftGradient * local;
  const rightInfluence = rightGradient * (local - 1);
  return lerp(leftInfluence, rightInfluence, fade(local)) * 2;
}

type BugState = "patrol" | "flee" | "dying" | "dead";

interface BugUpdateContext {
  getNeighbors: (e: BugEntity, r: number) => BugEntity[];
  targetX?: number | null;
  targetY?: number | null;
  config?: typeof DEFAULT_GAME_CONFIG;
  bounds?: { width: number; height: number };
}

export const getProfileForVariant = (variant: Entity["variant"]) => {
  const entry = getCodex()[variant as string];
  return entry ? (entry.profile as CrawlProfile) : undefined;
};

export class BugEntity extends Entity {
  seed: number;
  wanderAngle: number;
  hp: number;
  maxHp: number;
  lastHitTime: number;
  state: BugState;
  deathProgress: number;
  deathDuration: number;
  fleeTimer: number | null;
  baseSize: number;
  cruiseSpeed: number;
  turnRate: number;
  motionTime: number;
  typeSpec: BugType | null;

  constructor(opts: Partial<Entity> & { id?: string } = {}) {
    super(opts as Entity);
    this.seed = Math.random();
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.maxHp = 1;
    this.hp = this.maxHp;
    this.lastHitTime = 0;
    this.state = "patrol";
    this.deathProgress = 0;
    this.deathDuration = 0.6;
    this.fleeTimer = null;
    this.baseSize = this.size;
    this.cruiseSpeed = 0.88 + Math.random() * 0.24;
    this.turnRate = 0.94 + Math.random() * 0.18;
    this.heading = opts.heading ?? Math.atan2(this.vy || 0, this.vx || 1);
    this.motionTime = Math.random() * 100;
    this.typeSpec = null;
  }

  private syncTypeSpec() {
    this.typeSpec = getCodex()[this.variant as string] ?? null;
    return this.typeSpec;
  }

  private getWallSteering(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    const senseDistance = Math.max(
      config.wallAvoidDistance * 2.1,
      this.size * 3.4,
      34,
    );
    const left = clamp((senseDistance - this.x) / senseDistance, 0, 1);
    const right = clamp(
      (senseDistance - (bounds.width - this.x)) / senseDistance,
      0,
      1,
    );
    const top = clamp((senseDistance - this.y) / senseDistance, 0, 1);
    const bottom = clamp(
      (senseDistance - (bounds.height - this.y)) / senseDistance,
      0,
      1,
    );
    const away = normalizeVector(left * left - right * right, top * top - bottom * bottom);
    const pressure = Math.max(left, right, top, bottom);

    return {
      pressure,
      x: away.x * config.wallAvoidStrength * pressure * 1.5,
      y: away.y * config.wallAvoidStrength * pressure * 1.5,
    };
  }

  private getNeighborSeparation(
    neighbors: BugEntity[],
    radius: number,
    strength: number,
  ) {
    if (!neighbors.length) {
      return { x: 0, y: 0 };
    }

    let separationX = 0;
    let separationY = 0;

    for (const neighbor of neighbors) {
      const dx = this.x - neighbor.x;
      const dy = this.y - neighbor.y;
      const distance = Math.max(1, getLength(dx, dy));
      const weight = 1 - clamp(distance / radius, 0, 1);
      separationX += (dx / distance) * weight;
      separationY += (dy / distance) * weight;
    }

    const away = normalizeVector(separationX, separationY);
    return {
      x: away.x * strength,
      y: away.y * strength,
    };
  }

  private containWithinBounds(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
    desiredSpeed: number,
  ) {
    const margin = Math.max(6, this.size * 0.5);
    let inwardX = 0;
    let inwardY = 0;
    let touchedBoundary = false;

    if (this.x < margin) {
      this.x = margin;
      inwardX += 1;
      touchedBoundary = true;
    } else if (this.x > bounds.width - margin) {
      this.x = bounds.width - margin;
      inwardX -= 1;
      touchedBoundary = true;
    }

    if (this.y < margin) {
      this.y = margin;
      inwardY += 1;
      touchedBoundary = true;
    } else if (this.y > bounds.height - margin) {
      this.y = bounds.height - margin;
      inwardY -= 1;
      touchedBoundary = true;
    }

    if (!touchedBoundary) {
      return;
    }

    const inward = normalizeVector(inwardX, inwardY);
    const fallback = normalizeVector(
      bounds.width * 0.5 - this.x,
      bounds.height * 0.5 - this.y,
    );
    const recovery = inward.x !== 0 || inward.y !== 0 ? inward : fallback;
    const recoveryHeading = Math.atan2(recovery.y, recovery.x);
    const recoverySpeed = Math.max(desiredSpeed * 0.9, config.baseSpeed * 0.72);

    this.heading = recoveryHeading;
    this.vx = Math.cos(recoveryHeading) * recoverySpeed;
    this.vy = Math.sin(recoveryHeading) * recoverySpeed;
  }

  update(dt: number, ctx: BugUpdateContext) {
    const config = ctx.config ?? DEFAULT_GAME_CONFIG;
    const bounds = ctx.bounds ?? { width: 800, height: 600 };

    if (this.state === "dying") {
      this.deathProgress += dt / this.deathDuration;
      this.opacity = Math.max(0, 1 - this.deathProgress);
      this.size = Math.max(
        this.baseSize * 0.28,
        this.baseSize * (1 - this.deathProgress * 0.72),
      );
      if (this.deathProgress >= 1) {
        this.state = "dead";
      }
      return;
    }

    if (this.state === "dead") {
      return;
    }

    if (typeof this.heading !== "number" || Number.isNaN(this.heading)) {
      this.heading = Math.atan2(this.vy || 0, this.vx || 1);
    }

    this.motionTime += dt;

    if (this.fleeTimer != null) {
      this.fleeTimer = Math.max(0, this.fleeTimer - dt);
      if (this.fleeTimer === 0) {
        this.fleeTimer = null;
        this.state = "patrol";
      }
    }

    const targetX = ctx.targetX ?? null;
    const targetY = ctx.targetY ?? null;
    const hasThreat =
      targetX != null &&
      targetY != null &&
      getLength(this.x - targetX, this.y - targetY) <= config.fleeRadius * 1.8;

    if (hasThreat) {
      this.state = "flee";
      this.fleeTimer = 0.55;
    } else if (!this.fleeTimer) {
      this.state = "patrol";
    }

    const desired = {
      x: Math.cos(this.heading) * 0.42,
      y: Math.sin(this.heading) * 0.42,
    };
    const wallSteering = this.getWallSteering(bounds, config);

    desired.x += wallSteering.x;
    desired.y += wallSteering.y;

    const wanderNoise = perlin1D(
      this.motionTime * 0.38 + this.seed * 9.7,
      this.seed * 21.3,
    );
    this.wanderAngle = wanderNoise * (0.34 + config.wanderStrength * 0.4);
    desired.x += Math.cos(this.heading + this.wanderAngle) * (0.24 + config.wanderStrength * 0.7);
    desired.y += Math.sin(this.heading + this.wanderAngle) * (0.24 + config.wanderStrength * 0.7);

    const neighbors = ctx.getNeighbors(this, config.separationRadius);
    const separation = this.getNeighborSeparation(
      neighbors,
      config.separationRadius,
      config.separationStrength * 1.65,
    );
    desired.x += separation.x;
    desired.y += separation.y;

    if (this.state === "flee" && targetX != null && targetY != null) {
      const away = normalizeVector(this.x - targetX, this.y - targetY);
      desired.x += away.x * 2.2;
      desired.y += away.y * 2.2;
    }

    const desiredDirection = normalizeVector(desired.x, desired.y);
    const desiredHeading =
      desiredDirection.x === 0 && desiredDirection.y === 0
        ? this.heading
        : Math.atan2(desiredDirection.y, desiredDirection.x);
    const maxTurn = config.turnSpeed * this.turnRate * dt;
    this.heading += clamp(
      getAngleDelta(this.heading, desiredHeading),
      -maxTurn,
      maxTurn,
    );
    this.heading = normalizeAngle(this.heading);

    const edgeFactor = 1 - wallSteering.pressure * 0.12;
    const speedBoost = this.state === "flee" ? 1.22 : 1;
    const desiredSpeed = config.baseSpeed * this.cruiseSpeed * edgeFactor * speedBoost;
    const currentSpeed = getLength(this.vx, this.vy);
    const nextSpeed = currentSpeed + (desiredSpeed - currentSpeed) * Math.min(1, dt * 4.2);
    this.vx = Math.cos(this.heading) * nextSpeed;
    this.vy = Math.sin(this.heading) * nextSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.containWithinBounds(bounds, config, desiredSpeed);

    this.opacity = 1;
    this.size = this.baseSize;
  }

  onHit(damage = 1) {
    if (this.state === "dead" || this.state === "dying") {
      return { defeated: false, remainingHp: 0 };
    }

    this.lastHitTime = performance.now();
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) {
      this.state = "dying";
      this.deathProgress = 0;
      this.vx = 0;
      this.vy = 0;
      return { defeated: true, remainingHp: 0 };
    }

    this.state = "flee";
    this.fleeTimer = 0.9 + Math.random() * 0.5;
    this.syncTypeSpec();
    return { defeated: false, remainingHp: this.hp };
  }

  revive(width: number, height: number) {
    const padding = 18;
    this.x = padding + Math.random() * Math.max(1, width - padding * 2);
    this.y = padding + Math.random() * Math.max(1, height - padding * 2);
    const angle = Math.random() * Math.PI * 2;
    const speed = DEFAULT_GAME_CONFIG.baseSpeed * (0.75 + Math.random() * 0.35);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.heading = angle;
    this.hp = this.maxHp;
    this.lastHitTime = 0;
    this.state = "patrol";
    this.deathProgress = 0;
    this.fleeTimer = null;
    this.motionTime = Math.random() * 100;
    this.opacity = 1;
    this.size = this.baseSize;
    this.syncTypeSpec();
  }

  render(ctx2d: CanvasRenderingContext2D, alpha = 1) {
    const renderX = this.prevX * (1 - alpha) + this.x * alpha;
    const renderY = this.prevY * (1 - alpha) + this.y * alpha;
    const typeSpec = this.syncTypeSpec();
    const color = typeSpec?.color;
    const sizeMultiplier = typeSpec?.size ?? 1;
    drawBugSprite(ctx2d, {
      x: renderX,
      y: renderY,
      size: this.size * sizeMultiplier,
      rotation: this.heading,
      opacity: this.opacity,
      variant: this.variant,
      color: color ?? undefined,
    });
  }
}