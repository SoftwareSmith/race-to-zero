import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Bug Spray",
  detail:
    "Aerosol cone sprays noxious mist and leaves a toxic cloud that softens swarms instead of deleting them outright.",
  hint: "Hold to spray a cone — poison sets up follow-up hits while the cloud locks down space",
  effectColor: "#fde047",
  evolveAtKills: 25,
  hitPattern: HitPattern.Cone,
  toggles: {
    hitRadius: 128,
    coneArcDeg: 80,
    poisonDps: 0.28,
    poisonDurationMs: 650,
    cloudRadius: 96,
    cloudDurationMs: 2400,
    cloudIntervalMs: 400,
  },
  vfx: BUG_SPRAY_TIER_VFX.base,
  behavior: {
    summary: "Sustained area denial that softens lanes for your next committed hit.",
  },
};