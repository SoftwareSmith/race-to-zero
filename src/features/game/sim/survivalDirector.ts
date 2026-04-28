import type { BugCounts } from "../../../types/dashboard";

export type SurvivalBugBand = "low" | "medium" | "high" | "urgent";

export interface SurvivalVariantWeights extends Record<SurvivalBugBand, number> {}

export interface SurvivalSpawnPlan {
  activeBugLimit: number;
  burstSize: number;
  counts: BugCounts;
  focusLabel?: string;
  offlineDamagePerSecond: number;
  pressureThreshold: number;
  spawnBudget: number;
  spawnRatePerSecond: number;
  tacticLabel?: string;
  variantFocus?: string;
  variantWeights: SurvivalVariantWeights;
  wave: number;
}

export interface SurvivalPressureInput {
  activeBugCount: number;
  siteIntegrity: number;
  wave: number;
}

export interface SurvivalPressureResult {
  damagePerSecond: number;
  overloadedBy: number;
  pressurePercent: number;
  pressureThreshold: number;
  secondsUntilOffline: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundWeight(value: number): number {
  return Number(value.toFixed(4));
}

export function getSurvivalVariantWeights(wave: number): SurvivalVariantWeights {
  const safeWave = Math.max(1, Math.floor(wave));
  const earlyRamp = clamp((safeWave - 1) / 24, 0, 1);
  const lateRamp = clamp((safeWave - 25) / 35, 0, 1);
  const urgentRamp = Math.pow(earlyRamp, 1.65);

  const low = clamp(0.72 - earlyRamp * 0.44 - lateRamp * 0.12, 0.08, 0.72);
  const medium = clamp(0.23 + earlyRamp * 0.04 - lateRamp * 0.05, 0.14, 0.3);
  const high = clamp(0.05 + earlyRamp * 0.25 - lateRamp * 0.04, 0.05, 0.34);
  const urgent = clamp(0.01 + urgentRamp * 0.24 + lateRamp * 0.16, 0.01, 0.42);
  const total = low + medium + high + urgent;

  return {
    high: roundWeight(high / total),
    low: roundWeight(low / total),
    medium: roundWeight(medium / total),
    urgent: roundWeight(urgent / total),
  };
}

export function buildCountsFromWeights(
  totalCount: number,
  weights: SurvivalVariantWeights,
): BugCounts {
  const safeTotal = Math.max(0, Math.floor(totalCount));
  const variants: SurvivalBugBand[] = ["urgent", "high", "medium", "low"];
  const baseCounts = variants.map((variant) => {
    const exact = safeTotal * weights[variant];
    return {
      exact,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
      variant,
    };
  });
  let assigned = baseCounts.reduce((total, item) => total + item.floor, 0);
  const counts: BugCounts = { high: 0, low: 0, medium: 0, urgent: 0 };

  for (const item of baseCounts) {
    counts[item.variant] = item.floor;
  }

  for (const item of [...baseCounts].sort((left, right) => right.remainder - left.remainder)) {
    if (assigned >= safeTotal) {
      break;
    }
    counts[item.variant] += 1;
    assigned += 1;
  }

  return counts;
}

export function getSurvivalWavePlan(wave: number): SurvivalSpawnPlan {
  const safeWave = Math.max(1, Math.floor(wave));
  const variantWeights = getSurvivalVariantWeights(safeWave);
  const spawnBudget = Math.round(
    clamp(7 + safeWave * 1.8 + Math.pow(safeWave, 1.32) * 0.58, 8, 360),
  );
  const spawnRatePerSecond = Number(
    clamp(0.65 + Math.pow(safeWave, 1.18) * 0.12, 0.65, 18).toFixed(2),
  );
  const burstSize = Math.max(1, Math.ceil(spawnRatePerSecond));
  const pressureThreshold = Math.round(clamp(14 + safeWave * 1.15, 12, 95));
  const offlineDamagePerSecond = Number(
    clamp(2.2 + Math.pow(safeWave, 1.12) * 0.36, 2.5, 42).toFixed(2),
  );
  const urgentIsFocus = variantWeights.urgent >= 0.18;
  const highIsFocus = !urgentIsFocus && variantWeights.high >= 0.18;

  return {
    activeBugLimit: Math.round(clamp(pressureThreshold * 1.55, 24, 150)),
    burstSize,
    counts: buildCountsFromWeights(spawnBudget, variantWeights),
    focusLabel: urgentIsFocus
      ? "Critical surge"
      : highIsFocus
        ? "High pressure"
        : "Bug rush",
    offlineDamagePerSecond,
    pressureThreshold,
    spawnBudget,
    spawnRatePerSecond,
    tacticLabel:
      safeWave >= 25
        ? "Runaway escalation"
        : safeWave >= 16
          ? "Critical skew"
          : safeWave >= 6
            ? "Accelerating swarm"
            : "Opening wave",
    variantFocus: urgentIsFocus ? "urgent" : highIsFocus ? "high" : "low",
    variantWeights,
    wave: safeWave,
  };
}

export function createSurvivalBurstCounts(
  plan: SurvivalSpawnPlan,
  requestedCount = plan.burstSize,
): BugCounts {
  return buildCountsFromWeights(requestedCount, plan.variantWeights);
}

export function getSurvivalRuntimeSpeedMultiplier(wave: number): number {
  return Number(clamp(1 + Math.max(0, wave - 1) * 0.025, 1, 2.35).toFixed(2));
}

export function getSurvivalPressure({
  activeBugCount,
  siteIntegrity,
  wave,
}: SurvivalPressureInput): SurvivalPressureResult {
  const plan = getSurvivalWavePlan(wave);
  const overloadedBy = Math.max(0, activeBugCount - plan.pressureThreshold);
  const pressurePercent = Math.round(
    clamp((activeBugCount / Math.max(1, plan.pressureThreshold)) * 100, 0, 250),
  );
  const overloadRatio = overloadedBy / Math.max(1, plan.pressureThreshold);
  const damagePerSecond =
    overloadedBy > 0
      ? Number((plan.offlineDamagePerSecond * (0.45 + overloadRatio)).toFixed(2))
      : 0;

  return {
    damagePerSecond,
    overloadedBy,
    pressurePercent,
    pressureThreshold: plan.pressureThreshold,
    secondsUntilOffline:
      damagePerSecond > 0
        ? Math.max(0, Math.ceil(siteIntegrity / damagePerSecond))
        : null,
  };
}