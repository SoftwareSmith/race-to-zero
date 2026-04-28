import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Guiding Star",
  detail:
    "The pulse destabilizes the whole lock field, priming trapped bugs for explosive follow-up and precision finishers.",
  hint: "T5: the beacon now marks, pins, pulls, and destabilizes the trapped pack",
  effectColor: "#fbbf24",
  toggles: {
    cooldownMs: 950,
    damage: 2,
    markRadius: 148,
    markDurationMs: 3800,
    secondaryRadius: 168,
    secondaryDurationMs: 2600,
    shockwaveRadius: 168,
  },
  vfx: {
    intensity: "catastrophic",
    summary: "Layered amber rings and a hotter center read as a full control detonation.",
  },
  behavior: {
    summary: "Combines lockdown and unstable prep so the next weapon can delete the pack.",
  },
};