import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FLAME_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Kernel Panic",
  detail:
    "Burning bugs detonate on their next burn tick, turning the fire line into chained splash bursts.",
  hint: "T3: Burning bugs detonate — chain their position toward other bugs",
  effectColor: "#f97316",
  vfx: FLAME_TIER_VFX.tierTwo,
  behavior: {
    summary: "Upgrades ongoing burns into explosive follow-through instead of only sustained DPS.",
  },
};