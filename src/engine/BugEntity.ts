import { Entity } from "./Entity";
import { drawBugSprite } from "../utils/bugSprite";
import type { Vec2 } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";
import { getCodex, CrawlProfile, BugType } from "./bugCodex";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
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

type CrawlRegion = "edge" | "middle" | "interior";

type BugState = "patrol" | "flee" | "dying" | "dead";

interface BugUpdateContext {
  getNeighbors: (e: BugEntity, r: number) => BugEntity[];
  getCrowdingAt?: (
    x: number,
    y: number,
    r: number,
    exclude?: BugEntity,
  ) => { centerX: number; centerY: number; count: number; score: number };
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
  state: BugState;
  deathProgress: number;
  deathDuration: number;
  fleeTimer: number | null;
  roamTarget: Vec2 | null;
  retargetTimer: number;
  baseSize: number;
  cruiseSpeed: number;
  turnRate: number;
  homeAnchor: Vec2 | null;
  anchorDriftTimer: number;
  motionTime: number;
  typeSpec: BugType | null;
  stuckTimer: number;

  constructor(opts: Partial<Entity> & { id?: string } = {}) {
    super(opts as any);
    this.seed = Math.random();
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.maxHp = 1;
    this.hp = this.maxHp;
    this.state = "patrol";
    this.deathProgress = 0;
    this.deathDuration = 0.6;
    this.fleeTimer = null;
    this.roamTarget = null;
    this.retargetTimer = 0;
    this.baseSize = this.size;
    this.cruiseSpeed = 0.9 + Math.random() * 0.55;
    this.turnRate = 0.9 + Math.random() * 0.35;
    this.heading = opts.heading ?? Math.atan2(this.vy || 0, this.vx || 1);
    this.homeAnchor = null;
    this.anchorDriftTimer = 0;
    this.motionTime = Math.random() * 100;
    this.typeSpec = null;
    this.stuckTimer = 0;
  }

  private getCrawlProfile() {
    return getProfileForVariant(this.variant) ?? ({} as CrawlProfile);
  }

  private resetAnchorDriftTimer() {
    const profile = this.getCrawlProfile();
    const [minSeconds, maxSeconds] = profile.anchorDriftInterval;
    this.anchorDriftTimer = minSeconds + Math.random() * (maxSeconds - minSeconds);
  }

  private chooseWeightedRegion() {
    const weights = this.getCrawlProfile().regionWeights;
    const total = weights.edge + weights.middle + weights.interior;
    let roll = Math.random() * total;
    if (roll < weights.edge) return "edge" as CrawlRegion;
    roll -= weights.edge;
    if (roll < weights.middle) return "middle" as CrawlRegion;
    return "interior" as CrawlRegion;
  }

  private samplePointInRegion(
    bounds: { width: number; height: number },
    region: CrawlRegion,
  ) {
    const padding = 8;
    const edgeBandX = Math.max(18, bounds.width * 0.12);
    const edgeBandY = Math.max(18, bounds.height * 0.12);
    const interiorHalfWidth = bounds.width * 0.18;
    const interiorHalfHeight = bounds.height * 0.18;
    const centerX = bounds.width * 0.5;
    const centerY = bounds.height * 0.5;

    if (region === "edge") {
      // small chance to include true corners so they are not permanently empty
      if (Math.random() < 0.08) {
        return {
          x: clamp(Math.random() < 0.5 ? padding : bounds.width - padding, padding, bounds.width - padding),
          y: clamp(Math.random() < 0.5 ? padding : bounds.height - padding, padding, bounds.height - padding),
        };
      }
      const side = Math.floor(Math.random() * 4);
      if (side === 0) {
        return {
          x: clamp(Math.random() * edgeBandX, padding, bounds.width - padding),
          y: clamp(Math.random() * bounds.height, padding, bounds.height - padding),
        };
      }
      if (side === 1) {
        return {
          x: clamp(bounds.width - Math.random() * edgeBandX, padding, bounds.width - padding),
          y: clamp(Math.random() * bounds.height, padding, bounds.height - padding),
        };
      }
      if (side === 2) {
        return {
          x: clamp(Math.random() * bounds.width, padding, bounds.width - padding),
          y: clamp(Math.random() * edgeBandY, padding, bounds.height - padding),
        };
      }
      return {
        x: clamp(Math.random() * bounds.width, padding, bounds.width - padding),
        y: clamp(bounds.height - Math.random() * edgeBandY, padding, bounds.height - padding),
      };
    }

    if (region === "interior") {
      return {
        x: clamp(
          centerX + (Math.random() - 0.5) * interiorHalfWidth * 2,
          padding,
          bounds.width - padding,
        ),
        y: clamp(
          centerY + (Math.random() - 0.5) * interiorHalfHeight * 2,
          padding,
          bounds.height - padding,
        ),
      };
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = {
        x: clamp(Math.random() * bounds.width, padding, bounds.width - padding),
        y: clamp(Math.random() * bounds.height, padding, bounds.height - padding),
      };
      const isInteriorX = Math.abs(candidate.x - centerX) <= interiorHalfWidth;
      const isInteriorY = Math.abs(candidate.y - centerY) <= interiorHalfHeight;
      const isEdge =
        candidate.x <= edgeBandX ||
        candidate.x >= bounds.width - edgeBandX ||
        candidate.y <= edgeBandY ||
        candidate.y >= bounds.height - edgeBandY;
      if (!isEdge && !(isInteriorX && isInteriorY)) {
        return candidate;
      }
    }

    return {
      x: clamp(Math.random() * bounds.width, padding, bounds.width - padding),
      y: clamp(Math.random() * bounds.height, padding, bounds.height - padding),
    };
  }

  private getBiasedCoordinate(length: number, bias: CrawlProfile["anchorBias"]) {
    if (bias === "perimeter") {
      const edgeBand = Math.max(36, length * 0.18);
      if (Math.random() < 0.5) {
        return clamp(Math.random() * edgeBand, 24, length - 24);
      }
      return clamp(length - Math.random() * edgeBand, 24, length - 24);
    }

    if (bias === "interior") {
      const center = length * 0.5;
      const spread = length * 0.24;
      return clamp(center + (Math.random() - 0.5) * spread * 2, 24, length - 24);
    }

    return clamp(Math.random() * length, 24, length - 24);
  }

  private ensureHomeAnchor(bounds: { width: number; height: number }) {
    if (this.homeAnchor) {
      return;
    }
    const weightedPoint = this.samplePointInRegion(
      bounds,
      this.chooseWeightedRegion(),
    );
    this.homeAnchor = {
      x: weightedPoint.x,
      y: weightedPoint.y,
    };
    this.resetAnchorDriftTimer();
  }

  private updateHomeAnchor(dt: number, bounds: { width: number; height: number }) {
    this.ensureHomeAnchor(bounds);
    this.anchorDriftTimer -= dt;
    if (this.anchorDriftTimer > 0 || !this.homeAnchor) {
      return;
    }

    const nextAnchorPoint = this.samplePointInRegion(bounds, this.chooseWeightedRegion());
    this.homeAnchor = {
      x: nextAnchorPoint.x,
      y: nextAnchorPoint.y,
    };
    this.resetAnchorDriftTimer();
  }

  private chooseRoamTarget(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
    getCrowdingAt?: BugUpdateContext["getCrowdingAt"],
  ) {
    const profile = this.getCrawlProfile();
    this.ensureHomeAnchor(bounds);
    const padding = 8;
    const minDistance = Math.min(
      config.roamTargetMinDistance,
      Math.max(bounds.width, bounds.height) * 0.45,
    );

    let chosen: Vec2 | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const anchor = this.homeAnchor!;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const useWideRoam = Math.random() < profile.wideRoamChance;
      const radius = useWideRoam
        ? Math.max(bounds.width, bounds.height) * (0.28 + Math.random() * 0.22)
        : profile.roamRadius * (0.55 + Math.random() * 0.75);
      const angle = Math.random() * Math.PI * 2;
      const regionPoint = this.samplePointInRegion(bounds, this.chooseWeightedRegion());
      const candidate = {
        x: clamp(
          (useWideRoam ? regionPoint.x : anchor.x + Math.cos(angle) * radius),
          padding,
          bounds.width - padding,
        ),
        y: clamp(
          (useWideRoam ? regionPoint.y : anchor.y + Math.sin(angle) * radius),
          padding,
          bounds.height - padding,
        ),
      };
      const travelDistance = getLength(candidate.x - this.x, candidate.y - this.y);
      const anchorDistance = getLength(candidate.x - anchor.x, candidate.y - anchor.y);
      const edgeDistance = Math.min(
        candidate.x,
        candidate.y,
        bounds.width - candidate.x,
        bounds.height - candidate.y,
      );
      const maxEdgeDistance = Math.max(1, Math.min(bounds.width, bounds.height) * 0.5);
      const edgeNormalized = clamp(edgeDistance / maxEdgeDistance, 0, 1);
      const edgeScore =
        profile.edgePreference >= 0 ? 1 - edgeNormalized : edgeNormalized;
      const crowding = getCrowdingAt?.(
        candidate.x,
        candidate.y,
        config.crowdAvoidRadius,
        this,
      );
      const affinity = this.typeSpec?.socialAffinity ?? 0;
      const affinityScale = 1 - affinity; // positive affinity reduces crowd penalty
      const score =
        travelDistance * 0.42 -
        anchorDistance * 0.18 +
        edgeScore * Math.abs(profile.edgePreference) * 42 +
        -(crowding?.score ?? 0) * config.crowdTargetPenalty * affinityScale +
        Math.random() * 18;

      if (travelDistance >= minDistance * 0.5 && score > bestScore) {
        chosen = candidate;
        bestScore = score;
      }
    }

    this.roamTarget =
      chosen ?? {
        x: clamp(anchor.x, padding, bounds.width - padding),
        y: clamp(anchor.y, padding, bounds.height - padding),
      };
    this.retargetTimer = 2.8 + Math.random() * 3.4;
  }

  private getWallAvoidance(bounds: { width: number; height: number }, config: typeof DEFAULT_GAME_CONFIG) {
    let x = 0;
    let y = 0;
    const distance = config.wallAvoidDistance;

    if (this.x < distance) {
      x += 1 - this.x / distance;
    }
    if (this.x > bounds.width - distance) {
      x -= 1 - (bounds.width - this.x) / distance;
    }
    if (this.y < distance) {
      y += 1 - this.y / distance;
    }
    if (this.y > bounds.height - distance) {
      y -= 1 - (bounds.height - this.y) / distance;
    }

    const normalized = normalizeVector(x, y);
    return {
      x: normalized.x * config.wallAvoidStrength,
      y: normalized.y * config.wallAvoidStrength,
    };
  }

  update(dt: number, ctx: BugUpdateContext) {
    const config = ctx.config ?? DEFAULT_GAME_CONFIG;
    const bounds = ctx.bounds ?? { width: 800, height: 600 };
    const crawlProfile = this.getCrawlProfile();

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
    this.updateHomeAnchor(dt, bounds);
    this.retargetTimer -= dt;
    if (this.fleeTimer != null) {
      this.fleeTimer = Math.max(0, this.fleeTimer - dt);
      if (this.fleeTimer === 0) {
        this.fleeTimer = null;
        this.state = "patrol";
      }
    }

    if (!this.roamTarget || this.retargetTimer <= 0) {
      this.chooseRoamTarget(bounds, config, ctx.getCrowdingAt);
    }

    const distanceToTarget = this.roamTarget
      ? getLength(this.roamTarget.x - this.x, this.roamTarget.y - this.y)
      : 0;
    if (distanceToTarget <= config.targetReachRadius) {
      this.chooseRoamTarget(bounds, config, ctx.getCrowdingAt);
    }

    const targetX = ctx.targetX ?? null;
    const targetY = ctx.targetY ?? null;
    const hasThreat =
      targetX != null &&
      targetY != null &&
      getLength(this.x - targetX, this.y - targetY) <= config.fleeRadius * 1.8;

    const desired = { x: 0, y: 0 };
    if (hasThreat) {
      this.state = "flee";
      this.fleeTimer = 0.45;
      const away = normalizeVector(this.x - targetX, this.y - targetY);
      desired.x += away.x * 1.8;
      desired.y += away.y * 1.8;
    } else if (this.roamTarget) {
      this.state = this.fleeTimer ? "flee" : "patrol";
      const toTarget = normalizeVector(
        this.roamTarget.x - this.x,
        this.roamTarget.y - this.y,
      );
      desired.x += toTarget.x;
      desired.y += toTarget.y;
    }

    const wallAvoidance = this.getWallAvoidance(bounds, config);
    desired.x += wallAvoidance.x;
    desired.y += wallAvoidance.y;

    // detect if the entity is being pushed hard into a wall and not making progress
    const wallMag = Math.hypot(wallAvoidance.x, wallAvoidance.y);
    const speedNow = getLength(this.vx, this.vy);
    const speedThreshold = Math.max(6, config.baseSpeed * 0.22);
    if (wallMag > 0.45 && speedNow < speedThreshold) {
      this.stuckTimer += dt;
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    }

    if (this.stuckTimer > 0.18) {
      // rotate by a right-angle multiple and move on
      const choices = [Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
      const rot = choices[Math.floor(Math.random() * choices.length)];
      this.heading = normalizeAngle(this.heading + rot);
      const desiredSpeed = config.baseSpeed * this.cruiseSpeed * 0.6;
      this.vx = Math.cos(this.heading) * desiredSpeed;
      this.vy = Math.sin(this.heading) * desiredSpeed;
      // nudge slightly inside bounds
      this.x = clamp(this.x + Math.cos(this.heading) * 8, 4, bounds.width - 4);
      this.y = clamp(this.y + Math.sin(this.heading) * 8, 4, bounds.height - 4);
      this.roamTarget = null;
      this.retargetTimer = 0.25;
      this.stuckTimer = 0;
    }

    const crowding = ctx.getCrowdingAt?.(
      this.x,
      this.y,
      config.crowdAvoidRadius,
      this,
    );
    if (crowding && crowding.score > 0.55) {
      const awayFromCrowd = normalizeVector(
        this.x - crowding.centerX,
        this.y - crowding.centerY,
      );
      const affinity = this.typeSpec?.socialAffinity ?? 0;
      const steerScale = config.crowdSteerStrength * crowding.score * (1 - affinity);
      desired.x += awayFromCrowd.x * steerScale;
      desired.y += awayFromCrowd.y * steerScale;

      if (
        crowding.score > config.crowdRepathThreshold &&
        this.state === "patrol" &&
        this.retargetTimer > config.crowdRepathDelay
      ) {
        this.retargetTimer = config.crowdRepathDelay;
      }
    }

    const neighbors = ctx.getNeighbors(this, config.separationRadius);
    if (neighbors.length > 0) {
      let avoidX = 0;
      let avoidY = 0;
      for (const neighbor of neighbors) {
        const dx = this.x - neighbor.x;
        const dy = this.y - neighbor.y;
        const distance = Math.max(1, getLength(dx, dy));
        avoidX += dx / distance;
        avoidY += dy / distance;
      }
      const localAvoidance = normalizeVector(avoidX, avoidY);
      desired.x +=
        localAvoidance.x * config.separationStrength * crawlProfile.separationMultiplier;
      desired.y +=
        localAvoidance.y * config.separationStrength * crawlProfile.separationMultiplier;
    }

    const noiseTime = this.motionTime * crawlProfile.noiseFrequency;
    const headingNoise = perlin1D(noiseTime + this.seed * 11.7, this.seed * 19.3);
    const lateralNoise = perlin1D(noiseTime + this.seed * 23.1 + 17.4, this.seed * 7.9);
    const forwardNoise = perlin1D(noiseTime * 0.73 + this.seed * 5.3 + 41.2, this.seed * 13.7);

    this.wanderAngle = headingNoise * crawlProfile.noiseTurnStrength;
    desired.x +=
      Math.cos(this.heading + this.wanderAngle) * 0.22 * crawlProfile.wanderMultiplier;
    desired.y +=
      Math.sin(this.heading + this.wanderAngle) * 0.22 * crawlProfile.wanderMultiplier;

    const lateralAngle = this.heading + Math.PI / 2;
    desired.x += Math.cos(lateralAngle) * lateralNoise * crawlProfile.noiseLateralStrength;
    desired.y += Math.sin(lateralAngle) * lateralNoise * crawlProfile.noiseLateralStrength;
    desired.x += Math.cos(this.heading) * forwardNoise * crawlProfile.noiseForwardStrength;
    desired.y += Math.sin(this.heading) * forwardNoise * crawlProfile.noiseForwardStrength;

    const desiredDirection = normalizeVector(desired.x, desired.y);
    const desiredHeading =
      desiredDirection.x === 0 && desiredDirection.y === 0
        ? this.heading
        : Math.atan2(desiredDirection.y, desiredDirection.x);
    const maxTurn = config.turnSpeed * this.turnRate * crawlProfile.turnMultiplier * dt;
    this.heading += clamp(
      getAngleDelta(this.heading, desiredHeading),
      -maxTurn,
      maxTurn,
    );
    this.heading = normalizeAngle(this.heading);

    const arrivalDistance = this.roamTarget
      ? getLength(this.roamTarget.x - this.x, this.roamTarget.y - this.y)
      : config.targetReachRadius * 2;
    const arrivalScale = clamp(
      arrivalDistance / Math.max(config.targetReachRadius * 3, 1),
      0.55,
      1,
    );
    const speedBoost = this.state === "flee" ? 1.28 : 1;
    const desiredSpeed =
      config.baseSpeed *
      this.cruiseSpeed *
      crawlProfile.speedMultiplier *
      arrivalScale *
      speedBoost;
    const currentSpeed = getLength(this.vx, this.vy);
    const nextSpeed = currentSpeed + (desiredSpeed - currentSpeed) * Math.min(1, dt * 4.5);
    this.vx = Math.cos(this.heading) * nextSpeed;
    this.vy = Math.sin(this.heading) * nextSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = 6;
    if (this.x < margin) {
      this.x = margin;
      this.chooseRoamTarget(bounds, config, ctx.getCrowdingAt);
    }
    if (this.x > bounds.width - margin) {
      this.x = bounds.width - margin;
      this.chooseRoamTarget(bounds, config, ctx.getCrowdingAt);
    }
    if (this.y < margin) {
      this.y = margin;
      this.chooseRoamTarget(bounds, config, ctx.getCrowdingAt);
    }
    if (this.y > bounds.height - margin) {
      this.y = bounds.height - margin;
      this.chooseRoamTarget(bounds, config, ctx.getCrowdingAt);
    }

    this.opacity = 1;
    this.size = this.baseSize;
  }

  onHit(damage = 1) {
    if (this.state === "dead" || this.state === "dying") {
      return { defeated: false, remainingHp: 0 };
    }

    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) {
      this.state = "dying";
      this.deathProgress = 0;
      this.vx = 0;
      this.vy = 0;
      return { defeated: true, remainingHp: 0 };
    }

    this.state = "flee";
    this.fleeTimer = 0.9 + Math.random() * 0.8;
    this.roamTarget = null;
    this.retargetTimer = 0;
    this.typeSpec = getCodex()[this.variant as string] ?? null;
    return { defeated: false, remainingHp: this.hp };
  }

  revive(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const speed = DEFAULT_GAME_CONFIG.baseSpeed * (0.75 + Math.random() * 0.35);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.heading = angle;
    this.hp = this.maxHp;
    this.state = "patrol";
    this.deathProgress = 0;
    this.fleeTimer = null;
    this.roamTarget = null;
    this.retargetTimer = 0;
    this.homeAnchor = null;
    this.resetAnchorDriftTimer();
    this.motionTime = Math.random() * 100;
    this.opacity = 1;
    this.size = this.baseSize;
    this.typeSpec = getCodex()[this.variant as string] ?? null;
  }

  render(ctx2d: CanvasRenderingContext2D, alpha = 1) {
    const renderX = this.prevX * (1 - alpha) + this.x * alpha;
    const renderY = this.prevY * (1 - alpha) + this.y * alpha;
    const color = this.typeSpec?.color;
    const sizeMultiplier = this.typeSpec?.size ?? 1;
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
