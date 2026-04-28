import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { HAMMER_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Rewrite Engine",
  detail:
    "Converts the hit bug into a short-lived ally that intercepts nearby threats before reverting.",
  hint: "T3: Convert the hit bug into a temporary interceptor ally",
  effectColor: "#fbbf24",
  evolveAtKills: 88,
  toggles: {
    damage: 2,
    allyDurationMs: 7200,
    allyCap: 5,
    allyInterceptForce: 3.4,
    allyExpireBurstRadius: 68,
    allyExpireBurstDamage: 2,
  },
  vfx: HAMMER_TIER_VFX.tierTwo,
  behavior: {
    summary: "Swaps brute-force cleanup for short tactical breathing room.",
  },
};