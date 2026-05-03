import { describe, expect, it } from "vitest";

import {
  buildCountsFromWeights,
  calculateSurvivalSpawnRequest,
  calculateWaveProgress,
  createSurvivalBurstCounts,
  getSurvivalPressure,
  getSurvivalRuntimeSpeedMultiplier,
  getSurvivalVariantWeights,
  getSurvivalWavePlan,
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
    const wave25 = getSurvivalWavePlan(25);
    const wave50 = getSurvivalWavePlan(50);

    expect(wave1.spawnRatePerSecond).toBeLessThan(wave25.spawnRatePerSecond);
    expect(wave25.spawnRatePerSecond).toBeLessThan(wave50.spawnRatePerSecond);
    expect(wave25.spawnBudget).toBeGreaterThan(wave1.spawnBudget);
    expect(wave50.spawnBudget).toBeGreaterThan(wave25.spawnBudget);
    expect(wave50.activeBugLimit).toBeGreaterThan(wave1.activeBugLimit);
    expect(wave1.waveDurationMs).toBe(30_000);
    expect(wave25.spawnBudget).toBe(
      Math.round(wave25.spawnRatePerSecond * (wave25.waveDurationMs / 1000)),
    );
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

    expect(calm.damagePerSecond).toBe(0);
    expect(calm.secondsUntilOffline).toBeNull();
    expect(heavy.damagePerSecond).toBeGreaterThan(0);
    expect(heavy.secondsUntilOffline).toBeGreaterThan(0);
    expect(overloaded.damagePerSecond).toBeGreaterThan(0);
    expect(overloaded.damagePerSecond).toBeGreaterThan(heavy.damagePerSecond);
    expect(overloaded.secondsUntilOffline).toBeGreaterThan(0);
  });

  it("raises runtime speed multiplier without becoming unbounded", () => {
    expect(getSurvivalRuntimeSpeedMultiplier(1)).toBe(1);
    expect(getSurvivalRuntimeSpeedMultiplier(25)).toBeGreaterThan(1);
    expect(getSurvivalRuntimeSpeedMultiplier(250)).toBeLessThanOrEqual(2.35);
  });
});
