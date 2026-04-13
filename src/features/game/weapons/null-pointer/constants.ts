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
import type { WeaponDef } from "@game/weapons/types";

// ─── Identity ────────────────────────────────────────────────────────────────

export const ID = WeaponId.NullPointer;

// ─── Tier evolution ──────────────────────────────────────────────────────────

/** [kills to reach T2, kills to reach T3] */
export const EVOLVE_THRESHOLDS: [number, number] = [20, 60];

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

// ─── Static weapon definition ────────────────────────────────────────────────

export const def: WeaponDef = {
  id: ID,
  title: "Null Pointer",
  typeLabel: "Precision",
  typeHint: "Tracks the highest-value bug and converts setup into clean executions.",
  weaponType: "precision",
  unlockKills: 95,
  detail:
    "Homing missile that locks onto the highest-HP bug on screen. Curves to target over 0.6 s. Deals 3 dmg + 60px splash. Leaves a binary data burst (1s and 0s fly outward) and a tracer trail.",
  hitPattern: "seeking",
  hitRadius: SEEK_RADIUS,
  damage: DAMAGE,
  seekRadius: SEEK_RADIUS,
  splashRadius: SPLASH_RADIUS,
  effectColor: CURSOR.accent,
  cooldownMs: 3000,
  inputMode: "seeking",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click anywhere — missile curves to highest-HP bug, binary burst on impact",
  tierTitles: ["Garbage Collector", "Mark & Sweep", "Auto-Scaler"],
  tierDetails: [
    "Homing missile locks onto the highest-HP bug. Deals 3 dmg + 60px splash. Executes bugs below 33% HP.",
    "Mark & Sweep — applies Marked status to the target and nearby bugs. Increases execution threshold to 50% HP.",
    "Auto-Scaler — periodic global pulse instantly executes all Marked bugs below the HP threshold.",
  ],
  tierHints: [
    "Click anywhere — missile curves to highest-HP bug, binary burst on impact",
    "T2: Marks the target + nearby bugs; executes at 50% HP",
    "T3: Auto-Scaler pulse kills all Marked bugs below threshold globally",
  ],
};
