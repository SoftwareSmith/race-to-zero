import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Command Mesh",
  detail:
    "Adds a damage pulse on impact so the beacon starts converting control into real attrition.",
  hint: "T4: bugs inside the field take a direct pulse when it lands",
  effectColor: "#fbbf24",
  evolveAtKills: 146,
  toggles: {
    cooldownMs: 1050,
    damage: 2,
    markRadius: 136,
    shockwaveRadius: 156,
  },
  vfx: {
    intensity: "catastrophic",
    summary: "The lattice flashes brighter and the impact ring lands with more force.",
  },
  behavior: {
    summary: "Makes the control tool contribute direct clean-up pressure.",
  },
};