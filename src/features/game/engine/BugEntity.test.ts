import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BUG_CODEX, { cloneCodex, setCodex } from "./bugCodex";
import { BugEntity } from "./BugEntity";
import { DEFAULT_GAME_CONFIG } from "./types";

describe("bug movement", () => {
  beforeEach(() => {
    setCodex(cloneCodex(BUG_CODEX));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("steers back into the field without abrupt heading snaps", () => {
    const bug = new BugEntity({
      heading: Math.PI / 2,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 18,
      x: 8,
      y: 80,
    });
    const headingDeltas: number[] = [];
    let previousHeading = bug.heading;

    for (let index = 0; index < 240; index += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
      });
      headingDeltas.push(Math.abs(bug.heading - previousHeading));
      previousHeading = bug.heading;
    }

    expect(bug.x).toBeGreaterThan(34);
    expect(Math.abs(bug.heading - Math.PI / 2)).toBeGreaterThan(0.2);
    expect(Math.max(...headingDeltas)).toBeLessThan(0.35);
  });

  it("reorients inward after crossing the boundary", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "low",
      vx: -18,
      vy: 0,
      x: 2,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.x).toBeGreaterThanOrEqual(6);
    expect(bug.vx).toBeGreaterThan(0);
    expect(Math.abs(bug.heading)).toBeLessThan(0.3);
  });

  it("escapes corners instead of sticking to both walls", () => {
    const bug = new BugEntity({
      heading: -Math.PI * 0.75,
      size: 10,
      variant: "low",
      vx: -16,
      vy: -16,
      x: 4,
      y: 4,
    });
    const positions: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < 180; index += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
      });
      positions.push({ x: bug.x, y: bug.y });
    }

    const tail = positions.slice(-30);
    expect(bug.x).toBeGreaterThan(18);
    expect(bug.y).toBeGreaterThan(18);
    expect(Math.min(...tail.map((position) => position.x))).toBeGreaterThan(10);
    expect(Math.min(...tail.map((position) => position.y))).toBeGreaterThan(10);
  });

  it("uses roam anchors instead of always steering at the exact center", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 40,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.roamTargetX).not.toBe(110);
    expect(bug.roamTargetY).not.toBe(80);
  });

  it("uses crawl profile timing for roam-anchor drift", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 40,
      y: 80,
    });
    const beforeUpdate = performance.now();

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.nextRoamTargetAt).toBeGreaterThan(beforeUpdate + 7900);
    expect(bug.nextRoamTargetAt).toBeLessThan(beforeUpdate + 14_100);
  });

  it("prefers less crowded roam targets to fill open space", () => {
    const baselineBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });
    const crowdedBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });

    baselineBug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    crowdedBug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: (x, y) => ({
        centerX: x,
        centerY: y,
        count: x > 80 && x < 140 && y > 45 && y < 115 ? 8 : 0,
        score: x > 80 && x < 140 && y > 45 && y < 115 ? 8 : 0,
      }),
      getNeighbors: () => [],
    });

    const baselineEdgeDistance = Math.max(
      Math.abs((baselineBug.roamTargetX ?? 110) / 220 - 0.5),
      Math.abs((baselineBug.roamTargetY ?? 80) / 160 - 0.5),
    );
    const crowdedEdgeDistance = Math.max(
      Math.abs((crowdedBug.roamTargetX ?? 110) / 220 - 0.5),
      Math.abs((crowdedBug.roamTargetY ?? 80) / 160 - 0.5),
    );

    expect(crowdedEdgeDistance).toBeGreaterThanOrEqual(baselineEdgeDistance);
  });

  it("pushes roam targets away from a broad overloaded zone", () => {
    const crowdedCenterX = 92;
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "high",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: (x, y, radius) => {
        if (radius > 150) {
          return {
            centerX: crowdedCenterX,
            centerY: 80,
            count: x < 130 ? 14 : 4,
            score: x < 130 ? 7.4 : 1.2,
          };
        }

        return {
          centerX: x,
          centerY: y,
          count: x < 130 ? 6 : 0,
          score: x < 130 ? 3.6 : 0.1,
        };
      },
      getNeighbors: () => [],
    });

    expect((bug.roamTargetX ?? bug.x) - crowdedCenterX).toBeGreaterThan(bug.x - crowdedCenterX);
  });

  it("applies crawl profile speed multipliers", () => {
    const codex = cloneCodex(BUG_CODEX);
    codex.low.profile.speedMultiplier = 2;
    codex.medium.profile.speedMultiplier = 0.5;
    setCodex(codex);
    const fastBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    const slowBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "medium",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    const context = {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    };

    fastBug.update(1 / 60, context);
    slowBug.update(1 / 60, context);

    expect(Math.hypot(fastBug.vx, fastBug.vy)).toBeGreaterThan(
      Math.hypot(slowBug.vx, slowBug.vy) * 2,
    );
  });

  it("steers away from local crowding", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: () => ({
        centerX: 86,
        centerY: 80,
        count: 8,
        score: 6,
      }),
      getNeighbors: () => [],
    });

    expect(bug.vx).toBeGreaterThan(0);
  });

  it("orbits near its roam anchor instead of stopping", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    bug.roamTargetX = 102;
    bug.roamTargetY = 80;
    bug.nextRoamTargetAt = performance.now() + 10_000;

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(Math.hypot(bug.vx, bug.vy)).toBeGreaterThan(0);
    expect(Math.abs(bug.vy)).toBeGreaterThan(0.01);
  });

  it("lingers near a roam anchor before retargeting", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    const originalTargetX = 102;
    const originalTargetY = 80;

    bug.roamTargetX = originalTargetX;
    bug.roamTargetY = originalTargetY;
    bug.nextRoamTargetAt = performance.now() + 10_000;

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.roamTargetX).toBe(originalTargetX);
    expect(bug.roamTargetY).toBe(originalTargetY);
    expect(bug.roamLoiterUntil).toBeGreaterThan(performance.now());
  });

  it("resets stale roam anchors when revived", () => {
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 80 });
    bug.roamTargetX = 999;
    bug.roamTargetY = 999;
    bug.nextRoamTargetAt = performance.now() + 10_000;
    bug.roamLoiterUntil = performance.now() + 500;

    bug.revive(220, 160);

    expect(bug.roamTargetX).toBeNull();
    expect(bug.roamTargetY).toBeNull();
    expect(bug.nextRoamTargetAt).toBe(0);
    expect(bug.roamLoiterUntil).toBe(0);
  });
});
