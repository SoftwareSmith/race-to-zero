import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 3000;

export const FLAME_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Focused cone flame with a tight ember burst and ground fire patch.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Adds spreading ignition bursts around actively burning bugs.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Escalates every burn tick into explosive kernel-panic detonations.",
  },
};