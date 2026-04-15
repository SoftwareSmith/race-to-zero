import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { BUG_SPRAY_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Bug Spray",
  detail:
    "Aerosol cone sprays noxious mist and leaves a toxic cloud that re-poisons anything crossing the zone.",
  hint: "Hold to spray a cone — bugs are Poisoned; toxic cloud lingers 5 s",
  effectColor: "#fde047",
  evolveAtKills: 25,
  hitPattern: HitPattern.Cone,
  config: {
    hitRadius: 128,
    coneArcDeg: 80,
    poisonDps: 0.65,
    poisonDurationMs: 5000,
  },
  vfx: BUG_SPRAY_TIER_VFX.base,
  behavior: {
    summary: "Sustained area denial that rewards sweeping lanes and choke points.",
  },
};