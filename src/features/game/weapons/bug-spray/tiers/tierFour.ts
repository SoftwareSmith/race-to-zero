import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Corrosion Storm",
  detail:
    "Floods the lane with a sweeping toxic front that saturates bugs in stronger poison and broader rolling clouds.",
  hint: "T5: The whole lane becomes a corrosive survival hazard",
  effectColor: "#fde047",
  toggles: {
    hitRadius: 176,
    cooldownMs: 100,
    poisonDps: 0.44,
    poisonDurationMs: 1100,
    cloudRadius: 220,
    cloudDurationMs: 4200,
    cloudIntervalMs: 280,
    secondaryRadius: 96,
  },
  vfx: BUG_SPRAY_TIER_VFX.tierFour,
  behavior: {
    summary: "Escalates broad contamination into a true lane-denial overdrive.",
  },
};