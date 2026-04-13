import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { TRACER_BLOOM_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Debug Trace",
  detail:
    "Paints a route from the core to the target and detonates pulse blooms along that line.",
  hint: "Click to lay a bloom route — 4 bursts detonate between core and target",
  effectColor: "#f87171",
  evolveAtKills: 20,
  hitPattern: HitPattern.Line,
  config: {
    hitRadius: 38,
  },
  vfx: TRACER_BLOOM_TIER_VFX.base,
  behavior: {
    summary: "Precision route weapon that clips multiple points without ricochet logic.",
  },
};