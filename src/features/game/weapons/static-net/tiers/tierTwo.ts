import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { STATIC_NET_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Deadlock Cluster",
  detail:
    "Replaces the outward knockback with a crushing pull that drags the entire trapped cluster into one point.",
  hint: "T3: Deadlock pulls all bugs to one point instead",
  effectColor: "#e2e8f0",
  vfx: STATIC_NET_TIER_VFX.tierTwo,
  behavior: {
    summary: "Turns control into forced clustering for follow-up area damage.",
  },
};