import { WeaponTier } from "@game/types";
import { type WeaponTierDefinition } from "@game/weapons/types";
import { VOID_PULSE_TIER_VFX } from "../vfx";

export const tierThreeTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_FOUR,
  title: "Horizon Engine",
  detail:
    "Increases drag pressure, burn reach, and event-horizon size so the singularity controls more of the lane.",
  hint: "T4: The void well exerts broader pull and a larger kill perimeter",
  effectColor: "#c084fc",
  evolveAtKills: 128,
  toggles: {
    blackHoleRadius: 360,
    blackHoleCoreRadius: 90,
    blackHoleDurationMs: 2500,
    impactRadius: 390,
    reticleRadius: 126,
    shockwaveRadius: 100,
    secondaryRadius: 230,
    burnDps: 1.3,
    burnDurationMs: 3400,
    eventHorizonRadius: 240,
    eventHorizonDurationMs: 5600,
    chaosScale: 1.54,
  },
  vfx: VOID_PULSE_TIER_VFX.tierThree,
  behavior: {
    summary: "Expands the collapse from a trap into a broader lane-control engine.",
  },
};