/**
 * Structure plugin registry integrity test.
 * Imports the barrel to trigger all self-registrations, then verifies
 * all registered structures are available with valid configs.
 */

import { describe, it, expect } from "vitest";
import { registeredIds, getEntry, hasEntry } from "../runtime/registry";

// Import the barrel to trigger all self-registrations.
import "../index";

const EXPECTED_STRUCTURE_IDS = [
  "lantern",
  "agent",
] as const;

describe("structure plugin registry — integrity", () => {
  it("registers exactly 2 structures", () => {
    expect(registeredIds().length).toBe(2);
  });

  it("registers no duplicate IDs", () => {
    const ids = registeredIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(EXPECTED_STRUCTURE_IDS)('structure "%s" is registered', (id) => {
    expect(hasEntry(id as any)).toBe(true);
  });

  it.each(EXPECTED_STRUCTURE_IDS)(
    'structure "%s" entry has a valid config and tick function',
    (id) => {
      const entry = getEntry(id as any)!;
      expect(entry).toBeDefined();
      expect(entry.structureId).toBe(id);
      expect(typeof entry.config.maxPlaced).toBe("number");
      expect(typeof entry.tick).toBe("function");
    },
  );
});
