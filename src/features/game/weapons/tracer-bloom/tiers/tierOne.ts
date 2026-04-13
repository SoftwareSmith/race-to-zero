import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { TRACER_BLOOM_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Deep Trace",
  detail:
    "Each bloom gains bonus damage against Charged or Marked bugs caught in the blast.",
  hint: "T2: +2 bonus damage to Charged or Marked bugs",
  effectColor: "#f87171",
  evolveAtKills: 60,
  vfx: TRACER_BLOOM_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns prior setup effects into amplified bloom burst value.",
  },
};