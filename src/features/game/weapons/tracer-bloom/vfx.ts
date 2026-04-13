import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 560;

export const TRACER_BLOOM_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Four linked pulse blooms along a plotted route.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds a stronger readout glow around status-tagged bloom hits.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Full-route profiling overlay with maximal pulse readout coverage.",
  },
};