import { describe, it, expect } from "vitest";
import { registeredIds, getEntry, hasEntry } from "../runtime/registry";
import { WEAPON_REGISTRY } from "../index";

describe("weapon plugin registry — integrity", () => {
  it("registers one plugin for every authored weapon", () => {
    expect(registeredIds().length).toBe(WEAPON_REGISTRY.length);
  });

  it("registers no duplicate IDs", () => {
    const ids = registeredIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(WEAPON_REGISTRY)(
    'registers a usable plugin for "%s"',
    (weaponDef) => {
      expect(hasEntry(weaponDef.id)).toBe(true);

      const entry = getEntry(weaponDef.id);
      expect(entry).toBeDefined();
      if (!entry) {
        throw new Error(`Missing registry entry for ${weaponDef.id}`);
      }

      expect(entry?.weaponId).toBe(weaponDef.id);
      expect(typeof entry.config.cooldownMs).toBe("number");
      expect(typeof entry.createSession).toBe("function");
      expect(entry.config.cooldownMs).toBeGreaterThan(0);
    },
  );
});

