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
    clusterCount: 7,
    burstRadius: 38,
    burstOffsetDistance: 58,
    implosionRadius: 34,
    secondaryRadius: 36,
    impactRadius: 24,
    reticleRadius: 58,
    shockwaveRadius: 106,
    chaosScale: 1.16,
  },
  vfx: FORK_BOMB_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns every confirmed hit into another local blast origin.",
  },
};