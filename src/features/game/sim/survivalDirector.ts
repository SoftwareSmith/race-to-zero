import type { BugCounts } from "../../../types/dashboard";

export type SurvivalBugBand = "low" | "medium" | "high" | "urgent";
export type SurvivalMetricId = "uptime" | "errors" | "speed";
export type SurvivalMetricStatus = "stable" | "warning" | "critical";
export type SurvivalFailureKind =
  | "uptimeFailure"
  | "errorFlood"
  | "speedCollapse";

export interface SurvivalVariantWeights extends Record<SurvivalBugBand, number> {}

export interface SurvivalMetricValues {
  errors: number;
  speed: number;
  uptime: number;
}

export interface SurvivalMetricSnapshot {
  id: SurvivalMetricId;
  label: string;
  secondsToFail: number | null;
  status: SurvivalMetricStatus;
  value: number;
}

export interface SurvivalFailure {
  kind: SurvivalFailureKind;
  label: string;
  summary: string;
  trigger: string;
}

export const SURVIVAL_METRIC_LABELS: Record<SurvivalMetricId, string> = {
  errors: "Errors",
  speed: "Speed",
  uptime: "Uptime",
};

const SURVIVAL_BAND_PRESSURE_WEIGHTS: Record<SurvivalBugBand, number> = {
  high: 1.9,
  low: 1,
  medium: 1.45,
  urgent: 2.35,
};

const SURVIVAL_WAVE_TUNING = {
  activeBugLimit: {
    max: 780,
    min: 280,
    multiplier: 1.02,
  },
  offlineDamage: {
    base: 0.7,
    exponent: 1.04,
    growth: 0.16,
    max: 15,
    min: 0.7,
  },
  pressureThreshold: {
    base: 220,
    exponent: 1.02,
    growth: 11,
    max: 760,
    min: 220,
    waveLinear: 34,
  },
  spawnBudget: {
    max: 2300,
    min: 24,
  },
  spawnRate: {
    base: 3.05,
    exponent: 1.11,
    growth: 0.74,
    max: 31,
    min: 3.05,
  },
  variantWeights: {
    earlyRampMaxWave: 22,
    lateRampSpan: 32,
    lateStartWave: 18,
    urgentExponent: 1.35,
    high: {
      base: 0.04,
      earlyGain: 0.17,
      lateGain: 0.06,
      max: 0.36,
      min: 0.04,
    },
    low: {
      base: 0.74,
      earlyLoss: 0.3,
      lateLoss: 0.18,
      max: 0.74,
      min: 0.12,
    },
    medium: {
      base: 0.21,
      earlyGain: 0.05,
      lateLoss: 0.06,
      max: 0.32,
      min: 0.16,
    },
    urgent: {
      base: 0.01,
      lateGain: 0.12,
      max: 0.28,
      min: 0.01,
      rampGain: 0.18,
    },
  },
  waveDurationMs: 30_000,
} as const;

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
  waveDurationMs: number;
  wave: number;
}

export interface SurvivalPressureInput {
  activeBugCount: number;
  activeBugCounts?: BugCounts;
  metricValues?: SurvivalMetricValues;
  siteIntegrity?: number;
  tickSeconds?: number;
  wave: number;
}

export interface SurvivalPressureResult {
  damagePerSecond: number;
  failure: SurvivalFailure | null;
  leadingMetricId: SurvivalMetricId;
  metrics: Record<SurvivalMetricId, SurvivalMetricSnapshot>;
  overloadedBy: number;
  pressurePercent: number;
  pressureThreshold: number;
  secondsUntilOffline: number | null;
}

const SURVIVAL_CHIP_PRESSURE_START = 0.42;
const SURVIVAL_CHIP_DAMAGE_SCALE = 0.55;
const SURVIVAL_METRIC_MAX = 100;
const SURVIVAL_UPTIME_RECOVERY_PER_SECOND = 0.26;
const SURVIVAL_ERRORS_RECOVERY_PER_SECOND = 2.8;
const SURVIVAL_SPEED_RECOVERY_PER_SECOND = 4.2;
const SURVIVAL_ERRORS_DRAIN_START = 0.12;
const SURVIVAL_SPEED_DRAIN_START = 0.1;
const SURVIVAL_ERRORS_RECOVERY_FADE_START = 0.52;
const SURVIVAL_SPEED_RECOVERY_FADE_START = 0.46;
const SURVIVAL_RECOVERY_FADE_END = 1.08;
const SURVIVAL_CALM_RECOVERY_BONUS = 2.6;

export interface SurvivalSpawnAccumulatorInput {
  accumulator: number;
  activeBugCount: number;
  activeBugLimit: number;
  elapsedSeconds: number;
  remainingBudget: number;
  spawnRatePerSecond: number;
}

export interface SurvivalSpawnAccumulatorResult {
  nextAccumulator: number;
  requestedCount: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundWeight(value: number) {
  return Number(value.toFixed(4));
}

export function createInitialSurvivalMetricValues(): SurvivalMetricValues {
  return {
    errors: SURVIVAL_METRIC_MAX,
    speed: SURVIVAL_METRIC_MAX,
    uptime: SURVIVAL_METRIC_MAX,
  };
}

function getMetricStatus(value: number): SurvivalMetricStatus {
  if (value <= 34) {
    return "critical";
  }

  if (value <= 67) {
    return "warning";
  }

  return "stable";
}

function normalizeActiveBugCounts(
  activeBugCount: number,
  activeBugCounts: BugCounts | undefined,
  fallbackWeights: SurvivalVariantWeights,
): BugCounts {
  if (!activeBugCounts) {
    return buildCountsFromWeights(activeBugCount, fallbackWeights);
  }

  const normalized = {
    high: Math.max(0, Math.floor(activeBugCounts.high ?? 0)),
    low: Math.max(0, Math.floor(activeBugCounts.low ?? 0)),
    medium: Math.max(0, Math.floor(activeBugCounts.medium ?? 0)),
    urgent: Math.max(0, Math.floor(activeBugCounts.urgent ?? 0)),
  } satisfies BugCounts;
  const normalizedTotal = Object.values(normalized).reduce(
    (total, value) => total + value,
    0,
  );

  if (normalizedTotal === activeBugCount) {
    return normalized;
  }

  if (normalizedTotal <= 0) {
    return buildCountsFromWeights(activeBugCount, fallbackWeights);
  }

  return buildCountsFromWeights(activeBugCount, {
    high: normalized.high / normalizedTotal,
    low: normalized.low / normalizedTotal,
    medium: normalized.medium / normalizedTotal,
    urgent: normalized.urgent / normalizedTotal,
  });
}

function evolveMetricValue(
  currentValue: number,
  drainPerSecond: number,
  recoveryPerSecond: number,
  tickSeconds: number,
): number {
  return clamp(
    currentValue + (recoveryPerSecond - drainPerSecond) * tickSeconds,
    0,
    SURVIVAL_METRIC_MAX,
  );
}

function getMetricDrainPerSecond(
  pressureRatio: number,
  drainStart: number,
  offlineDamagePerSecond: number,
  multiplier: number,
): number {
  return Number(
    (
      Math.max(0, pressureRatio - drainStart) * offlineDamagePerSecond * multiplier
    ).toFixed(2),
  );
}

function getMetricRecoveryPerSecond(
  currentValue: number,
  maxRecoveryPerSecond: number,
  pressureRatio: number,
  fadeStart: number,
): number {
  const missingRatio = clamp(
    (SURVIVAL_METRIC_MAX - currentValue) / SURVIVAL_METRIC_MAX,
    0,
    1,
  );
  const recoveryStrength = Math.pow(missingRatio, 0.42);
  const suppression = clamp(
    (pressureRatio - fadeStart) /
      Math.max(SURVIVAL_RECOVERY_FADE_END - fadeStart, 0.01),
    0,
    1,
  );
  const calmRatio = clamp(1 - pressureRatio / Math.max(fadeStart, 0.01), 0, 1);
  const calmBonus = 1 + Math.pow(calmRatio, 0.7) * SURVIVAL_CALM_RECOVERY_BONUS;

  return Number(
    (
      maxRecoveryPerSecond * recoveryStrength * (1 - suppression) * calmBonus
    ).toFixed(2),
  );
}

function getFailureForMetric(metricId: SurvivalMetricId): SurvivalFailure {
  if (metricId === "errors") {
    return {
      kind: "errorFlood",
      label: "Errors",
      summary: "Errors spiked faster than the platform could recover.",
      trigger: "Too many dangerous bugs were active at once.",
    };
  }

  if (metricId === "speed") {
    return {
      kind: "speedCollapse",
      label: "Speed",
      summary: "Load pushed the site into a crawl.",
      trigger: "The swarm kept the board overloaded for too long.",
    };
  }

  return {
    kind: "uptimeFailure",
    label: "Uptime",
    summary: "Too many bugs broke through and took the platform down.",
    trigger: "The total swarm load got out of hand.",
  };
}

export function getSurvivalVariantWeights(wave: number): SurvivalVariantWeights {
  const safeWave = Math.max(1, Math.floor(wave));
  const tuning = SURVIVAL_WAVE_TUNING.variantWeights;
  const earlyRamp = clamp((safeWave - 1) / tuning.earlyRampMaxWave, 0, 1);
  const lateRamp = clamp(
    (safeWave - tuning.lateStartWave) / tuning.lateRampSpan,
    0,
    1,
  );
  const urgentRamp = Math.pow(lateRamp, tuning.urgentExponent);

  const low = clamp(
    tuning.low.base - earlyRamp * tuning.low.earlyLoss - lateRamp * tuning.low.lateLoss,
    tuning.low.min,
    tuning.low.max,
  );
  const medium = clamp(
    tuning.medium.base + earlyRamp * tuning.medium.earlyGain - lateRamp * tuning.medium.lateLoss,
    tuning.medium.min,
    tuning.medium.max,
  );
  const high = clamp(
    tuning.high.base + earlyRamp * tuning.high.earlyGain + lateRamp * tuning.high.lateGain,
    tuning.high.min,
    tuning.high.max,
  );
  const urgent = clamp(
    tuning.urgent.base + urgentRamp * tuning.urgent.rampGain + lateRamp * tuning.urgent.lateGain,
    tuning.urgent.min,
    tuning.urgent.max,
  );
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

export function getSurvivalSeverityPressureMultiplier(
  weights: SurvivalVariantWeights,
): number {
  return Number(
    (
      weights.low * SURVIVAL_BAND_PRESSURE_WEIGHTS.low +
      weights.medium * SURVIVAL_BAND_PRESSURE_WEIGHTS.medium +
      weights.high * SURVIVAL_BAND_PRESSURE_WEIGHTS.high +
      weights.urgent * SURVIVAL_BAND_PRESSURE_WEIGHTS.urgent
    ).toFixed(4),
  );
}

export function getSurvivalWavePressureScore(wave: number): number {
  const plan = getSurvivalWavePlan(wave);

  return Number(
    (
      plan.spawnRatePerSecond *
      getSurvivalSeverityPressureMultiplier(plan.variantWeights)
    ).toFixed(4),
  );
}

export function getSurvivalWavePlan(wave: number): SurvivalSpawnPlan {
  const safeWave = Math.max(1, Math.floor(wave));
  const variantWeights = getSurvivalVariantWeights(safeWave);
  const waveDurationMs = SURVIVAL_WAVE_TUNING.waveDurationMs;
  const spawnRatePerSecond = Number(
    clamp(
      SURVIVAL_WAVE_TUNING.spawnRate.base +
        Math.pow(safeWave, SURVIVAL_WAVE_TUNING.spawnRate.exponent) *
          SURVIVAL_WAVE_TUNING.spawnRate.growth,
      SURVIVAL_WAVE_TUNING.spawnRate.min,
      SURVIVAL_WAVE_TUNING.spawnRate.max,
    ).toFixed(2),
  );
  const spawnBudget = Math.round(
    clamp(
      spawnRatePerSecond * (waveDurationMs / 1000),
      SURVIVAL_WAVE_TUNING.spawnBudget.min,
      SURVIVAL_WAVE_TUNING.spawnBudget.max,
    ),
  );
  const burstSize = Math.max(1, Math.ceil(spawnRatePerSecond));
  const pressureThreshold = Math.round(
    clamp(
      SURVIVAL_WAVE_TUNING.pressureThreshold.base +
        safeWave * SURVIVAL_WAVE_TUNING.pressureThreshold.waveLinear +
        Math.pow(safeWave, SURVIVAL_WAVE_TUNING.pressureThreshold.exponent) *
          SURVIVAL_WAVE_TUNING.pressureThreshold.growth,
      SURVIVAL_WAVE_TUNING.pressureThreshold.min,
      SURVIVAL_WAVE_TUNING.pressureThreshold.max,
    ),
  );
  const offlineDamagePerSecond = Number(
    clamp(
      SURVIVAL_WAVE_TUNING.offlineDamage.base +
        Math.pow(safeWave, SURVIVAL_WAVE_TUNING.offlineDamage.exponent) *
          SURVIVAL_WAVE_TUNING.offlineDamage.growth,
      SURVIVAL_WAVE_TUNING.offlineDamage.min,
      SURVIVAL_WAVE_TUNING.offlineDamage.max,
    ).toFixed(2),
  );
  const urgentIsFocus = variantWeights.urgent >= 0.18;
  const highIsFocus = !urgentIsFocus && variantWeights.high >= 0.18;

  return {
    activeBugLimit: Math.round(
      clamp(
        pressureThreshold * SURVIVAL_WAVE_TUNING.activeBugLimit.multiplier,
        SURVIVAL_WAVE_TUNING.activeBugLimit.min,
        SURVIVAL_WAVE_TUNING.activeBugLimit.max,
      ),
    ),
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
    waveDurationMs,
    wave: safeWave,
  };
}

export function createSurvivalBurstCounts(
  plan: SurvivalSpawnPlan,
  requestedCount = plan.burstSize,
): BugCounts {
  return buildCountsFromWeights(requestedCount, plan.variantWeights);
}

export function calculateWaveProgress(
  now: number,
  startedAt: number | null,
  durationMs: number,
): number {
  if (startedAt == null || durationMs <= 0) {
    return 0;
  }

  return Math.round(clamp(((now - startedAt) / durationMs) * 100, 0, 100));
}

export function calculateSurvivalSpawnRequest({
  accumulator,
  activeBugCount,
  activeBugLimit,
  elapsedSeconds,
  remainingBudget,
  spawnRatePerSecond,
}: SurvivalSpawnAccumulatorInput): SurvivalSpawnAccumulatorResult {
  const safeBudget = Math.max(0, Math.floor(remainingBudget));
  const openSlots = Math.max(0, Math.floor(activeBugLimit - activeBugCount));
  const nextAccumulator = Math.max(
    0,
    accumulator + Math.max(0, elapsedSeconds) * Math.max(0, spawnRatePerSecond),
  );
  const requestedCount = Math.min(
    Math.floor(nextAccumulator),
    safeBudget,
    openSlots,
  );

  return {
    nextAccumulator: nextAccumulator - requestedCount,
    requestedCount,
  };
}

export function getSurvivalRuntimeSpeedMultiplier(wave: number): number {
  return getSurvivalRuntimeSpeedMultiplierForPressure(wave, 0);
}

export function getSurvivalRuntimeSpeedMultiplierForPressure(
  wave: number,
  pressurePercent: number,
): number {
  const safeWave = Math.max(1, Math.floor(wave));
  const pressureRatio = clamp(pressurePercent / 100, 0, 2.5);
  const waveSpeed = 1 + Math.max(0, safeWave - 1) * 0.016;
  const pressureBonus = clamp((pressureRatio - 0.72) * 0.22, 0, 0.2);

  return Number(clamp(waveSpeed + pressureBonus, 1, 1.92).toFixed(2));
}

export function getSurvivalPressure({
  activeBugCount,
  activeBugCounts,
  metricValues,
  siteIntegrity,
  tickSeconds = 1,
  wave,
}: SurvivalPressureInput): SurvivalPressureResult {
  const plan = getSurvivalWavePlan(wave);
  const safeMetricValues = metricValues ?? {
    ...createInitialSurvivalMetricValues(),
    uptime: clamp(siteIntegrity ?? SURVIVAL_METRIC_MAX, 0, SURVIVAL_METRIC_MAX),
  };
  const liveBugCounts = normalizeActiveBugCounts(
    activeBugCount,
    activeBugCounts,
    plan.variantWeights,
  );
  const overloadedBy = Math.max(0, activeBugCount - plan.pressureThreshold);
  const pressurePercent = Math.round(
    clamp((activeBugCount / Math.max(1, plan.pressureThreshold)) * 100, 0, 250),
  );
  const pressureRatio = activeBugCount / Math.max(1, plan.pressureThreshold);
  const dangerCount =
    liveBugCounts.medium * 0.35 +
    liveBugCounts.high * 1.05 +
    liveBugCounts.urgent * 1.45;
  const dangerThreshold = Math.max(8, Math.round(plan.pressureThreshold * 0.12));
  const speedThreshold = Math.max(12, Math.round(plan.pressureThreshold * 0.32));
  const dangerRatio = dangerCount / Math.max(1, dangerThreshold);
  const speedRatio =
    (activeBugCount +
      liveBugCounts.medium * 0.45 +
      liveBugCounts.high * 0.9 +
      liveBugCounts.urgent * 1.35) /
    Math.max(1, speedThreshold);
  const chipPressureRatio = clamp(
    (pressureRatio - SURVIVAL_CHIP_PRESSURE_START) /
      Math.max(1 - SURVIVAL_CHIP_PRESSURE_START, 0.01),
    0,
    1,
  );
  const overloadRatio = overloadedBy / Math.max(1, plan.pressureThreshold);
  const chipDamagePerSecond =
    chipPressureRatio > 0
      ? plan.offlineDamagePerSecond * chipPressureRatio * SURVIVAL_CHIP_DAMAGE_SCALE
      : 0;
  const overloadDamagePerSecond =
    overloadedBy > 0
      ? plan.offlineDamagePerSecond * (0.35 + overloadRatio * 1.05)
      : 0;
  const damagePerSecond = Number(
    (chipDamagePerSecond + overloadDamagePerSecond).toFixed(2),
  );
  const errorDrainPerSecond = getMetricDrainPerSecond(
    dangerRatio,
    SURVIVAL_ERRORS_DRAIN_START,
    plan.offlineDamagePerSecond,
    1.02,
  );
  const speedDrainPerSecond = getMetricDrainPerSecond(
    speedRatio,
    SURVIVAL_SPEED_DRAIN_START,
    plan.offlineDamagePerSecond,
    0.82,
  );
  const errorRecoveryPerSecond = getMetricRecoveryPerSecond(
    safeMetricValues.errors,
    SURVIVAL_ERRORS_RECOVERY_PER_SECOND,
    dangerRatio,
    SURVIVAL_ERRORS_RECOVERY_FADE_START,
  );
  const speedRecoveryPerSecond = getMetricRecoveryPerSecond(
    safeMetricValues.speed,
    SURVIVAL_SPEED_RECOVERY_PER_SECOND,
    speedRatio,
    SURVIVAL_SPEED_RECOVERY_FADE_START,
  );
  const nextValues: SurvivalMetricValues = {
    errors: Number(
      evolveMetricValue(
        safeMetricValues.errors,
        errorDrainPerSecond,
        errorRecoveryPerSecond,
        tickSeconds,
      ).toFixed(2),
    ),
    speed: Number(
      evolveMetricValue(
        safeMetricValues.speed,
        speedDrainPerSecond,
        speedRecoveryPerSecond,
        tickSeconds,
      ).toFixed(2),
    ),
    uptime: Number(
      evolveMetricValue(
        safeMetricValues.uptime,
        damagePerSecond,
        damagePerSecond > 0 ? 0 : SURVIVAL_UPTIME_RECOVERY_PER_SECOND,
        tickSeconds,
      ).toFixed(2),
    ),
  };
  const secondsToFail = {
    errors:
      errorDrainPerSecond > 0
        ? Math.max(0, Math.ceil(safeMetricValues.errors / errorDrainPerSecond))
        : null,
    speed:
      speedDrainPerSecond > 0
        ? Math.max(0, Math.ceil(safeMetricValues.speed / speedDrainPerSecond))
        : null,
    uptime:
      damagePerSecond > 0
        ? Math.max(0, Math.ceil(safeMetricValues.uptime / damagePerSecond))
        : null,
  };
  const metrics = {
    errors: {
      id: "errors",
      label: SURVIVAL_METRIC_LABELS.errors,
      secondsToFail: secondsToFail.errors,
      status: getMetricStatus(nextValues.errors),
      value: nextValues.errors,
    },
    speed: {
      id: "speed",
      label: SURVIVAL_METRIC_LABELS.speed,
      secondsToFail: secondsToFail.speed,
      status: getMetricStatus(nextValues.speed),
      value: nextValues.speed,
    },
    uptime: {
      id: "uptime",
      label: SURVIVAL_METRIC_LABELS.uptime,
      secondsToFail: secondsToFail.uptime,
      status: getMetricStatus(nextValues.uptime),
      value: nextValues.uptime,
    },
  } satisfies Record<SurvivalMetricId, SurvivalMetricSnapshot>;
  const leadingMetricId = (["uptime", "errors", "speed"] as SurvivalMetricId[]).sort(
    (left, right) => metrics[left].value - metrics[right].value,
  )[0];
  const failedMetric = (["uptime", "errors", "speed"] as SurvivalMetricId[]).find(
    (metricId) => metrics[metricId].value <= 0,
  );

  return {
    damagePerSecond,
    failure: failedMetric ? getFailureForMetric(failedMetric) : null,
    leadingMetricId,
    metrics,
    overloadedBy,
    pressurePercent,
    pressureThreshold: plan.pressureThreshold,
    secondsUntilOffline: metrics.uptime.secondsToFail,
  };
}