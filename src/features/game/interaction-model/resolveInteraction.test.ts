import { describe, expect, it } from "vitest";

import { fireResistantBug } from "./bugs/fireResistantBug";
import { resolveInteraction } from "./resolveInteraction";
import { burnStatus } from "./statuses";
import type { WeaponConfig } from "./types";
import { hammerWeapon } from "./weapons/hammer";

const fireWeapon: WeaponConfig = {
  id: "ember-wand",
  name: "Ember Wand",
  type: "fire",
  damage: 4,
  statusesOnHit: [burnStatus],
};

describe("resolveInteraction", () => {
  it("keeps blunt weapons readable and direct", () => {
    expect(resolveInteraction(hammerWeapon.config, fireResistantBug)).toEqual({
      outcome: "normal",
      damage: 2,
      appliedStatuses: [],
      blockedStatuses: [],
      notes: [],
    });
  });

  it("returns immune cleanly instead of hiding it in effects", () => {
    expect(resolveInteraction(fireWeapon, fireResistantBug)).toEqual({
      outcome: "immune",
      damage: 0,
      appliedStatuses: [],
      blockedStatuses: ["burn"],
      notes: [
        "Cinder Mite ignores burn.",
        "Cinder Mite is immune to fire damage.",
      ],
    });
  });

  it("treats armor as a simple weak rule for non-blunt damage", () => {
    const electricWeapon: WeaponConfig = {
      id: "prod",
      name: "Prod",
      type: "electric",
      damage: 5,
    };

    expect(resolveInteraction(electricWeapon, fireResistantBug)).toEqual({
      outcome: "weak",
      damage: 2,
      appliedStatuses: [],
      blockedStatuses: [],
      notes: ["Prod is weak against Cinder Mite."],
    });
  });
});