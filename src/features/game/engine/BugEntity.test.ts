import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BUG_CODEX, { cloneCodex, setCodex } from "./bugCodex";
import { BugEntity } from "./BugEntity";
import { DEFAULT_GAME_CONFIG } from "./types";

function normalizeAngle(angle: number) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

describe("bug movement", () => {
  beforeEach(() => {
    setCodex(cloneCodex(BUG_CODEX));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps from left to right under sustained outward pressure without abrupt heading snaps", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "low",
      vx: -18,
      vy: 0,
      x: 8,
      y: 80,
    });
    const headingDeltas: number[] = [];
    let previousHeading = bug.heading;

    const xSamples: number[] = [];

    for (let index = 0; index < 90; index += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
        targetX: 44,
        targetY: 80,
      });
      headingDeltas.push(Math.abs(normalizeAngle(bug.heading - previousHeading)));
      previousHeading = bug.heading;
      xSamples.push(bug.x);
    }

    expect(xSamples.some((x) => x > 180)).toBe(true);
    expect(Math.max(...headingDeltas)).toBeLessThan(0.35);
  });

  it("continues through the opposite side after crossing the boundary", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "low",
      vx: -30,
      vy: 0,
      x: -13,
      y: 80,
    });
    bug.hasEnteredField = true;

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.x).toBeGreaterThan(180);
    expect(bug.vx).toBeLessThan(0);
    expect(Math.abs(normalizeAngle(bug.heading - Math.PI))).toBeLessThan(0.18);
  });

  it("wraps diagonally through corners without stalling", () => {
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

    for (let index = 0; index < 90; index += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
        targetX: 38,
        targetY: 38,
      });
      positions.push({ x: bug.x, y: bug.y });
    }

    expect(positions.some((position) => position.x > 180)).toBe(true);
    expect(positions.some((position) => position.y > 120)).toBe(true);
    expect(Math.hypot(bug.vx, bug.vy)).toBeGreaterThan(6);
  });

  it("lets offscreen entrants enter the field before wrap-around activates", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 18,
      vy: 0,
      x: -12,
      y: 80,
    });
    bug.hasEnteredField = false;
    const positions: Array<{ x: number; y: number }> = [];

    for (let index = 0; index < 60; index += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
      });
      positions.push({ x: bug.x, y: bug.y });
    }

    expect(Math.max(...positions.slice(0, 12).map((position) => position.x))).toBeLessThan(40);
    expect(positions.some((position) => position.x > 0)).toBe(true);
    expect(positions.every((position) => position.x < 180)).toBe(true);
    expect(bug.hasEnteredField).toBe(true);
  });

  it("assigns a per-bug movement intent instead of steering at the exact center", () => {
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

    expect(bug.roamTargetX).not.toBeNull();
    expect(bug.roamTargetY).not.toBeNull();
    expect(bug.roamTargetX).not.toBe(110);
    expect(bug.roamTargetY).not.toBe(80);
    expect(bug.nextRoamTargetAt).toBeGreaterThan(beforeUpdate + 350);
    expect(bug.nextRoamTargetAt).toBeLessThan(beforeUpdate + 2600);
  });

  it("retargets immediately when it reaches an active intent", () => {
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

    expect(bug.roamTargetX).not.toBe(originalTargetX);
    expect(bug.roamTargetY).not.toBe(originalTargetY);
    expect(Math.hypot(bug.vx, bug.vy)).toBeGreaterThan(0);
  });

  it("prefers intent endpoints away from broad crowding", () => {
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
          centerX: x < 130 ? crowdedCenterX : x,
          centerY: 80,
          count: x < 130 ? 6 : 0,
          score: x < 130 ? 3.6 : 0.1,
        };
      },
      getNeighbors: () => [],
    });

    expect((bug.roamTargetX ?? bug.x) - crowdedCenterX).toBeGreaterThan(bug.x - crowdedCenterX);
  });

  it("enters a startled mood after taking a hit", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "medium",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    const baseline = new BugEntity({
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

    bug.maxHp = 2;
    bug.hp = 2;
    baseline.maxHp = 2;
    baseline.hp = 2;
    baseline.update(1 / 60, context);
    bug.onHit(1);
    bug.update(1 / 60, context);

    expect(bug.movementMood).toBe("startled");
    expect(Math.hypot(bug.vx, bug.vy)).toBeGreaterThan(Math.hypot(baseline.vx, baseline.vy));
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

  it("makes urgent bugs flee the cursor faster than low urgency bugs", () => {
    const lowBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    const urgentBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "urgent",
      vx: 0,
      vy: 0,
      x: 100,
      y: 80,
    });
    const threatContext = {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
      targetX: 84,
      targetY: 80,
    };

    lowBug.update(1 / 60, threatContext);
    urgentBug.update(1 / 60, threatContext);

    expect(urgentBug.x - 100).toBeGreaterThan((lowBug.x - 100) * 2.4);
    expect(Math.hypot(urgentBug.vx, urgentBug.vy)).toBeGreaterThan(
      Math.hypot(lowBug.vx, lowBug.vy) * 2.2,
    );
  });

  it("keeps low bugs catchable before entering close flee range", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 220,
      y: 160,
    });
    const baseline = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 220,
      y: 160,
    });
    const cursorX = 395;
    const cursorY = 160;
    const beforeUpdate = performance.now();

    for (let frame = 0; frame < 12; frame += 1) {
      baseline.update(1 / 60, {
        bounds: { width: 500, height: 320 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
      });
      bug.update(1 / 60, {
        bounds: { width: 500, height: 320 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
        targetX: cursorX,
        targetY: cursorY,
      });
    }

    expect(Math.hypot(220 - cursorX, 160 - cursorY)).toBeGreaterThan(DEFAULT_GAME_CONFIG.fleeRadius * 1.8);
    expect(bug.state).toBe("patrol");
    expect(bug.nextRoamTargetAt).toBeGreaterThan(beforeUpdate + 200);
    expect(Math.abs(bug.heading - baseline.heading)).toBeLessThan(0.04);
    expect(Math.hypot(bug.vx, bug.vy)).toBeLessThanOrEqual(
      Math.hypot(baseline.vx, baseline.vy) * 1.08,
    );
  });

  it("scales mouse-proximity repellant by urgency", () => {
    const variants = ["low", "medium", "high", "urgent"] as const;
    const cursorX = 410;
    const cursorY = 160;
    const hoverSamples = variants.map((variant) => {
      const bug = new BugEntity({
        heading: 0,
        size: 10,
        variant,
        vx: 0,
        vy: 0,
        x: 220,
        y: 160,
      });

      for (let frame = 0; frame < 18; frame += 1) {
        bug.update(1 / 60, {
          bounds: { width: 640, height: 360 },
          config: DEFAULT_GAME_CONFIG,
          getNeighbors: () => [],
          targetX: cursorX,
          targetY: cursorY,
        });
      }

      return {
        distanceDelta:
          Math.hypot(bug.x - cursorX, bug.y - cursorY) -
          Math.hypot(220 - cursorX, 160 - cursorY),
        speed: Math.hypot(bug.vx, bug.vy),
        state: bug.state,
        variant,
      };
    });

    expect(hoverSamples[0].state).toBe("patrol");
    expect(hoverSamples[1].state).toBe("patrol");
    expect(hoverSamples[2].state).toBe("flee");
    expect(hoverSamples[3].state).toBe("flee");
    expect(hoverSamples[1].speed).toBeGreaterThan(hoverSamples[0].speed * 1.1);
    expect(hoverSamples[2].speed).toBeGreaterThan(hoverSamples[0].speed * 1.2);
    expect(hoverSamples[3].speed).toBeGreaterThan(hoverSamples[2].speed * 3);
    expect(hoverSamples[3].distanceDelta).toBeGreaterThan(8);
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

  it("does not orbit into a local spin loop while escaping the cursor", () => {
    const cursorX = 108;
    const cursorY = 90;
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "urgent",
      vx: 0,
      vy: 0,
      x: 122,
      y: 90,
    });
    const orbitAngles: number[] = [];
    const distances: number[] = [];

    for (let frame = 0; frame < 40; frame += 1) {
      bug.update(1 / 60, {
        bounds: { width: 320, height: 220 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
        targetX: cursorX,
        targetY: cursorY,
      });
      orbitAngles.push(Math.atan2(bug.y - cursorY, bug.x - cursorX));
      distances.push(Math.hypot(bug.x - cursorX, bug.y - cursorY));
    }

    let cumulativeOrbitTravel = 0;
    for (let index = 21; index < orbitAngles.length; index += 1) {
      cumulativeOrbitTravel += normalizeAngle(orbitAngles[index] - orbitAngles[index - 1]);
    }

    expect(Math.abs(cumulativeOrbitTravel)).toBeLessThan(Math.PI * 1.2);
    expect(distances.at(-1) ?? 0).toBeGreaterThan(distances[0] + 18);
  });

  it("maintains smooth heading through a horizontal wrap", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "medium",
      vx: -22,
      vy: 0,
      x: 24,
      y: 130,
    });
    const headingDeltas: number[] = [];
    let previousHeading = bug.heading;
    const xSamples: number[] = [];

    for (let frame = 0; frame < 90; frame += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
        targetX: 56,
        targetY: 130,
      });
      headingDeltas.push(Math.abs(normalizeAngle(bug.heading - previousHeading)));
      previousHeading = bug.heading;
      xSamples.push(bug.x);
    }

    expect(xSamples.some((x) => x > 180)).toBe(true);
    expect(Math.max(...headingDeltas)).toBeLessThan(0.35);
  });

  it("wraps cleanly when travelling parallel to a border", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "low",
      vx: -14,
      vy: 0,
      x: 12,
      y: 72,
    });
    const samples: number[] = [];

    for (let frame = 0; frame < 210; frame += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
        targetX: 42,
        targetY: 72,
      });

      samples.push(bug.x);
    }

    expect(samples.some((x) => x < 24)).toBe(true);
    expect(samples.some((x) => x > 180)).toBe(true);
  });

  it("naturally follows wrap-aware roam targets across the seam", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "medium",
      vx: -16,
      vy: 0,
      x: 14,
      y: 90,
    });
    bug.roamTargetX = 206;
    bug.roamTargetY = 90;
    bug.nextRoamTargetAt = performance.now() + 10_000;
    const xSamples: number[] = [];

    for (let frame = 0; frame < 90; frame += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
      });
      xSamples.push(bug.x);
    }

    expect(xSamples.some((x) => x > 180)).toBe(true);
    expect(Math.abs(normalizeAngle(bug.heading - Math.PI))).toBeLessThan(0.28);
  });

  it("treats seam positions as topology-neutral after entering the field", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 8,
      y: 80,
    });
    bug.hasEnteredField = true;

    expect((bug as any).classifyRoamRegion({ width: 220, height: 160 }, 6, 80)).toBe("middle");
    expect((bug as any).getRegionPreferenceScore("edge")).toBe(0);
  });

  it("does not reject seam-adjacent roam targets just because they sit near a wrap boundary", () => {
    const bug = new BugEntity({
      heading: Math.PI,
      size: 10,
      variant: "high",
      vx: 0,
      vy: 0,
      x: 10,
      y: 80,
    });
    bug.hasEnteredField = true;

    const candidateScore = (bug as any).chooseRoamTarget;
    expect(candidateScore).toBeTypeOf("function");

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: () => ({
        centerX: 110,
        centerY: 80,
        count: 0,
        score: 0,
      }),
      getNeighbors: () => [],
    });

    expect(bug.roamTargetX).not.toBeNull();
    const seamDelta = Math.abs(normalizeAngle(Math.atan2(0, -1) - bug.heading));
    expect(seamDelta).toBeLessThan(Math.PI);
  });

  it("does not orbit around nearby bugs while separating from a local crowd", () => {
    const startX = 130;
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "medium",
      vx: 0,
      vy: 0,
      x: startX,
      y: 100,
    });
    const neighbors = [
      new BugEntity({ size: 10, variant: "medium", x: 142, y: 100 }),
      new BugEntity({ size: 10, variant: "medium", x: 144, y: 112 }),
      new BugEntity({ size: 10, variant: "medium", x: 144, y: 88 }),
      new BugEntity({ size: 10, variant: "medium", x: 154, y: 100 }),
    ];
    const crowdCenterX = neighbors.reduce((sum, neighbor) => sum + neighbor.x, 0) / neighbors.length;
    const crowdCenterY = neighbors.reduce((sum, neighbor) => sum + neighbor.y, 0) / neighbors.length;
    const orbitAngles: number[] = [];
    const distances: number[] = [];

    for (let frame = 0; frame < 120; frame += 1) {
      bug.update(1 / 60, {
        bounds: { width: 320, height: 220 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => neighbors,
      });
      orbitAngles.push(Math.atan2(bug.y - crowdCenterY, bug.x - crowdCenterX));
      distances.push(Math.hypot(bug.x - crowdCenterX, bug.y - crowdCenterY));
    }

    let cumulativeOrbitTravel = 0;
    for (let index = 16; index < orbitAngles.length; index += 1) {
      cumulativeOrbitTravel += normalizeAngle(orbitAngles[index] - orbitAngles[index - 1]);
    }

    expect(Math.abs(cumulativeOrbitTravel)).toBeLessThan(Math.PI * 0.9);
    expect(Math.hypot(bug.x - startX, bug.y - 100)).toBeGreaterThan(12);
  });

  it("does not churn patrol roam targets into dense-field spin loops", () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "medium",
      vx: 0,
      vy: 0,
      x: 1038,
      y: 286,
    });
    bug.hasEnteredField = true;

    const roamTargets = new Set<string>();
    const headingSamples: number[] = [];
    const positions: Array<{ x: number; y: number }> = [];

    for (let sample = 0; sample < 24; sample += 1) {
      for (let frame = 0; frame < 6; frame += 1) {
        bug.update(1 / 60, {
          bounds: { width: 1440, height: 1200 },
          config: DEFAULT_GAME_CONFIG,
          getCrowdingAt: () => ({
            centerX: 980,
            centerY: 286,
            count: 12,
            score: 6,
          }),
          getNeighbors: () => [],
        });

        now += 1000 / 60;
      }

      roamTargets.add(`${Math.round(bug.roamTargetX ?? -1)}:${Math.round(bug.roamTargetY ?? -1)}`);
      headingSamples.push(bug.heading);
      positions.push({ x: bug.x, y: bug.y });
    }

    let headingTravel = 0;
    for (let index = 1; index < headingSamples.length; index += 1) {
      headingTravel += Math.abs(normalizeAngle(headingSamples[index] - headingSamples[index - 1]));
    }

    const displacement = Math.hypot(
      positions.at(-1)!.x - positions[0].x,
      positions.at(-1)!.y - positions[0].y,
    );

    expect(roamTargets.size).toBeLessThanOrEqual(7);
    expect(headingTravel).toBeLessThan(Math.PI * 2.2);
    expect(displacement).toBeGreaterThan(18);
  });

  it("resets stale intents when revived", () => {
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
