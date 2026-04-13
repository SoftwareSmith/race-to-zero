import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 2500;

export const VOID_PULSE_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Compact singularity with a clean collapse ring.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds burn-laced well pressure and a hotter accretion core.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Leaves an exaggerated event-horizon trap after collapse.",
  },
};