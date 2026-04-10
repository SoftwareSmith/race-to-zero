export interface SiegeZoneRect {
  height: number;
  id: string;
  left: number;
  top: number;
  width: number;
}

export type SiegeWeaponId = "hammer" | "laser" | "pulse";

export type SiegePhase = "idle" | "entering" | "active" | "exiting";

export interface WeaponEffectEvent {
  id: string;
  weapon: SiegeWeaponId;
  /** Viewport x coordinate */
  x: number;
  /** Viewport y coordinate */
  y: number;
  /** performance.now() timestamp when fired */
  startedAt: number;
}

export interface WeaponProgressSnapshot {
  current: boolean;
  detail: string;
  id: SiegeWeaponId;
  locked: boolean;
  progressText: string;
  title: string;
}

export interface SiegeCombatStats {
  currentToolLabel: string;
  hammerDamage: number;
  laserDamage: number;
  laserInterval: number;
  laserUnlocked: boolean;
  laserVolleyCount: number;
  pulseDamage: number;
  pulseInterval: number;
  pulseUnlocked: boolean;
  pulseVolleyCount: number;
}