import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { PULSE_BEACON_TIERS } from "./helpers";

export const ID = WeaponId.PulseBeacon;

export const CURSOR = {
  accent: "#fbbf24",
  aura: "0 0 28px rgba(251,191,36,0.32)",
  size: 50,
  showCrosshair: true,
} as const;

export const BASE_TOGGLES = {
  cooldownMs: 1200,
  hitRadius: 120,
  impactRadius: 30,
  reticleRadius: 44,
  shockwaveRadius: 128,
  secondaryRadius: 144,
  secondaryDurationMs: 1800,
  markRadius: 120,
  markDurationMs: 3200,
  damage: 1,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: PULSE_BEACON_TIERS[0].title,
  typeLabel: "Control",
  typeHint: "Pins a lane with a click and turns clustered pushes into readable kill windows.",
  weaponType: "precision",
  unlockKills: 48,
  detail: PULSE_BEACON_TIERS[0].detail,
  hitPattern: HitPattern.Area,
  hitRadius: BASE_TOGGLES.hitRadius,
  cursor: CURSOR,
  overlayEffectDurationMs: 900,
  damage: BASE_TOGGLES.damage,
  effectColor: CURSOR.accent,
  cooldownMs: BASE_TOGGLES.cooldownMs,
  inputMode: WeaponInputMode.Click,
  hint: PULSE_BEACON_TIERS[0].hint,
  toggles: BASE_TOGGLES,
  tiers: PULSE_BEACON_TIERS,
};