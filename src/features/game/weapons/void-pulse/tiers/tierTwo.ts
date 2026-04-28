import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { VOID_PULSE_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Event Horizon",
  detail:
    "After collapse, leaves behind a trap zone that instantly destroys unstable bugs entering it.",
  hint: "T3: Leaves an Event Horizon trap that destroys Unstable bugs on contact",
  effectColor: "#c084fc",
  evolveAtKills: 84,
  toggles: {
    blackHoleRadius: 340,
    blackHoleDurationMs: 2300,
    impactRadius: 360,
    reticleRadius: 118,
    shockwaveRadius: 90,
    secondaryRadius: 210,
    eventHorizonRadius: 200,
    eventHorizonDurationMs: 5000,
    chaosScale: 1.38,
  },
  vfx: VOID_PULSE_TIER_VFX.tierTwo,
  behavior: {
    summary: "Extends the collapse payoff into a persistent kill zone.",
  },
};