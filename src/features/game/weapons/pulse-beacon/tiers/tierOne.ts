import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Lane Latch",
  detail:
    "Adds a binding pulse that ensnares everything caught inside the marked field.",
  hint: "T2: the pulse also pins bugs in place for follow-up weapons",
  effectColor: "#fbbf24",
  evolveAtKills: 72,
  toggles: {
    secondaryRadius: 148,
    secondaryDurationMs: 2200,
    markRadius: 128,
  },
  vfx: {
    intensity: "amplified",
    summary: "The beacon ring lingers longer and reads like a hard lockdown zone.",
  },
  behavior: {
    summary: "Turns a soft mark into immediate lane control.",
  },
};