import { WeaponTier } from "@game/types";
import type { WeaponTierDefinition } from "@game/weapons/types";
import { NULL_POINTER_TIER_VFX } from "../vfx";

export const tierTwoTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_THREE,
  title: "Auto-Scaler",
  detail:
    "Adds a periodic global pulse while firing three independent target locks with oversized reticles and stacked impact bursts.",
  hint: "T3: Triple-lock chaos beam plus the global Auto-Scaler cleanup pulse",
  effectColor: "#fb7185",
  evolveAtKills: 82,
  toggles: {
    cooldownMs: 2800,
    targetCount: 3,
    executeHpLimit: 2,
    markRadius: 112,
    splashRadius: 84,
    impactRadius: 164,
    reticleRadius: 22,
    shockwaveRadius: 228,
    beamWidth: 2.2,
    beamGlowWidth: 15,
    binaryBurstCount: 3,
    chaosScale: 1.38,
  },
  vfx: NULL_POINTER_TIER_VFX.tierTwo,
  behavior: {
    summary: "Converts precise lock-on into a catastrophic multi-target execution package.",
  },
};