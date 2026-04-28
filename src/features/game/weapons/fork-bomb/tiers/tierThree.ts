import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FORK_BOMB_TIER_VFX } from "../vfx";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Recursion Bloom",
  detail:
    "Adds more child bursts, larger rings, and stronger secondary implosions while keeping the recursion readable.",
  hint: "T4: Fork patterns bloom wider before collapsing back inward",
  effectColor: "#38bdf8",
  evolveAtKills: 142,
  toggles: {
    damage: 3,
    clusterCount: 6,
    burstRadius: 40,
    burstOffsetDistance: 56,
    implosionRadius: 36,
    secondaryRadius: 46,
    ringCount: 10,
    ringRadius: 110,
    impactRadius: 26,
    reticleRadius: 60,
    shockwaveRadius: 110,
    chaosScale: 1.25,
  },
  vfx: FORK_BOMB_TIER_VFX.tierThree,
  behavior: {
    summary: "Pushes plasma recursion outward in a more deliberate staged pattern.",
  },
};