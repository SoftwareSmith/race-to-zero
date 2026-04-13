import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 1200;

export const CHAIN_ZAP_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Short neon chain arcs with spark crowns at each hop.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Longer bounce chains with stronger charged-hit highlights.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Board-wide network pulse that lights every charged bug simultaneously.",
  },
};