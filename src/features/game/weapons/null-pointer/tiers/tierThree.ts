import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Vector Execution",
  detail:
    "Adds a fourth target lock, tighter execution pacing, and stronger mark splash for priority deletion.",
  hint: "T4: Multi-lock execution gets faster and wider without losing precision",
  effectColor: "#fb7185",
  evolveAtKills: 122,
  toggles: {
    cooldownMs: 2400,
    targetCount: 4,
    executeHpLimit: 2,
    markRadius: 136,
    splashRadius: 96,
    impactRadius: 180,
    reticleRadius: 26,
    shockwaveRadius: 250,
    beamWidth: 2.5,
    beamGlowWidth: 18,
    binaryBurstCount: 4,
    chaosScale: 1.55,
  },
  vfx: NULL_POINTER_TIER_VFX.tierThree,
  behavior: {
    summary: "Extends the precision beam into a faster vectorized execution chain.",
  },
};