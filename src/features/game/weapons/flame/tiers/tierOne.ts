import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FLAME_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Memory Leak",
  detail:
    "Every burning bug starts additional local fire spread, letting flames leap through nearby clusters.",
  hint: "T2: Flame spreads to bugs near each burn target",
  effectColor: "#f97316",
  evolveAtKills: 75,
  config: {
    burnDps: 6,
  },
  vfx: FLAME_TIER_VFX.tierOne,
  behavior: {
    summary: "Transforms direct ignition into contagious lane pressure.",
  },
};