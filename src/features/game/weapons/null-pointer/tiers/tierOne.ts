import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const tierOneTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_TWO,
  title: "Mark & Sweep",
  detail:
    "Locks onto two bugs, marks both impact pockets, and throws a wider detonation envelope around each hit.",
  hint: "T2: Dual target locks, broader mark spread, and heavier impact bloom",
  effectColor: "#fb7185",
  evolveAtKills: 60,
  toggles: {
    targetCount: 2,
    executeHpLimit: 2,
    markRadius: 96,
    markDurationMs: 6000,
    splashRadius: 72,
    impactRadius: 140,
    reticleRadius: 18,
    shockwaveRadius: 196,
    beamWidth: 1.8,
    beamGlowWidth: 12,
    binaryBurstCount: 2,
    chaosScale: 1.18,
  },
  vfx: NULL_POINTER_TIER_VFX.tierOne,
  behavior: {
    summary: "Turns the shot into a dual-lock sweep with louder beams and broader hit punctuation.",
  },
};