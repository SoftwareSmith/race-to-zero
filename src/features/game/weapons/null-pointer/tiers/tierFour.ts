import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const tierFourTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FIVE,
  title: "Deletion Line",
  detail:
    "Overdrives the beam into a five-lock cutline that collapses marked targets in a single surgical sweep.",
  hint: "T5: Precision peaks as a lane-cutting deletion seam",
  effectColor: "#fb7185",
  toggles: {
    cooldownMs: 2200,
    targetCount: 5,
    executeHpLimit: 3,
    markRadius: 156,
    splashRadius: 110,
    impactRadius: 220,
    reticleRadius: 30,
    shockwaveRadius: 280,
    beamWidth: 2.8,
    beamGlowWidth: 20,
    binaryBurstCount: 5,
    chaosScale: 1.72,
  },
  vfx: NULL_POINTER_TIER_VFX.tierFour,
  behavior: {
    summary: "Turns execution into a memorable survival overdrive cutline.",
  },
};