import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Hotfix",
  detail:
    "After the initial spray, secondary poison clouds erupt around each bug caught in the active cone.",
  hint: "T2: Secondary poison clouds erupt around each freshly poisoned bug",
  effectColor: "#fde047",
  evolveAtKills: 70,
  config: {
    poisonDps: 0.5,
  },
  vfx: BUG_SPRAY_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns every tagged target into a small local poison source.",
  },
};