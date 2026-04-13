import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { CHAIN_ZAP_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Event Loop",
  detail:
    "Doubles the bounce budget and applies Charged to every bug hit by the chain.",
  hint: "T2: 6 bounces + each hit applies Charged status",
  effectColor: "#6ee7b7",
  evolveAtKills: 75,
  config: {
    chainMaxBounces: 6,
  },
  vfx: CHAIN_ZAP_TIER_VFX.tierOne,
  behavior: {
    summary: "Builds persistent charged setups while increasing chain reach.",
  },
};