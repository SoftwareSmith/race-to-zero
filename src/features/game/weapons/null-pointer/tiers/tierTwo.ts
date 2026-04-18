import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Auto-Scaler",
  detail:
    "Adds a periodic global pulse that instantly executes marked bugs below the HP threshold while preserving the homing impact burst.",
  hint: "T3: Auto-Scaler pulse kills all Marked bugs below threshold globally",
  effectColor: "#fb7185",
  toggles: {
    executeHpLimit: 2,
  },
  vfx: NULL_POINTER_TIER_VFX.tierTwo,
  behavior: {
    summary: "Converts the mark setup into a global finishing pulse for marked weak targets.",
  },
};