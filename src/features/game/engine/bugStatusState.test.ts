import { describe, expect, it } from "vitest";

import { collectActiveSupportStatuses, isStatusActive } from "./bugStatusState";

describe("bug status state helpers", () => {
  it("detects whether an expiring status is active", () => {
    expect(isStatusActive(null, 100)).toBe(false);
    expect(isStatusActive({ expiresAt: 50 }, 100)).toBe(false);
    expect(isStatusActive({ expiresAt: 150 }, 100)).toBe(true);
  });

  it("returns active support statuses in priority order and excludes the finisher", () => {
    const statuses = collectActiveSupportStatuses(
      {
        ally: { expiresAt: 200 },
        burn: { accumulatedDmg: 0, dps: 1, expiresAt: 200 },
        charged: { expiresAt: 200 },
        ensnare: null,
        looped: null,
        marked: { expiresAt: 200 },
        poison: { accumulatedDmg: 0, dps: 1, expiresAt: 200 },
        slow: { expiresAt: 200 },
        unstable: null,
      },
      100,
      "burn",
    );

    expect(statuses).toEqual(["ally", "charged", "freeze", "poison", "marked"]);
  });
});