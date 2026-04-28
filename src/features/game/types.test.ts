import { describe, expect, it } from "vitest";

import { SIEGE_GAME_MODE_META, WeaponTier } from "./types";

describe("siege game mode metadata", () => {
  it("presents the two player-facing game modes", () => {
    expect(SIEGE_GAME_MODE_META.purge).toMatchObject({
      label: "Time Attack",
      maxWeaponTier: WeaponTier.TIER_THREE,
      objective: "Clear every bug as quickly as possible.",
      scoringLabel: "Fastest clear",
      shortLabel: "Time Attack",
    });
    expect(SIEGE_GAME_MODE_META.outbreak).toMatchObject({
      label: "Survival",
      maxWeaponTier: WeaponTier.TIER_FIVE,
      objective: "Last as many waves as possible before the site goes offline.",
      scoringLabel: "Best wave survived",
      shortLabel: "Survival",
    });
  });
});
