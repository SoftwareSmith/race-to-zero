import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Contamination Engine",
  detail:
    "Deepens area denial with stronger poison, larger clouds, and more persistent residue islands.",
  hint: "T4: Poison fields hold space longer and punish regrouping harder",
  effectColor: "#fde047",
  evolveAtKills: 148,
  toggles: {
    hitRadius: 160,
    cooldownMs: 110,
    poisonDps: 0.36,
    poisonDurationMs: 900,
    cloudRadius: 176,
    cloudDurationMs: 3600,
    secondaryRadius: 72,
  },
  vfx: BUG_SPRAY_TIER_VFX.tierThree,
  behavior: {
    summary: "Turns spray coverage into a clearer contamination engine for dense swarms.",
  },
};