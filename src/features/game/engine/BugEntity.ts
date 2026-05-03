import { Entity } from "./Entity";
import { drawBugSprite } from "@game/utils/bugSprite";
import type { SiegeStatusId } from "@game/status/statusCatalog";
import { STATUS_PRIORITY } from "@game/status/statusCatalog";
import { DEFAULT_GAME_CONFIG } from "./types";
import { getCodex, type CrawlProfile, type CrawlRegion, type BugType } from "./bugCodex";
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
type BugMovementMood = "patrol" | "loiter" | "lane-follow" | "regroup" | "startled";

const ALLY_CONTACT_DAMAGE = 2;
const ALLY_CONTACT_COOLDOWN_MS = 260;
const ALLY_INTERCEPT_RADIUS = 196;
const DEFAULT_ROAM_INTERVAL: [number, number] = [1.4, 5];

const DEFAULT_REGION_WEIGHTS: Record<CrawlRegion, number> = {
  edge: 0.2,
  interior: 0.34,
  middle: 0.46,
};

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
  roamTargetRegion: CrawlRegion | null;
  roamTargetWide: boolean;
  roamTargetLongPath: boolean;
  nextRoamTargetAt: number;
  roamTargetGeneration: number;
  roamLoiterUntil: number;
  movementMood: BugMovementMood;
  orbitBias: -1 | 1;
  packAffinity: number;
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
    this.roamTargetRegion = null;
    this.roamTargetWide = false;
    this.roamTargetLongPath = false;
    this.nextRoamTargetAt = 0;
    this.roamTargetGeneration = 0;
    this.roamLoiterUntil = 0;
    this.movementMood = "patrol";
    this.orbitBias = Math.random() < 0.5 ? -1 : 1;
    this.packAffinity = 0.7 + Math.random() * 0.55;
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

  private pickRoamRegion(profile: CrawlProfile | null, generation: number): CrawlRegion {
    const regionWeights = profile?.regionWeights ?? DEFAULT_REGION_WEIGHTS;
    const preferredRegion = this.typeSpec?.preferredRegion;
    const anchorBias = profile?.anchorBias ?? "any";
    const edgePreference = profile?.edgePreference ?? 0;
    const edgeWeight =
      regionWeights.edge +
      Math.max(0, edgePreference) * 0.45 +
      (anchorBias === "perimeter" ? 0.1 : 0) +
      (preferredRegion === "edge" ? 0.06 : 0);
    const interiorWeight =
      regionWeights.interior +
      Math.max(0, -edgePreference) * 0.68 +
      (anchorBias === "interior" ? 0.18 : 0) +
      (preferredRegion === "interior" ? 0.1 : 0);
    const middleWeight =
      regionWeights.middle +
      (anchorBias === "any" ? 0.12 : 0) +
      (preferredRegion === "middle" ? 0.12 : 0);
    const totalWeight = Math.max(0.01, edgeWeight + interiorWeight + middleWeight);
    const roll =
      this.getUnitNoise(this.seed * 23.3 + generation * 1.11, this.seed * 53.1) *
      totalWeight;

    if (roll < edgeWeight) {
      return "edge";
    }

    if (roll < edgeWeight + middleWeight) {
      return "middle";
    }

    return "interior";
  }

  private getRegionAnchorPoint(
    region: CrawlRegion,
    baseX: number,
    baseY: number,
    sideNoise: number,
  ) {
    const centerX = 0.5;
    const centerY = 0.5;

    if (region === "edge") {
      const side = Math.floor(sideNoise * 4);
      const inset = lerp(0.02, 0.13, baseX);
      const sweep = lerp(0.04, 0.96, baseY);
      if (side === 0) {
        return { x: inset, y: sweep };
      }
      if (side === 1) {
        return { x: 1 - inset, y: sweep };
      }
      if (side === 2) {
        return { x: sweep, y: inset };
      }

      return { x: sweep, y: 1 - inset };
    }

    if (region === "interior") {
      const angle = sideNoise * Math.PI * 2 + (baseX - 0.5) * 0.7;
      const radius = lerp(0.05, 0.19, baseY);

      return {
        x: clamp(centerX + Math.cos(angle) * radius * 0.92, 0.28, 0.72),
        y: clamp(centerY + Math.sin(angle) * radius * 0.78, 0.26, 0.74),
      };
    }

    const angle = sideNoise * Math.PI * 2 + (baseY - 0.5) * 1.25;
    const radius = lerp(0.2, 0.42, baseX);
    const skewX = (baseY - 0.5) * 0.08;
    const skewY = (baseX - 0.5) * 0.08;

    return {
      x: clamp(centerX + Math.cos(angle) * radius * 0.94 + skewX, 0.1, 0.9),
      y: clamp(centerY + Math.sin(angle) * radius * 0.8 + skewY, 0.1, 0.9),
    };
  }

  private getSocialCohesion(
    neighbors: BugEntity[],
    socialAffinity: number,
    crowdScore: number,
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    if (socialAffinity <= 0.22 || neighbors.length === 0) {
      return { x: 0, y: 0 };
    }

    let centerX = 0;
    let centerY = 0;
    let totalWeight = 0;

    for (const neighbor of neighbors) {
      if (!(neighbor instanceof BugEntity) || isTerminalEntityState(neighbor.state)) {
        continue;
      }

      const dx = neighbor.x - this.x;
      const dy = neighbor.y - this.y;
      const distance = Math.max(1, getLength(dx, dy));
      const sameVariantBonus = neighbor.variant === this.variant ? 1.25 : 1;
      const weight = (1 - clamp(distance / config.crowdAvoidRadius, 0, 1)) * sameVariantBonus;

      centerX += neighbor.x * weight;
      centerY += neighbor.y * weight;
      totalWeight += weight;
    }

    if (totalWeight <= 0 || crowdScore > config.crowdRepathThreshold * 0.85) {
      return { x: 0, y: 0 };
    }

    const towardGroup = normalizeVector(centerX / totalWeight - this.x, centerY / totalWeight - this.y);
    const strength = clamp(socialAffinity, 0, 1) * 0.035;

    return {
      x: towardGroup.x * strength,
      y: towardGroup.y * strength,
    };
  }

  private getWallSteering(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    const edgeLaneScale = this.roamTargetRegion === "edge" && this.state !== "flee" ? 0.62 : 1;
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

  private getPerimeterResidencySteering(bounds: { width: number; height: number }) {
    if (this.roamTargetRegion !== "edge") {
      return { x: 0, y: 0 };
    }

    const targetX = this.roamTargetX ?? this.x;
    const targetY = this.roamTargetY ?? this.y;
    const minDistances = {
      left: targetX,
      right: bounds.width - targetX,
      top: targetY,
      bottom: bounds.height - targetY,
    };
    const side = Object.entries(minDistances).sort((left, right) => left[1] - right[1])[0]?.[0] as
      | "left"
      | "right"
      | "top"
      | "bottom";
    const laneInset = Math.max(16, Math.min(bounds.width, bounds.height) * 0.09);
    const laneWidth = Math.max(18, Math.min(bounds.width, bounds.height) * 0.075);

    if (side === "left" || side === "right") {
      const laneCenterX = side === "left" ? laneInset : bounds.width - laneInset;
      return {
        x: clamp((laneCenterX - this.x) / laneWidth, -1, 1) * 0.18,
        y: clamp((targetY - this.y) / Math.max(bounds.height * 0.22, 1), -1, 1) * 0.07,
      };
    }

    const laneCenterY = side === "top" ? laneInset : bounds.height - laneInset;
    return {
      x: clamp((targetX - this.x) / Math.max(bounds.width * 0.22, 1), -1, 1) * 0.07,
      y: clamp((laneCenterY - this.y) / laneWidth, -1, 1) * 0.18,
    };
  }

  private getCursorRepelResponse(
    targetX: number,
    targetY: number,
    config: typeof DEFAULT_GAME_CONFIG,
    cursorHoverRepelMultiplier: number,
    cursorTangentStrength: number,
  ) {
    const away = normalizeVector(this.x - targetX, this.y - targetY);
    const distance = getLength(this.x - targetX, this.y - targetY);
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
    const lateral = {
      x: -away.y * this.orbitBias,
      y: away.x * this.orbitBias,
    };
    const scatter = Math.sin(
      this.motionTime * (7.8 + cursorHoverRepelMultiplier * 0.9) + this.seed * 13.7,
    );
    const directForce =
      (0.12 + cursorHoverRepelMultiplier * 0.9) +
      pressure * (0.94 + cursorHoverRepelMultiplier * 3.1);
    const lateralForce =
      pressure * (0.02 + cursorHoverRepelMultiplier * 0.12) * cursorTangentStrength;
    const immediateThreatThreshold = Math.max(
      0.05,
      0.19 - cursorHoverRepelMultiplier * 0.034,
    );

    return {
      active: true,
      pressure,
      steerX: away.x * directForce + lateral.x * scatter * lateralForce,
      steerY: away.y * directForce + lateral.y * scatter * lateralForce,
      immediateThreat: pressure > immediateThreatThreshold,
    };
  }

  private getCornerEscapeSteering(
    bounds: { width: number; height: number },
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
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
    let swirlX = 0;
    let swirlY = 0;
    const personalSpace = Math.max(this.size * 2.05, radius * 0.34);
    const softRadius = Math.max(personalSpace + 1, radius * 0.72);

    for (const neighbor of neighbors) {
      const dx = this.x - neighbor.x;
      const dy = this.y - neighbor.y;
      const distance = Math.max(1, getLength(dx, dy));
      const collisionPressure = 1 - clamp((distance - 1) / Math.max(personalSpace, 1), 0, 1);
      const softPressure = 1 - clamp((distance - personalSpace) / Math.max(softRadius - personalSpace, 1), 0, 1);
      const weight = collisionPressure * 0.92 + softPressure * 0.12;
      if (weight <= 0.001) {
        continue;
      }
      const tangentBias = Math.sin(
        this.seed * 17.3 + neighbor.seed * 11.9 + this.motionTime * 0.37,
      );
      separationX += (dx / distance) * weight;
      separationY += (dy / distance) * weight;
      swirlX += (-dy / distance) * weight * tangentBias;
      swirlY += (dx / distance) * weight * tangentBias;
    }

    const away = normalizeVector(separationX, separationY);
    const swirl = normalizeVector(swirlX, swirlY);
    const swirlStrength = Math.min(0.54, neighbors.length * 0.06);
    const directStrength = 0.62 * localAvoidanceStrength;

    return {
      x: away.x * strength * directStrength + swirl.x * strength * swirlStrength,
      y: away.y * strength * directStrength + swirl.y * strength * swirlStrength,
    };
  }

  private getFlowFieldSteering(
    bounds: { width: number; height: number },
    noiseFrequency: number,
    wanderMultiplier: number,
    crowdScore: number,
    config: typeof DEFAULT_GAME_CONFIG,
    flowFieldStrength: number,
  ) {
    const normalizedX = this.x / Math.max(bounds.width, 1);
    const normalizedY = this.y / Math.max(bounds.height, 1);
    const fieldScale = 4.8 + noiseFrequency * 1.9;
    const timePhase = this.motionTime * (0.075 + noiseFrequency * 0.028);
    const angleNoise = perlin1D(
      normalizedX * fieldScale + normalizedY * (fieldScale * 0.83) + timePhase + this.seed * 13.1,
      this.seed * 47.3,
    );
    const curlNoise = perlin1D(
      normalizedY * (fieldScale * 1.07) - normalizedX * (fieldScale * 0.71) + timePhase * 1.3 + this.seed * 29.9,
      this.seed * 61.7,
    );
    const fieldAngle =
      angleNoise * Math.PI * 1.18 +
      curlNoise * Math.PI * 0.24 +
      Math.sin(this.motionTime * 0.19 + this.seed * 17.7) * 0.1;
    const flowDirection = {
      x: Math.cos(fieldAngle),
      y: Math.sin(fieldAngle),
    };
    const crowdPressure = clamp(
      crowdScore / Math.max(config.crowdRepathThreshold, 1),
      0,
      1.5,
    );
    const strength =
      (0.16 + wanderMultiplier * 0.08 + crowdPressure * 0.05) * flowFieldStrength;

    return {
      x: flowDirection.x * strength,
      y: flowDirection.y * strength,
    };
  }

  private resetRoamState() {
    this.roamTargetX = null;
    this.roamTargetY = null;
    this.roamTargetRegion = null;
    this.roamTargetWide = false;
    this.roamTargetLongPath = false;
    this.nextRoamTargetAt = 0;
    this.roamTargetGeneration = 0;
    this.roamLoiterUntil = 0;
    this.movementMood = "patrol";
    this.orbitBias = Math.random() < 0.5 ? -1 : 1;
    this.packAffinity = 0.7 + Math.random() * 0.55;
  }

  private getLoiterDurationMs(profile: CrawlProfile | null, generation: number) {
    const baseDuration =
      180 +
      this.getUnitNoise(this.seed * 19.7 + generation * 0.63, this.seed * 41.9) * 220;

    if (profile?.behavior === "panic") {
      return baseDuration * 0.72;
    }

    if (profile?.behavior === "stalk") {
      return baseDuration * 1.18;
    }

    if (profile?.behavior === "skitter") {
      return baseDuration * 0.88;
    }

    return baseDuration;
  }

  private getUnitNoise(position: number, seed: number) {
    return clamp(perlin1D(position, seed) * 0.5 + 0.5, 0, 1);
  }

  private getMovementMood(
    now: number,
    targetDistance: number,
    neighbors: BugEntity[],
    socialAffinity: number,
    crowdScore: number,
    config: typeof DEFAULT_GAME_CONFIG,
    isBurnPanicking: boolean,
  ): BugMovementMood {
    const wasRecentlyHit = this.lastHitTime > 0 && now - this.lastHitTime < 820;

    if (this.state === "flee" || isBurnPanicking || wasRecentlyHit) {
      return "startled";
    }

    if (
      socialAffinity >= 0.12 &&
      neighbors.length >= 2 &&
      crowdScore < config.crowdRepathThreshold * 0.72
    ) {
      return "regroup";
    }

    if (
      !this.roamTargetWide &&
      !this.roamTargetLongPath &&
      this.roamTargetRegion === "edge" &&
      targetDistance > config.targetReachRadius * 1.9
    ) {
      return "lane-follow";
    }

    return "patrol";
  }

  private getMoodSpeedMultiplier(mood: BugMovementMood) {
    if (mood === "lane-follow") {
      return 1.03;
    }

    if (mood === "regroup") {
      return 0.96;
    }

    if (mood === "startled") {
      return 1.16;
    }

    return 1;
  }

  private getLaneFollowSteering(
    bounds: { width: number; height: number },
    targetDirection: { x: number; y: number },
  ) {
    const targetX = this.roamTargetX ?? this.x;
    const targetY = this.roamTargetY ?? this.y;
    const centerX = bounds.width * 0.5;
    const centerY = bounds.height * 0.5;
    const radial = normalizeVector(targetX - centerX, targetY - centerY);
    const tangent = normalizeVector(-radial.y * this.orbitBias, radial.x * this.orbitBias);
    const tangentStrength = this.roamTargetRegion === "edge" ? 0.08 : 0.06;
    const laneCorrection = this.roamTargetRegion === "edge" ? 0.06 : 0.04;

    return {
      x: tangent.x * tangentStrength + targetDirection.x * laneCorrection,
      y: tangent.y * tangentStrength + targetDirection.y * laneCorrection,
    };
  }

  private getRegroupSteering(
    neighbors: BugEntity[],
    socialAffinity: number,
    crowdScore: number,
    config: typeof DEFAULT_GAME_CONFIG,
  ) {
    if (socialAffinity < 0.12 || neighbors.length < 2) {
      return { x: 0, y: 0 };
    }

    const crowdRelief = 1 - clamp(crowdScore / Math.max(config.crowdRepathThreshold, 1), 0, 1);
    if (crowdRelief <= 0) {
      return { x: 0, y: 0 };
    }

    let centerX = 0;
    let centerY = 0;
    let headingX = 0;
    let headingY = 0;
    let totalWeight = 0;

    for (const neighbor of neighbors) {
      if (!(neighbor instanceof BugEntity) || isTerminalEntityState(neighbor.state)) {
        continue;
      }

      const distance = Math.max(1, getLength(neighbor.x - this.x, neighbor.y - this.y));
      const sameVariantBonus = neighbor.variant === this.variant ? 1.3 : 1;
      const weight = (1 - clamp(distance / config.crowdAvoidRadius, 0, 1)) * sameVariantBonus;
      if (weight <= 0) {
        continue;
      }

      centerX += neighbor.x * weight;
      centerY += neighbor.y * weight;
      const neighborHeading = normalizeVector(neighbor.vx, neighbor.vy);
      headingX += neighborHeading.x * weight;
      headingY += neighborHeading.y * weight;
      totalWeight += weight;
    }

    if (totalWeight <= 0) {
      return { x: 0, y: 0 };
    }

    const towardPack = normalizeVector(centerX / totalWeight - this.x, centerY / totalWeight - this.y);
    const alignedHeading = normalizeVector(headingX, headingY);
    const packStrength = clamp(socialAffinity, 0, 1) * 0.045 * crowdRelief;
    const alignStrength = clamp(socialAffinity, 0, 1) * 0.02 * crowdRelief;

    return {
      x: towardPack.x * packStrength + alignedHeading.x * alignStrength,
      y: towardPack.y * packStrength + alignedHeading.y * alignStrength,
    };
  }

  private getChaosSteering(
    targetDirection: { x: number; y: number },
    neighborCount: number,
    crowdScore: number,
    config: typeof DEFAULT_GAME_CONFIG,
    wanderMultiplier: number,
    chaosTangentStrength: number,
  ) {
    const crowdPressure = clamp(
      crowdScore / Math.max(config.crowdRepathThreshold, 1),
      0,
      1.8,
    );
    const neighborPressure = clamp(neighborCount / 6, 0, 1.4);
    const turbulence =
      0.06 +
      wanderMultiplier * 0.04 +
      crowdPressure * 0.09 +
      neighborPressure * 0.08;

    const baseDirection =
      targetDirection.x === 0 && targetDirection.y === 0
        ? { x: Math.cos(this.heading), y: Math.sin(this.heading) }
        : targetDirection;
    const tangentSign = Math.sin(
      this.motionTime * 1.7 + this.seed * 41.3 + neighborCount * 0.33,
    );
    const tangent = {
      x: -baseDirection.y * (tangentSign >= 0 ? 1 : -1),
      y: baseDirection.x * (tangentSign >= 0 ? 1 : -1),
    };
    const scatterHeading =
      this.heading +
      perlin1D(this.motionTime * (0.82 + crowdPressure * 0.24) + this.seed * 19.1, this.seed * 73.7) *
        (0.7 + crowdPressure * 0.6 + neighborPressure * 0.4);
    const scatter = {
      x: Math.cos(scatterHeading),
      y: Math.sin(scatterHeading),
    };
    const surge =
      0.68 +
      this.getUnitNoise(
        this.motionTime * (0.44 + neighborPressure * 0.12) + this.seed * 27.9,
        this.seed * 91.7,
      ) *
        (0.52 + crowdPressure * 0.18);

    return {
      x: tangent.x * turbulence * chaosTangentStrength + scatter.x * turbulence * surge,
      y: tangent.y * turbulence * chaosTangentStrength + scatter.y * turbulence * surge,
    };
  }

  private getProjectedRoamTarget(
    bounds: { width: number; height: number },
    margin: number,
    heading: number,
    headingJitter: number,
    travelNoise: number,
  ) {
    const direction = normalizeVector(
      Math.cos(heading + headingJitter),
      Math.sin(heading + headingJitter),
    );
    const minX = margin;
    const maxX = bounds.width - margin;
    const minY = margin;
    const maxY = bounds.height - margin;
    const times: number[] = [];

    if (Math.abs(direction.x) > 0.001) {
      const tx = direction.x > 0 ? (maxX - this.x) / direction.x : (minX - this.x) / direction.x;
      if (tx > 0) {
        times.push(tx);
      }
    }

    if (Math.abs(direction.y) > 0.001) {
      const ty = direction.y > 0 ? (maxY - this.y) / direction.y : (minY - this.y) / direction.y;
      if (ty > 0) {
        times.push(ty);
      }
    }

    const travelTime = times.length ? Math.min(...times) : Math.min(bounds.width, bounds.height) * 0.45;
    const tangent = { x: -direction.y, y: direction.x };
    const tangentShift = (travelNoise - 0.5) * Math.min(bounds.width, bounds.height) * 0.12;

    return {
      x: clamp(this.x + direction.x * travelTime + tangent.x * tangentShift, minX, maxX),
      y: clamp(this.y + direction.y * travelTime + tangent.y * tangentShift, minY, maxY),
    };
  }

  private getLoiterSteering(targetDirection: { x: number; y: number }) {
    const forward = {
      x: Math.cos(this.heading),
      y: Math.sin(this.heading),
    };
    const lateral = {
      x: -forward.y,
      y: forward.x,
    };
    const weave = Math.sin(this.motionTime * 1.8 + this.seed * 9.3) * 0.022;

    return {
      x: forward.x * 0.08 + targetDirection.x * 0.04 + lateral.x * weave,
      y: forward.y * 0.08 + targetDirection.y * 0.04 + lateral.y * weave,
    };
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
    this.roamTargetGeneration += 1;
    const margin = Math.max(22, this.size * 3.2, config.wallAvoidDistance * 1.25);
    const usableWidth = Math.max(1, bounds.width - margin * 2);
    const usableHeight = Math.max(1, bounds.height - margin * 2);
    const generation = this.roamTargetGeneration;
    const roamRadius = profile?.roamRadius ?? config.roamTargetMinDistance;
    const wideRoamChance = profile?.wideRoamChance ?? 0.24;
    const longPathBias = clamp(profile?.longPathBias ?? 0.72, 0, 1);
    const pathCommitment = Math.max(0.6, profile?.pathCommitment ?? 1);
    const broadCrowding = getCrowdingAt?.(
      this.x,
      this.y,
      config.crowdAvoidRadius * 2.1,
      this,
    );
    const currentEdgeCoverage = Math.max(
      Math.abs(this.x / bounds.width - 0.5),
      Math.abs(this.y / bounds.height - 0.5),
    );
    const currentPerimeterDistance = Math.min(
      this.x,
      bounds.width - this.x,
      this.y,
      bounds.height - this.y,
    );
    const currentPerimeterScore = 1 - clamp(
      currentPerimeterDistance / Math.max(Math.min(bounds.width, bounds.height) * 0.16, 1),
      0,
      1,
    );
    let bestTargetX = this.x;
    let bestTargetY = this.y;
    let bestScore = -Infinity;
    let bestRegion: CrawlRegion | null = null;
    let bestWideRoam = false;
    let bestLongPath = false;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const attemptPhase = generation + attempt * 0.37;
      const driftPhase = this.motionTime * 0.013 * (profile?.noiseFrequency ?? 1);
      const baseX = this.getUnitNoise(
        this.seed * 31.7 + attemptPhase * 0.73 + driftPhase,
        this.seed * 67.3 + attemptPhase * 3.1,
      );
      const baseY = this.getUnitNoise(
        this.seed * 43.9 + attemptPhase * 0.61 + driftPhase,
        this.seed * 71.5 + attemptPhase * 2.7,
      );
      const laneBias = this.getUnitNoise(
        this.seed * 17.1 + attemptPhase * 1.37,
        this.seed * 59.9 + attempt * 0.41,
      );
      const wideRoam = laneBias < wideRoamChance;
      const region = wideRoam ? "middle" : this.pickRoamRegion(profile, generation + attempt);
      const longPathRoll = this.getUnitNoise(
        this.seed * 13.9 + generation * 0.59 + attempt * 0.43,
        this.seed * 97.1,
      );
      const longPathChance = clamp(
        longPathBias + (wideRoam ? 0.22 : 0) + (region === "interior" ? 0.12 : region === "middle" ? 0.05 : -0.26),
        0,
        1,
      );
      const useLongPath = longPathRoll <= longPathChance;
      const projectedTarget = useLongPath
        ? this.getProjectedRoamTarget(
            bounds,
            margin,
            this.heading,
            (baseX - 0.5) * 0.9 + (laneBias - 0.5) * 0.55,
            baseY,
          )
        : null;
      const anchorPoint = !useLongPath
        ? this.getRegionAnchorPoint(region, baseX, baseY, laneBias)
        : null;

      let candidateX = projectedTarget?.x ?? margin + (anchorPoint?.x ?? 0.5) * usableWidth;
      let candidateY = projectedTarget?.y ?? margin + (anchorPoint?.y ?? 0.5) * usableHeight;
      if (!useLongPath && !wideRoam && roamRadius > 0) {
        const toTargetX = candidateX - this.x;
        const toTargetY = candidateY - this.y;
        const distance = getLength(toTargetX, toTargetY);

        if (distance > roamRadius) {
          const direction = normalizeVector(toTargetX, toTargetY);
          candidateX = this.x + direction.x * roamRadius;
          candidateY = this.y + direction.y * roamRadius;
        }
      }

      candidateX = clamp(candidateX, margin, bounds.width - margin);
      candidateY = clamp(candidateY, margin, bounds.height - margin);

      const crowding = getCrowdingAt?.(candidateX, candidateY, config.crowdAvoidRadius);
      const crowdPenalty = clamp(
        (crowding?.score ?? 0) / Math.max(config.crowdRepathThreshold * 2.8, 1),
        0,
        1,
      );
      const broadCandidateCrowding = getCrowdingAt?.(
        candidateX,
        candidateY,
        config.crowdAvoidRadius * 2.1,
        this,
      );
      const broadPenalty = clamp(
        (broadCandidateCrowding?.score ?? 0) /
          Math.max(config.crowdRepathThreshold * 5.8, 1),
        0,
        1,
      );
      const broadEscape = broadCrowding
        ? clamp(
            getLength(
              candidateX - broadCrowding.centerX,
              candidateY - broadCrowding.centerY,
            ) / Math.max(Math.min(bounds.width, bounds.height) * 0.48, 1),
            0,
            1,
          )
        : 0;
      const distanceScore = clamp(
        getLength(candidateX - this.x, candidateY - this.y) /
          Math.max(roamRadius, config.roamTargetMinDistance, 1),
        0,
        1,
      );
      const edgeCoverage = Math.max(
        Math.abs(candidateX / bounds.width - 0.5),
        Math.abs(candidateY / bounds.height - 0.5),
      );
      const perimeterDistance = Math.min(
        candidateX,
        bounds.width - candidateX,
        candidateY,
        bounds.height - candidateY,
      );
      const perimeterScore = 1 - clamp(
        perimeterDistance / Math.max(Math.min(bounds.width, bounds.height) * 0.16, 1),
        0,
        1,
      );
      const perimeterResidency = edgeCoverage >= currentEdgeCoverage ? edgeCoverage - currentEdgeCoverage : 0;
      const perimeterCatchup = Math.max(0, perimeterScore - currentPerimeterScore);
      const broadEscapeWeight = broadCrowding && broadCrowding.score > config.crowdRepathThreshold
        ? 0.22
        : 0.1;
      const noveltyScore =
        this.roamTargetX != null && this.roamTargetY != null
          ? clamp(
              getLength(candidateX - this.roamTargetX, candidateY - this.roamTargetY) /
                Math.max(roamRadius * 0.9, config.roamTargetMinDistance * 0.8, 1),
              0,
              1,
            )
          : distanceScore;
      const chaosJitter = this.getUnitNoise(
        this.seed * 11.7 + generation * 0.83 + attempt * 0.49,
        this.seed * 109.1,
      );
      const tightCenterPenalty =
        region === "middle" && edgeCoverage < 0.12 && !wideRoam
          ? 0.08
          : 0;
      const regionBonus =
        region === "edge"
          ? 0.03 + perimeterScore * 0.05
          : region === "middle"
            ? 0.07
            : 0.05;
      const score =
        (1 - crowdPenalty) * 0.16 +
        (1 - broadPenalty) * 0.08 +
        distanceScore * 0.24 +
        edgeCoverage * 0.03 +
        perimeterScore * 0.02 +
        perimeterResidency * 0.01 +
        perimeterCatchup * 0.02 +
        broadEscape * broadEscapeWeight +
        noveltyScore * 0.18 +
        (useLongPath ? 0.06 + longPathBias * 0.08 : 0) +
        (wideRoam ? 0.04 : 0) +
        chaosJitter * 0.19 +
        regionBonus -
        tightCenterPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestTargetX = candidateX;
        bestTargetY = candidateY;
        bestRegion = region;
        bestWideRoam = wideRoam;
        bestLongPath = useLongPath;
      }
    }

    this.roamTargetX = bestTargetX;
    this.roamTargetY = bestTargetY;
    this.roamTargetRegion = bestRegion;
    this.roamTargetWide = bestWideRoam;
    this.roamTargetLongPath = bestLongPath;
    const [minInterval, maxInterval] = profile?.anchorDriftInterval ?? DEFAULT_ROAM_INTERVAL;
    const minIntervalMs = clamp(Math.min(minInterval, maxInterval) * 1000 * pathCommitment, 1200, 18_000);
    const maxIntervalMs = clamp(Math.max(minInterval, maxInterval) * 1000 * pathCommitment, minIntervalMs, 20_000);
    this.nextRoamTargetAt =
      now +
      minIntervalMs +
      this.getUnitNoise(this.seed * 37.1 + generation * 0.47, this.seed * 83.7) *
        (maxIntervalMs - minIntervalMs);
    this.roamLoiterUntil = 0;
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
      const targetDistance = getLength(this.roamTargetX! - this.x, this.roamTargetY! - this.y);
      const loiterEnterRadius = Math.max(config.targetReachRadius * 1.05, this.size * 2.4);

      if (this.roamTargetLongPath && targetDistance <= loiterEnterRadius * 1.4) {
        this.chooseRoamTarget(bounds, now, config, getCrowdingAt);
      } else if (targetDistance <= loiterEnterRadius) {
        this.chooseRoamTarget(bounds, now, config, getCrowdingAt);
      } else {
        this.roamLoiterUntil = 0;
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
      x: inward.x * config.followStrength * pressure * 0.08,
      y: inward.y * config.followStrength * pressure * 0.08,
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

    const motion = normalizeVector(this.vx || Math.cos(this.heading), this.vy || Math.sin(this.heading));
    let reflectX = motion.x;
    let reflectY = motion.y;

    if (inwardX !== 0) {
      reflectX = Math.abs(reflectX) * inwardX;
    }

    if (inwardY !== 0) {
      reflectY = Math.abs(reflectY) * inwardY;
    }

    const fallback = normalizeVector(
      bounds.width * 0.5 - this.x,
      bounds.height * 0.5 - this.y,
    );
    const recovery = normalizeVector(reflectX, reflectY);
    const nextDirection = recovery.x !== 0 || recovery.y !== 0 ? recovery : fallback;
    const recoveryHeading = Math.atan2(nextDirection.y, nextDirection.x);
    const recoverySpeed = Math.max(desiredSpeed * 0.9, config.baseSpeed * 0.72);

    this.heading = recoveryHeading;
    this.vx = Math.cos(recoveryHeading) * recoverySpeed;
    this.vy = Math.sin(recoveryHeading) * recoverySpeed;
    this.roamTargetX = null;
    this.roamTargetY = null;
    this.roamTargetWide = false;
    this.roamTargetLongPath = false;
    this.roamLoiterUntil = 0;
    this.nextRoamTargetAt = 0;
  }

  update(dt: number, ctx: BugUpdateContext) {
    const config = ctx.config ?? DEFAULT_GAME_CONFIG;
    const bounds = ctx.bounds ?? { width: 800, height: 600 };
    const typeSpec = this.syncTypeSpec();
    const profile = typeSpec?.profile ?? null;
    const socialAffinity = typeSpec?.socialAffinity ?? 0;
    const speedMultiplier = profile?.speedMultiplier ?? 1;
    const cursorFleeMultiplier = profile?.cursorFleeMultiplier ?? 1;
    const cursorHoverRepelMultiplier =
      profile?.cursorHoverRepelMultiplier ?? cursorFleeMultiplier;
    const cursorTangentStrength = profile?.cursorTangentStrength ?? 0.03;
    const turnMultiplier = profile?.turnMultiplier ?? 1;
    const wanderMultiplier = profile?.wanderMultiplier ?? 1;
    const noiseFrequency = profile?.noiseFrequency ?? 1;
    const noiseForwardStrength = 0.65 + (profile?.noiseForwardStrength ?? 0.2);
    const noiseLateralStrength = 0.65 + (profile?.noiseLateralStrength ?? 0.5);
    const noiseTurnStrength = profile?.noiseTurnStrength ?? 1;
    const separationMultiplier = profile?.separationMultiplier ?? 1;
    const chaosTangentStrength = profile?.chaosTangentStrength ?? 0.18;
    const flowFieldStrength = profile?.flowFieldStrength ?? 1;
    const localAvoidanceStrength = profile?.localAvoidanceStrength ?? 1;
    const crowdTangentBiasScale = profile?.crowdTangentBias ?? 1;
    const targetOrbitStrength = profile?.targetOrbitStrength ?? 0.1;

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
            cursorTangentStrength,
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

    this.movementMood = !isAlly && (this.state === "flee" || isBurnPanicking)
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
        weaveNoise * dt * (0.9 + config.wanderStrength * 1.1) * noiseTurnStrength,
    );
    desired.x += driftNoiseX * (0.52 + config.wanderStrength * 0.85) * noiseForwardStrength;
    desired.y += driftNoiseY * (0.52 + config.wanderStrength * 0.85) * noiseLateralStrength;
    desired.x += Math.cos(this.wanderAngle) * 0.18 * wanderMultiplier;
    desired.y += Math.sin(this.wanderAngle) * 0.18 * wanderMultiplier;

    const neighbors = ctx.getNeighbors(this, config.separationRadius);
    const separation = this.getNeighborSeparation(
      neighbors,
      config.separationRadius,
      config.separationStrength * 1.35 * separationMultiplier,
      localAvoidanceStrength,
    );
    desired.x += separation.x;
    desired.y += separation.y;

    const crowding = !isAlly && this.state !== "flee"
      ? ctx.getCrowdingAt?.(
          this.x,
          this.y,
          config.crowdAvoidRadius,
          this,
        )
      : undefined;

    const socialCohesion = this.getSocialCohesion(
      neighbors,
      socialAffinity,
      crowding?.score ?? 0,
      config,
    );
    desired.x += socialCohesion.x;
    desired.y += socialCohesion.y;

    const flowSteering = this.getFlowFieldSteering(
      bounds,
      noiseFrequency,
      wanderMultiplier,
      crowding?.score ?? 0,
      config,
      flowFieldStrength,
    );
    desired.x += flowSteering.x;
    desired.y += flowSteering.y;

    if (!isAlly && this.state !== "flee") {
      const roamTarget = this.getRoamTarget(bounds, now, config, ctx.getCrowdingAt);
      const toTargetX = roamTarget.x - this.x;
      const toTargetY = roamTarget.y - this.y;
      const targetDistance = getLength(toTargetX, toTargetY);
      const targetDirection = normalizeVector(toTargetX, toTargetY);
      const boardBias = this.getBoardBias(bounds, config);
      const perimeterResidency = this.getPerimeterResidencySteering(bounds);
      const mood = this.getMovementMood(
        now,
        targetDistance,
        neighbors,
        socialAffinity,
        crowding?.score ?? 0,
        config,
        isBurnPanicking,
      );

      this.movementMood = mood;

      const chaosSteering = this.getChaosSteering(
        targetDirection,
        neighbors.length,
        crowding?.score ?? 0,
        config,
        wanderMultiplier,
        chaosTangentStrength,
      );
      desired.x += chaosSteering.x;
      desired.y += chaosSteering.y;

      const boardBiasScale = this.roamTargetRegion === "edge" ? 0.62 : 1;
      desired.x += boardBias.x * boardBiasScale;
      desired.y += boardBias.y * boardBiasScale;
      desired.x += perimeterResidency.x;
      desired.y += perimeterResidency.y;

      if (targetDistance > config.targetReachRadius * 1.35) {
        const targetRamp = clamp(
          targetDistance / Math.max(profile?.roamRadius ?? config.roamTargetMinDistance, 1),
          0,
          1,
        );
        const roamPullStrength =
          config.followStrength *
          (0.38 + targetRamp * 0.95) *
          this.packAffinity *
          (1 + socialAffinity * 0.16);
        desired.x += targetDirection.x * roamPullStrength;
        desired.y += targetDirection.y * roamPullStrength;
      } else {
        const tangentDirection = {
          x: -targetDirection.y * this.orbitBias,
          y: targetDirection.x * this.orbitBias,
        };
        const loiterRadius = Math.max(config.targetReachRadius * 1.2, this.size * 2.8);
        const radialPressure = clamp(targetDistance / loiterRadius, 0, 1);
        const orbitStrength = this.roamTargetLongPath
          ? 0
          : config.followStrength * targetOrbitStrength * (0.08 + radialPressure * 0.22);
        const inwardCorrection = config.followStrength * (0.16 + (1 - radialPressure) * 0.12);
        const forwardCarry = 0.05 + (1 - radialPressure) * 0.04;
        const driftStrength = 0.02 + wanderMultiplier * 0.014;

        desired.x += tangentDirection.x * orbitStrength;
        desired.y += tangentDirection.y * orbitStrength;
        desired.x += targetDirection.x * inwardCorrection;
        desired.y += targetDirection.y * inwardCorrection;
        desired.x += Math.cos(this.heading) * forwardCarry;
        desired.y += Math.sin(this.heading) * forwardCarry;
        desired.x += Math.cos(this.wanderAngle) * driftStrength;
        desired.y += Math.sin(this.wanderAngle) * driftStrength;
      }

      if (mood === "lane-follow") {
        const laneFollow = this.getLaneFollowSteering(bounds, targetDirection);
        desired.x += laneFollow.x;
        desired.y += laneFollow.y;
      } else if (mood === "regroup") {
        const regroup = this.getRegroupSteering(
          neighbors,
          socialAffinity,
          crowding?.score ?? 0,
          config,
        );
        desired.x += regroup.x;
        desired.y += regroup.y;
      }

      if (crowding && crowding.score > config.crowdRepathThreshold) {
        const awayFromCrowd = normalizeVector(
          this.x - crowding.centerX,
          this.y - crowding.centerY,
        );
        const crowdTangentBias = Math.sin(
          this.seed * 29.7 + this.motionTime * 0.24 + crowding.count * 0.31,
        );
        const crowdTangent = {
          x: -awayFromCrowd.y * crowdTangentBias,
          y: awayFromCrowd.x * crowdTangentBias,
        };
        const crowdPressure = clamp(
          (crowding.score - config.crowdRepathThreshold) /
            Math.max(1, config.crowdTargetPenalty / 18),
          0,
          1,
        );

        desired.x +=
          awayFromCrowd.x * config.crowdSteerStrength * crowdPressure * 0.5 +
          crowdTangent.x * config.crowdSteerStrength * crowdPressure * 0.42 * crowdTangentBiasScale;
        desired.y +=
          awayFromCrowd.y * config.crowdSteerStrength * crowdPressure * 0.5 +
          crowdTangent.y * config.crowdSteerStrength * crowdPressure * 0.42 * crowdTangentBiasScale;
        this.nextRoamTargetAt = Math.min(
          this.nextRoamTargetAt,
          now + config.crowdRepathDelay * 1000,
        );
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
        const distance = getLength(hostile.x - this.x, hostile.y - this.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestHostile = hostile;
        }
      }

      if (nearestHostile) {
        const towardHostile = normalizeVector(
          nearestHostile.x - this.x,
          nearestHostile.y - this.y,
        );
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
      const away = normalizeVector(this.x - targetX, this.y - targetY);
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
      let cursorSteerX = cursorRepel.steerX;
      let cursorSteerY = cursorRepel.steerY;

      desired.x += cursorSteerX;
      desired.y += cursorSteerY;

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

      if (this.nextRoamTargetAt === 0 || this.nextRoamTargetAt > now + 260) {
        this.nextRoamTargetAt = now + 260;
      }
    }

    if (isBurnPanicking) {
      desired.x += (Math.random() - 0.5) * 1.6;
      desired.y += (Math.random() - 0.5) * 1.6;
    }

    const desiredDirection = normalizeVector(desired.x, desired.y);
    const desiredHeading =
      desiredDirection.x === 0 && desiredDirection.y === 0
        ? this.heading
        : Math.atan2(desiredDirection.y, desiredDirection.x);
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
          const distance = getLength(hostile.x - this.x, hostile.y - this.y);
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
    const localCrowdPressure = clamp(
      (crowding?.score ?? 0) / Math.max(config.crowdRepathThreshold, 1),
      0,
      1.8,
    );
    const speedPulse =
      0.74 +
      this.getUnitNoise(
        this.motionTime * (0.52 + noiseFrequency * 0.16) + this.seed * 37.7,
        this.seed * 61.1,
      ) *
        (0.56 + localCrowdPressure * 0.22);
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
    this.containWithinBounds(bounds, config, desiredSpeed);

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
    this.syncTypeSpec();
  }

  render(ctx2d: CanvasRenderingContext2D, alpha = 1) {
    const renderX = this.prevX * (1 - alpha) + this.x * alpha;
    const renderY = this.prevY * (1 - alpha) + this.y * alpha;
    const typeSpec = this.syncTypeSpec();
    const color = typeSpec?.color;
    const sizeMultiplier = typeSpec?.size ?? 1;
    const now = performance.now();
    const statusStrength = (expiresAt: number | undefined, fullMs: number) => {
      if (!expiresAt || now >= expiresAt) {
        return 0;
      }

      return Math.max(0.18, Math.min(1, (expiresAt - now) / fullMs));
    };

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
  }
}