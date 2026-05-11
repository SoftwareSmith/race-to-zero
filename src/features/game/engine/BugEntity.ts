import { Entity } from "./Entity";
import { drawBugSprite } from "@game/utils/bugSprite";
import type { SiegeStatusId } from "@game/status/statusCatalog";
import { STATUS_PRIORITY } from "@game/status/statusCatalog";
import { DEFAULT_GAME_CONFIG } from "./types";
import { getCodex, type CrawlProfile, type CrawlRegion, type BugType } from "./bugCodex";
import { getWrappedDelta, wrapCoordinate } from "./toroidalMath";
import { EntityState, isTerminalEntityState } from "../types";
import type { AllyConversionConfig } from "@game/weapons/runtime/types";

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

function getNormalizedCrowdScore(score: number, count: number) {
  if (score <= 0 || count <= 0) {
    return 0;
  }

  return score / Math.max(1, Math.sqrt(count) * 0.72);
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

type BugState = "patrol" | "flee" | EntityState.Dying | EntityState.Dead;
type BugMovementMood = "patrol" | "startled";

const ALLY_CONTACT_DAMAGE = 2;
const ALLY_CONTACT_COOLDOWN_MS = 260;
const ALLY_INTERCEPT_RADIUS = 196;

function isStatusActive(
  status:
    | { expiresAt: number }
    | { expiresAt: number; dps: number; accumulatedDmg: number }
    | null,
  now: number,
) {
  return status !== null && now < status.expiresAt;
}

interface BugUpdateContext {
  getCrowdingAt?: (
    x: number,
    y: number,
    r: number,
    exclude?: BugEntity,
  ) => { centerX: number; centerY: number; count: number; score: number };
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

type MovementIntentTuning = {
  headingSpread: number;
  maxIntervalMs: number;
  maxTravelRatio: number;
  minIntervalMs: number;
  minTravelRatio: number;
  momentumWeight: number;
  pressureBias: number;
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
  roamTargetX: number | null;
  roamTargetY: number | null;
  roamTargetWide: boolean;
  roamTargetLongPath: boolean;
  nextRoamTargetAt: number;
  roamTargetGeneration: number;
  movementMood: BugMovementMood;
  lastCrowdCount: number;
  lastCrowdScore: number;
  lastNeighborCount: number;
  lastSeparationScale: number;
  typeSpec: BugType | null;
  hasEnteredField: boolean;
  fieldWidth: number;
  fieldHeight: number;
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
  ally: {
    expiresAt: number;
    expireBurstDamage: number;
    expireBurstRadius: number;
    interceptForce: number;
  } | null;
  allyContactReadyAt: number;
  /** Whether this bug's eventual death has already been credited to the player. */
  deathCredited: boolean;
  /** Weapon ID that will receive kill credit for any pending DOT death. */
  dotSourceWeaponId: string | null;
  finalBlowStatus: SiegeStatusId | null;
  supportStatusesAtDeath: SiegeStatusId[];
  deathPointValue: number;

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
    this.roamTargetX = null;
    this.roamTargetY = null;
    this.roamTargetWide = false;
    this.roamTargetLongPath = false;
    this.nextRoamTargetAt = 0;
    this.roamTargetGeneration = 0;
    this.movementMood = "patrol";
    this.lastCrowdCount = 0;
    this.lastCrowdScore = 0;
    this.lastNeighborCount = 0;
    this.lastSeparationScale = 1;
    this.typeSpec = null;
    this.hasEnteredField = true;
    this.fieldWidth = 0;
    this.fieldHeight = 0;
    this.slow = null;
    this.poison = null;
    this.burn = null;
    this.ensnare = null;
    this.charged = null;
    this.marked = null;
    this.unstable = null;
    this.looped = null;
    this.ally = null;
    this.allyContactReadyAt = 0;
    this.deathCredited = false;
    this.dotSourceWeaponId = null;
    this.finalBlowStatus = null;
    this.supportStatusesAtDeath = [];
    this.deathPointValue = 1;
  }

  private getBasePointValue() {
    return this.typeSpec?.pointValue ?? 1;
  }

  private getDeltaToPoint(targetX: number, targetY: number) {
    return {
      x:
        this.hasEnteredField && this.fieldWidth > 0
          ? getWrappedDelta(this.x, targetX, this.fieldWidth)
          : targetX - this.x,
      y:
        this.hasEnteredField && this.fieldHeight > 0
          ? getWrappedDelta(this.y, targetY, this.fieldHeight)
          : targetY - this.y,
    };
  }

  private getDeltaFromNeighbor(neighbor: BugEntity) {
    return {
      x:
        this.hasEnteredField && neighbor.hasEnteredField && this.fieldWidth > 0
          ? getWrappedDelta(neighbor.x, this.x, this.fieldWidth)
          : this.x - neighbor.x,
      y:
        this.hasEnteredField && neighbor.hasEnteredField && this.fieldHeight > 0
          ? getWrappedDelta(neighbor.y, this.y, this.fieldHeight)
          : this.y - neighbor.y,
    };
  }

  private isAllyActive(now: number) {
    return isStatusActive(this.ally, now);
  }

  private getActiveSupportStatuses(now: number, finisherStatus?: SiegeStatusId | null) {
    const statuses: SiegeStatusId[] = [];

    if (this.isAllyActive(now)) statuses.push("ally");
    if (isStatusActive(this.burn, now)) statuses.push("burn");
    if (isStatusActive(this.charged, now)) statuses.push("charged");
    if (isStatusActive(this.ensnare, now)) statuses.push("ensnare");
    if (isStatusActive(this.slow, now)) statuses.push("freeze");
    if (isStatusActive(this.looped, now)) statuses.push("looped");
    if (isStatusActive(this.marked, now)) statuses.push("marked");
    if (isStatusActive(this.poison, now)) statuses.push("poison");
    if (isStatusActive(this.unstable, now)) statuses.push("unstable");

    const filtered = finisherStatus
      ? statuses.filter((status) => status !== finisherStatus)
      : statuses;

    return STATUS_PRIORITY.filter((status) => filtered.includes(status));
  }

  private enterDyingState(finisherStatus: SiegeStatusId | null, supportStatuses?: SiegeStatusId[]) {
    this.finalBlowStatus = finisherStatus;
    this.supportStatusesAtDeath = supportStatuses ?? this.getActiveSupportStatuses(performance.now(), finisherStatus);
    this.deathPointValue = finisherStatus === "ally" ? 0 : this.getBasePointValue();
    this.state = EntityState.Dying;
    this.deathProgress = 0;
    this.vx = 0;
    this.vy = 0;
    this.deathCredited = false;
  }

  private applyIncidentalDamage(amount: number, finisherStatus: SiegeStatusId) {
    if (amount <= 0 || isTerminalEntityState(this.state)) {
      return false;
    }

    this.lastHitTime = performance.now();
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp > 0) {
      return false;
    }

    this.enterDyingState(finisherStatus);
    return true;
  }

  private syncTypeSpec() {
    this.typeSpec = getCodex()[this.variant as string] ?? null;
    return this.typeSpec;
  }

  private getActiveProfile() {
    return this.typeSpec?.profile ?? getProfileForVariant(this.variant) ?? null;
  }

  private getIntentTuning(profile: CrawlProfile | null): MovementIntentTuning {
    switch (profile?.behavior) {
      case "skitter":
        return {
          headingSpread: 1.08,
          maxIntervalMs: 900,
          maxTravelRatio: 0.42,
          minIntervalMs: 380,
          minTravelRatio: 0.22,
          momentumWeight: 0.58,
          pressureBias: 1.12,
        };
      case "stalk":
        return {
          headingSpread: 0.58,
          maxIntervalMs: 1580,
          maxTravelRatio: 0.58,
          minIntervalMs: 880,
          minTravelRatio: 0.34,
          momentumWeight: 0.96,
          pressureBias: 0.86,
        };
      case "panic":
        return {
          headingSpread: 1.3,
          maxIntervalMs: 760,
          maxTravelRatio: 0.46,
          minIntervalMs: 300,
          minTravelRatio: 0.24,
          momentumWeight: 0.52,
          pressureBias: 0.82,
        };
      case "patrol":
      default:
        return {
          headingSpread: 0.82,
          maxIntervalMs: 1320,
          maxTravelRatio: 0.5,
          minIntervalMs: 620,
          minTravelRatio: 0.28,
          momentumWeight: 0.78,
          pressureBias: 0.98,
        };
    }
  }

  private getRegionPreferenceScore(candidateRegion: CrawlRegion) {
    if (this.hasEnteredField) {
      return 0;
    }

    const preferredRegion = this.typeSpec?.preferredRegion;

    if (!preferredRegion) {
      return 0;
    }

    if (preferredRegion === candidateRegion) {
      return 0.08;
    }

    if (preferredRegion === "middle" || candidateRegion === "middle") {
      return 0.02;
    }

    return -0.05;
  }

  private classifyRoamRegion(bounds: { width: number; height: number }, x: number, y: number): CrawlRegion {
    if (this.hasEnteredField) {
      return "middle";
    }

    const edgeDistance = Math.min(x, bounds.width - x, y, bounds.height - y);
    const centerBandX = Math.abs(x / Math.max(bounds.width, 1) - 0.5);
    const centerBandY = Math.abs(y / Math.max(bounds.height, 1) - 0.5);

    if (edgeDistance <= Math.min(bounds.width, bounds.height) * 0.14) {
      return "edge";
    }

    if (centerBandX <= 0.18 && centerBandY <= 0.18) {
      return "interior";
    }

    return "middle";
  }

  private getWallSteering(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    if (this.hasEnteredField) {
      return {
        pressure: 0,
        x: 0,
        y: 0,
      };
    }

    const edgeLaneScale = 1;
    const senseDistance = Math.max(
      config.wallAvoidDistance * (1.15 + edgeLaneScale * 0.95),
      this.size * (2.25 + edgeLaneScale * 1.15),
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
      x: away.x * config.wallAvoidStrength * pressure * (1.04 + edgeLaneScale * 0.72),
      y: away.y * config.wallAvoidStrength * pressure * (1.04 + edgeLaneScale * 0.72),
    };
  }

  private getCursorRepelResponse(
    targetX: number,
    targetY: number,
    config: typeof DEFAULT_GAME_CONFIG,
    cursorHoverRepelMultiplier: number,
  ) {
    const toTarget = this.getDeltaToPoint(targetX, targetY);
    const away = normalizeVector(-toTarget.x, -toTarget.y);
    const distance = getLength(toTarget.x, toTarget.y);
    const radius = config.fleeRadius * (1.46 + cursorHoverRepelMultiplier * 0.94);

    if (distance > radius) {
      return {
        active: false,
        pressure: 0,
        steerX: 0,
        steerY: 0,
        immediateThreat: false,
      };
    }

    const normalized = 1 - clamp(distance / Math.max(radius, 1), 0, 1);
    const pressure =
      normalized * normalized *
      (0.68 + cursorHoverRepelMultiplier * 0.24 + normalized * (0.5 + cursorHoverRepelMultiplier * 0.46));
    const directForce =
      (0.12 + cursorHoverRepelMultiplier * 0.9) +
      pressure * (0.94 + cursorHoverRepelMultiplier * 3.1);
    const immediateThreatThreshold = Math.max(
      0.05,
      0.19 - cursorHoverRepelMultiplier * 0.034,
    );

    return {
      active: true,
      pressure,
      steerX: away.x * directForce,
      steerY: away.y * directForce,
      immediateThreat: pressure > immediateThreatThreshold,
    };
  }

  private getCornerEscapeSteering(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    if (this.hasEnteredField) {
      return {
        active: false,
        cornerPressure: 0,
        inwardX: 0,
        inwardY: 0,
        steerX: 0,
        steerY: 0,
      };
    }

    const senseDistance = Math.max(
      config.wallAvoidDistance * 1.55,
      this.size * 3.2,
      36,
    );
    const left = clamp((senseDistance - this.x) / senseDistance, 0, 1);
    const right = clamp((senseDistance - (bounds.width - this.x)) / senseDistance, 0, 1);
    const top = clamp((senseDistance - this.y) / senseDistance, 0, 1);
    const bottom = clamp((senseDistance - (bounds.height - this.y)) / senseDistance, 0, 1);
    const horizontalPressure = Math.max(left, right);
    const verticalPressure = Math.max(top, bottom);
    const cornerPressure = horizontalPressure * verticalPressure;

    if (cornerPressure <= 0.04) {
      return {
        active: false,
        cornerPressure: 0,
        inwardX: 0,
        inwardY: 0,
        steerX: 0,
        steerY: 0,
      };
    }

    const inward = normalizeVector(left - right, top - bottom);
    const tangentBase =
      horizontalPressure >= verticalPressure
        ? { x: 0, y: top > bottom ? 1 : -1 }
        : { x: left > right ? 1 : -1, y: 0 };
    const tangentSign = Math.sin(this.seed * 23.7 + this.motionTime * 0.9) >= 0 ? 1 : -1;
    const tangent = {
      x: tangentBase.x * tangentSign,
      y: tangentBase.y * tangentSign,
    };
    const steerStrength = config.wallAvoidStrength * (1.35 + cornerPressure * 2.9);

    return {
      active: true,
      cornerPressure,
      inwardX: inward.x,
      inwardY: inward.y,
      steerX: inward.x * steerStrength + tangent.x * steerStrength * 0.14,
      steerY: inward.y * steerStrength + tangent.y * steerStrength * 0.14,
    };
  }

  private getNeighborSeparation(
    neighbors: BugEntity[],
    radius: number,
    strength: number,
    localAvoidanceStrength: number,
  ) {
    if (!neighbors.length) {
      return { x: 0, y: 0 };
    }

    let separationX = 0;
    let separationY = 0;
    let weightedCenterX = 0;
    let weightedCenterY = 0;
    let totalWeight = 0;
    const personalSpace = Math.max(this.size * 2.05, radius * 0.34);
    const softRadius = Math.max(personalSpace + 2, radius * 0.78);

    for (const neighbor of neighbors) {
      const { x: dx, y: dy } = this.getDeltaFromNeighbor(neighbor);
      const distance = Math.max(1, getLength(dx, dy));
      const collisionPressure = 1 - clamp((distance - 1) / Math.max(personalSpace, 1), 0, 1);
      const softPressure = 1 - clamp((distance - personalSpace) / Math.max(softRadius - personalSpace, 1), 0, 1);
      const weight = collisionPressure * 1 + softPressure * 0.26;
      if (weight <= 0.001) {
        continue;
      }
      separationX += (dx / distance) * weight;
      separationY += (dy / distance) * weight;
      weightedCenterX += (this.x - dx) * weight;
      weightedCenterY += (this.y - dy) * weight;
      totalWeight += weight;
    }

    const crowdCenter =
      totalWeight > 0
        ? {
            x: weightedCenterX / totalWeight,
            y: weightedCenterY / totalWeight,
          }
        : { x: this.x, y: this.y };
    const crowdEscape = normalizeVector(this.x - crowdCenter.x, this.y - crowdCenter.y);
    let away = normalizeVector(separationX, separationY);

    if (away.x === 0 && away.y === 0) {
      away = crowdEscape;
    }

    const forward = normalizeVector(Math.cos(this.heading), Math.sin(this.heading));
    const awayDot = away.x * forward.x + away.y * forward.y;
    const reversePressure = clamp((-awayDot - 0.08) / 0.92, 0, 1);
    const smoothedAway = normalizeVector(
      away.x * (1 - reversePressure * 0.08) +
        crowdEscape.x * (0.14 + reversePressure * 0.24),
      away.y * (1 - reversePressure * 0.08) +
        crowdEscape.y * (0.14 + reversePressure * 0.24),
    );
    const directStrength = 1.18 * localAvoidanceStrength;

    return {
      x: smoothedAway.x * strength * directStrength,
      y: smoothedAway.y * strength * directStrength,
    };
  }

  private resetRoamState() {
    this.roamTargetX = null;
    this.roamTargetY = null;
    this.roamTargetWide = false;
    this.roamTargetLongPath = false;
    this.nextRoamTargetAt = 0;
    this.roamTargetGeneration = 0;
    this.movementMood = "patrol";
  }

  private getUnitNoise(position: number, seed: number) {
    return clamp(perlin1D(position, seed) * 0.5 + 0.5, 0, 1);
  }

  private getMoodSpeedMultiplier(mood: BugMovementMood) {
    if (mood === "startled") {
      return 1.16;
    }

    return 1;
  }

  private getStartledSteering() {
    const forward = {
      x: Math.cos(this.heading),
      y: Math.sin(this.heading),
    };
    const lateral = {
      x: -forward.y,
      y: forward.x,
    };
    const weave = Math.sin(this.motionTime * 9.4 + this.seed * 12.7);

    return {
      x: forward.x * 0.14 + lateral.x * weave * 0.24,
      y: forward.y * 0.14 + lateral.y * weave * 0.24,
    };
  }

  private chooseRoamTarget(
    bounds: { width: number; height: number },
    now: number,
    config: typeof DEFAULT_GAME_CONFIG,
    getCrowdingAt?: BugUpdateContext["getCrowdingAt"],
  ) {
    const profile = this.getActiveProfile();
    const tuning = this.getIntentTuning(profile);
    const boardSpan = Math.max(1, Math.min(bounds.width, bounds.height));
    const margin = Math.max(18, this.size * 2.8, config.wallAvoidDistance * 0.9);
    const localCrowding = getCrowdingAt?.(
      this.x,
      this.y,
      config.crowdAvoidRadius * 1.25,
      this,
    );
    const wallSteering = this.getWallSteering(bounds, config);
    const boardBias = this.getBoardBias(bounds, config);
    const forward = normalizeVector(Math.cos(this.heading), Math.sin(this.heading));
    const localCrowdDelta = localCrowding
      ? this.getDeltaToPoint(localCrowding.centerX, localCrowding.centerY)
      : null;
    const crowdEscape = localCrowding && localCrowding.score > 0
      ? normalizeVector(-(localCrowdDelta?.x ?? 0), -(localCrowdDelta?.y ?? 0))
      : { x: 0, y: 0 };
    const crowdPressure = clamp(
      (localCrowding?.score ?? 0) / Math.max(config.crowdRepathThreshold, 1),
      0,
      1.8,
    );
    const projectTarget = (x: number, y: number) => {
      if (!this.hasEnteredField) {
        return {
          x: clamp(x, margin, bounds.width - margin),
          y: clamp(y, margin, bounds.height - margin),
        };
      }

      return {
        x: wrapCoordinate(x, bounds.width),
        y: wrapCoordinate(y, bounds.height),
      };
    };
    const getTravelDistance = (targetX: number, targetY: number) =>
      getLength(
        this.hasEnteredField
          ? getWrappedDelta(this.x, targetX, bounds.width)
          : targetX - this.x,
        this.hasEnteredField
          ? getWrappedDelta(this.y, targetY, bounds.height)
          : targetY - this.y,
      );

    this.roamTargetGeneration += 1;
    const initialTarget = projectTarget(
      this.x + forward.x * boardSpan * tuning.minTravelRatio,
      this.y + forward.y * boardSpan * tuning.minTravelRatio,
    );
    let bestTargetX = initialTarget.x;
    let bestTargetY = initialTarget.y;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const phase = this.roamTargetGeneration + attempt * 0.47;
      const angleOffset =
        (this.getUnitNoise(this.seed * 23.1 + phase * 0.81, this.seed * 47.7) - 0.5) *
        Math.PI * tuning.headingSpread;
      const candidateHeading = this.heading + angleOffset;
      const candidateDirection = normalizeVector(
        Math.cos(candidateHeading) * (0.76 + tuning.momentumWeight * 0.5) +
          forward.x * tuning.momentumWeight +
          crowdEscape.x * crowdPressure * tuning.pressureBias +
          wallSteering.x * (0.62 + tuning.pressureBias * 0.16) +
          boardBias.x * (0.88 + tuning.pressureBias * 0.12),
        Math.sin(candidateHeading) * (0.76 + tuning.momentumWeight * 0.5) +
          forward.y * tuning.momentumWeight +
          crowdEscape.y * crowdPressure * tuning.pressureBias +
          wallSteering.y * (0.62 + tuning.pressureBias * 0.16) +
          boardBias.y * (0.88 + tuning.pressureBias * 0.12),
      );
      const tangent = { x: -candidateDirection.y, y: candidateDirection.x };
      const travelNoise = this.getUnitNoise(this.seed * 12.7 + phase * 0.61, this.seed * 91.1);
      const lateralNoise = this.getUnitNoise(this.seed * 31.9 + phase * 0.73, this.seed * 61.3) - 0.5;
      const travelDistance =
        boardSpan * (tuning.minTravelRatio + travelNoise * (tuning.maxTravelRatio - tuning.minTravelRatio));
      const lateralShift = lateralNoise * boardSpan * 0.1 * (1 - tuning.momentumWeight * 0.45);
      const candidate = projectTarget(
        this.x + candidateDirection.x * travelDistance + tangent.x * lateralShift,
        this.y + candidateDirection.y * travelDistance + tangent.y * lateralShift,
      );
      const candidateX = candidate.x;
      const candidateY = candidate.y;
      const endpointCrowding = getCrowdingAt?.(candidateX, candidateY, config.crowdAvoidRadius, this);
      const broadCrowding = getCrowdingAt?.(
        candidateX,
        candidateY,
        config.crowdAvoidRadius * 1.8,
        this,
      );
      const endpointPenalty = clamp(
        (endpointCrowding?.score ?? 0) / Math.max(config.crowdRepathThreshold * 2.2, 1),
        0,
        1.5,
      );
      const broadPenalty = clamp(
        (broadCrowding?.score ?? 0) / Math.max(config.crowdRepathThreshold * 3.8, 1),
        0,
        1.5,
      );
      const currentEdgeDistance = this.hasEnteredField
        ? Infinity
        : Math.min(
            this.x,
            bounds.width - this.x,
            this.y,
            bounds.height - this.y,
          );
      const edgeDistance = this.hasEnteredField
        ? Infinity
        : Math.min(candidateX, bounds.width - candidateX, candidateY, bounds.height - candidateY);
      const boundaryComfort = this.hasEnteredField
        ? 1
        : clamp(edgeDistance / Math.max(margin * 2.2, 1), 0, 1);
      const edgeRecoveryPressure = this.hasEnteredField
        ? 0
        : clamp(
            (margin * 2.5 - currentEdgeDistance) / Math.max(margin * 2.5, 1),
            0,
            1,
          );
      const edgeExitScore =
        this.hasEnteredField
          ? 0
          : edgeRecoveryPressure *
              clamp((edgeDistance - currentEdgeDistance) / Math.max(boardSpan * 0.18, 1), 0, 1) *
              0.22;
      const candidateRegion = this.classifyRoamRegion(bounds, candidateX, candidateY);
      const regionPreferenceScore = this.getRegionPreferenceScore(candidateRegion);
      const travelScore = clamp(
        getTravelDistance(candidateX, candidateY) / Math.max(boardSpan * tuning.maxTravelRatio, 1),
        0,
        1,
      );
      const novelty =
        this.roamTargetX != null && this.roamTargetY != null
          ? clamp(
              getLength(
                this.hasEnteredField
                  ? getWrappedDelta(this.roamTargetX, candidateX, bounds.width)
                  : candidateX - this.roamTargetX,
                this.hasEnteredField
                  ? getWrappedDelta(this.roamTargetY, candidateY, bounds.height)
                  : candidateY - this.roamTargetY,
              ) /
                Math.max(boardSpan * 0.35, 1),
              0,
              1,
            )
          : travelScore;
      const score =
        (1 - endpointPenalty) * 0.33 +
        (1 - broadPenalty) * 0.2 +
        travelScore * 0.2 +
        boundaryComfort * 0.08 +
        novelty * 0.13 +
        edgeExitScore +
        regionPreferenceScore +
        this.getUnitNoise(this.seed * 7.7 + phase * 0.93, this.seed * 113.9) * 0.06;

      if (score > bestScore) {
        bestScore = score;
        bestTargetX = candidateX;
        bestTargetY = candidateY;
      }
    }

    this.roamTargetX = bestTargetX;
    this.roamTargetY = bestTargetY;
    this.roamTargetWide = false;
    this.roamTargetLongPath =
      getTravelDistance(bestTargetX, bestTargetY) > boardSpan * (tuning.maxTravelRatio * 0.7);
    const expectedCruiseSpeed = Math.max(
      8,
      config.baseSpeed * this.cruiseSpeed * (profile?.speedMultiplier ?? 1) * 0.82,
    );
    const estimatedTravelMs =
      (getTravelDistance(bestTargetX, bestTargetY) / expectedCruiseSpeed) * 1000;
    const intervalPressure = clamp(crowdPressure * 0.48 + wallSteering.pressure * 0.34, 0, 0.72);
    const minIntervalMs = Math.max(200, tuning.minIntervalMs * (1 - intervalPressure));
    const maxIntervalMs = Math.max(minIntervalMs + 60, tuning.maxIntervalMs * (1 - intervalPressure * 0.58));
    const commitMs = clamp(estimatedTravelMs * 0.42, minIntervalMs, 1600);
    this.nextRoamTargetAt =
      now +
      Math.max(
        commitMs,
        minIntervalMs +
          this.getUnitNoise(this.seed * 37.1 + this.roamTargetGeneration * 0.47, this.seed * 83.7) *
            (maxIntervalMs - minIntervalMs),
      );
  }

  private getRoamTarget(
    bounds: { width: number; height: number },
    now: number,
    config: typeof DEFAULT_GAME_CONFIG,
    getCrowdingAt?: BugUpdateContext["getCrowdingAt"],
  ) {
    const profile = this.getActiveProfile();
    const targetMissing = this.roamTargetX == null || this.roamTargetY == null;
    const targetExpired = now >= this.nextRoamTargetAt;
    const targetOutOfBounds =
      !targetMissing &&
      (this.roamTargetX! < 0 ||
        this.roamTargetX! > bounds.width ||
        this.roamTargetY! < 0 ||
        this.roamTargetY! > bounds.height);

    if (targetMissing || targetExpired || targetOutOfBounds) {
      this.chooseRoamTarget(bounds, now, config, getCrowdingAt);
    } else {
      const targetDistance = getLength(
        this.hasEnteredField
          ? getWrappedDelta(this.x, this.roamTargetX!, bounds.width)
          : this.roamTargetX! - this.x,
        this.hasEnteredField
          ? getWrappedDelta(this.y, this.roamTargetY!, bounds.height)
          : this.roamTargetY! - this.y,
      );
      const retargetRadius = Math.max(config.targetReachRadius * 1.12, this.size * 2.15);

      if (targetDistance <= retargetRadius) {
        this.chooseRoamTarget(bounds, now, config, getCrowdingAt);
      }
    }

    return {
      x: this.roamTargetX ?? this.x,
      y: this.roamTargetY ?? this.y,
    };
  }

  private getBoardBias(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    if (this.hasEnteredField) {
      return { x: 0, y: 0 };
    }

    const softMargin = Math.max(
      config.wallAvoidDistance * 0.72,
      Math.min(bounds.width, bounds.height) * 0.028,
      this.size * 1.7,
    );
    const left = clamp((softMargin - this.x) / softMargin, 0, 1);
    const right = clamp((softMargin - (bounds.width - this.x)) / softMargin, 0, 1);
    const top = clamp((softMargin - this.y) / softMargin, 0, 1);
    const bottom = clamp((softMargin - (bounds.height - this.y)) / softMargin, 0, 1);
    const inward = normalizeVector(left * left - right * right, top * top - bottom * bottom);
    const pressure = Math.max(left, right, top, bottom);

    return {
      x: inward.x * config.followStrength * pressure * (0.08 + pressure * 0.18),
      y: inward.y * config.followStrength * pressure * (0.08 + pressure * 0.18),
    };
  }

  private wrapAcrossBounds(
    bounds: { width: number; height: number },
  ) {
    const wrapMargin = Math.max(12, this.size * 1.25);
    const isInsideField =
      this.x >= 0 && this.x <= bounds.width && this.y >= 0 && this.y <= bounds.height;

    if (!this.hasEnteredField) {
      if (isInsideField) {
        this.hasEnteredField = true;
      }
      return;
    }

    let wrapped = false;

    if (this.x < -wrapMargin) {
      this.x += bounds.width;
      wrapped = true;
    } else if (this.x > bounds.width + wrapMargin) {
      this.x -= bounds.width;
      wrapped = true;
    }

    if (this.y < -wrapMargin) {
      this.y += bounds.height;
      wrapped = true;
    } else if (this.y > bounds.height + wrapMargin) {
      this.y -= bounds.height;
      wrapped = true;
    }

    if (!wrapped) {
      return;
    }

    this.roamTargetX = null;
    this.roamTargetY = null;
    this.roamTargetWide = false;
    this.roamTargetLongPath = false;
    this.nextRoamTargetAt = 0;
  }

  update(dt: number, ctx: BugUpdateContext) {
    const config = ctx.config ?? DEFAULT_GAME_CONFIG;
    const bounds = ctx.bounds ?? { width: 800, height: 600 };
    this.fieldWidth = bounds.width;
    this.fieldHeight = bounds.height;
    const typeSpec = this.syncTypeSpec();
    const profile = typeSpec?.profile ?? null;
    const speedMultiplier = profile?.speedMultiplier ?? 1;
    const cursorFleeMultiplier = profile?.cursorFleeMultiplier ?? 1;
    const cursorHoverRepelMultiplier =
      profile?.cursorHoverRepelMultiplier ?? cursorFleeMultiplier;
    const turnMultiplier = profile?.turnMultiplier ?? 1;
    const wanderMultiplier = profile?.wanderMultiplier ?? 1;
    const noiseFrequency = profile?.noiseFrequency ?? 1;
    const noiseForwardStrength = 0.38 + (profile?.noiseForwardStrength ?? 0.2) * 0.45;
    const noiseLateralStrength = 0.32 + (profile?.noiseLateralStrength ?? 0.5) * 0.4;
    const noiseTurnStrength = profile?.noiseTurnStrength ?? 1;
    const separationMultiplier = profile?.separationMultiplier ?? 1;
    const localAvoidanceStrength = profile?.localAvoidanceStrength ?? 1;
    const behavior = profile?.behavior ?? "patrol";

    if (this.state === EntityState.Dying) {
      this.deathProgress += dt / this.deathDuration;
      this.opacity = Math.max(0, 1 - this.deathProgress);
      this.size = Math.max(
        this.baseSize * 0.28,
        this.baseSize * (1 - this.deathProgress * 0.72),
      );
      if (this.deathProgress >= 1) {
        this.state = EntityState.Dead;
      }
      return;
    }

    if (this.state === EntityState.Dead) {
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

    const now = performance.now();
    const targetX = ctx.targetX ?? null;
    const targetY = ctx.targetY ?? null;
    const isAlly = this.isAllyActive(now);
    const isBurnPanicking = this.burn !== null && now < this.burn.expiresAt && this.burn.dps > 0.3;
    const cornerEscape = this.getCornerEscapeSteering(bounds, config);
    const cursorRepel =
      !isAlly && targetX != null && targetY != null
        ? this.getCursorRepelResponse(
            targetX,
            targetY,
            config,
            cursorHoverRepelMultiplier,
          )
        : null;
    const hasThreat =
      !isAlly &&
      cursorRepel?.immediateThreat === true &&
      !cornerEscape.active;

    if (hasThreat) {
      this.state = "flee";
      this.fleeTimer = 0.55;
    } else if (!this.fleeTimer) {
      this.state = "patrol";
    }

    const wasRecentlyHit = this.lastHitTime > 0 && now - this.lastHitTime < 820;
    this.movementMood = !isAlly && (this.state === "flee" || isBurnPanicking || wasRecentlyHit)
      ? "startled"
      : "patrol";

    const desired = {
      x: Math.cos(this.heading) * 0.28,
      y: Math.sin(this.heading) * 0.28,
    };
    const wallSteering = this.getWallSteering(bounds, config);

    desired.x += wallSteering.x;
    desired.y += wallSteering.y;
    if (cornerEscape.active) {
      desired.x += cornerEscape.steerX * 1.35;
      desired.y += cornerEscape.steerY * 1.35;
      this.nextRoamTargetAt = 0;
    } else {
      desired.x += cornerEscape.steerX;
      desired.y += cornerEscape.steerY;
    }

    const driftNoiseX = perlin1D(
      this.motionTime * 0.29 * noiseFrequency + this.seed * 11.3,
      this.seed * 17.9,
    );
    const driftNoiseY = perlin1D(
      this.motionTime * 0.33 * noiseFrequency + this.seed * 7.1,
      this.seed * 23.4,
    );
    const weaveNoise = perlin1D(
      this.motionTime * 0.17 * noiseFrequency + this.seed * 5.7,
      this.seed * 31.2,
    );
    this.wanderAngle = normalizeAngle(
      this.wanderAngle +
        weaveNoise * dt * (0.55 + config.wanderStrength * 0.8) * noiseTurnStrength,
    );
    desired.x += driftNoiseX * (0.18 + config.wanderStrength * 0.36) * noiseForwardStrength;
    desired.y += driftNoiseY * (0.18 + config.wanderStrength * 0.36) * noiseLateralStrength;
    desired.x += Math.cos(this.wanderAngle) * 0.08 * wanderMultiplier;
    desired.y += Math.sin(this.wanderAngle) * 0.08 * wanderMultiplier;

    const crowding = !isAlly
      ? ctx.getCrowdingAt?.(
          this.x,
          this.y,
          config.crowdAvoidRadius,
          this,
        )
      : undefined;
    const normalizedCrowdScore = getNormalizedCrowdScore(
      crowding?.score ?? 0,
      crowding?.count ?? 0,
    );
    const localCrowdingPressure = clamp(
      normalizedCrowdScore / Math.max(config.crowdRepathThreshold, 1),
      0,
      1.8,
    );
    const neighbors = ctx.getNeighbors(this, config.separationRadius);
    const neighborPressure = clamp(neighbors.length / 4, 0, 1);
    const separationScale = clamp(
      1 - localCrowdingPressure * 0.26 + neighborPressure * 0.18,
      0.48,
      1,
    );
    this.lastCrowdCount = crowding?.count ?? 0;
    this.lastCrowdScore = crowding?.score ?? 0;
    this.lastSeparationScale = separationScale;
    this.lastNeighborCount = neighbors.length;
    const separation = this.getNeighborSeparation(
      neighbors,
      config.separationRadius,
      config.separationStrength * 1.35 * separationMultiplier * separationScale,
      localAvoidanceStrength,
    );
    desired.x += separation.x;
    desired.y += separation.y;

    if (!isAlly && this.state !== "flee") {
      const roamTarget = this.getRoamTarget(bounds, now, config, ctx.getCrowdingAt);
      const toTargetX = this.hasEnteredField
        ? getWrappedDelta(this.x, roamTarget.x, bounds.width)
        : roamTarget.x - this.x;
      const toTargetY = this.hasEnteredField
        ? getWrappedDelta(this.y, roamTarget.y, bounds.height)
        : roamTarget.y - this.y;
      const targetDistance = getLength(toTargetX, toTargetY);
      const targetDirection = normalizeVector(toTargetX, toTargetY);
      const boardBias = this.getBoardBias(bounds, config);
      const crowdPressure = clamp(
        normalizedCrowdScore / Math.max(config.crowdRepathThreshold, 1),
        0,
        1.4,
      );
      const targetRamp = clamp(
        targetDistance / Math.max(profile?.roamRadius ?? config.roamTargetMinDistance, 1),
        0,
        1,
      );
      const targetPullBase =
        behavior === "stalk"
          ? 1.12
          : behavior === "panic"
            ? 0.72
            : behavior === "skitter"
              ? 0.84
              : 0.94;
      const targetPullScale = 1 - crowdPressure * 0.62;
      desired.x += boardBias.x * 0.7;
      desired.y += boardBias.y * 0.7;
      desired.x +=
        targetDirection.x *
        config.followStrength *
        (targetPullBase + targetRamp * 1.1) *
        clamp(targetPullScale, 0.18, 1);
      desired.y +=
        targetDirection.y *
        config.followStrength *
        (targetPullBase + targetRamp * 1.1) *
        clamp(targetPullScale, 0.18, 1);

      if (crowding && normalizedCrowdScore > config.crowdRepathThreshold * 0.72) {
        const crowdDelta = this.getDeltaToPoint(crowding.centerX, crowding.centerY);
        const awayFromCrowd = normalizeVector(
          -crowdDelta.x,
          -crowdDelta.y,
        );
        const crowdEscapePressure = clamp(
          (normalizedCrowdScore - config.crowdRepathThreshold * 0.72) /
            Math.max(1, config.crowdTargetPenalty / 18),
          0,
          1,
        );

        desired.x +=
          awayFromCrowd.x *
          config.crowdSteerStrength *
          crowdEscapePressure *
          (behavior === "stalk" ? 0.58 : 0.78);
        desired.y +=
          awayFromCrowd.y *
          config.crowdSteerStrength *
          crowdEscapePressure *
          (behavior === "stalk" ? 0.58 : 0.78);
      }
    }

    if (isAlly) {
      this.state = "patrol";
      this.fleeTimer = null;
      const interceptCandidates = ctx
        .getNeighbors(this, Math.max(ALLY_INTERCEPT_RADIUS, config.separationRadius * 3))
        .filter((neighbor): neighbor is BugEntity => neighbor instanceof BugEntity)
        .filter((neighbor) => !neighbor.isAllyActive(now) && !isTerminalEntityState(neighbor.state));

      let nearestHostile: BugEntity | null = null;
      let nearestDistance = Infinity;

      for (const hostile of interceptCandidates) {
        const toHostile = this.getDeltaToPoint(hostile.x, hostile.y);
        const distance = getLength(toHostile.x, toHostile.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestHostile = hostile;
        }
      }

      if (nearestHostile) {
        const toHostile = this.getDeltaToPoint(nearestHostile.x, nearestHostile.y);
        const towardHostile = normalizeVector(toHostile.x, toHostile.y);
        const interceptForce = this.ally?.interceptForce ?? 2.5;
        desired.x += towardHostile.x * interceptForce;
        desired.y += towardHostile.y * interceptForce;

        const contactRadius = Math.max(this.size, nearestHostile.size) * 1.18 + 6;
        if (
          nearestDistance <= contactRadius &&
          now >= this.allyContactReadyAt
        ) {
          this.allyContactReadyAt = now + ALLY_CONTACT_COOLDOWN_MS;
          nearestHostile.applyIncidentalDamage(ALLY_CONTACT_DAMAGE, "ally");
          nearestHostile.state = "flee";
          nearestHostile.fleeTimer = Math.max(nearestHostile.fleeTimer ?? 0, 0.28);
        }
      } else {
        desired.x += Math.cos(this.heading + this.wanderAngle * 0.5) * 0.38;
        desired.y += Math.sin(this.heading + this.wanderAngle * 0.5) * 0.38;
      }
    }

    if (this.state === "flee" && targetX != null && targetY != null && !cornerEscape.active) {
      const toTarget = this.getDeltaToPoint(targetX, targetY);
      const away = normalizeVector(-toTarget.x, -toTarget.y);
      const fleeForce = 2.6 + cursorFleeMultiplier * 1.45;
      let fleeX = away.x * fleeForce;
      let fleeY = away.y * fleeForce;

      if (cornerEscape.active) {
        const trappedProjection = fleeX * cornerEscape.inwardX + fleeY * cornerEscape.inwardY;
        if (trappedProjection < 0) {
          fleeX -= cornerEscape.inwardX * trappedProjection * 1.05;
          fleeY -= cornerEscape.inwardY * trappedProjection * 1.05;
        }
        fleeX *= 1 - cornerEscape.cornerPressure * 0.42;
        fleeY *= 1 - cornerEscape.cornerPressure * 0.42;
      }

      desired.x += fleeX;
      desired.y += fleeY;
    }

    if (cursorRepel?.active) {
      if (cornerEscape.active) {
        if (this.nextRoamTargetAt === 0 || this.nextRoamTargetAt > now + 90) {
          this.nextRoamTargetAt = now + 90;
        }
      } else {
        desired.x += cursorRepel.steerX;
        desired.y += cursorRepel.steerY;

      if (
        cursorRepel.pressure > 0.42 &&
        (this.nextRoamTargetAt === 0 || this.nextRoamTargetAt > now + 110)
      ) {
        this.nextRoamTargetAt = now + 110;
      }
      }
    }

    if (!isAlly && this.movementMood === "startled") {
      const startled = this.getStartledSteering();
      desired.x += startled.x;
      desired.y += startled.y;

      if (this.nextRoamTargetAt === 0 || this.nextRoamTargetAt > now + 180) {
        this.nextRoamTargetAt = now + 180;
      }
    }

    if (isBurnPanicking) {
      desired.x += (Math.random() - 0.5) * 1.6;
      desired.y += (Math.random() - 0.5) * 1.6;
    }

    const desiredDirection = normalizeVector(desired.x, desired.y);
    const headingAnchor =
      !isAlly && this.state !== "flee"
        ? clamp(
            0.18 +
              ((crowding?.score ?? 0) /
                Math.max(config.crowdRepathThreshold * 6, 1)) *
                0.42,
            0.18,
            0.42,
          )
        : 0;
    const stabilizedDirection =
      headingAnchor > 0
        ? normalizeVector(
            desiredDirection.x * (1 - headingAnchor) + Math.cos(this.heading) * headingAnchor,
            desiredDirection.y * (1 - headingAnchor) + Math.sin(this.heading) * headingAnchor,
          )
        : desiredDirection;
    const desiredHeading =
      stabilizedDirection.x === 0 && stabilizedDirection.y === 0
        ? this.heading
        : Math.atan2(stabilizedDirection.y, stabilizedDirection.x);
    const cursorTurnMultiplier = cursorRepel?.active
      ? 1 + cursorRepel.pressure * (0.28 + cursorHoverRepelMultiplier * 0.82)
      : 1;
    const panicTurnMultiplier = (isBurnPanicking ? 1.8 : 1) * cursorTurnMultiplier;
    const maxTurn = config.turnSpeed * this.turnRate * turnMultiplier * panicTurnMultiplier * dt;
    this.heading += clamp(
      getAngleDelta(this.heading, desiredHeading),
      -maxTurn,
      maxTurn,
    );
    this.heading = normalizeAngle(this.heading);

    const edgeFactor = 1 - wallSteering.pressure * 0.12;
    const cursorSpeedBoost = cursorRepel?.active
      ? 1 + cursorRepel.pressure * (0.16 + cursorHoverRepelMultiplier * 0.9)
      : 1;
    const speedBoost = this.state === "flee"
      ? (1.4 + cursorFleeMultiplier * 0.75) * cursorSpeedBoost
      : cursorSpeedBoost;
    // Apply status effects
    if (this.slow && now >= this.slow.expiresAt) this.slow = null;
    if (this.ensnare && now >= this.ensnare.expiresAt) this.ensnare = null;
    if (this.poison && now >= this.poison.expiresAt) this.poison = null;
    if (this.burn && now >= this.burn.expiresAt) this.burn = null;
    if (this.charged && now >= this.charged.expiresAt) this.charged = null;
    if (this.marked && now >= this.marked.expiresAt) this.marked = null;
    if (this.unstable && now >= this.unstable.expiresAt) this.unstable = null;
    if (this.looped && now >= this.looped.expiresAt) this.looped = null;
    if (this.ally && now >= this.ally.expiresAt) {
      const expireBurstRadius = this.ally.expireBurstRadius;
      const expireBurstDamage = this.ally.expireBurstDamage;
      if (expireBurstRadius > 0 && expireBurstDamage > 0) {
        const burstTargets = ctx
          .getNeighbors(this, Math.max(expireBurstRadius, config.separationRadius * 2))
          .filter((neighbor): neighbor is BugEntity => neighbor instanceof BugEntity)
          .filter((neighbor) => !neighbor.isAllyActive(now) && !isTerminalEntityState(neighbor.state));

        for (const hostile of burstTargets) {
          const toHostile = this.getDeltaToPoint(hostile.x, hostile.y);
          const distance = getLength(toHostile.x, toHostile.y);
          if (distance > expireBurstRadius) {
            continue;
          }

          hostile.applyIncidentalDamage(expireBurstDamage, "ally");
          hostile.state = "flee";
          hostile.fleeTimer = Math.max(hostile.fleeTimer ?? 0, 0.32);
        }
      }

      this.ally = null;
      this.state = "flee";
      this.fleeTimer = 0.36;
    }

    // Tick poison DOT damage
    if (this.poison && !isTerminalEntityState(this.state)) {
      this.poison.accumulatedDmg += this.poison.dps * dt;
      if (this.poison.accumulatedDmg >= 1) {
        const dmgToApply = Math.floor(this.poison.accumulatedDmg);
        this.poison.accumulatedDmg -= dmgToApply;
        this.applyIncidentalDamage(dmgToApply, "poison");
      }
    }

    // Tick burn DOT damage with exponential decay so bugs still burn after leaving flame
    if (this.burn && !isTerminalEntityState(this.state)) {
      this.burn.dps *= Math.exp(-this.burn.decayPerSecond * dt);
      this.burn.accumulatedDmg += this.burn.dps * dt;
      if (this.burn.accumulatedDmg >= 1) {
        const dmgToApply = Math.floor(this.burn.accumulatedDmg);
        this.burn.accumulatedDmg -= dmgToApply;
        this.applyIncidentalDamage(dmgToApply, "burn");
      }
      if (this.burn && this.burn.dps < 0.05) {
        this.burn = null;
      }
    }

    // Tick looped echo DOT damage
    if (this.looped && !isTerminalEntityState(this.state)) {
      this.looped.accumulatedDmg += this.looped.dps * dt;
      if (this.looped.accumulatedDmg >= 1) {
        const dmgToApply = Math.floor(this.looped.accumulatedDmg);
        this.looped.accumulatedDmg -= dmgToApply;
        this.applyIncidentalDamage(dmgToApply, "looped");
      }
    }

    // Ensnared bugs cannot move at all
    if (this.ensnare && now < this.ensnare.expiresAt) {
      this.vx = 0;
      this.vy = 0;
      this.movementMood = "patrol";
      this.opacity = 1;
      this.size = this.baseSize;
      return;
    }

    const slowMult = this.slow ? this.slow.multiplier : 1;
    const burnSpeedBoost = isBurnPanicking ? 1.18 : 1;
    const moodSpeedMultiplier = this.getMoodSpeedMultiplier(this.movementMood);
    const speedPulse =
      0.82 +
      this.getUnitNoise(
        this.motionTime * (0.52 + noiseFrequency * 0.16) + this.seed * 37.7,
        this.seed * 61.1,
      ) *
        (0.24 + localCrowdingPressure * 0.12);
    const desiredSpeed =
      config.baseSpeed *
      this.cruiseSpeed *
      speedMultiplier *
      edgeFactor *
      speedBoost *
      slowMult *
      burnSpeedBoost *
      moodSpeedMultiplier *
      speedPulse;
    const currentSpeed = getLength(this.vx, this.vy);
    const nextSpeed = currentSpeed + (desiredSpeed - currentSpeed) * Math.min(1, dt * 5.4);
    this.vx = Math.cos(this.heading) * nextSpeed;
    this.vy = Math.sin(this.heading) * nextSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.wrapAcrossBounds(bounds);

    this.opacity = 1;
    this.size = this.baseSize;
  }

  onHit(damage = 1) {
    if (isTerminalEntityState(this.state)) {
      return { defeated: false, remainingHp: 0, pointValue: 0, frozen: false, poisoned: false, burning: false, ensnared: false };
    }

    const now = performance.now();
    const frozen = this.slow !== null && now < this.slow.expiresAt;
    const poisoned = this.poison !== null && now < this.poison.expiresAt;
    const burning = this.burn !== null && now < this.burn.expiresAt;
    const ensnared = this.ensnare !== null && now < this.ensnare.expiresAt;
    const pointValue = this.getBasePointValue();
    const supportStatuses = this.getActiveSupportStatuses(now, ensnared ? "ensnare" : null);

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
      this.enterDyingState(ensnared ? "ensnare" : null, supportStatuses);
      this.ensnare = null;
      return {
        defeated: true,
        remainingHp: 0,
        pointValue,
        frozen,
        poisoned,
        burning,
        ensnared,
        finisherStatus: ensnared ? "ensnare" : null,
        supportStatuses,
      };
    }

    this.state = "flee";
    this.fleeTimer = 0.9 + Math.random() * 0.5;
    this.syncTypeSpec();
    const comboEvents = this.handleStatusInteractions();
    if (isTerminalEntityState(this.state)) {
      return {
        defeated: true,
        remainingHp: 0,
        pointValue,
        frozen,
        poisoned,
        burning,
        ensnared,
        comboEvents,
        finisherStatus: null,
        supportStatuses,
      };
    }
    return {
      defeated: false,
      remainingHp: this.hp,
      pointValue: 0,
      frozen,
      poisoned,
      burning,
      ensnared,
      comboEvents,
      finisherStatus: null,
      supportStatuses,
    };
  }

  /** Handle status combo interactions after a hit. */
  handleStatusInteractions() {
    const now = performance.now();
    const isCharged = this.charged !== null && now < this.charged.expiresAt;
    const isBurning = this.burn !== null && now < this.burn.expiresAt;
    const isFrozen = this.slow !== null && now < this.slow.expiresAt;
    const comboEvents: Array<"detonate" | "quench"> = [];

    // burning + charged → detonation: extra damage burst, clears charged
    if (isBurning && isCharged) {
      this.hp = Math.max(0, this.hp - 3);
      this.charged = null;
      comboEvents.push("detonate");
      if (this.hp === 0 && !isTerminalEntityState(this.state)) {
        this.enterDyingState(null, this.getActiveSupportStatuses(now));
      }
    }

    // frozen + burning → extinguish burn, deal 2 bonus damage
    if (isFrozen && isBurning) {
      this.burn = null;
      this.hp = Math.max(0, this.hp - 2);
      comboEvents.push("quench");
      if (this.hp === 0 && !isTerminalEntityState(this.state)) {
        this.enterDyingState(null, this.getActiveSupportStatuses(now));
      }
    }

    return comboEvents;
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
  applyPoison(dps: number, durationMs: number, sourceWeaponId?: string) {
    const now = performance.now();
    if (this.poison && now < this.poison.expiresAt) {
      this.poison.expiresAt = this.poison.expiresAt + durationMs;
      this.poison.sourceWeaponId = sourceWeaponId ?? this.poison.sourceWeaponId;
    } else {
      this.poison = {
        dps,
        expiresAt: now + durationMs,
        accumulatedDmg: 0,
        sourceWeaponId,
      };
    }
    if (sourceWeaponId) this.dotSourceWeaponId = sourceWeaponId;
  }

  /** Apply flamethrower burn. Reapplication refreshes duration and keeps the stronger flame. */
  applyBurn(
    dps: number,
    durationMs: number,
    decayPerSecond = 3.2,
    sourceWeaponId?: string,
  ) {
    const now = performance.now();
    if (this.burn && now < this.burn.expiresAt) {
      this.burn.dps = Math.max(this.burn.dps, dps);
      this.burn.decayPerSecond = Math.max(this.burn.decayPerSecond, decayPerSecond);
      this.burn.expiresAt = Math.max(this.burn.expiresAt, now + durationMs);
      this.burn.sourceWeaponId = sourceWeaponId ?? this.burn.sourceWeaponId;
    } else {
      this.burn = {
        dps,
        expiresAt: now + durationMs,
        accumulatedDmg: 0,
        decayPerSecond,
        sourceWeaponId,
      };
    }
    if (sourceWeaponId) this.dotSourceWeaponId = sourceWeaponId;
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
  applyLooped(dps: number, durationMs: number, sourceWeaponId?: string) {
    const now = performance.now();
    if (this.looped && now < this.looped.expiresAt) {
      this.looped.dps = Math.max(this.looped.dps, dps);
      this.looped.expiresAt = Math.max(this.looped.expiresAt, now + durationMs);
    } else {
      this.looped = { dps, expiresAt: now + durationMs, accumulatedDmg: 0 };
    }
    if (sourceWeaponId) this.dotSourceWeaponId = sourceWeaponId;
  }

  /** Apply ally state — bug stops targeting the player base. */
  applyAlly(config: AllyConversionConfig) {
    const now = performance.now();
    this.ally = {
      expiresAt: now + config.durationMs,
      expireBurstDamage: config.expireBurstDamage ?? 0,
      expireBurstRadius: config.expireBurstRadius ?? 0,
      interceptForce: config.interceptForce ?? 2.5,
    };
    this.allyContactReadyAt = now + 180;
    this.dotSourceWeaponId = null;
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
    if (isTerminalEntityState(this.state)) return;
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
    this.allyContactReadyAt = 0;
    this.dotSourceWeaponId = null;
    this.deathCredited = false;
    this.finalBlowStatus = null;
    this.supportStatusesAtDeath = [];
    this.deathPointValue = this.getBasePointValue();
    this.motionTime = Math.random() * 100;
    this.resetRoamState();
    this.opacity = 1;
    this.size = this.baseSize;
    this.hasEnteredField = this.x >= 0 && this.x <= width && this.y >= 0 && this.y <= height;
    this.syncTypeSpec();
  }

  render(ctx2d: CanvasRenderingContext2D, alpha = 1) {
    const wrapDelta = (from: number, to: number, span: number) => {
      if (span <= 0) {
        return to - from;
      }

      let delta = to - from;
      if (delta > span * 0.5) {
        delta -= span;
      } else if (delta < -span * 0.5) {
        delta += span;
      }

      return delta;
    };
    const renderX =
      this.hasEnteredField && this.fieldWidth > 0
        ? this.prevX + wrapDelta(this.prevX, this.x, this.fieldWidth) * alpha
        : this.prevX * (1 - alpha) + this.x * alpha;
    const renderY =
      this.hasEnteredField && this.fieldHeight > 0
        ? this.prevY + wrapDelta(this.prevY, this.y, this.fieldHeight) * alpha
        : this.prevY * (1 - alpha) + this.y * alpha;
    const typeSpec = this.syncTypeSpec();
    const color = typeSpec?.color;
    const sizeMultiplier = typeSpec?.size ?? 1;
    const wrapMargin = Math.max(12, this.size * sizeMultiplier * 0.7);
    const now = performance.now();
    const statusStrength = (expiresAt: number | undefined, fullMs: number) => {
      if (!expiresAt || now >= expiresAt) {
        return 0;
      }

      return Math.max(0.18, Math.min(1, (expiresAt - now) / fullMs));
    };

    const drawAt = (x: number, y: number) => {
      drawBugSprite(ctx2d, {
        x,
        y,
        size: this.size * sizeMultiplier,
        rotation: this.heading,
        opacity: this.opacity,
        variant: this.variant,
        color: color ?? undefined,
        timeMs: now,
        statusFlags: {
          ally: statusStrength(this.ally?.expiresAt, 7000),
          burn: statusStrength(this.burn?.expiresAt, 2800),
          charged: statusStrength(this.charged?.expiresAt, 2400),
          ensnare: statusStrength(this.ensnare?.expiresAt, 2200),
          freeze: statusStrength(this.slow?.expiresAt, 2200),
          marked: statusStrength(this.marked?.expiresAt, 2600),
          poison: statusStrength(this.poison?.expiresAt, 3200),
          unstable: statusStrength(this.unstable?.expiresAt, 2600),
        },
      });
    };

    const xOffsets = [0];
    const yOffsets = [0];

    if (this.hasEnteredField && this.fieldWidth > 0) {
      if (renderX < wrapMargin) {
        xOffsets.push(this.fieldWidth);
      }
      if (renderX > this.fieldWidth - wrapMargin) {
        xOffsets.push(-this.fieldWidth);
      }
    }

    if (this.hasEnteredField && this.fieldHeight > 0) {
      if (renderY < wrapMargin) {
        yOffsets.push(this.fieldHeight);
      }
      if (renderY > this.fieldHeight - wrapMargin) {
        yOffsets.push(-this.fieldHeight);
      }
    }

    for (const xOffset of xOffsets) {
      for (const yOffset of yOffsets) {
        drawAt(renderX + xOffset, renderY + yOffset);
      }
    }
  }
}