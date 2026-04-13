import type { WeaponTierVfxDefinition } from "@game/weapons/types";

export const OVERLAY_EFFECT_DURATION_MS = 700;

export const FREEZE_CONE_TIER_VFX: Record<"base" | "tierOne" | "tierTwo", WeaponTierVfxDefinition> = {
  base: {
    intensity: "basic",
    summary: "Focused ice ring with a dense snowflake scatter.",
  },
  tierOne: {
    intensity: "amplified",
    summary: "Sharper fracture bloom and heavier lock-down visuals around ensnared targets.",
  },
  tierTwo: {
    intensity: "catastrophic",
    summary: "Field-wide flash-freeze burst with exaggerated radial coverage.",
  },
};