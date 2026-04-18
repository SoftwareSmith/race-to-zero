import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { HAMMER_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Rewrite Engine",
  detail:
    "Converts the hit bug into an ally for 8 seconds, removing it from the active threat stream.",
  hint: "T3: Convert the hit bug to an ally for 8 seconds",
  effectColor: "#fbbf24",
  toggles: {
    damage: 2,
    allyDurationMs: 8000,
  },
  vfx: HAMMER_TIER_VFX.tierTwo,
  behavior: {
    summary: "Swaps brute-force cleanup for targeted battlefield conversion.",
  },
};