import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 760;

export const FORK_BOMB_TIER_VFX: Record<"base" | "tierOne" | "tierTwo" | "tierThree" | "tierFour", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Central detonation with four satellite bursts.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds child-process explosions from each directly hit target.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Recursive outer-ring blast cascade with heavy screen coverage.",
  },
  tierThree: {
    intensity: "catastrophic",
    summary: "Nested ring telegraphs make the recursion bloom readable before the split pops land.",
  },
  tierFour: {
    intensity: "catastrophic",
    summary: "Burst-web overdrive fans a plasma lattice of recursive explosions across the target cluster.",
  },
};