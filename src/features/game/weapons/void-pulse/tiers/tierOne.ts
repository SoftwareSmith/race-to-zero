import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { VOID_PULSE_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Singularity",
  detail:
    "Strengthens the gravity well and adds a burn ring during the pull phase.",
  hint: "T2: Stronger pull + burn DOT during the well phase",
  effectColor: "#c084fc",
  evolveAtKills: 50,
  vfx: VOID_PULSE_TIER_VFX.tierOne,
  behavior: {
    summary: "Layers sustained damage onto the pull window without changing the single-hole constraint.",
  },
};