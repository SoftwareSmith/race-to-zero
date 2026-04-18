import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FORK_BOMB_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Process Storm",
  detail:
    "Each direct detonation spawns child explosions from hit bugs, multiplying the cluster damage.",
  hint: "T2: Each detonation spawns child explosions from hit bugs",
  effectColor: "#38bdf8",
  evolveAtKills: 60,
  toggles: {
    secondaryRadius: 36,
  },
  vfx: FORK_BOMB_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns every confirmed hit into another local blast origin.",
  },
};