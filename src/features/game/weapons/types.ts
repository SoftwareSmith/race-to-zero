/**
 * Weapon module types — a single weapon owns its def, hit pattern, and VFX spec.
 */

import type { SiegeWeaponId, WeaponType } from "@game/types";
import type { WeaponTier } from "@game/types";

export type { SiegeWeaponId };

/** How hit-detection is resolved for a weapon. */
export enum HitPattern {
  Single = "point",
  Line = "line",
  Area = "area",
  Cone = "cone",
  Chain = "chain",
  Seeking = "seeking",
  BlackHole = "blackhole",
}

export enum WeaponInputMode {
  Click = "click",
  Directional = "directional",
  Seeking = "seeking",
  Hold = "hold",
}

export interface CursorConfig {
  accent: string;
  aura: string;
  size: number;
  showCrosshair: boolean;
  ringClassName?: string;
}

export interface WeaponTierVfxDefinition {
  intensity: "basic" | "amplified" | "catastrophic";
  summary: string;
}

export interface WeaponTierBehaviorDefinition {
  summary: string;
}

export interface WeaponToggles {
  damage?: number;
  cooldownMs?: number;
  hitRadius?: number;
  coneArcDeg?: number;
  seekRadius?: number;
  splashRadius?: number;
  splashDamage?: number;
  chainRadius?: number;
  chainMaxBounces?: number;
  cloudRadius?: number;
  cloudDurationMs?: number;
  cloudIntervalMs?: number;
  poisonDps?: number;
  poisonDurationMs?: number;
  burnDps?: number;
  burnDurationMs?: number;
  burnDecayPerSecond?: number;
  secondaryRadius?: number;
  secondaryDurationMs?: number;
  secondaryDamage?: number;
  burstRadius?: number;
  burstOffsetDistance?: number;
  ringRadius?: number;
  allyDurationMs?: number;
  markRadius?: number;
  markDurationMs?: number;
  executeHpLimit?: number;
  blackHoleRadius?: number;
  blackHoleCoreRadius?: number;
  blackHoleDurationMs?: number;
  eventHorizonRadius?: number;
  eventHorizonDurationMs?: number;
}

export type WeaponToggleOverrides = Partial<WeaponToggles>;

export interface WeaponTierDefinition {
  tier: WeaponTier;
  title: string;
  detail: string;
  hint: string;
  effectColor?: string;
  evolveAtKills?: number;
  hitPattern?: HitPattern;
  toggles?: WeaponToggleOverrides;
  vfx?: WeaponTierVfxDefinition;
  behavior?: WeaponTierBehaviorDefinition;
  evolution?: WeaponTierDefinition;
}

/** Per-weapon static definition. */
export interface WeaponDef {
  id: SiegeWeaponId;
  title: string;
  typeHint: string;
  typeLabel: string;
  weaponType: WeaponType;
  unlockKills: number;
  detail: string;
  hitPattern: HitPattern;
  hitRadius: number;
  cursor: CursorConfig;
  overlayEffectDurationMs: number;
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
  inputMode: WeaponInputMode;
  hint: string;
  effectColor: string;
  cooldownMs: number;
  toggles: WeaponToggles;
  tiers: readonly WeaponTierDefinition[];
}

export interface ResolvedWeaponConfig extends WeaponDef, WeaponToggles {
  toggles: WeaponToggles;
}
