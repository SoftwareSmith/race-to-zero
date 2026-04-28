import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Supervisor",
  detail:
    "The takeover lands with a sharp impact hit so the hijacked bug starts paying back immediately.",
  hint: "T3: each leash also lands a direct impact on the converted target",
  effectColor: "#34d399",
  evolveAtKills: 112,
  toggles: {
    damage: 3,
    cooldownMs: 2350,
    allyInterceptForce: 2.5,
  },
  vfx: {
    intensity: "amplified",
    summary: "Adds a hotter impact flash before the ally peel begins.",
  },
  behavior: {
    summary: "Turns conversion into immediate tempo instead of delayed value only.",
  },
};