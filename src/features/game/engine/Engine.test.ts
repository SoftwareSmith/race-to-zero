import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WEAPON_EVOLVE_THRESHOLDS } from "@config/gameDefaults";
import { WeaponTier } from "@game/types";
import { WEAPON_REGISTRY } from "@game/weapons";
import BUG_CODEX, { cloneCodex, setCodex } from "./bugCodex";
import { BugEntity } from "./BugEntity";
import { Engine } from "./Engine";

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
});