import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 1400;

export const BUG_SPRAY_TIER_VFX: Record<"base" | "tierOne" | "tierTwo" | "tierThree" | "tierFour", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Tight mist cone with a small persistent toxic cloud.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds clustered secondary poison blooms around freshly tagged bugs.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Expands the spray footprint into a field-wide rolling poison wave.",
  },
  tierThree: {
    intensity: "catastrophic",
    summary: "Spore-laced contamination bands create more readable lane denial islands.",
  },
  tierFour: {
    intensity: "catastrophic",
    summary: "Corrosion storm saturates the lane with suspended droplets and collapsing toxic filaments.",
  },
};