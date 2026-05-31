import type { BugCounts } from "../../../types/dashboard";
import {
  buildCountsFromWeights,
  createInitialSurvivalMetricValues,
  getSurvivalPressure,
  getSurvivalWavePlan,
  type SurvivalFailureKind,
  type SurvivalMetricSnapshot,
  type SurvivalMetricValues,
  type SurvivalSpawnPlan,
  type SurvivalVariantWeights,
} from "@game/sim/survivalDirector";
import type {
  SiegeWeaponId,
} from "@game/types";

export interface SiegeRuntimeSnapshot {
  elapsedMs: number;
  killStreak: number;
  kills: number;
  lastFireTimes: Record<SiegeWeaponId, number>;
  points: number;
  remainingBugs: number;
  streakMultiplier: number;
}

export interface SurvivalRuntimeStatus {
  activeBugLimit: number;
  failureKind: SurvivalFailureKind | null;
  failureLabel: string | null;
  failureSummary: string | null;
  focusLabel: string;
  liveBugCounts: BugCounts;
  metrics: Record<"uptime" | "errors" | "speed", SurvivalMetricSnapshot>;
  offlineReason: string | null;
  pressurePercent: number;
  remainingSpawnBudget: number;
  secondsUntilNextWave: number | null;
  secondsUntilOffline: number | null;
  siteIntegrity: number;
  spawnRatePerSecond: number;
  tacticLabel: string;
  variantWeights: SurvivalVariantWeights;
  wave: number;
  waveDurationMs: number;
  waveEndsAt: number | null;
  waveProgressPercent: number;
  waveStartedAt: number | null;
}

export function createEmptyBugCounts(): BugCounts {
  return { high: 0, low: 0, medium: 0, urgent: 0 };
}

export function getBugCountTotal(bugCounts: BugCounts): number {
  return Object.values(bugCounts).reduce((total, value) => total + value, 0);
}

export function normalizeBugCountsForSurvival(
  count: number,
  bugCounts: BugCounts | undefined,
  wave: number,
): BugCounts {
  if (!bugCounts) {
    return buildCountsFromWeights(count, getSurvivalWavePlan(wave).variantWeights);
  }

  const normalized = {
    high: Math.max(0, Math.floor(bugCounts.high ?? 0)),
    low: Math.max(0, Math.floor(bugCounts.low ?? 0)),
    medium: Math.max(0, Math.floor(bugCounts.medium ?? 0)),
    urgent: Math.max(0, Math.floor(bugCounts.urgent ?? 0)),
  } satisfies BugCounts;
  const total = getBugCountTotal(normalized);

  if (total === count) {
    return normalized;
  }

  if (count <= 0) {
    return createEmptyBugCounts();
  }

  if (total <= 0) {
    return buildCountsFromWeights(count, getSurvivalWavePlan(wave).variantWeights);
  }

  return buildCountsFromWeights(count, {
    high: normalized.high / total,
    low: normalized.low / total,
    medium: normalized.medium / total,
    urgent: normalized.urgent / total,
  });
}

export function scheduleTimeout(callback: () => void, delay: number): number {
  if (typeof window !== "undefined") {
    return window.setTimeout(callback, delay);
  }

  return globalThis.setTimeout(callback, delay) as unknown as number;
}

export function cancelTimeout(timeoutId: number | null): void {
  if (timeoutId == null) {
    return;
  }

  globalThis.clearTimeout(timeoutId);
}

export function scheduleAnimationFrame(callback: (timestamp: number) => void): number {
  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    return window.requestAnimationFrame(callback);
  }

  return globalThis.setTimeout(
    () => callback(globalThis.performance.now()),
    16,
  ) as unknown as number;
}

export function cancelScheduledAnimationFrame(frameId: number | null): void {
  if (frameId == null) {
    return;
  }

  if (
    typeof window !== "undefined" &&
    typeof window.cancelAnimationFrame === "function"
  ) {
    window.cancelAnimationFrame(frameId);
    return;
  }

  globalThis.clearTimeout(frameId);
}

export function recordSurvivalPressureQaSnapshot(payload: {
  activeBugCount: number;
  errors: number;
  pressurePercent: number;
  speed: number;
  tickedAt: number;
  uptime: number;
  wave: number;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const qaState = (window as Window & {
    __RTZ_QA__?: {
      enabled?: boolean;
      survivalPressureSnapshot?: typeof payload;
    };
  }).__RTZ_QA__;

  if (!qaState?.enabled) {
    return;
  }

  qaState.survivalPressureSnapshot = payload;
}

export function scaleBugCounts(
  bugCounts: BugCounts,
  multiplier: number,
): BugCounts {
  return Object.fromEntries(
    Object.entries(bugCounts).map(([variant, count]) => [
      variant,
      Math.max(0, Math.round(count * multiplier)),
    ]),
  ) as BugCounts;
}

export function createRuntimeSnapshot(
  remainingBugs = 0,
): SiegeRuntimeSnapshot {
  return {
    elapsedMs: 0,
    killStreak: 0,
    kills: 0,
    lastFireTimes: {} as Record<SiegeWeaponId, number>,
    points: 0,
    remainingBugs,
    streakMultiplier: 1,
  };
}

export function areRuntimeSnapshotsEqual(
  left: SiegeRuntimeSnapshot,
  right: SiegeRuntimeSnapshot,
): boolean {
  return (
    left.elapsedMs === right.elapsedMs &&
    left.killStreak === right.killStreak &&
    left.kills === right.kills &&
    left.lastFireTimes === right.lastFireTimes &&
    left.points === right.points &&
    left.remainingBugs === right.remainingBugs &&
    left.streakMultiplier === right.streakMultiplier
  );
}

export function createSurvivalRuntimeStatus(
  plan: SurvivalSpawnPlan,
  options: {
    liveBugCounts?: BugCounts;
    metricValues?: SurvivalMetricValues;
    now?: number | null;
    remainingSpawnBudget?: number;
    siteIntegrity?: number;
  } = {},
): SurvivalRuntimeStatus {
  const now = options.now ?? null;
  const waveEndsAt = now == null ? null : now + plan.waveDurationMs;
  const baseMetricValues = {
    ...createInitialSurvivalMetricValues(),
    ...options.metricValues,
  };
  if (options.siteIntegrity != null) {
    baseMetricValues.uptime = options.siteIntegrity;
  }
  const liveBugCounts = options.liveBugCounts ?? createEmptyBugCounts();
  const metrics = getSurvivalPressure({
    activeBugCount: getBugCountTotal(liveBugCounts),
    activeBugCounts: liveBugCounts,
    metricValues: baseMetricValues,
    tickSeconds: 0,
    wave: plan.wave,
  }).metrics;

  return {
    activeBugLimit: plan.activeBugLimit,
    failureKind: null,
    failureLabel: null,
    failureSummary: null,
    focusLabel: plan.focusLabel ?? "Bug rush",
    liveBugCounts,
    metrics,
    offlineReason: null,
    pressurePercent: 0,
    remainingSpawnBudget: Math.max(0, options.remainingSpawnBudget ?? 0),
    secondsUntilNextWave: Math.ceil(plan.waveDurationMs / 1000),
    secondsUntilOffline: metrics.uptime.secondsToFail,
    siteIntegrity: metrics.uptime.value,
    spawnRatePerSecond: plan.spawnRatePerSecond,
    tacticLabel: plan.tacticLabel ?? "Opening wave",
    variantWeights: plan.variantWeights,
    wave: plan.wave,
    waveDurationMs: plan.waveDurationMs,
    waveEndsAt,
    waveProgressPercent: 0,
    waveStartedAt: now,
  };
}