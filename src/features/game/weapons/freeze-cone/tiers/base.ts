import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { FREEZE_CONE_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Deadlock",
  detail:
    "Radial ice burst slows every bug in range and locks down fast pathing without direct damage.",
  hint: "Click to freeze — radial blast slows all nearby bugs; snowflakes linger",
  effectColor: "#bfdbfe",
  evolveAtKills: 20,
  hitPattern: HitPattern.Area,
  config: {
    hitRadius: 180,
    appliesSlow: true,
  },
  vfx: FREEZE_CONE_TIER_VFX.base,
  behavior: {
    summary: "Reliable space-control burst built around slowing a full local cluster.",
  },
};