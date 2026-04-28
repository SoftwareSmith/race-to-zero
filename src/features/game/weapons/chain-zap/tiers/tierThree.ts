import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { CHAIN_ZAP_TIER_VFX } from "../vfx";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Conductor Grid",
  detail:
    "Pushes the chain into a denser network with more bounces, a wider chain radius, and stronger follow-up damage.",
  hint: "T4: More targets stay trapped inside a readable electric mesh",
  effectColor: "#6ee7b7",
  evolveAtKills: 138,
  toggles: {
    cooldownMs: 900,
    chainRadius: 110,
    chainMaxBounces: 5,
    beamWidth: 3,
    beamGlowWidth: 9,
    chaosScale: 1.25,
    secondaryDamage: 2,
  },
  vfx: CHAIN_ZAP_TIER_VFX.tierThree,
  behavior: {
    summary: "Builds a broader, more reliable electric capture network.",
  },
};