import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Ghost Process",
  detail:
    "Marks the area around the hijacked bug so the rest of the loadout can cleanly focus the collapse point.",
  hint: "T2: conversions now paint a marked pocket around the target",
  effectColor: "#34d399",
  evolveAtKills: 78,
  toggles: {
    splashRadius: 112,
    allyDurationMs: 6600,
  },
  vfx: {
    intensity: "amplified",
    summary: "The leash leaves a brighter command wake around the converted target.",
  },
  behavior: {
    summary: "Adds setup value around every conversion instead of only the ally body itself.",
  },
};