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
    expect(Math.abs(bug.heading - Math.PI / 2)).toBeGreaterThan(0.1);
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

  it("keeps edge roam targets close to the perimeter lane", () => {
    const codex = cloneCodex(BUG_CODEX);
    codex.medium.profile.regionWeights = { edge: 1, middle: 0, interior: 0 };
    codex.medium.profile.wideRoamChance = 0;
    codex.medium.profile.edgePreference = 0.32;
    setCodex(codex);
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "medium",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: () => ({ centerX: 110, centerY: 80, count: 0, score: 0 }),
      getNeighbors: () => [],
    });

    expect(bug.roamTargetX).not.toBeNull();
    expect(bug.roamTargetY).not.toBeNull();
    expect(bug.roamTargetRegion).toBe("edge");
    const targetX = bug.roamTargetX ?? 110;
    const targetY = bug.roamTargetY ?? 80;
    const perimeterDistance = Math.min(targetX, 220 - targetX, targetY, 160 - targetY);

    expect(perimeterDistance).toBeLessThan(48);
  });

  it("keeps middle-lane roam targets out of the tight center box", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.roamTargetX).not.toBeNull();
    expect(bug.roamTargetY).not.toBeNull();
    const targetX = bug.roamTargetX ?? 110;
    const targetY = bug.roamTargetY ?? 80;
    const inTightCenter = targetX > 88 && targetX < 132 && targetY > 56 && targetY < 104;

    expect(inTightCenter).toBe(false);
  });

  it("avoids corridor-style middle anchors that read like rows and columns", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    const targetX = bug.roamTargetX ?? 110;
    const targetY = bug.roamTargetY ?? 80;
    const inTopBand = targetY > 24 && targetY < 54;
    const inRightBand = targetX > 144 && targetX < 188;

    expect(inTopBand && inRightBand).toBe(false);
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

  it("regroups when social bugs have nearby packmates and open space", () => {
    const codex = cloneCodex(BUG_CODEX);
    codex.low.socialAffinity = 0.55;
    setCodex(codex);
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 80,
      y: 80,
    });
    const neighbors = [
      new BugEntity({ size: 10, variant: "low", vx: 10, vy: 0, x: 96, y: 78 }),
      new BugEntity({ size: 10, variant: "low", vx: 10, vy: 0, x: 102, y: 82 }),
    ];

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getCrowdingAt: () => ({ centerX: 80, centerY: 80, count: 1, score: 0.5 }),
      getNeighbors: () => neighbors,
    });

    expect(bug.movementMood).toBe("regroup");
    expect(bug.vx).toBeGreaterThan(0);
  });

  it("follows lane tangents for edge anchors", () => {
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "medium",
      vx: 0,
      vy: 0,
      x: 40,
      y: 80,
    });
    bug.roamTargetX = 24;
    bug.roamTargetY = 128;
    bug.roamTargetRegion = "edge";
    bug.roamTargetWide = false;
    bug.nextRoamTargetAt = performance.now() + 10_000;

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.movementMood).toBe("lane-follow");
    expect(Math.abs(bug.vx)).toBeGreaterThan(0.01);
  });

  it("retargets instead of loitering near an active roam anchor", () => {
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
    bug.roamTargetRegion = "middle";
    bug.roamTargetWide = false;
    bug.nextRoamTargetAt = performance.now() + 10_000;
    bug.roamLoiterUntil = performance.now() + 400;

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.movementMood).not.toBe("loiter");
    expect(bug.roamTargetX).not.toBe(102);
    expect(bug.roamTargetY).not.toBe(80);
    expect(Math.hypot(bug.vx, bug.vy)).toBeGreaterThan(0);
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

  it("lets crawl profiles bias long-path roaming per bug class", () => {
    const codex = cloneCodex(BUG_CODEX);
    codex.low.profile.longPathBias = 1;
    codex.low.profile.wideRoamChance = 1;
    codex.high.profile.longPathBias = 0;
    codex.high.profile.wideRoamChance = 0;
    codex.high.profile.regionWeights = { edge: 1, middle: 0, interior: 0 };
    setCodex(codex);

    const lowBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });
    const highBug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "high",
      vx: 0,
      vy: 0,
      x: 110,
      y: 80,
    });

    lowBug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });
    highBug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(lowBug.roamTargetLongPath).toBe(true);
    expect(highBug.roamTargetLongPath).toBe(false);
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
    expect(bug.nextRoamTargetAt).toBeGreaterThan(beforeUpdate + 1000);
    expect(Math.abs(bug.heading - baseline.heading)).toBeLessThan(0.02);
    expect(Math.hypot(bug.vx, bug.vy)).toBeLessThanOrEqual(
      Math.hypot(baseline.vx, baseline.vy) * 1.05,
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

  it("immediately retargets when it reaches a roam anchor", () => {
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
    expect(bug.roamLoiterUntil).toBe(0);
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
