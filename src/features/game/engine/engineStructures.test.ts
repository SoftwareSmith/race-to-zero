import { describe, expect, it } from "vitest";

import { WeaponTier } from "@game/types";
import { EngineStructureState } from "./engineStructures";

describe("EngineStructureState", () => {
  it("evicts the oldest structure of the same type when over cap", () => {
    const state = new EngineStructureState();

    state.addStructure(10, 20, "agent", 100, "agent-1");
    state.addStructure(20, 30, "agent", 200, "agent-2");
    state.addStructure(30, 40, "agent", 300, "agent-3");

    expect(state.getStructures()).toEqual([
      expect.objectContaining({ id: "agent-2", type: "agent" }),
      expect.objectContaining({ id: "agent-3", type: "agent" }),
    ]);
  });

  it("updates and removes structures by id", () => {
    const state = new EngineStructureState();
    const id = state.addStructure(10, 20, "lantern", 100, "lantern-1");

    state.updateStructureTier(id, WeaponTier.TIER_THREE);
    expect(state.getStructures()).toEqual([
      expect.objectContaining({ id: "lantern-1", tier: WeaponTier.TIER_THREE }),
    ]);

    state.removeStructure(id);
    expect(state.getStructures()).toEqual([]);
  });
});