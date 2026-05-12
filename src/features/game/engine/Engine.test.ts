import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WEAPON_EVOLVE_THRESHOLDS } from "@config/gameDefaults";
import { EntityState, WeaponTier, isTerminalEntityState } from "@game/types";
import { WEAPON_REGISTRY } from "@game/weapons";
import BUG_CODEX, { cloneCodex, setCodex } from "./bugCodex";
import { BugEntity } from "./BugEntity";
import { Engine } from "./Engine";
import { MAX_ACTIVE_BUGS } from "./runtimeSafety";
import { DEFAULT_GAME_CONFIG } from "./types";
import type { BugTransitionSnapshotItem } from "@game/components/BackgroundField/types";

function createCanvas() {
  return {
    clientHeight: 200,
    clientWidth: 200,
    getContext: vi.fn(() => ({
      clearRect: vi.fn(),
    })),
  } as unknown as HTMLCanvasElement;
}

function advanceUntilRemoved(engine: Engine, maxFrames = 120) {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    engine.update(1 / 60, 100, 100);
    if (engine.getAllBugs().length === 0) {
      return;
    }
  }
}

function getMaxLocalClusterSize(bugs: BugEntity[], radius: number) {
  let maxClusterSize = 0;

  for (const bug of bugs) {
    let clusterSize = 0;
    for (const other of bugs) {
      if (Math.hypot(bug.x - other.x, bug.y - other.y) <= radius) {
        clusterSize += 1;
      }
    }
    maxClusterSize = Math.max(maxClusterSize, clusterSize);
  }

  return maxClusterSize;
}

function countBugsInPods(bugs: BugEntity[], radius: number, minimumNeighbors: number) {
  let poddedBugCount = 0;

  for (const bug of bugs) {
    let neighborCount = 0;
    for (const other of bugs) {
      if (bug === other) {
        continue;
      }
      if (Math.hypot(bug.x - other.x, bug.y - other.y) <= radius) {
        neighborCount += 1;
      }
    }
    if (neighborCount >= minimumNeighbors) {
      poddedBugCount += 1;
    }
  }

  return poddedBugCount;
}

describe("engine death attribution", () => {
  beforeEach(() => {
    setCodex(cloneCodex(BUG_CODEX));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports credited direct kills without recounting them", () => {
    const onEntityDeath = vi.fn();
    const engine = new Engine(createCanvas(), {
      height: 200,
      onEntityDeath,
      width: 200,
    });
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });

    engine.entities = [bug];
    engine.handleHit(0, bug.maxHp, true);
    advanceUntilRemoved(engine);

    expect(onEntityDeath).toHaveBeenCalledTimes(1);
    expect(onEntityDeath).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      "low",
      expect.objectContaining({ credited: true, pointValue: 1 }),
    );
  });

  it("reports delayed poison kills as uncredited so the UI can count them", () => {
    const onEntityDeath = vi.fn();
    const engine = new Engine(createCanvas(), {
      height: 200,
      onEntityDeath,
      width: 200,
    });
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });

    bug.hp = 1;
    bug.applyPoison(120, 1000);
    engine.entities = [bug];
    advanceUntilRemoved(engine);

    expect(onEntityDeath).toHaveBeenCalledTimes(1);
    expect(onEntityDeath).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      "low",
      expect.objectContaining({ credited: false, pointValue: 1 }),
    );
  });

  it("credits poison DOT kills to the weapon that applied them", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });

    bug.hp = 1;
    bug.applyPoison(120, 1000, "zapper");
    engine.entities = [bug];
    advanceUntilRemoved(engine);

    expect(engine.getWeaponEvolutionStates().get("zapper")?.kills).toBe(1);
  });

  it("does not double-count a direct kill after poison was already applied", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });

    bug.applyPoison(120, 1000, "zapper");
    engine.entities = [bug];
    engine.handleHit(0, bug.maxHp, true, "hammer");
    advanceUntilRemoved(engine);

    expect(engine.getWeaponEvolutionStates().get("hammer")?.kills).toBe(1);
    expect(engine.getWeaponEvolutionStates().get("zapper")?.kills).toBe(0);
  });

  it("reports delayed burn kills as uncredited so the UI can count them", () => {
    const onEntityDeath = vi.fn();
    const engine = new Engine(createCanvas(), {
      height: 200,
      onEntityDeath,
      width: 200,
    });
    const bug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });

    bug.hp = 1;
    bug.applyBurn(120, 1000, 3.2);
    engine.entities = [bug];
    advanceUntilRemoved(engine);

    expect(onEntityDeath).toHaveBeenCalledTimes(1);
    expect(onEntityDeath).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      "low",
      expect.objectContaining({ credited: false, pointValue: 1 }),
    );
  });

  it("applies stronger burn near the center than at the edge", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const nearBug = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });
    const edgeBug = new BugEntity({ size: 10, variant: "low", x: 145, y: 100 });

    engine.entities = [nearBug, edgeBug];
    engine.applyBurnInRadius(100, 100, 50, 6, 1200, 3.2);

    expect(nearBug.burn?.dps ?? 0).toBeGreaterThan(edgeBug.burn?.dps ?? 0);
    expect(edgeBug.burn?.dps ?? 0).toBeGreaterThan(0);
  });

  it("credits black hole kills to the void weapon", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const bug = new BugEntity({ size: 10, variant: "high", x: 110, y: 100 });

    bug.hp = 1;
    engine.entities = [bug];
    engine.startBlackHole(100, 100, 80, 24, 1000, 1, "void");
    engine.tickBlackHole(16, vi.fn());
    advanceUntilRemoved(engine);

    expect(engine.getWeaponEvolutionStates().get("void")?.kills).toBe(1);
  });

  it("collapses black holes after their duration expires", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const onCollapse = vi.fn();

    engine.startBlackHole(100, 100, 80, 24, 1000, 1, "void");

    for (let frame = 0; frame < 90; frame += 1) {
      engine.update(1 / 60);
      engine.tickBlackHole(1000 / 60, onCollapse);
      if (engine.getBlackHole() == null) {
        break;
      }
    }

    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(engine.getBlackHole()).toBeNull();
  });

  it("keeps patrol bugs active near seams without pinning them to the center", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const bug = new BugEntity({
      heading: 0,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 170,
      y: 100,
    });

    engine.entities = [bug];
    const xSamples: number[] = [];

    for (let frame = 0; frame < 120; frame += 1) {
      engine.update(1 / 60, null, null);
      xSamples.push(bug.x);
    }

    expect(xSamples.some((x) => x > 180)).toBe(true);
    expect(xSamples.every((x) => x > 70)).toBe(true);
  });

  it("reports stable crowding centers and scores", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const subject = new BugEntity({ size: 10, variant: "low", x: 100, y: 100 });

    engine.entities = [
      subject,
      new BugEntity({ size: 10, variant: "low", x: 90, y: 100 }),
      new BugEntity({ size: 10, variant: "low", x: 94, y: 104 }),
      new BugEntity({ size: 10, variant: "low", x: 150, y: 100 }),
    ];
    engine.update(1 / 60, null, null);

    const crowding = engine.getCrowdingAt(100, 100, 32, subject);

    expect(crowding.count).toBe(2);
    expect(crowding.score).toBeGreaterThan(1);
    expect(crowding.centerX).toBeLessThan(100);
  });

  it("treats seam-adjacent bugs as local neighbors across the wrap", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const subject = new BugEntity({ size: 10, variant: "low", x: 4, y: 100 });
    const seamNeighbor = new BugEntity({ size: 10, variant: "medium", x: 196, y: 100 });

    engine.entities = [subject, seamNeighbor];
    engine.update(1 / 60, null, null);

    expect(engine.getNeighbors(subject, 16)).toContain(seamNeighbor);
  });

  it("reports wrapped crowding centers near the seam", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const subject = new BugEntity({ size: 10, variant: "low", x: 4, y: 100 });
    const seamNeighbor = new BugEntity({ size: 10, variant: "medium", x: 196, y: 100 });

    engine.entities = [subject, seamNeighbor];
    engine.update(1 / 60, null, null);

    const crowding = engine.getCrowdingAt(4, 100, 16, subject);

    expect(crowding.count).toBe(1);
    expect(crowding.centerX).toBeGreaterThan(180);
  });

  it("hits seam-adjacent bugs with wrapped point and line hit tests", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const seamBug = new BugEntity({ size: 10, variant: "high", x: 196, y: 100 });

    engine.entities = [seamBug];

    expect(engine.hitTest(4, 100)).toEqual({ distance: 8, index: 0 });
    expect(engine.lineHitTest(4, 100, 196, 100, 0)).toEqual([0]);
    expect(engine.radiusHitTest(4, 100, 4)).toEqual([0]);
  });

  it("does not clamp pre-entry bugs back onto the board during engine updates", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const entrant = new BugEntity({ size: 10, variant: "low", x: -12, y: 80, vx: 0, vy: 0 });

    entrant.hasEnteredField = false;
    engine.entities = [entrant];
    engine.update(1 / 60, null, null);

    expect(entrant.x).toBeLessThan(0);
  });

  it("returns read-only bug telemetry snapshots for live bugs", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });
    const liveBug = new BugEntity({
      heading: Math.PI / 3,
      size: 10,
      variant: "low",
      vx: 2,
      vy: -1,
      x: 100,
      y: 120,
    });
    const deadBug = new BugEntity({ size: 8, variant: "medium", x: 40, y: 50 });

    liveBug.movementMood = "patrol";
    liveBug.roamTargetX = 160;
    liveBug.roamTargetY = 80;
    deadBug.state = EntityState.Dead;
    engine.entities = [liveBug, deadBug];

    expect(engine.getBugTelemetrySnapshot()).toEqual([
      expect.objectContaining({
        heading: Math.PI / 3,
        index: 0,
        movementMood: "patrol",
        targetX: 160,
        targetY: 80,
        variant: "low",
        vx: 2,
        vy: -1,
        x: 100,
        y: 120,
      }),
    ]);
  });

  it("keeps simulated swarms distributed across board quadrants", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ high: 10, low: 30, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 360; frame += 1) {
      engine.update(1 / 60, null, null);
    }

    const quadrantCounts = [0, 0, 0, 0];
    for (const bug of engine.getAllBugs() as BugEntity[]) {
      const quadrant = (bug.x >= 100 ? 1 : 0) + (bug.y >= 100 ? 2 : 0);
      quadrantCounts[quadrant] += 1;
    }

    expect(quadrantCounts.filter((count) => count > 0)).toHaveLength(4);
    expect(Math.max(...quadrantCounts)).toBeLessThan(engine.getAllBugs().length * 0.55);
  });

  it("keeps the swarm centroid near the board center over time", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ high: 10, low: 30, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 360; frame += 1) {
      engine.update(1 / 60, null, null);
    }

    const bugs = engine.getAllBugs() as BugEntity[];
    const centroid = bugs.reduce(
      (acc, bug) => ({ x: acc.x + bug.x, y: acc.y + bug.y }),
      { x: 0, y: 0 },
    );
    const centroidX = centroid.x / Math.max(1, bugs.length);
    const centroidY = centroid.y / Math.max(1, bugs.length);

    expect(centroidX).toBeGreaterThan(78);
    expect(centroidX).toBeLessThan(122);
    expect(centroidY).toBeGreaterThan(78);
    expect(centroidY).toBeLessThan(122);
  });

  it("keeps a meaningful share of the swarm outside the center box", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ high: 10, low: 30, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 360; frame += 1) {
      engine.update(1 / 60, null, null);
    }

    const bugs = engine.getAllBugs() as BugEntity[];
    const outsideCenterBox = bugs.filter(
      (bug) => bug.x < 70 || bug.x > 130 || bug.y < 56 || bug.y > 144,
    ).length;

    expect(outsideCenterBox).toBeGreaterThan(engine.getAllBugs().length * 0.42);
  });

  it("keeps a visible share of the swarm in the outer perimeter bands", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ high: 10, low: 30, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 360; frame += 1) {
      engine.update(1 / 60, null, null);
    }

    const perimeterBandCount = (engine.getAllBugs() as BugEntity[]).filter(
      (bug) => bug.x < 36 || bug.x > 164 || bug.y < 32 || bug.y > 168,
    ).length;

    expect(perimeterBandCount).toBeGreaterThan(engine.getAllBugs().length * 0.26);
  });

  it("does not collapse edge spawns into a handful of dense startup clusters", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnBurst({ high: 10, low: 30, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 90; frame += 1) {
      engine.update(1 / 60, null, null);
    }

    const bugs = engine.getAllBugs() as BugEntity[];
    const maxClusterSize = getMaxLocalClusterSize(bugs, 18);
    const centerBoxCount = bugs.filter(
      (bug) => bug.x >= 70 && bug.x <= 130 && bug.y >= 56 && bug.y <= 144,
    ).length;

    expect(maxClusterSize).toBeLessThan(8);
    expect(centerBoxCount).toBeLessThan(bugs.length * 0.4);
  });

  it("does not settle into persistent close-range pods over time", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ high: 10, low: 30, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 540; frame += 1) {
      engine.update(1 / 60, null, null);
    }

    const bugs = engine.getAllBugs() as BugEntity[];
    const poddedBugCount = countBugsInPods(bugs, 12, 5);
    const maxClusterSize = getMaxLocalClusterSize(bugs, 18);

    expect(poddedBugCount).toBeLessThan(bugs.length * 0.62);
    expect(maxClusterSize).toBeLessThanOrEqual(15);
  });

  it("caps temporary allies so conversion stays readable", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.entities = Array.from({ length: 7 }, (_, index) =>
      new BugEntity({ size: 10, variant: "low", x: 60 + index * 12, y: 100 }),
    );

    for (let index = 0; index < engine.entities.length; index += 1) {
      engine.allyBug(index, { durationMs: 2000, maxActiveAllies: 5 });
    }

    const activeAllies = engine.getAllBugs().filter((bug: any) => bug.ally).length;
    expect(activeAllies).toBe(5);
  });

  it("uses config-driven ally caps instead of a fixed engine limit", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.entities = Array.from({ length: 7 }, (_, index) =>
      new BugEntity({ size: 10, variant: "low", x: 60 + index * 12, y: 100 }),
    );

    for (let index = 0; index < engine.entities.length; index += 1) {
      engine.allyBug(index, { durationMs: 2000, maxActiveAllies: 3 });
    }

    const activeAllies = engine.getAllBugs().filter((bug: any) => bug.ally).length;
    expect(activeAllies).toBe(3);
  });

  it("spawns survival bursts off-screen and sends them inward", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.173) % 1;
      return seed;
    });

    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnBurst({ high: 1, low: 1, medium: 1, urgent: 1 });

    const bugs = engine.getAllBugs() as BugEntity[];

    expect(bugs).toHaveLength(4);
    expect(
      bugs.every(
        (bug) =>
          (bug.y < 0 && bug.vy > 0) ||
          (bug.x > 200 && bug.vx < 0) ||
          (bug.y > 200 && bug.vy < 0) ||
          (bug.x < 0 && bug.vx > 0),
      ),
    ).toBe(true);
  });

  it("fans larger survival bursts across multiple edge lanes", () => {
    const randomSpy = vi.spyOn(Math, "random");
    let seed = 0;
    randomSpy.mockImplementation(() => {
      seed = (seed + 0.137) % 1;
      return seed;
    });

    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnBurst({ high: 2, low: 8, medium: 2, urgent: 2 });

    const bugs = engine.getAllBugs() as BugEntity[];
    const offscreenLanes = new Set(
      bugs.map((bug) => {
        if (bug.y < 0 || bug.y > 200) {
          return `horizontal-${Math.round(bug.x / 24)}`;
        }

        return `vertical-${Math.round(bug.y / 24)}`;
      }),
    );

    expect(offscreenLanes.size).toBeGreaterThan(4);
  });

  it.each(WEAPON_REGISTRY.map((weapon) => weapon.id))(
    "promotes %s through all three tiers at its kill thresholds",
    (weaponId) => {
    const onWeaponEvolution = vi.fn();
    const engine = new Engine(createCanvas(), {
      height: 200,
      onWeaponEvolution,
      width: 200,
    });
    const [tierTwoThreshold, tierThreeThreshold] = WEAPON_EVOLVE_THRESHOLDS[weaponId];

    for (let kills = 0; kills < tierTwoThreshold - 1; kills += 1) {
      engine.recordWeaponKill(weaponId);
    }

    expect(engine.getWeaponEvolutionStates().get(weaponId)).toMatchObject({
      kills: Math.max(0, tierTwoThreshold - 1),
      tier: WeaponTier.TIER_ONE,
    });
    expect(onWeaponEvolution).not.toHaveBeenCalled();

    engine.recordWeaponKill(weaponId);

    expect(engine.getWeaponEvolutionStates().get(weaponId)).toMatchObject({
      kills: tierTwoThreshold,
      tier: WeaponTier.TIER_TWO,
    });
    expect(onWeaponEvolution).toHaveBeenNthCalledWith(1, weaponId, WeaponTier.TIER_TWO);

    for (let kills = tierTwoThreshold; kills < tierThreeThreshold - 1; kills += 1) {
      engine.recordWeaponKill(weaponId);
    }

    expect(engine.getWeaponEvolutionStates().get(weaponId)).toMatchObject({
      kills: Math.max(tierTwoThreshold, tierThreeThreshold - 1),
      tier: WeaponTier.TIER_TWO,
    });
    expect(onWeaponEvolution).toHaveBeenCalledTimes(1);

    engine.recordWeaponKill(weaponId);

    expect(engine.getWeaponEvolutionStates().get(weaponId)).toMatchObject({
      kills: tierThreeThreshold,
      tier: WeaponTier.TIER_THREE,
    });
    expect(onWeaponEvolution).toHaveBeenNthCalledWith(2, weaponId, WeaponTier.TIER_THREE);

    engine.recordWeaponKill(weaponId);

    expect(engine.getWeaponEvolutionStates().get(weaponId)).toMatchObject({
      kills: tierThreeThreshold + 1,
      tier: WeaponTier.TIER_THREE,
    });
    expect(onWeaponEvolution).toHaveBeenCalledTimes(2);
    },
  );

  it("respects the active mode weapon tier cap", () => {
    const cappedEvolution = vi.fn();
    const cappedEngine = new Engine(createCanvas(), {
      height: 200,
      onWeaponEvolution: cappedEvolution,
      width: 200,
    });
    const survivalEvolution = vi.fn();
    const survivalEngine = new Engine(createCanvas(), {
      height: 200,
      maxWeaponTier: WeaponTier.TIER_FIVE,
      onWeaponEvolution: survivalEvolution,
      width: 200,
    });
    const thresholds = WEAPON_EVOLVE_THRESHOLDS.hammer;
    const tierFourThreshold = thresholds[2];

    expect(tierFourThreshold).toBeGreaterThan(0);

    for (let kills = 0; kills < tierFourThreshold; kills += 1) {
      cappedEngine.recordWeaponKill("hammer");
      survivalEngine.recordWeaponKill("hammer");
    }

    expect(cappedEngine.getWeaponEvolutionStates().get("hammer")).toMatchObject({
      kills: tierFourThreshold,
      tier: WeaponTier.TIER_THREE,
    });
    expect(cappedEvolution).toHaveBeenCalledTimes(2);
    expect(survivalEngine.getWeaponEvolutionStates().get("hammer")).toMatchObject({
      kills: tierFourThreshold,
      tier: WeaponTier.TIER_FOUR,
    });
    expect(survivalEvolution).toHaveBeenCalledWith("hammer", WeaponTier.TIER_FOUR);
  });
});

describe("engine runtime bounds", () => {
  beforeEach(() => {
    setCodex(cloneCodex(BUG_CODEX));
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caps spawnFromCounts to the maximum active bug limit", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ low: MAX_ACTIVE_BUGS + 250 });

    expect(engine.getAllBugs()).toHaveLength(MAX_ACTIVE_BUGS);
  });

  it("caps spawnBurst by remaining entity capacity", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromCounts({ low: MAX_ACTIVE_BUGS - 2 });
    engine.spawnBurst({ high: 10 });

    expect(engine.getAllBugs()).toHaveLength(MAX_ACTIVE_BUGS);
  });

  it("sanitizes invalid snapshot items before spawning", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromSnapshot([
      {
        heading: Number.NaN,
        hp: 999999,
        maxHp: -5,
        opacity: 4,
        size: -10,
        variant: "not-real" as any,
        vx: Number.POSITIVE_INFINITY,
        vy: Number.NEGATIVE_INFINITY,
        x: Number.NaN,
        y: Number.NaN,
      },
    ]);

    const [bug] = engine.getAllBugs() as BugEntity[];

    expect(bug.variant).toBe("low");
    expect(bug.maxHp).toBeGreaterThanOrEqual(1);
    expect(bug.hp).toBeLessThanOrEqual(bug.maxHp);
    expect(bug.size).toBeGreaterThan(0);
    expect(Number.isFinite(bug.x)).toBe(true);
    expect(Number.isFinite(bug.y)).toBe(true);
    expect(Number.isFinite(bug.vx)).toBe(true);
    expect(Number.isFinite(bug.vy)).toBe(true);
  });

  it("preserves movement identity when spawning from transition snapshots", () => {
    const engine = new Engine(createCanvas(), {
      height: 200,
      width: 200,
    });

    engine.spawnFromSnapshot([
      {
        cruiseSpeed: 1.13,
        fleeTimer: 0.42,
        hasEnteredField: true,
        heading: 1.1,
        hp: 2,
        maxHp: 3,
        motionTime: 84,
        movementMood: "startled",
        nextRoamTargetDelayMs: 640,
        opacity: 1,
        roamTargetGeneration: 7,
        roamTargetLongPath: true,
        roamTargetWide: true,
        roamTargetX: 160,
        roamTargetY: 70,
        seed: 0.23,
        size: 10,
        state: "flee",
        turnRate: 1.08,
        variant: "low",
        vx: 5,
        vy: -3,
        wanderAngle: 2.4,
        x: 100,
        y: 120,
      },
    ]);

    const [bug] = engine.getAllBugs() as BugEntity[];

    expect(bug.seed).toBeCloseTo(0.23);
    expect(bug.wanderAngle).toBeCloseTo(2.4);
    expect(bug.cruiseSpeed).toBeCloseTo(1.13);
    expect(bug.turnRate).toBeCloseTo(1.08);
    expect(bug.motionTime).toBeCloseTo(84);
    expect(bug.roamTargetX).toBe(160);
    expect(bug.roamTargetY).toBe(70);
    expect(bug.roamTargetWide).toBe(true);
    expect(bug.roamTargetLongPath).toBe(true);
    expect(bug.roamTargetGeneration).toBe(7);
    expect(bug.movementMood).toBe("startled");
    expect(bug.state).toBe("flee");
    expect(bug.fleeTimer).toBeCloseTo(0.42);
  });

  it("matches live movement after snapshot handoff under the same cursor input", () => {
    const sourceEngine = new Engine(createCanvas(), {
      height: 240,
      width: 320,
    });
    const sourceBug = new BugEntity({
      heading: 0.2,
      size: 10,
      variant: "urgent",
      vx: 24,
      vy: -6,
      x: 172,
      y: 116,
    });

    sourceEngine.entities = [sourceBug];

    for (let frame = 0; frame < 18; frame += 1) {
      sourceEngine.update(1 / 60, 190, 120);
    }

    const [liveBugBeforeHandoff] = sourceEngine.getAllBugs() as BugEntity[];
    const snapshot: BugTransitionSnapshotItem[] = [
      {
        cruiseSpeed: liveBugBeforeHandoff.cruiseSpeed,
        fleeTimer: liveBugBeforeHandoff.fleeTimer,
        hasEnteredField: liveBugBeforeHandoff.hasEnteredField,
        heading: liveBugBeforeHandoff.heading,
        hp: liveBugBeforeHandoff.hp,
        maxHp: liveBugBeforeHandoff.maxHp,
        motionTime: liveBugBeforeHandoff.motionTime,
        movementMood: liveBugBeforeHandoff.movementMood,
        nextRoamTargetDelayMs: Math.max(
          0,
          liveBugBeforeHandoff.nextRoamTargetAt - performance.now(),
        ),
        opacity: liveBugBeforeHandoff.opacity,
        roamTargetGeneration: liveBugBeforeHandoff.roamTargetGeneration,
        roamTargetLongPath: liveBugBeforeHandoff.roamTargetLongPath,
        roamTargetWide: liveBugBeforeHandoff.roamTargetWide,
        roamTargetX: liveBugBeforeHandoff.roamTargetX,
        roamTargetY: liveBugBeforeHandoff.roamTargetY,
        seed: liveBugBeforeHandoff.seed,
        size: liveBugBeforeHandoff.size,
        state: liveBugBeforeHandoff.state === "flee" ? "flee" : "patrol",
        turnRate: liveBugBeforeHandoff.turnRate,
        variant: liveBugBeforeHandoff.variant,
        vx: liveBugBeforeHandoff.vx,
        vy: liveBugBeforeHandoff.vy,
        wanderAngle: liveBugBeforeHandoff.wanderAngle,
        x: liveBugBeforeHandoff.x,
        y: liveBugBeforeHandoff.y,
      },
    ];

    const handoffEngine = new Engine(createCanvas(), {
      height: 240,
      width: 320,
    });
    handoffEngine.spawnFromSnapshot(snapshot);

    for (let frame = 0; frame < 60; frame += 1) {
      sourceEngine.update(1 / 60, 190, 120);
      handoffEngine.update(1 / 60, 190, 120);
    }

    const [liveBugAfterHandoff] = sourceEngine.getAllBugs() as BugEntity[];
    const [respawnedBug] = handoffEngine.getAllBugs() as BugEntity[];

    expect(respawnedBug.state).toBe(liveBugAfterHandoff.state);
    expect(respawnedBug.movementMood).toBe(liveBugAfterHandoff.movementMood);
    expect(respawnedBug.x).toBeCloseTo(liveBugAfterHandoff.x, 5);
    expect(respawnedBug.y).toBeCloseTo(liveBugAfterHandoff.y, 5);
    expect(respawnedBug.vx).toBeCloseTo(liveBugAfterHandoff.vx, 5);
    expect(respawnedBug.vy).toBeCloseTo(liveBugAfterHandoff.vy, 5);
    expect(respawnedBug.heading).toBeCloseTo(liveBugAfterHandoff.heading, 5);
  });

  it("keeps aggregate swarm motion aligned after a snapshot handoff", () => {
    const sourceEngine = new Engine(createCanvas(), {
      height: 240,
      width: 320,
    });

    sourceEngine.spawnFromCounts({ high: 8, low: 14, medium: 10, urgent: 6 });

    for (let frame = 0; frame < 24; frame += 1) {
      sourceEngine.update(1 / 60, 190, 120);
    }

    const now = performance.now();
    const snapshot: BugTransitionSnapshotItem[] = (sourceEngine.getAllBugs() as BugEntity[])
      .filter((bug) => !isTerminalEntityState(bug.state))
      .map((bug) => ({
        cruiseSpeed: bug.cruiseSpeed,
        fleeTimer: bug.fleeTimer,
        hasEnteredField: bug.hasEnteredField,
        heading: bug.heading,
        hp: bug.hp,
        maxHp: bug.maxHp,
        motionTime: bug.motionTime,
        movementMood: bug.movementMood,
        nextRoamTargetDelayMs: Math.max(0, bug.nextRoamTargetAt - now),
        opacity: bug.opacity,
        roamTargetGeneration: bug.roamTargetGeneration,
        roamTargetLongPath: bug.roamTargetLongPath,
        roamTargetWide: bug.roamTargetWide,
        roamTargetX: bug.roamTargetX,
        roamTargetY: bug.roamTargetY,
        seed: bug.seed,
        size: bug.size,
        state: bug.state === "flee" ? "flee" : "patrol",
        turnRate: bug.turnRate,
        variant: bug.variant,
        vx: bug.vx,
        vy: bug.vy,
        wanderAngle: bug.wanderAngle,
        x: bug.x,
        y: bug.y,
      }));

    const handoffEngine = new Engine(createCanvas(), {
      height: 240,
      width: 320,
    });
    handoffEngine.spawnFromSnapshot(snapshot);

    for (let frame = 0; frame < 60; frame += 1) {
      sourceEngine.update(1 / 60, 190, 120);
      handoffEngine.update(1 / 60, 190, 120);
    }

    const summarize = (bugs: BugEntity[]) => {
      const liveBugs = bugs.filter((bug) => !isTerminalEntityState(bug.state));
      const totalSpeed = liveBugs.reduce(
        (sum, bug) => sum + Math.hypot(bug.vx, bug.vy),
        0,
      );
      const startledCount = liveBugs.filter(
        (bug) => bug.movementMood === "startled",
      ).length;
      return {
        count: liveBugs.length,
        meanSpeed: totalSpeed / Math.max(1, liveBugs.length),
        startledCount,
      };
    };

    const liveSummary = summarize(sourceEngine.getAllBugs() as BugEntity[]);
    const handoffSummary = summarize(handoffEngine.getAllBugs() as BugEntity[]);

    expect(handoffSummary.count).toBe(liveSummary.count);
    expect(handoffSummary.startledCount).toBe(liveSummary.startledCount);
    expect(handoffSummary.meanSpeed).toBeCloseTo(liveSummary.meanSpeed, 4);
  });

  it("clamps extreme config overrides to safe runtime bounds", () => {
    const engine = new Engine(createCanvas(), {
      config: {
        baseSpeed: 10_000,
        crowdRepathDelay: -100,
        separationRadius: 0,
      },
      height: 200,
      width: 200,
    });

    expect(engine.config.baseSpeed).toBeLessThanOrEqual(DEFAULT_GAME_CONFIG.baseSpeed * 10);
    expect(engine.config.crowdRepathDelay).toBeGreaterThanOrEqual(0.01);
    expect(engine.config.separationRadius).toBeGreaterThanOrEqual(0.1);
  });
});
