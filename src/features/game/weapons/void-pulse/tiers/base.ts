import { WeaponTier } from "@game/types";
import { HitPattern, type WeaponTierDefinition } from "@game/weapons/types";
import { VOID_PULSE_TIER_VFX } from "../vfx";

export const baseTier: WeaponTierDefinition = {
  tier: WeaponTier.TIER_ONE,
  title: "Void Pulse",
  detail:
    "Creates a compact black hole that pulls nearby bugs inward and collapses in a damaging ring.",
  hint: "Click to spawn a black hole — gravity pull 2 s then 300px collapse ring",
  effectColor: "#c084fc",
  evolveAtKills: 15,
  hitPattern: HitPattern.BlackHole,
  toggles: {
    hitRadius: 300,
    blackHoleDurationMs: 2000,
    blackHoleRadius: 300,
    blackHoleCoreRadius: 80,
  },
  vfx: VOID_PULSE_TIER_VFX.base,
  behavior: {
    summary: "High-commit gravity tool built around pull timing and collapse placement.",
  },
};