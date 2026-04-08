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

  it("steers back into the field instead of orbiting the left edge", () => {
    const bug = new BugEntity({
      heading: Math.PI / 2,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 18,
      x: 10,
      y: 80,
    });

    for (let index = 0; index < 240; index += 1) {
      bug.update(1 / 60, {
        bounds: { width: 220, height: 160 },
        config: DEFAULT_GAME_CONFIG,
        getNeighbors: () => [],
      });
    }

    expect(bug.x).toBeGreaterThan(34);
    expect(Math.abs(bug.heading - Math.PI / 2)).toBeGreaterThan(0.2);
  });

  it("injects inward motion when clamped against a wall", () => {
    const bug = new BugEntity({
      heading: Math.PI / 2,
      size: 10,
      variant: "low",
      vx: 0,
      vy: 18,
      x: 10,
      y: 80,
    });

    bug.update(1 / 60, {
      bounds: { width: 220, height: 160 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });

    expect(bug.vx).toBeGreaterThan(6);
    expect(bug.x).toBeGreaterThan(10);
  });
});
