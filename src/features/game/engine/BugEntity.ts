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
  /** Speed-slow status effect applied by Freeze Cone. */
  slow: { multiplier: number; expiresAt: number } | null;
  /** Poison DOT applied by Bug Spray. Source weapon ID for kill attribution. */
  poison: { dps: number; expiresAt: number; accumulatedDmg: number; sourceWeaponId?: string } | null;
  /** Burn DOT applied by Flamethrower. Source weapon ID for kill attribution. */
  burn: {
    dps: number;
    expiresAt: number;
    accumulatedDmg: number;
    decayPerSecond: number;
    sourceWeaponId?: string;
  } | null;
  /** Ensnare applied by Static Net — stops all movement; next click = instakill. */
  ensnare: { expiresAt: number; canInstakill: boolean } | null;
  /** Charged by Chain Zap — amplifies damage taken (×1.1) and enables network propagation. */
  charged: { expiresAt: number } | null;
  /** Marked by Garbage Collector — amplifies damage taken (×1.2) and triggers execution. */
  marked: { expiresAt: number } | null;
  /** Unstable — consumed by Event Horizon; amplifies mark bonus to ×1.4 when combined. */
  unstable: { expiresAt: number } | null;
  /** Looped — periodic echo DOT damage. */
  looped: { dps: number; expiresAt: number; accumulatedDmg: number } | null;
  /** Ally state — bug is temporarily converted; stops targeting the player base. */
  ally: { expiresAt: number } | null;
  /** Whether this bug's eventual death has already been credited to the player. */
  deathCredited: boolean;
  /** Weapon ID that will receive kill credit for any pending DOT death. */
  dotSourceWeaponId: string | null;

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
    this.slow = null;
    this.poison = null;
    this.burn = null;
    this.ensnare = null;
    this.charged = null;
    this.marked = null;
    this.unstable = null;
    this.looped = null;
    this.ally = null;
    this.deathCredited = false;
    this.dotSourceWeaponId = null;
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

    const now = performance.now();
    const isBurnPanicking = this.burn !== null && now < this.burn.expiresAt && this.burn.dps > 0.3;
    if (isBurnPanicking) {
      desired.x += (Math.random() - 0.5) * 1.6;
      desired.y += (Math.random() - 0.5) * 1.6;
    }

    const desiredDirection = normalizeVector(desired.x, desired.y);
    const desiredHeading =
      desiredDirection.x === 0 && desiredDirection.y === 0
        ? this.heading
        : Math.atan2(desiredDirection.y, desiredDirection.x);
    const turnMultiplier = isBurnPanicking ? 1.8 : 1;
    const maxTurn = config.turnSpeed * this.turnRate * turnMultiplier * dt;
    this.heading += clamp(
      getAngleDelta(this.heading, desiredHeading),
      -maxTurn,
      maxTurn,
    );
    this.heading = normalizeAngle(this.heading);

    const edgeFactor = 1 - wallSteering.pressure * 0.12;
    const speedBoost = this.state === "flee" ? 1.22 : 1;
    // Apply status effects
    if (this.slow && now >= this.slow.expiresAt) this.slow = null;
    if (this.ensnare && now >= this.ensnare.expiresAt) this.ensnare = null;
    if (this.poison && now >= this.poison.expiresAt) this.poison = null;
    if (this.burn && now >= this.burn.expiresAt) this.burn = null;
    if (this.charged && now >= this.charged.expiresAt) this.charged = null;
    if (this.marked && now >= this.marked.expiresAt) this.marked = null;
    if (this.unstable && now >= this.unstable.expiresAt) this.unstable = null;
    if (this.looped && now >= this.looped.expiresAt) this.looped = null;
    if (this.ally && now >= this.ally.expiresAt) this.ally = null;

    // Tick poison DOT damage
    if (this.poison && (this.state as BugState) !== "dying" && (this.state as BugState) !== "dead") {
      this.poison.accumulatedDmg += this.poison.dps * dt;
      if (this.poison.accumulatedDmg >= 1) {
        const dmgToApply = Math.floor(this.poison.accumulatedDmg);
        this.poison.accumulatedDmg -= dmgToApply;
        this.lastHitTime = performance.now();
        this.hp = Math.max(0, this.hp - dmgToApply);
        if (this.hp === 0) {
          this.state = "dying";
          this.deathProgress = 0;
          this.vx = 0;
          this.vy = 0;
          this.deathCredited = false;
        }
      }
    }

    // Tick burn DOT damage with exponential decay so bugs still burn after leaving flame
    if (this.burn && (this.state as BugState) !== "dying" && (this.state as BugState) !== "dead") {
      this.burn.dps *= Math.exp(-this.burn.decayPerSecond * dt);
      this.burn.accumulatedDmg += this.burn.dps * dt;
      if (this.burn.accumulatedDmg >= 1) {
        const dmgToApply = Math.floor(this.burn.accumulatedDmg);
        this.burn.accumulatedDmg -= dmgToApply;
        this.lastHitTime = performance.now();
        this.hp = Math.max(0, this.hp - dmgToApply);
        if (this.hp === 0) {
          this.state = "dying";
          this.deathProgress = 0;
          this.vx = 0;
          this.vy = 0;
          this.deathCredited = false;
        }
      }
      if (this.burn && this.burn.dps < 0.05) {
        this.burn = null;
      }
    }

    // Tick looped echo DOT damage
    if (this.looped && (this.state as BugState) !== "dying" && (this.state as BugState) !== "dead") {
      this.looped.accumulatedDmg += this.looped.dps * dt;
      if (this.looped.accumulatedDmg >= 1) {
        const dmgToApply = Math.floor(this.looped.accumulatedDmg);
        this.looped.accumulatedDmg -= dmgToApply;
        this.lastHitTime = performance.now();
        this.hp = Math.max(0, this.hp - dmgToApply);
        if (this.hp === 0) {
          this.state = "dying";
          this.deathProgress = 0;
          this.vx = 0;
          this.vy = 0;
          this.deathCredited = false;
        }
      }
    }

    // Ensnared bugs cannot move at all
    if (this.ensnare && now < this.ensnare.expiresAt) {
      this.vx = 0;
      this.vy = 0;
      this.opacity = 1;
      this.size = this.baseSize;
      return;
    }

    const slowMult = this.slow ? this.slow.multiplier : 1;
    const burnSpeedBoost = isBurnPanicking ? 1.18 : 1;
    const desiredSpeed = config.baseSpeed * this.cruiseSpeed * edgeFactor * speedBoost * slowMult * burnSpeedBoost;
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
      return { defeated: false, remainingHp: 0, pointValue: 0, frozen: false, poisoned: false, burning: false, ensnared: false };
    }

    const now = performance.now();
    const frozen = this.slow !== null && now < this.slow.expiresAt;
    const poisoned = this.poison !== null && now < this.poison.expiresAt;
    const burning = this.burn !== null && now < this.burn.expiresAt;
    const ensnared = this.ensnare !== null && now < this.ensnare.expiresAt;
    const pointValue = this.typeSpec?.pointValue ?? 1;

    this.lastHitTime = performance.now();

    // Status damage multipliers
    const now2 = performance.now();
    const isCharged = this.charged !== null && now2 < this.charged.expiresAt;
    const isMarked = this.marked !== null && now2 < this.marked.expiresAt;
    const isUnstable = this.unstable !== null && now2 < this.unstable.expiresAt;
    let multiplier = 1.0;
    if (frozen) multiplier *= 1.5;
    if (isMarked) multiplier *= (isUnstable ? 1.4 : 1.2);
    if (isCharged) multiplier *= 1.1;

    // Ensnared bugs can be instakilled by a click
    const effectiveDamage = ensnared ? this.maxHp : Math.round(damage * multiplier);
    this.hp = Math.max(0, this.hp - effectiveDamage);
    if (this.hp === 0) {
      this.state = "dying";
      this.deathProgress = 0;
      this.vx = 0;
      this.vy = 0;
      this.ensnare = null;
      return { defeated: true, remainingHp: 0, pointValue, frozen, poisoned, burning, ensnared };
    }

    this.state = "flee";
    this.fleeTimer = 0.9 + Math.random() * 0.5;
    this.syncTypeSpec();
    this.handleStatusInteractions();
    return { defeated: false, remainingHp: this.hp, pointValue: 0, frozen, poisoned, burning, ensnared };
  }

  /** Handle status combo interactions after a hit. */
  handleStatusInteractions() {
    const now = performance.now();
    const isCharged = this.charged !== null && now < this.charged.expiresAt;
    const isBurning = this.burn !== null && now < this.burn.expiresAt;
    const isFrozen = this.slow !== null && now < this.slow.expiresAt;

    // burning + charged → detonation: extra damage burst, clears charged
    if (isBurning && isCharged) {
      this.hp = Math.max(0, this.hp - 3);
      this.charged = null;
      if (this.hp === 0 && this.state !== "dying" && this.state !== "dead") {
        this.state = "dying";
        this.deathProgress = 0;
        this.vx = 0;
        this.vy = 0;
        this.deathCredited = false;
      }
    }

    // frozen + burning → extinguish burn, deal 2 bonus damage
    if (isFrozen && isBurning) {
      this.burn = null;
      this.hp = Math.max(0, this.hp - 2);
      if (this.hp === 0 && this.state !== "dying" && this.state !== "dead") {
        this.state = "dying";
        this.deathProgress = 0;
        this.vx = 0;
        this.vy = 0;
        this.deathCredited = false;
      }
    }
  }

  /** Apply a Freeze Cone slow. Stacks to extend duration. */
  applyFreeze(multiplier: number, durationMs: number) {
    const now = performance.now();
    if (this.slow && now < this.slow.expiresAt) {
      // Extend: add remaining time + new duration
      this.slow.expiresAt = this.slow.expiresAt + durationMs;
    } else {
      this.slow = { multiplier, expiresAt: now + durationMs };
    }
  }

  /** Apply Bug Spray poison DOT. Stacks to extend duration. */
  applyPoison(dps: number, durationMs: number) {
    const now = performance.now();
    if (this.poison && now < this.poison.expiresAt) {
      this.poison.expiresAt = this.poison.expiresAt + durationMs;
    } else {
      this.poison = { dps, expiresAt: now + durationMs, accumulatedDmg: 0 };
    }
  }

  /** Apply flamethrower burn. Reapplication refreshes duration and keeps the stronger flame. */
  applyBurn(dps: number, durationMs: number, decayPerSecond = 3.2) {
    const now = performance.now();
    if (this.burn && now < this.burn.expiresAt) {
      this.burn.dps = Math.max(this.burn.dps, dps);
      this.burn.decayPerSecond = Math.max(this.burn.decayPerSecond, decayPerSecond);
      this.burn.expiresAt = Math.max(this.burn.expiresAt, now + durationMs);
    } else {
      this.burn = {
        dps,
        expiresAt: now + durationMs,
        accumulatedDmg: 0,
        decayPerSecond,
      };
    }
  }

  /** Apply Chain Zap charged status — amplifies damage taken (×1.1), enables network propagation. */
  applyCharged(durationMs: number) {
    const now = performance.now();
    if (this.charged && now < this.charged.expiresAt) {
      this.charged.expiresAt = this.charged.expiresAt + durationMs;
    } else {
      this.charged = { expiresAt: now + durationMs };
    }
  }

  /** Apply Garbage Collector mark — amplifies damage (×1.2, or ×1.4 when unstable). */
  applyMarked(durationMs: number) {
    const now = performance.now();
    if (this.marked && now < this.marked.expiresAt) {
      this.marked.expiresAt = this.marked.expiresAt + durationMs;
    } else {
      this.marked = { expiresAt: now + durationMs };
    }
  }

  /** Apply unstable status — consumed by Event Horizon; doubles mark bonus when combined. */
  applyUnstable(durationMs: number) {
    const now = performance.now();
    if (this.unstable && now < this.unstable.expiresAt) {
      this.unstable.expiresAt = this.unstable.expiresAt + durationMs;
    } else {
      this.unstable = { expiresAt: now + durationMs };
    }
  }

  /** Apply looped echo DOT — periodic damage over time. */
  applyLooped(dps: number, durationMs: number) {
    const now = performance.now();
    if (this.looped && now < this.looped.expiresAt) {
      this.looped.dps = Math.max(this.looped.dps, dps);
      this.looped.expiresAt = Math.max(this.looped.expiresAt, now + durationMs);
    } else {
      this.looped = { dps, expiresAt: now + durationMs, accumulatedDmg: 0 };
    }
  }

  /** Apply ally state — bug stops targeting the player base. */
  applyAlly(durationMs: number) {
    const now = performance.now();
    this.ally = { expiresAt: now + durationMs };
    // Stop movement, enter a neutral state
    this.state = "patrol";
    this.fleeTimer = null;
  }

  /** Apply Static Net ensnare — completely immobilises; next hit = instakill. */
  applyEnsnare(durationMs: number) {
    this.ensnare = { expiresAt: performance.now() + durationMs, canInstakill: true };
    // Stop movement immediately
    this.vx = 0;
    this.vy = 0;
    this.state = "patrol";
    this.fleeTimer = null;
  }

  /** Apply an impulse and trigger flee state (Pulse Cannon knockback). */
  knockback(dx: number, dy: number) {
    if (this.state === "dying" || this.state === "dead") return;
    this.vx += dx;
    this.vy += dy;
    this.heading = Math.atan2(this.vy, this.vx);
    this.state = "flee";
    this.fleeTimer = (this.fleeTimer ?? 0) + 1.0;
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
    this.slow = null;
    this.poison = null;
    this.burn = null;
    this.ensnare = null;
    this.charged = null;
    this.marked = null;
    this.unstable = null;
    this.looped = null;
    this.ally = null;
    this.dotSourceWeaponId = null;
    this.deathCredited = false;
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
    const now = performance.now();
    drawBugSprite(ctx2d, {
      x: renderX,
      y: renderY,
      size: this.size * sizeMultiplier,
      rotation: this.heading,
      opacity: this.opacity,
      variant: this.variant,
      color: color ?? undefined,
      timeMs: now,
      statusFlags: {
        ally: this.ally !== null && now < this.ally.expiresAt,
        burn: this.burn !== null && now < this.burn.expiresAt,
        charged: this.charged !== null && now < this.charged.expiresAt,
        ensnare: this.ensnare !== null && now < this.ensnare.expiresAt,
        freeze: this.slow !== null && now < this.slow.expiresAt,
        marked: this.marked !== null && now < this.marked.expiresAt,
        poison: this.poison !== null && now < this.poison.expiresAt,
        unstable: this.unstable !== null && now < this.unstable.expiresAt,
      },
    });
  }
}