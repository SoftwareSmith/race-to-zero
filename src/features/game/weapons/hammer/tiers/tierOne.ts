import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { HAMMER_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Refactor Tool",
  detail:
    "If the target is above 50% HP, it splits into two half-HP bugs instead of taking a standard hit.",
  hint: "T2: High-HP bugs split into two half-HP clones",
  effectColor: "#fbbf24",
  evolveAtKills: 60,
  config: {
    damage: 2,
  },
  vfx: HAMMER_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns chunky targets into manageable pieces instead of overkilling them.",
  },
};