import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { STATIC_NET_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Mutex",
  detail:
    "Adds knockback so ensnared bugs are pushed apart instead of staying packed together.",
  hint: "T2: Ensnared bugs get knockback — scattered apart",
  effectColor: "#e2e8f0",
  evolveAtKills: 50,
  vfx: STATIC_NET_TIER_VFX.tierOne,
  behavior: {
    summary: "Breaks dense clusters after capture to create safer cleanup spacing.",
  },
};