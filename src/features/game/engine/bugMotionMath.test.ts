import { describe, expect, it } from "vitest";

import {
  clamp,
  getAngleDelta,
  getLength,
  getNormalizedCrowdScore,
  normalizeAngle,
  normalizeVector,
  perlin1D,
} from "./bugMotionMath";

describe("bug motion math", () => {
  it("clamps values into range", () => {
    expect(clamp(-4, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(24, 0, 10)).toBe(10);
  });

  it("normalizes angles and computes wrapped deltas", () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(getAngleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  it("normalizes vectors and lengths", () => {
    expect(getLength(3, 4)).toBe(5);
    expect(normalizeVector(0, 0)).toEqual({ x: 0, y: 0 });
    expect(normalizeVector(3, 4)).toEqual({ x: 0.6, y: 0.8 });
  });

  it("scales crowd scores defensively", () => {
    expect(getNormalizedCrowdScore(0, 5)).toBe(0);
    expect(getNormalizedCrowdScore(12, 0)).toBe(0);
    expect(getNormalizedCrowdScore(12, 9)).toBeCloseTo(12 / (3 * 0.72));
  });

  it("produces deterministic bounded noise", () => {
    const first = perlin1D(1.25, 2.5);
    const second = perlin1D(1.25, 2.5);

    expect(first).toBeCloseTo(second);
    expect(first).toBeGreaterThanOrEqual(-2);
    expect(first).toBeLessThanOrEqual(2);
  });
});