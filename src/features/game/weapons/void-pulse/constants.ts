/**
 * Void Pulse — single source of truth.
 */

import { WeaponId } from "@game/types";
import { HitPattern, WeaponInputMode, type WeaponDef } from "@game/weapons/types";
import { VOID_PULSE_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

export const ID = WeaponId.VoidPulse;

export const CURSOR = {
  accent: "#c084fc",
  aura: "0 0 30px rgba(192,132,252,0.4)",
  size: 56,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: VOID_PULSE_TIERS[0].title,
  typeLabel: "Gravity",
  typeHint: "Pulls elite bugs into collapse zones and rewards timing over spam.",
  weaponType: "gravity",
  unlockKills: 132,
  detail: VOID_PULSE_TIERS[0].detail,
  hitPattern: HitPattern.BlackHole,
  hitRadius: 300,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: 2,
  blackHoleMode: true,
  blackHoleDurationMs: 2000,
  blackHoleRadius: 300,
  blackHoleCoreRadius: 80,
  instakillLowHp: false,
  appliesKnockback: true,
  effectColor: CURSOR.accent,
  cooldownMs: 6000,
  inputMode: WeaponInputMode.Click,
  hint: VOID_PULSE_TIERS[0].hint,
  tiers: VOID_PULSE_TIERS,
};
