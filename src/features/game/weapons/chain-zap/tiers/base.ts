import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { CHAIN_ZAP_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Chain Zap",
  detail:
    "Starts a short lightning chain that prioritises unfrozen bugs and rewards tight cluster targeting.",
  hint: "Click near a bug — arc bounces 3x, targets unfrozen bugs first",
  effectColor: "#6ee7b7",
  evolveAtKills: 25,
  hitPattern: HitPattern.Chain,
  config: {
    damage: 2,
    chainMaxBounces: 3,
  },
  vfx: CHAIN_ZAP_TIER_VFX.base,
  behavior: {
    summary: "Standard bounce chain with freeze synergy and local crackle pressure.",
  },
};