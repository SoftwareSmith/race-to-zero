import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { FLAME_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Stack Overflow",
  detail:
    "Sprays napalm in a wide cone and leaves burning ground at the tip of the stream.",
  hint: "Hold to spray — move to paint a trail; ground patch burns trespassers",
  effectColor: "#f97316",
  evolveAtKills: 25,
  hitPattern: HitPattern.Cone,
  config: {
    hitRadius: 150,
    coneArcDeg: 70,
    burnDps: 6,
  },
  vfx: FLAME_TIER_VFX.base,
  behavior: {
    summary: "Lane-denial fire tool with continuous burn application and paint-trail fill.",
  },
};