import type { BugTransitionSnapshotItem } from "@game/components/BackgroundField/types";
import type { BugVariant } from "../../../types/dashboard";
import type { GameConfig } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";

const VALID_BUG_VARIANTS = new Set<BugVariant>(["low", "medium", "high", "urgent"]);
const GAME_CONFIG_KEYS = Object.keys(DEFAULT_GAME_CONFIG) as Array<keyof GameConfig>;

export const MAX_ACTIVE_BUGS = 5000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getConfigBounds(defaultValue: number) {
  return {
    max: Math.max(1, defaultValue * 10),
    min: defaultValue >= 1 ? 0.1 : 0.01,
  };
}

function normalizeFiniteNumber(value: unknown, fallbackValue: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallbackValue;
}

function normalizeVariant(value: unknown): BugVariant {
  return typeof value === "string" && VALID_BUG_VARIANTS.has(value as BugVariant)
    ? (value as BugVariant)
    : "low";
}

function normalizeOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function sanitizeGameConfig(config?: Partial<GameConfig>): GameConfig {
  if (!config) {
    return { ...DEFAULT_GAME_CONFIG };
  }

  const sanitizedConfig = { ...DEFAULT_GAME_CONFIG };

  for (const [key, defaultValue] of Object.entries(DEFAULT_GAME_CONFIG)) {
    const configKey = key as keyof GameConfig;
    const bounds = getConfigBounds(defaultValue);
    sanitizedConfig[configKey] = clamp(
      normalizeFiniteNumber(config[configKey], defaultValue),
      bounds.min,
      bounds.max,
    );
  }

  return sanitizedConfig;
}

export function createGameConfigKey(config?: Partial<GameConfig>) {
  const sanitizedConfig = sanitizeGameConfig(config);

  return GAME_CONFIG_KEYS.map((key) => String(sanitizedConfig[key])).join("|");
}

export function normalizeSpawnCounts(
  counts: Record<string, number>,
  maxTotalCount = MAX_ACTIVE_BUGS,
) {
  const normalizedCounts: Record<string, number> = {};
  let remainingCapacity = Math.max(0, Math.floor(maxTotalCount));

  for (const variant of Object.keys(counts)) {
    if (remainingCapacity <= 0) {
      normalizedCounts[variant] = 0;
      continue;
    }

    const requestedCount = counts[variant] ?? 0;
    const safeCount = Math.max(0, Math.floor(Number.isFinite(requestedCount) ? requestedCount : 0));
    const appliedCount = Math.min(safeCount, remainingCapacity);
    normalizedCounts[variant] = appliedCount;
    remainingCapacity -= appliedCount;
  }

  return normalizedCounts;
}

export function sanitizeSnapshotItems(
  snapshot: BugTransitionSnapshotItem[],
  width: number,
  height: number,
  maxTotalCount = MAX_ACTIVE_BUGS,
) {
  return snapshot.slice(0, Math.max(0, Math.floor(maxTotalCount))).map((item) => {
    const size = clamp(normalizeFiniteNumber(item.size, 12), 2, 64);
    const maxHp = clamp(Math.floor(normalizeFiniteNumber(item.maxHp, 1)), 1, 9999);
    const hp = clamp(Math.floor(normalizeFiniteNumber(item.hp, maxHp)), 0, maxHp);

    return {
      cruiseSpeed: clamp(normalizeFiniteNumber(item.cruiseSpeed, 1), 0.1, 4),
      fleeTimer:
        item.fleeTimer == null
          ? null
          : clamp(normalizeFiniteNumber(item.fleeTimer, 0), 0, 10),
      hasEnteredField: item.hasEnteredField === true,
      heading: normalizeFiniteNumber(item.heading, 0),
      hp,
      maxHp,
      motionTime: clamp(normalizeFiniteNumber(item.motionTime, 0), 0, 10000),
      movementMood: item.movementMood === "startled" ? "startled" : "patrol",
      nextRoamTargetDelayMs: clamp(
        normalizeFiniteNumber(item.nextRoamTargetDelayMs, 0),
        0,
        10000,
      ),
      opacity: clamp(normalizeFiniteNumber(item.opacity, 1), 0, 1),
      prevX: clamp(
        normalizeFiniteNumber(item.prevX, item.x),
        -width,
        width * 2,
      ),
      prevY: clamp(
        normalizeFiniteNumber(item.prevY, item.y),
        -height,
        height * 2,
      ),
      roamTargetGeneration: Math.max(
        0,
        Math.floor(normalizeFiniteNumber(item.roamTargetGeneration, 0)),
      ),
      roamTargetLongPath: item.roamTargetLongPath === true,
      roamTargetWide: item.roamTargetWide === true,
      roamTargetX:
        item.roamTargetX == null
          ? null
          : clamp(normalizeFiniteNumber(item.roamTargetX, width * 0.5), -width, width * 2),
      roamTargetY:
        item.roamTargetY == null
          ? null
          : clamp(normalizeFiniteNumber(item.roamTargetY, height * 0.5), -height, height * 2),
      seed: clamp(normalizeFiniteNumber(item.seed, 0.5), 0, 1),
      size,
      state: item.state === "flee" ? "flee" : "patrol",
      turnRate: clamp(normalizeFiniteNumber(item.turnRate, 1), 0.1, 4),
      variant: normalizeVariant(item.variant),
      vx: clamp(normalizeFiniteNumber(item.vx, 0), -2000, 2000),
      vy: clamp(normalizeFiniteNumber(item.vy, 0), -2000, 2000),
      wanderAngle: normalizeOptionalNumber(item.wanderAngle) ?? 0,
      x: clamp(normalizeFiniteNumber(item.x, width * 0.5), -width, width * 2),
      y: clamp(normalizeFiniteNumber(item.y, height * 0.5), -height, height * 2),
    } satisfies BugTransitionSnapshotItem;
  });
}