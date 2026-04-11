import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});