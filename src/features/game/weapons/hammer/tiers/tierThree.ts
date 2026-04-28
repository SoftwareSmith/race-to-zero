import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { HAMMER_TIER_VFX } from "../vfx";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Shock Captain",
  detail:
    "Amplifies ally control with a stronger intercept force, longer conversions, and a wider expiry burst.",
  hint: "T4: Converted allies hold lanes longer and hit harder on expiry",
  effectColor: "#fbbf24",
  evolveAtKills: 132,
  toggles: {
    damage: 3,
    allyDurationMs: 8200,
    allyCap: 6,
    allyInterceptForce: 4,
    allyExpireBurstRadius: 80,
    allyExpireBurstDamage: 2,
  },
  vfx: HAMMER_TIER_VFX.tierThree,
  behavior: {
    summary: "Turns temporary allies into a stronger local command net.",
  },
};