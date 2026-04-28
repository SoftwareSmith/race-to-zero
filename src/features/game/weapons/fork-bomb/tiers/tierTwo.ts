import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FORK_BOMB_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Recursive Crash",
  detail:
    "Adds an expanding outer ring of detonations so the cascade keeps growing after the initial fork.",
  hint: "T3: Recursive cascade — expanding rings of AoE explosions",
  effectColor: "#38bdf8",
  evolveAtKills: 94,
  toggles: {
    clusterCount: 9,
    burstRadius: 42,
    burstOffsetDistance: 64,
    implosionRadius: 40,
    ringCount: 12,
    ringRadius: 90,
    impactRadius: 28,
    reticleRadius: 66,
    shockwaveRadius: 122,
    chaosScale: 1.34,
  },
  vfx: FORK_BOMB_TIER_VFX.tierTwo,
  behavior: {
    summary: "Scales the weapon from dense-pack breaker into full-pocket collapse.",
  },
};