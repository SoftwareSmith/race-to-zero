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
  vfx: NULL_POINTER_TIER_VFX.base,
  behavior: {
    summary: "Single-target clean-up shot that marks only the primary bug.",
  },
};