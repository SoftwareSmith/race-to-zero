import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { TRACER_BLOOM_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Full Profiling",
  detail:
    "All bloom charges gain stronger bonus damage against any status-afflicted bug while the route overlay becomes fully exaggerated.",
  hint: "T3: +3 bonus to any status-afflicted bug; full coverage",
  effectColor: "#f87171",
  vfx: TRACER_BLOOM_TIER_VFX.tierTwo,
  behavior: {
    summary: "Broadens the status-damage synergy from select tags to any afflicted target.",
  },
};