import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { FORK_BOMB_TIER_VFX } from "../vfx";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Burst Web",
  detail:
    "Overdrives the recursion into a larger plasma web of branching explosions and collapsing outer-ring nodes.",
  hint: "T5: Recursive burst patterns fan into a wider survival kill web",
  effectColor: "#38bdf8",
  toggles: {
    damage: 3,
    clusterCount: 7,
    burstRadius: 46,
    burstOffsetDistance: 62,
    implosionRadius: 44,
    secondaryRadius: 56,
    ringCount: 12,
    ringRadius: 134,
    impactRadius: 32,
    reticleRadius: 68,
    shockwaveRadius: 132,
    chaosScale: 1.45,
  },
  vfx: FORK_BOMB_TIER_VFX.tierFour,
  behavior: {
    summary: "Turns recursive plasma into a full survival overdrive web.",
  },
};