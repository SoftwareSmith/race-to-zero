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
  edgeOrbitTimer: number;
  edgeEscapeCooldown: number;
  edgeRecoveryTimer: number;

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
    this.edgeOrbitTimer = 0;
    this.edgeEscapeCooldown = 0;
    this.edgeRecoveryTimer = 0;
  }

  private getCrawlProfile() {
    return getProfileForVariant(this.variant) ?? ({} as CrawlProfile);
  }

  private syncTypeSpec() {
    this.typeSpec = getCodex()[this.variant as string] ?? null;
    return this.typeSpec;
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
    const typeSpec = this.syncTypeSpec();
    this.ensureHomeAnchor(bounds);
    const padding = 8;
    const minDistance = Math.min(
      config.roamTargetMinDistance,
      Math.max(bounds.width, bounds.height) * 0.45,
    );

    let chosen: Vec2 | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const anchor = this.homeAnchor!;
    const centerX = bounds.width * 0.5;
    const centerY = bounds.height * 0.5;
    for (let attempt = 0; attempt < 10; attempt += 1) {
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
      const centerDistance = getLength(candidate.x - centerX, candidate.y - centerY);
      const maxCenterDistance = Math.max(1, getLength(centerX, centerY));
      const centerBiasScore = 1 - clamp(centerDistance / maxCenterDistance, 0, 1);
      const crowding = getCrowdingAt?.(
        candidate.x,
        candidate.y,
        config.crowdAvoidRadius,
        this,
      );
      const affinity = typeSpec?.socialAffinity ?? 0;
      const affinityScale = 1 - affinity; // positive affinity reduces crowd penalty
      const score =
        travelDistance * 0.24 -
        anchorDistance * 0.08 +
        edgeScore * Math.abs(profile.edgePreference) * 8 +
        centerBiasScore * 4.5 +
        -(crowding?.score ?? 0) * config.crowdTargetPenalty * affinityScale +
        Math.random() * 32;

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
    // proactive avoidance: use a larger sensing band so entities steer before touching the wall
    const distance = Math.max(config.wallAvoidDistance * 1.6, 24);
    const push = (amount: number) => amount * amount;

    if (this.x < distance) {
      x += push(1 - this.x / distance);
    }
    if (this.x > bounds.width - distance) {
      x -= push(1 - (bounds.width - this.x) / distance);
    }
    if (this.y < distance) {
      y += push(1 - this.y / distance);
    }
    if (this.y > bounds.height - distance) {
      y -= push(1 - (bounds.height - this.y) / distance);
    }

    const normalized = normalizeVector(x, y);
    // slightly amplify the returned avoidance so bugs begin turning earlier
    const amplify = 1.25;
    return {
      x: normalized.x * config.wallAvoidStrength * Math.max(Math.abs(x), 0.2) * amplify,
      y: normalized.y * config.wallAvoidStrength * Math.max(Math.abs(y), 0.2) * amplify,
    };
  }

  private getBoundaryRecovery(bounds: { width: number; height: number }, config: typeof DEFAULT_GAME_CONFIG) {
    const margin = 10;
    const safeBand = Math.max(44, config.wallAvoidDistance * 2.1);
    const horizontalRange = Math.max(1, safeBand - margin);
    const verticalRange = Math.max(1, safeBand - margin);
    const leftPressure = this.x <= safeBand ? 1 - clamp((this.x - margin) / horizontalRange, 0, 1) : 0;
    const rightPressure = this.x >= bounds.width - safeBand
      ? 1 - clamp((bounds.width - margin - this.x) / horizontalRange, 0, 1)
      : 0;
    const topPressure = this.y <= safeBand ? 1 - clamp((this.y - margin) / verticalRange, 0, 1) : 0;
    const bottomPressure = this.y >= bounds.height - safeBand
      ? 1 - clamp((bounds.height - margin - this.y) / verticalRange, 0, 1)
      : 0;

    const inwardX = leftPressure * leftPressure * 2.8 - rightPressure * rightPressure * 2.8;
    const inwardY = topPressure * topPressure * 2.8 - bottomPressure * bottomPressure * 2.8;
    const pressure = Math.max(leftPressure, rightPressure, topPressure, bottomPressure);

    return {
      x: inwardX,
      y: inwardY,
      pressure,
    };
  }

  private getAnchorInfluence(bounds: { width: number; height: number }) {
    this.ensureHomeAnchor(bounds);
    if (!this.homeAnchor) {
      return { x: 0, y: 0 };
    }

    const toAnchor = normalizeVector(
      this.homeAnchor.x - this.x,
      this.homeAnchor.y - this.y,
    );
    const distanceToAnchor = getLength(
      this.homeAnchor.x - this.x,
      this.homeAnchor.y - this.y,
    );
    const profile = this.getCrawlProfile();
    const radius = Math.max(profile.roamRadius, 48);
    const pull = clamp(distanceToAnchor / radius, 0.08, 0.9);

    return {
      x: toAnchor.x * pull,
      y: toAnchor.y * pull,
    };
  }

  private getPreferredRegionInfluence(bounds: { width: number; height: number }) {
    const typeSpec = this.syncTypeSpec();
    const preferredRegion = typeSpec?.preferredRegion ?? "middle";
    const centerX = bounds.width * 0.5;
    const centerY = bounds.height * 0.5;
    const toCenter = normalizeVector(centerX - this.x, centerY - this.y);

    if (preferredRegion === "interior") {
      return {
        x: toCenter.x * 0.3,
        y: toCenter.y * 0.3,
      };
    }

    if (preferredRegion === "edge") {
      const edgeInset = Math.max(42, Math.min(bounds.width, bounds.height) * 0.14);
      const distances = [
        { wall: "left", value: this.x },
        { wall: "right", value: bounds.width - this.x },
        { wall: "top", value: this.y },
        { wall: "bottom", value: bounds.height - this.y },
      ] as const;
      const nearestWall = distances.reduce((closest, entry) =>
        entry.value < closest.value ? entry : closest,
      );
      const target = { x: this.x, y: this.y };

      if (nearestWall.wall === "left") {
        target.x = edgeInset;
      }
      if (nearestWall.wall === "right") {
        target.x = bounds.width - edgeInset;
      }
      if (nearestWall.wall === "top") {
        target.y = edgeInset;
      }
      if (nearestWall.wall === "bottom") {
        target.y = bounds.height - edgeInset;
      }

      const toEdgeLane = normalizeVector(target.x - this.x, target.y - this.y);
      return {
        x: toEdgeLane.x * 0.28,
        y: toEdgeLane.y * 0.28,
      };
    }

    return {
      x: toCenter.x * 0.12,
      y: toCenter.y * 0.12,
    };
  }

  update(dt: number, ctx: BugUpdateContext) {
    const config = ctx.config ?? DEFAULT_GAME_CONFIG;
    const bounds = ctx.bounds ?? { width: 800, height: 600 };
    const crawlProfile = this.getCrawlProfile();
    const typeSpec = this.syncTypeSpec();

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

    if (this.retargetTimer <= 0) {
      this.homeAnchor = this.samplePointInRegion(bounds, this.chooseWeightedRegion());
      this.retargetTimer = 3.8 + Math.random() * 4.2;
    }

    // decay any temporary edge-recovery bias
    if (this.edgeRecoveryTimer > 0) {
      this.edgeRecoveryTimer = Math.max(0, this.edgeRecoveryTimer - dt);
    }

    const targetX = ctx.targetX ?? null;
    const targetY = ctx.targetY ?? null;
    const hasThreat =
      targetX != null &&
      targetY != null &&
      getLength(this.x - targetX, this.y - targetY) <= config.fleeRadius * 1.8;

    const desired = { x: 0, y: 0 };
    const boundaryRecovery = this.getBoundaryRecovery(bounds, config);
    if (hasThreat) {
      this.state = "flee";
      this.fleeTimer = 0.45;
      const away = normalizeVector(this.x - targetX, this.y - targetY);
      desired.x += away.x * 1.8;
      desired.y += away.y * 1.8;
    } else {
      this.state = this.fleeTimer ? "flee" : "patrol";
      const anchorInfluence = this.getAnchorInfluence(bounds);
      const regionInfluence = this.getPreferredRegionInfluence(bounds);
      const forwardWeight = boundaryRecovery.pressure > 0.2 ? 0.12 : 0.38;
      desired.x += Math.cos(this.heading) * forwardWeight;
      desired.y += Math.sin(this.heading) * forwardWeight;
      desired.x += anchorInfluence.x * 1.05;
      desired.y += anchorInfluence.y * 1.05;
      desired.x += regionInfluence.x;
      desired.y += regionInfluence.y;
    }

    const wallAvoidance = this.getWallAvoidance(bounds, config);
    desired.x += boundaryRecovery.x;
    desired.y += boundaryRecovery.y;
    desired.x += wallAvoidance.x;
    desired.y += wallAvoidance.y;

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
      const affinity = typeSpec?.socialAffinity ?? 0;
      const steerScale = config.crowdSteerStrength * crowding.score * (1 - affinity);
      desired.x += awayFromCrowd.x * steerScale;
      desired.y += awayFromCrowd.y * steerScale;
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
    const roamNoiseX = perlin1D(noiseTime * 0.51 + this.seed * 29.4, this.seed * 3.7);
    const roamNoiseY = perlin1D(noiseTime * 0.61 + this.seed * 37.2, this.seed * 5.1);

    this.wanderAngle = headingNoise * crawlProfile.noiseTurnStrength;
    desired.x +=
      Math.cos(this.heading + this.wanderAngle) *
      (0.22 + config.wanderStrength * 0.35) *
      crawlProfile.wanderMultiplier;
    desired.y +=
      Math.sin(this.heading + this.wanderAngle) *
      (0.22 + config.wanderStrength * 0.35) *
      crawlProfile.wanderMultiplier;

    const lateralAngle = this.heading + Math.PI / 2;
    desired.x += Math.cos(lateralAngle) * lateralNoise * crawlProfile.noiseLateralStrength;
    desired.y += Math.sin(lateralAngle) * lateralNoise * crawlProfile.noiseLateralStrength;
    desired.x += Math.cos(this.heading) * forwardNoise * crawlProfile.noiseForwardStrength;
    desired.y += Math.sin(this.heading) * forwardNoise * crawlProfile.noiseForwardStrength;
    desired.x += roamNoiseX * 0.18;
    desired.y += roamNoiseY * 0.18;

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

    const edgeDistance = Math.min(
      this.x,
      this.y,
      bounds.width - this.x,
      bounds.height - this.y,
    );
    const edgeSlowdown = clamp(edgeDistance / Math.max(config.wallAvoidDistance * 1.4, 1), 0.9, 1);
    const speedBoost = this.state === "flee" ? 1.28 : 1;
    const desiredSpeed =
      config.baseSpeed *
      this.cruiseSpeed *
      crawlProfile.speedMultiplier *
      edgeSlowdown *
      speedBoost;
    const currentSpeed = getLength(this.vx, this.vy);
    const nextSpeed = currentSpeed + (desiredSpeed - currentSpeed) * Math.min(1, dt * 4.5);
    this.vx = Math.cos(this.heading) * nextSpeed;
    this.vy = Math.sin(this.heading) * nextSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const margin = 10;
    let clampedToBoundary = false;
    if (this.x < margin) {
      this.x = margin;
      clampedToBoundary = true;
    }
    if (this.x > bounds.width - margin) {
      this.x = bounds.width - margin;
      clampedToBoundary = true;
    }
    if (this.y < margin) {
      this.y = margin;
      clampedToBoundary = true;
    }
    if (this.y > bounds.height - margin) {
      this.y = bounds.height - margin;
      clampedToBoundary = true;
    }

    if (clampedToBoundary || boundaryRecovery.pressure > 0.72) {
      // Choose the nearest wall and pick a heading that points away from it with some randomized jitter.
      const distLeft = this.x;
      const distRight = bounds.width - this.x;
      const distTop = this.y;
      const distBottom = bounds.height - this.y;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);
      let baseDir = Math.PI / 2; // default down
      if (minDist === distLeft) baseDir = 0; // point right
      else if (minDist === distRight) baseDir = Math.PI; // point left
      else if (minDist === distTop) baseDir = Math.PI / 2; // point down
      else if (minDist === distBottom) baseDir = -Math.PI / 2; // point up

      // jitter +/- 30 degrees (smaller turns) so we head more inward and avoid large arcs
      const jitter = (Math.random() - 0.5) * (Math.PI / 6);
      this.heading = normalizeAngle(baseDir + jitter);

      // set a longer recovery window so the entity biases toward the field center
      this.edgeRecoveryTimer = 3.2 + Math.random() * 2.8;

      // bias the entity's home anchor toward the interior temporarily to avoid repeated wall arcs
      this.homeAnchor = { x: bounds.width * 0.5, y: bounds.height * 0.5 };
      this.retargetTimer = 4 + Math.random() * 3;
      this.edgeEscapeCooldown = 1.8;

      const recoverySpeed = Math.max(desiredSpeed * 0.92, config.baseSpeed * 0.8);
      this.vx = Math.cos(this.heading) * recoverySpeed;
      this.vy = Math.sin(this.heading) * recoverySpeed;

      // nudge position so entities don't stay exactly on the edge
      this.x = clamp(this.x + this.vx * dt * 1.2, margin, bounds.width - margin);
      this.y = clamp(this.y + this.vy * dt * 1.2, margin, bounds.height - margin);
    }

    // while in edge-recovery, add a smooth inward bias plus Perlin jitter so entities move toward center for a while
    if (this.edgeRecoveryTimer > 0) {
      const toCenter = normalizeVector(bounds.width * 0.5 - this.x, bounds.height * 0.5 - this.y);
      const recoveryStrength = Math.min(1, this.edgeRecoveryTimer / 4.2);
      const inwardBias = 1.2 * recoveryStrength; // stronger inward bias while recovering
      desired.x += toCenter.x * inwardBias;
      desired.y += toCenter.y * inwardBias;

      // Perlin-based gentle wander while recovering to avoid strict straight-line movement
      const recoverNoise = perlin1D(this.motionTime * 0.7 + this.seed * 13.7, this.seed * 7.3) * 0.26;
      desired.x += Math.cos(this.heading + recoverNoise) * 0.14 * recoveryStrength;
      desired.y += Math.sin(this.heading + recoverNoise) * 0.14 * recoveryStrength;
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
    this.edgeOrbitTimer = 0;
    this.edgeEscapeCooldown = 0;
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
