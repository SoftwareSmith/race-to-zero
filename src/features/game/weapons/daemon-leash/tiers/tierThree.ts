import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Shadow Queue",
  detail:
    "Hijacked bugs now destabilize the pocket around them, turning every leash into a volatile setup anchor.",
  hint: "T4: the target zone becomes unstable and punishes dense follow-up",
  effectColor: "#34d399",
  evolveAtKills: 154,
  toggles: {
    splashRadius: 124,
    allyCap: 5,
    allyExpireBurstRadius: 78,
    allyExpireBurstDamage: 2,
  },
  vfx: {
    intensity: "catastrophic",
    summary: "The control ring thickens and the aftermath reads as a dangerous volatile field.",
  },
  behavior: {
    summary: "Lets one conversion set up explosive follow-through across the lane.",
  },
};