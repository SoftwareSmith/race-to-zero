/**
 * Weapon module types — a single weapon owns its def, hit pattern, and VFX spec.
 */

import type { SiegeWeaponId } from "@game/types";

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
  /** Laser disc: bounce off walls instead of full-screen beam. */
  bouncingDisc?: boolean;
  /** Laser disc: max wall bounces before the disc disappears. */
  maxBounces?: number;
  /** Plasma bomb: radius for inward gravity pull phase before explosion. */
  implosionRadius?: number;
  /** Plasma bomb: ms for the pull phase. */
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
}
