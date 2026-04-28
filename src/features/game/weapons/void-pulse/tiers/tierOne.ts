import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { VOID_PULSE_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Singularity",
  detail:
    "Strengthens the gravity well and adds a burn ring that softens bugs caught in the pull phase.",
  hint: "T2: Stronger pull + softer burn pressure during the well phase",
  effectColor: "#c084fc",
  evolveAtKills: 50,
  toggles: {
    blackHoleRadius: 320,
    impactRadius: 330,
    reticleRadius: 102,
    shockwaveRadius: 76,
    secondaryRadius: 180,
    burnDps: 1.15,
    burnDurationMs: 3000,
    burnDecayPerSecond: 0.72,
    chaosScale: 1.18,
  },
  vfx: VOID_PULSE_TIER_VFX.tierOne,
  behavior: {
    summary: "Layers controlled burn pressure onto the pull window without making the well self-sufficient.",
  },
};