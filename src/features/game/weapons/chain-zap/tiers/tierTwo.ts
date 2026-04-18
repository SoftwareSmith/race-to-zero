import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { CHAIN_ZAP_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Distributed System",
  detail:
    "After the chain lands, a network pulse hits every Charged bug on the board with cascading reduced damage.",
  hint: "T3: All Charged bugs on screen get hit in a network pulse",
  effectColor: "#6ee7b7",
  toggles: {
    damage: 2,
    secondaryDamage: 1,
  },
  vfx: CHAIN_ZAP_TIER_VFX.tierTwo,
  behavior: {
    summary: "Converts charged setup into global follow-through rather than local chaining only.",
  },
};