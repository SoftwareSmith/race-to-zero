import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Mark & Sweep",
  detail:
    "Marks the target and nearby bugs before detonation. Execution threshold rises to 50% HP for marked bugs.",
  hint: "T2: Marks the target + nearby bugs; executes at 50% HP",
  effectColor: "#fb7185",
  evolveAtKills: 60,
  toggles: {
    executeHpLimit: 2,
    markRadius: 80,
    markDurationMs: 6000,
  },
  vfx: NULL_POINTER_TIER_VFX.tierOne,
  behavior: {
    summary: "Extends mark application to the nearby cluster and broadens execute setups.",
  },
};