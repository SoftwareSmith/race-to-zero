import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { HAMMER_TIER_VFX } from "../vfx";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Tribunal Loop",
  detail:
    "Overdrives the conversion slam into a decisive shock-ring execution that leaves the lane briefly under your command.",
  hint: "T5: Conversion slam peaks with a wider command burst and stronger ally routing",
  effectColor: "#fbbf24",
  toggles: {
    damage: 3,
    allyDurationMs: 9500,
    allyCap: 7,
    allyInterceptForce: 4.6,
    allyExpireBurstRadius: 96,
    allyExpireBurstDamage: 3,
  },
  vfx: HAMMER_TIER_VFX.tierFour,
  behavior: {
    summary: "Pushes the hammer into a lane-resetting overdrive state.",
  },
};