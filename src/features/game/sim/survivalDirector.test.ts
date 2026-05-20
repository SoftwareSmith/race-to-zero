import { describe, expect, it } from "vitest";

import {
  buildCountsFromWeights,
  calculateSurvivalSpawnRequest,
  calculateWaveProgress,
  createSurvivalBurstCounts,
  createInitialSurvivalMetricValues,
  getSurvivalPressure,
  getSurvivalRuntimeSpeedMultiplier,
  getSurvivalRuntimeSpeedMultiplierForPressure,
  getSurvivalSeverityPressureMultiplier,
  getSurvivalVariantWeights,
  getSurvivalWavePlan,
  getSurvivalWavePressureScore,
} from "./survivalDirector";

function totalCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

describe("survival director", () => {
  it("gradually shifts wave composition toward critical bugs", () => {
    const waves = [1, 5, 10, 15, 25, 50].map((wave) => ({
      wave,
      weights: getSurvivalVariantWeights(wave),
    }));

    expect(waves[0].weights.low).toBeGreaterThan(waves[1].weights.urgent);
    expect(waves[0].weights.low).toBeGreaterThan(waves[5].weights.low);
    expect(waves[2].weights.high).toBeGreaterThan(waves[0].weights.high);
    expect(waves[4].weights.urgent).toBeGreaterThan(waves[2].weights.urgent);
    expect(waves[5].weights.urgent).toBeGreaterThan(waves[4].weights.urgent);
    expect(waves[4].weights.high).toBeGreaterThan(waves[1].weights.high);
  });

  it("keeps generated counts deterministic and equal to the requested total", () => {
    const weights = getSurvivalVariantWeights(25);
    const counts = buildCountsFromWeights(37, weights);

    expect(totalCounts(counts)).toBe(37);
    expect(counts.urgent).toBeGreaterThan(0);
    expect(counts.high).toBeGreaterThan(0);
  });

  it("ramps spawn rate, pressure, and budget through wave 50", () => {
    const wave1 = getSurvivalWavePlan(1);
    const wave10 = getSurvivalWavePlan(10);
    const wave25 = getSurvivalWavePlan(25);
    const wave50 = getSurvivalWavePlan(50);

    expect(wave1.spawnRatePerSecond).toBeLessThan(wave10.spawnRatePerSecond);
    expect(wave10.spawnRatePerSecond).toBeLessThanOrEqual(wave25.spawnRatePerSecond);
    expect(wave25.spawnRatePerSecond).toBeLessThanOrEqual(wave50.spawnRatePerSecond);
    expect(wave10.spawnBudget).toBeGreaterThan(wave1.spawnBudget);
    expect(wave50.spawnBudget).toBeGreaterThanOrEqual(wave25.spawnBudget);
    expect(wave50.activeBugLimit).toBeGreaterThan(wave1.activeBugLimit);
    expect(wave50.activeBugLimit).toBeLessThan(wave50.pressureThreshold * 1.2);
    expect(wave1.waveDurationMs).toBe(30_000);
    expect(wave25.spawnBudget).toBe(
      Math.round(wave25.spawnRatePerSecond * (wave25.waveDurationMs / 1000)),
    );
  });

  it("keeps severity pressure climbing as waves skew toward dangerous bugs", () => {
    const wave1 = getSurvivalVariantWeights(1);
    const wave10 = getSurvivalVariantWeights(10);
    const wave25 = getSurvivalVariantWeights(25);
    const wave50 = getSurvivalVariantWeights(50);

    expect(totalCounts(wave1)).toBeCloseTo(1, 3);
    expect(totalCounts(wave50)).toBeCloseTo(1, 3);
    expect(getSurvivalSeverityPressureMultiplier(wave10)).toBeGreaterThan(
      getSurvivalSeverityPressureMultiplier(wave1),
    );
    expect(getSurvivalSeverityPressureMultiplier(wave25)).toBeGreaterThan(
      getSurvivalSeverityPressureMultiplier(wave10),
    );
    expect(getSurvivalSeverityPressureMultiplier(wave50)).toBeGreaterThan(
      getSurvivalSeverityPressureMultiplier(wave25),
    );
  });

  it("guarantees outbreak pressure never regresses across the authored wave range", () => {
    let previousPlan = getSurvivalWavePlan(1);
    let previousPressureScore = getSurvivalWavePressureScore(1);

    for (let wave = 2; wave <= 50; wave += 1) {
      const nextPlan = getSurvivalWavePlan(wave);
      const nextPressureScore = getSurvivalWavePressureScore(wave);

      expect(nextPlan.spawnRatePerSecond).toBeGreaterThanOrEqual(
        previousPlan.spawnRatePerSecond,
      );
      expect(nextPressureScore).toBeGreaterThanOrEqual(previousPressureScore);
      expect(
        nextPlan.spawnRatePerSecond > previousPlan.spawnRatePerSecond ||
          getSurvivalSeverityPressureMultiplier(nextPlan.variantWeights) >=
            getSurvivalSeverityPressureMultiplier(previousPlan.variantWeights),
      ).toBe(true);

      previousPlan = nextPlan;
      previousPressureScore = nextPressureScore;
    }
  });

  it("caps late-wave survival below the known pooling band", () => {
    const wave14 = getSurvivalWavePlan(14);
    const wave25 = getSurvivalWavePlan(25);
    const wave50 = getSurvivalWavePlan(50);

    expect(wave14.activeBugLimit).toBeLessThanOrEqual(780);
    expect(wave25.activeBugLimit).toBeLessThanOrEqual(780);
    expect(wave50.activeBugLimit).toBeLessThanOrEqual(780);
    expect(wave14.spawnRatePerSecond).toBeLessThan(21);
    expect(wave25.spawnRatePerSecond).toBeLessThanOrEqual(31);
    expect(wave50.spawnRatePerSecond).toBeLessThanOrEqual(31);
  });

  it("calculates wave loader progress from timestamps", () => {
    expect(calculateWaveProgress(1_500, 1_000, 1_000)).toBe(50);
    expect(calculateWaveProgress(2_500, 1_000, 1_000)).toBe(100);
    expect(calculateWaveProgress(500, 1_000, 1_000)).toBe(0);
    expect(calculateWaveProgress(1_500, null, 1_000)).toBe(0);
  });

  it("accumulates fractional survival spawns without exceeding budget or active limit", () => {
    const first = calculateSurvivalSpawnRequest({
      accumulator: 0,
      activeBugCount: 5,
      activeBugLimit: 20,
      elapsedSeconds: 0.5,
      remainingBudget: 10,
      spawnRatePerSecond: 1.5,
    });

    expect(first.requestedCount).toBe(0);
    expect(first.nextAccumulator).toBeCloseTo(0.75);

    const second = calculateSurvivalSpawnRequest({
      accumulator: first.nextAccumulator,
      activeBugCount: 5,
      activeBugLimit: 6,
      elapsedSeconds: 1,
      remainingBudget: 10,
      spawnRatePerSecond: 1.5,
    });

    expect(second.requestedCount).toBe(1);
    expect(second.nextAccumulator).toBeCloseTo(1.25);
  });

  it("creates burst counts from the active wave weights", () => {
    const plan = getSurvivalWavePlan(16);
    const burst = createSurvivalBurstCounts(plan, 9);

    expect(totalCounts(burst)).toBe(9);
    expect(burst.high + burst.urgent).toBeGreaterThan(0);
  });

  it("starts chipping integrity once sustained swarm pressure gets heavy", () => {
    const plan = getSurvivalWavePlan(10);
    const calm = getSurvivalPressure({
      activeBugCount: Math.floor(plan.pressureThreshold * 0.45),
      siteIntegrity: 100,
      wave: 10,
    });
    const heavy = getSurvivalPressure({
      activeBugCount: Math.floor(plan.pressureThreshold * 0.82),
      siteIntegrity: 84,
      wave: 10,
    });
    const overloaded = getSurvivalPressure({
      activeBugCount: plan.pressureThreshold + 12,
      siteIntegrity: 48,
      wave: 10,
    });

    expect(calm.damagePerSecond).toBeLessThan(heavy.damagePerSecond);
    expect(calm.secondsUntilOffline).toBeGreaterThan(heavy.secondsUntilOffline ?? 0);
    expect(heavy.damagePerSecond).toBeGreaterThan(0);
    expect(heavy.secondsUntilOffline).toBeGreaterThan(0);
    expect(overloaded.damagePerSecond).toBeGreaterThan(0);
    expect(overloaded.damagePerSecond).toBeGreaterThan(heavy.damagePerSecond);
    expect(overloaded.secondsUntilOffline).toBeGreaterThan(0);
  });

  it("fails distinct survival systems based on the live bug mix", () => {
    const errorFailure = getSurvivalPressure({
      activeBugCount: 210,
      activeBugCounts: { high: 90, low: 10, medium: 20, urgent: 80 },
      metricValues: { errors: 5, speed: 100, uptime: 100 },
      tickSeconds: 10,
      wave: 18,
    });
    const speedFailure = getSurvivalPressure({
      activeBugCount: 260,
      activeBugCounts: { high: 8, low: 72, medium: 174, urgent: 6 },
      metricValues: { errors: 100, speed: 5, uptime: 100 },
      tickSeconds: 14,
      wave: 22,
    });

    expect(errorFailure.failure?.kind).toBe("errorFlood");
    expect(errorFailure.metrics.errors.value).toBeLessThanOrEqual(0);
    expect(speedFailure.failure?.kind).toBe("speedCollapse");
    expect(speedFailure.metrics.speed.value).toBeLessThanOrEqual(0);
  });

  it("stays stable when no survival metric is under real pressure", () => {
    const status = getSurvivalPressure({
      activeBugCount: 18,
      activeBugCounts: { high: 1, low: 12, medium: 5, urgent: 0 },
      metricValues: createInitialSurvivalMetricValues(),
      tickSeconds: 5,
      wave: 3,
    });

    expect(status.failure).toBeNull();
    expect(status.metrics.uptime.value).toBe(100);
    expect(status.metrics.errors.value).toBe(100);
    expect(status.metrics.speed.value).toBeGreaterThan(98);
  });

  it("raises runtime speed multiplier without becoming unbounded", () => {
    expect(getSurvivalRuntimeSpeedMultiplier(1)).toBe(1);
    expect(getSurvivalRuntimeSpeedMultiplier(25)).toBeGreaterThan(1);
    expect(getSurvivalRuntimeSpeedMultiplier(250)).toBeLessThanOrEqual(1.92);
  });

  it("adds only a bounded speed bonus when pressure gets heavy", () => {
    const calm = getSurvivalRuntimeSpeedMultiplierForPressure(18, 48);
    const strained = getSurvivalRuntimeSpeedMultiplierForPressure(18, 108);
    const overloaded = getSurvivalRuntimeSpeedMultiplierForPressure(18, 180);

    expect(strained).toBeGreaterThan(calm);
    expect(overloaded).toBeGreaterThanOrEqual(strained);
    expect(overloaded - calm).toBeLessThanOrEqual(0.2);
  });
});
