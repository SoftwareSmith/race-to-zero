/**
 * Registry integrity test.
 *
 * Imports the barrel (which runs all self-registrations) and asserts that
 * every expected weapon ID has been registered exactly once.
 *
 * Note: ES module cache means registrations run once per test run. We do NOT
 * reset between tests here because we are only verifying static invariants.
 */

import { describe, it, expect } from "vitest";
import { registeredIds, getEntry, hasEntry } from "../runtime/registry";

// Import the barrel to trigger all self-registrations.
import "../index";

const EXPECTED_WEAPON_IDS = [
  "hammer",
  "zapper",     // bug-spray
  "freeze",
  "chain",
  "flame",
  "laser",
  "shockwave",  // static-net
  "nullpointer",
  "plasma",
  "void",
] as const;

describe("weapon plugin registry — integrity", () => {
  it("registers exactly 10 weapons", () => {
    expect(registeredIds().length).toBe(10);
  });

  it("registers no duplicate IDs", () => {
    const ids = registeredIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(EXPECTED_WEAPON_IDS)('weapon "%s" is registered', (id) => {
    expect(hasEntry(id as any)).toBe(true);
  });

  it.each(EXPECTED_WEAPON_IDS)(
    'weapon "%s" entry has a valid config with cooldownMs',
    (id) => {
      const entry = getEntry(id as any)!;
      expect(entry).toBeDefined();
      expect(entry.weaponId).toBe(id);
      expect(typeof entry.config.cooldownMs).toBe("number");
      expect(typeof entry.createSession).toBe("function");
    },
  );
});

