import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { VOID_PULSE_TIER_VFX } from "../vfx";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Collapse Cathedral",
  detail:
    "Overdrives the singularity into a larger sustained collapse with a brighter core, wider trap, and stronger lingering burn field.",
  hint: "T5: The void peaks as a full survival collapse event",
  effectColor: "#c084fc",
  toggles: {
    blackHoleRadius: 400,
    blackHoleCoreRadius: 104,
    blackHoleDurationMs: 2800,
    impactRadius: 430,
    reticleRadius: 140,
    shockwaveRadius: 120,
    secondaryRadius: 260,
    burnDps: 1.5,
    burnDurationMs: 3800,
    eventHorizonRadius: 280,
    eventHorizonDurationMs: 6500,
    chaosScale: 1.72,
  },
  vfx: VOID_PULSE_TIER_VFX.tierFour,
  behavior: {
    summary: "Turns the gravity well into a memorable overdrive collapse sequence.",
  },
};