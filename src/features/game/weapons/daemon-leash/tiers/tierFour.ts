import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Host Takeover",
  detail:
    "Each leash now detonates the seized bug's local cluster with a kernel panic burst before the ally body starts working.",
  hint: "T5: the hijack opens with an immediate cluster rupture and stronger ally payoff",
  effectColor: "#34d399",
  toggles: {
    cooldownMs: 2100,
    damage: 4,
    splashRadius: 136,
    allyDurationMs: 7200,
    allyInterceptForce: 2.8,
    allyExpireBurstRadius: 88,
    allyExpireBurstDamage: 2,
  },
  vfx: {
    intensity: "catastrophic",
    summary: "Conversion, rupture, and ally wake all happen in a single readable emerald burst.",
  },
  behavior: {
    summary: "Makes the leash a full priority-delete setup rather than a niche control option.",
  },
};