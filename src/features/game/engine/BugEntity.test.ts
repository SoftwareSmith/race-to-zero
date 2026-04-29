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

  it("resets stale roam anchors when revived", () => {
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 80 });
    bug.roamTargetX = 999;
    bug.roamTargetY = 999;
    bug.nextRoamTargetAt = performance.now() + 10_000;

    bug.revive(220, 160);

    expect(bug.roamTargetX).toBeNull();
    expect(bug.roamTargetY).toBeNull();
    expect(bug.nextRoamTargetAt).toBe(0);
  });
});
