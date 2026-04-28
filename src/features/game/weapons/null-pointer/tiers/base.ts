import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Garbage Collector",
  detail:
    "Homing missile locks onto the highest-HP bug. Deals 3 dmg + 60px splash. Executes bugs below 33% HP.",
  hint: "Click anywhere — missile curves to highest-HP bug, binary burst on impact",
  effectColor: "#fb7185",
  evolveAtKills: 20,
  toggles: {
    damage: 3,
    targetCount: 1,
    seekRadius: 500,
    splashRadius: 60,
    splashDamage: 1,
    markRadius: 80,
    markDurationMs: 6000,
    impactRadius: 120,
    reticleRadius: 14,
    shockwaveRadius: 160,
    beamWidth: 1.5,
    beamGlowWidth: 8,
    binaryBurstCount: 1,
    chaosScale: 1,
    executeHpLimit: 1,
  },
  vfx: NULL_POINTER_TIER_VFX.base,
  behavior: {
    summary: "Single-target clean-up shot with a narrow lock beam and compact impact packet.",
  },
};