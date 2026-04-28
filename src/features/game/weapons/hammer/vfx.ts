import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 520;

export const HAMMER_TIER_VFX: Record<"base" | "tierOne" | "tierTwo" | "tierThree" | "tierFour", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Compact crack decal and tight impact flash.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Heavier split-hit impact with a wider fracture burst.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Full rewrite slam with a dominant gold shock pulse and ally-conversion flare.",
  },
  tierThree: {
    intensity: "catastrophic",
    summary: "Layered command rings with stagger pulses that briefly organize the impact zone.",
  },
  tierFour: {
    intensity: "catastrophic",
    summary: "Overdrive tribunal blast with a decisive shock wall and ally-tagged afterimage arcs.",
  },
};