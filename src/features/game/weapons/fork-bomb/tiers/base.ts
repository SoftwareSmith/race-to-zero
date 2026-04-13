import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { FORK_BOMB_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Fork Bomb",
  detail:
    "Duplicates the payload into one central blast plus satellite bursts to shred dense bug clusters.",
  hint: "Click into a dense pocket — blast forks into 5 detonations",
  effectColor: "#38bdf8",
  evolveAtKills: 20,
  hitPattern: HitPattern.Area,
  config: {
    hitRadius: 48,
    damage: 2,
  },
  vfx: FORK_BOMB_TIER_VFX.base,
  behavior: {
    summary: "Cluster breaker built around overlapping local explosions.",
  },
};