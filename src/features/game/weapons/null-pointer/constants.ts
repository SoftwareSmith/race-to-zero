/**
 * Null Pointer — single source of truth.
 *
 * Everything specific to this weapon lives here:
 *   - weapon ID (typed constant, no string literals)
 *   - tier evolution thresholds
 *   - cursor appearance
 *   - static WeaponDef
 *   - behavior-level constants (damage, radii, durations)
 *
 * The behavior.ts file reads from here instead of scattering magic values.
 */

import { WeaponId } from "@game/types";
import {
  HitPattern,
  WeaponInputMode,
  type WeaponDef,
} from "@game/weapons/types";
import { NULL_POINTER_TIERS } from "./helpers";
import { OVERLAY_EFFECT_DURATION_MS } from "./vfx";

// ─── Identity ────────────────────────────────────────────────────────────────

export const ID = WeaponId.NullPointer;

// ─── Tier evolution ──────────────────────────────────────────────────────────

/** [kills to reach T2, kills to reach T3] */
// ─── Cursor ──────────────────────────────────────────────────────────────────

export const CURSOR = {
  accent: "#fb7185",
  aura: "0 0 26px rgba(251,113,133,0.3)",
  size: 54,
  /** Renders crosshair lines on the cursor reticle. */
  showCrosshair: true,
} as const;

// ─── Behavior constants ──────────────────────────────────────────────────────

export const DAMAGE = 3;
export const SPLASH_DAMAGE = 1;
export const SEEK_RADIUS = 500;
export const SPLASH_RADIUS = 60;
export const MARK_RADIUS = 80;
export const MARK_DURATION_MS = 6000;
/** HP threshold: bugs at or below this are executed by T1+ (≈ 1 HP). */
export const T1_EXECUTE_HP = 1;
/** HP threshold: bugs at or below this are executed by T2+ (≈ 2 HP). */
export const T2_EXECUTE_HP = 2;

export const BASE_TOGGLES = {
  damage: DAMAGE,
  hitRadius: SEEK_RADIUS,
  cooldownMs: 3200,
  seekRadius: SEEK_RADIUS,
  splashRadius: SPLASH_RADIUS,
  splashDamage: SPLASH_DAMAGE,
  markRadius: MARK_RADIUS,
  markDurationMs: MARK_DURATION_MS,
  executeHpLimit: T1_EXECUTE_HP,
} as const;

// ─── Static weapon definition ────────────────────────────────────────────────

export const def: WeaponDef = {
  id: ID,
  title: NULL_POINTER_TIERS[0].title,
  typeLabel: "Precision",
  typeHint: "Tracks the highest-value bug and converts setup into clean executions.",
  weaponType: "precision",
  unlockKills: 18,
  detail: NULL_POINTER_TIERS[0].detail,
  hitPattern: HitPattern.Seeking,
  hitRadius: SEEK_RADIUS,
  cursor: CURSOR,
  overlayEffectDurationMs: OVERLAY_EFFECT_DURATION_MS,
  damage: BASE_TOGGLES.damage,
  seekRadius: BASE_TOGGLES.seekRadius,
  splashRadius: BASE_TOGGLES.splashRadius,
  effectColor: CURSOR.accent,
  cooldownMs: BASE_TOGGLES.cooldownMs,
  inputMode: WeaponInputMode.Seeking,
  tiers: NULL_POINTER_TIERS,
  hint: NULL_POINTER_TIERS[0].hint,
  toggles: BASE_TOGGLES,
};
