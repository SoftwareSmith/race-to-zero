import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Hotfix",
  detail:
    "After the initial spray, secondary poison clouds erupt around each bug caught in the active cone so the swarm stays softened.",
  hint: "T2: Tagged bugs seed small follow-up clouds instead of turning poison into an instant wipe",
  effectColor: "#fde047",
  evolveAtKills: 70,
  toggles: {
    poisonDps: 0.34,
    secondaryRadius: 56,
    secondaryDurationMs: 900,
  },
  vfx: BUG_SPRAY_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns every tagged target into a local setup point for follow-up damage.",
  },
};