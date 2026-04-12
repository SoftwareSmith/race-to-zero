/**
 * Weapon module types — a single weapon owns its def, hit pattern, and VFX spec.
 */

import type { SiegeWeaponId } from "@game/types";
import type { WeaponTier } from "@game/types";

export type { SiegeWeaponId };

/** How hit-detection is resolved for a weapon. */
export type HitPattern =
  | "point"
  | "line"
  | "area"
  | "cone"
  | "chain"
  | "seeking"
  | "blackhole";

/** Per-weapon static definition. */
export interface WeaponDef {
  id: SiegeWeaponId;
  title: string;
  unlockKills: number;
  detail: string;
  hitPattern: HitPattern;
  hitRadius: number;
  damage?: number;
  hitOrientation?: "horizontal" | "vertical";
  snapAngle?: boolean;
  coneArcDeg?: number;
  chainMaxBounces?: number;
  seekRadius?: number;
  splashRadius?: number;
  instakillLowHp?: boolean;
  appliesSlow?: boolean;
  appliesKnockback?: boolean;
  applyPoison?: boolean;
  applyBurn?: boolean;
  burnDps?: number;
  burnDurationMs?: number;
  burnDecayPerSecond?: number;
  poisonDps?: number;
  poisonDurationMs?: number;
  applyEnsnare?: boolean;
  ensnareDurationMs?: number;
  /** Optional legacy path-based projectile mode. */
  bouncingDisc?: boolean;
  /** Optional legacy path-based projectile bounce count. */
  maxBounces?: number;
  /** Optional implosion radius for staged explosive weapons. */
  implosionRadius?: number;
  /** Optional implosion duration for staged explosive weapons. */
  implosionDurationMs?: number;
  /** Void pulse black-hole mode: persistent gravity well. */
  blackHoleMode?: boolean;
  blackHoleDurationMs?: number;
  blackHoleRadius?: number;
  blackHoleCoreRadius?: number;
  inputMode: "click" | "directional" | "seeking" | "hold";
  hint: string;
  effectColor: string;
  cooldownMs: number;
  /**
   * Display names for each tier: [T1, T2, T3].
   * T1 falls back to `title` if not provided.
   */
  tierTitles?: [string, string, string];
  /**
   * Kill thresholds to evolve: [kills needed for T2, kills needed for T3].
   * Referenced from WEAPON_EVOLVE_THRESHOLDS in gameDefaults when not overridden here.
   */
  evolveThresholds?: [number, number];
  /** Per-tier detail overrides: [T1, T2, T3]. Falls back to `detail` when absent. */
  tierDetails?: [string, string, string];
  /** Per-tier hint overrides: [T1, T2, T3]. Falls back to `hint` when absent. */
  tierHints?: [string, string, string];
  /** Optional per-tier effect colour overrides: [T1, T2, T3]. */
  tierEffectColors?: [string, string, string];
}
