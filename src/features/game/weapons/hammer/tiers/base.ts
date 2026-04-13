import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { HAMMER_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Hammer",
  detail:
    "Heavy impact strike. Deals 2 damage and leaves a crack decal at the hit point.",
  hint: "Click directly on a bug to smash it",
  effectColor: "#fbbf24",
  evolveAtKills: 20,
  hitPattern: HitPattern.Single,
  config: {
    damage: 2,
    hitRadius: 48,
  },
  vfx: HAMMER_TIER_VFX.base,
  behavior: {
    summary: "Direct strike that rewards tight targeting and reliable cleanup.",
  },
};