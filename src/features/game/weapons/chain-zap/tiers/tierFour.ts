import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { CHAIN_ZAP_TIER_VFX } from "../vfx";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Lattice Storm",
  detail:
    "Overdrives the network into a larger strike cage with faster pacing and denser synchronized arcs.",
  hint: "T5: Chain lightning peaks as a multi-strike survival cage",
  effectColor: "#6ee7b7",
  toggles: {
    cooldownMs: 850,
    chainRadius: 130,
    chainMaxBounces: 7,
    beamWidth: 3.4,
    beamGlowWidth: 11,
    chaosScale: 1.45,
    secondaryDamage: 2,
  },
  vfx: CHAIN_ZAP_TIER_VFX.tierFour,
  behavior: {
    summary: "Converts charge control into a full overdrive lattice storm.",
  },
};