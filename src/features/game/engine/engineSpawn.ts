import { getBugVariantMaxHp } from "../../../constants/bugs";
import type { BugVariant } from "../../../types/dashboard";
import { MAX_ACTIVE_BUGS, normalizeSpawnCounts, sanitizeSnapshotItems } from "./runtimeSafety";
import type { GameConfig } from "./types";
import { BugEntity } from "./BugEntity";
import type { BugTransitionSnapshotItem } from "@game/components/BackgroundField/types";

interface SpawnZone {
  height: number;
  left: number;
  top: number;
  width: number;
}

const GOLDEN_RATIO_CONJUGATE = 0.61803398875;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fract(value: number) {
  return value - Math.floor(value);
}

function createOrReuseBug({
  config,
  hasEnteredField,
  heading,
  hp,
  maxHp,
  opacity = 1,
  pool,
  size,
  variant,
  vx,
  vy,
  width,
  x,
  y,
  height,
}: {
  config: GameConfig;
  hasEnteredField: boolean;
  heading: number;
  hp?: number;
  maxHp?: number;
  opacity?: number;
  pool: BugEntity[];
  size?: number;
  variant: string;
  vx: number;
  vy: number;
  width: number;
  x: number;
  y: number;
  height: number;
}) {
  const resolvedSize = size ?? (6 + Math.random() * 2) * config.sizeMultiplier;
  const resolvedMaxHp = maxHp ?? getBugVariantMaxHp(variant as BugVariant);
  const resolvedHp = hp ?? resolvedMaxHp;

  if (pool.length > 0) {
    const bug = pool.pop()!;
    bug.revive(width, height);
    bug.variant = (variant as any) || "low";
    bug.size = resolvedSize;
    bug.baseSize = resolvedSize;
    bug.maxHp = resolvedMaxHp;
    bug.hp = resolvedHp;
    bug.x = x;
    bug.y = y;
    bug.vx = vx;
    bug.vy = vy;
    bug.heading = heading;
    bug.opacity = opacity;
    bug.hasEnteredField = hasEnteredField;
    return bug;
  }

  const bug = new BugEntity({
    heading,
    opacity,
    size: resolvedSize,
    variant: (variant as any) || "low",
    vx,
    vy,
    x,
    y,
  } as any);
  bug.baseSize = resolvedSize;
  bug.maxHp = resolvedMaxHp;
  bug.hp = resolvedHp;
  bug.hasEnteredField = hasEnteredField;

  return bug;
}

function getSpawnPoint(width: number, height: number, spawnZones: SpawnZone[]) {
  const usableZones = spawnZones.filter((zone) => zone.width > 24 && zone.height > 24);
  const totalZoneArea = usableZones.reduce(
    (total, zone) => total + zone.width * zone.height,
    0,
  );
  const padding = 18;

  if (!usableZones.length || Math.random() > 0.38 || totalZoneArea <= 0) {
    return {
      x: padding + Math.random() * Math.max(1, width - padding * 2),
      y: padding + Math.random() * Math.max(1, height - padding * 2),
    };
  }

  let roll = Math.random() * totalZoneArea;
  let selectedZone = usableZones[0];
  for (const zone of usableZones) {
    roll -= zone.width * zone.height;
    if (roll <= 0) {
      selectedZone = zone;
      break;
    }
  }

  return {
    x: Math.min(
      width - padding,
      Math.max(padding, selectedZone.left + Math.random() * selectedZone.width),
    ),
    y: Math.min(
      height - padding,
      Math.max(padding, selectedZone.top + Math.random() * selectedZone.height),
    ),
  };
}

export function getEdgeSpawnPoint(
  width: number,
  height: number,
  spawnIndex = 0,
  totalCount = 1,
) {
  const padding = 18;
  const edge = Math.floor(Math.random() * 4);
  const spanPosition =
    totalCount > 1
      ? fract(spawnIndex * GOLDEN_RATIO_CONJUGATE + Math.random() * 0.35)
      : Math.random();
  const jitterScale = Math.min(0.22, 0.9 / Math.max(3, totalCount));
  const lanePosition = clamp(
    spanPosition + (Math.random() - 0.5) * jitterScale,
    0.03,
    0.97,
  );
  const x = padding + lanePosition * Math.max(1, width - padding * 2);
  const y = padding + lanePosition * Math.max(1, height - padding * 2);

  if (edge === 0) {
    return { heading: Math.PI / 2, x, y: -padding };
  }

  if (edge === 1) {
    return { heading: Math.PI, x: width + padding, y };
  }

  if (edge === 2) {
    return { heading: -Math.PI / 2, x, y: height + padding };
  }

  return { heading: 0, x: -padding, y };
}

export function spawnEntitiesFromCounts({
  config,
  counts,
  height,
  pool,
  spawnZones = [],
  width,
}: {
  config: GameConfig;
  counts: Record<string, number>;
  height: number;
  pool: BugEntity[];
  spawnZones?: SpawnZone[];
  width: number;
}) {
  const normalizedCounts = normalizeSpawnCounts(counts, MAX_ACTIVE_BUGS);
  const entities: BugEntity[] = [];

  for (const variant of Object.keys(normalizedCounts)) {
    const count = normalizedCounts[variant] ?? 0;
    for (let index = 0; index < count; index += 1) {
      const { x, y } = getSpawnPoint(width, height, spawnZones);
      const heading = Math.random() * Math.PI * 2;
      const speed = config.baseSpeed * (0.8 + Math.random() * 0.6);
      entities.push(
        createOrReuseBug({
          config,
          hasEnteredField: true,
          heading,
          pool,
          variant,
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          width,
          x,
          y,
          height,
        }),
      );
    }
  }

  return entities;
}

export function spawnBurstEntities({
  config,
  counts,
  currentEntityCount,
  height,
  pool,
  width,
}: {
  config: GameConfig;
  counts: Record<string, number>;
  currentEntityCount: number;
  height: number;
  pool: BugEntity[];
  width: number;
}) {
  const remainingCapacity = Math.max(0, MAX_ACTIVE_BUGS - currentEntityCount);
  const normalizedCounts = normalizeSpawnCounts(counts, remainingCapacity);
  const variants = Object.keys(normalizedCounts);
  const totalCount = variants.reduce(
    (total, variant) => total + Math.max(0, normalizedCounts[variant] ?? 0),
    0,
  );
  const entities: BugEntity[] = [];
  let spawnIndex = 0;

  for (const variant of variants) {
    const count = normalizedCounts[variant] ?? 0;
    for (let index = 0; index < count; index += 1) {
      const spawnPoint = getEdgeSpawnPoint(width, height, spawnIndex, totalCount);
      const targetX = width * (0.18 + Math.random() * 0.64);
      const targetY = height * (0.18 + Math.random() * 0.64);
      const inwardHeading = Math.atan2(targetY - spawnPoint.y, targetX - spawnPoint.x);
      const heading = inwardHeading + (Math.random() - 0.5) * 0.55;
      const speed = config.baseSpeed * (0.9 + Math.random() * 0.85);

      entities.push(
        createOrReuseBug({
          config,
          hasEnteredField: false,
          heading,
          pool,
          variant,
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          width,
          x: spawnPoint.x,
          y: spawnPoint.y,
          height,
        }),
      );
      spawnIndex += 1;
    }
  }

  return entities;
}

export function spawnEntitiesFromSnapshot({
  height,
  pool,
  snapshot,
  width,
}: {
  height: number;
  pool: BugEntity[];
  snapshot: BugTransitionSnapshotItem[];
  width: number;
}) {
  const sanitizedSnapshot = sanitizeSnapshotItems(snapshot, width, height, MAX_ACTIVE_BUGS);
  const now = performance.now();
  const entities: BugEntity[] = [];

  for (const item of sanitizedSnapshot) {
    const bug = createOrReuseBug({
      config: {
        baseSpeed: 1,
        sizeMultiplier: 1,
      } as GameConfig,
      hasEnteredField:
        item.hasEnteredField ??
        (item.x >= 0 && item.x <= width && item.y >= 0 && item.y <= height),
      heading: item.heading,
      hp: item.hp,
      maxHp: item.maxHp,
      opacity: item.opacity,
      pool,
      size: item.size,
      variant: item.variant,
      vx: item.vx,
      vy: item.vy,
      width,
      x: item.x,
      y: item.y,
      height,
    });

    bug.prevX = item.prevX ?? item.x;
    bug.prevY = item.prevY ?? item.y;
    bug.seed = item.seed ?? bug.seed;
    bug.wanderAngle = item.wanderAngle ?? bug.wanderAngle;
    bug.cruiseSpeed = item.cruiseSpeed ?? bug.cruiseSpeed;
    bug.turnRate = item.turnRate ?? bug.turnRate;
    bug.motionTime = item.motionTime ?? bug.motionTime;
    bug.roamTargetX = item.roamTargetX ?? null;
    bug.roamTargetY = item.roamTargetY ?? null;
    bug.roamTargetWide = item.roamTargetWide === true;
    bug.roamTargetLongPath = item.roamTargetLongPath === true;
    bug.nextRoamTargetAt = now + (item.nextRoamTargetDelayMs ?? 0);
    bug.roamTargetGeneration = item.roamTargetGeneration ?? 0;
    bug.movementMood = item.movementMood === "startled" ? "startled" : "patrol";
    bug.state = item.state === "flee" ? "flee" : "patrol";
    bug.fleeTimer = item.state === "flee" ? (item.fleeTimer ?? 0) : null;

    entities.push(bug);
  }

  return entities;
}

export type { SpawnZone };