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
  toggles: {
    eventHorizonRadius: 200,
    eventHorizonDurationMs: 5000,
  },
  vfx: VOID_PULSE_TIER_VFX.tierTwo,
  behavior: {
    summary: "Extends the collapse payoff into a persistent kill zone.",
  },
};