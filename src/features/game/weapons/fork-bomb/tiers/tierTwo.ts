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
  toggles: {
    ringRadius: 90,
  },
  vfx: FORK_BOMB_TIER_VFX.tierTwo,
  behavior: {
    summary: "Scales the weapon from dense-pack breaker into full-pocket collapse.",
  },
};