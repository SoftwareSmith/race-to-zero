import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Rolling Deployment",
  detail:
    "Expands the poison footprint into a much larger rolling wave that blankets the lane in lingering damage.",
  hint: "T3: Expanding ring — poison spreads across the whole field",
  effectColor: "#fde047",
  toggles: {
    hitRadius: 144,
    cloudRadius: 144,
    cloudDurationMs: 3200,
  },
  vfx: BUG_SPRAY_TIER_VFX.tierTwo,
  behavior: {
    summary: "Scales the toxin plan from lane control into broad-screen contamination.",
  },
};