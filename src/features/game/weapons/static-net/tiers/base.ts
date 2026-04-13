import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { STATIC_NET_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Thread Lock",
  detail:
    "Expands a wire-mesh net that ensnares everything inside and sets up instant-kill follow-up clicks.",
  hint: "Click to cast a net — ensnared bugs are frozen; click them to instakill",
  effectColor: "#e2e8f0",
  evolveAtKills: 15,
  hitPattern: HitPattern.Area,
  config: {
    hitRadius: 200,
    ensnareDurationMs: 3000,
  },
  vfx: STATIC_NET_TIER_VFX.base,
  behavior: {
    summary: "Pure lockdown zone for follow-up precision and structure support.",
  },
};