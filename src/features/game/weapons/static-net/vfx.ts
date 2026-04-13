import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 1200;

export const STATIC_NET_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Expanding wire mesh and bright EMP scatter ring.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds aggressive displacement energy as trapped bugs are pushed apart.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Deadlock pull visual that collapses the full cluster inward.",
  },
};