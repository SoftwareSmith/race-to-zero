/**
 * Weapon runtime contracts — typed interfaces shared across all weapon plugins,
 * the registry, and the executor. No weapon-specific logic lives here.
 *
 * Dependency direction:  plugin → contracts (never contracts → plugin)
 */

import type { SiegeWeaponId, WeaponTier } from "@game/types";
import type { WeaponMatchupState } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

// ─── Re-exports ────────────────────────────────────────────────────────────────
export type { SiegeWeaponId, WeaponDef, WeaponTier };

// ---------------------------------------------------------------------------
// Game engine interface
// Typed subset of Engine.ts methods available to weapon behaviors.
// Behaviors only read/query; mutations happen via WeaponCommand dispatch.
// ---------------------------------------------------------------------------

export interface BugSnapshot {
  readonly x: number;
  readonly y: number;
  readonly variant: string;
  readonly hp?: number;
  readonly size?: number;
  readonly charged?: boolean;
  readonly marked?: boolean;
  readonly unstable?: boolean;
  readonly looped?: boolean;
  readonly ally?: boolean;
}

export interface HitResult {
  defeated: boolean;
  matchup: WeaponMatchupState;
  remainingHp: number;
  pointValue: number;
  frozen: boolean;
  variant: string;
}

export interface BlackHoleState {
  active: boolean;
  x: number;
  y: number;
  radius: number;
}

export interface GameEngine {
  hitTest(x: number, y: number): { index: number; distance: number } | null;
  lineHitTest(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    hitRadius?: number,
  ): number[];
  radiusHitTest(cx: number, cy: number, radius: number): number[];
  coneHitTest(
    cx: number,
    cy: number,
    angleDeg: number,
    arcDeg: number,
    depth: number,
  ): number[];
  chainHitTest(
    startIndex: number,
    chainRadius: number,
    maxBounces: number,
  ): number[];
  chainHitTestPreferUnfrozen(
    startIndex: number,
    chainRadius: number,
    maxBounces: number,
  ): number[];
  closestTargetIndex(cx: number, cy: number, searchRadius: number): number;
  handleHit(
    index: number,
    damage: number,
    creditOnDeath: boolean,
    weaponId?: SiegeWeaponId,
  ): HitResult | null;
  getAllBugs(): BugSnapshot[];
  applyPoisonInRadius(
    cx: number,
    cy: number,
    radius: number,
    dps: number,
    durationMs: number,
    weaponId?: SiegeWeaponId,
  ): void;
  applyBurnInRadius(
    cx: number,
    cy: number,
    radius: number,
    peakDps: number,
    durationMs: number,
    decayPerSecond?: number,
    weaponId?: SiegeWeaponId,
  ): void;
  applyEnsnareInRadius(
    cx: number,
    cy: number,
    radius: number,
    durationMs: number,
    weaponId?: SiegeWeaponId,
  ): void;
  startBlackHole(
    x: number,
    y: number,
    radius: number,
    coreRadius: number,
    durationMs: number,
    collapseDamage: number,
    weaponId?: SiegeWeaponId,
  ): boolean;
  getBlackHole(): BlackHoleState | null;
  // ── Evolution-era additions ──────────────────────────────────────────────
  applyChargedInRadius(cx: number, cy: number, radius: number, durationMs: number): void;
  applyMarkedInRadius(cx: number, cy: number, radius: number, durationMs: number): void;
  applyUnstableInRadius(cx: number, cy: number, radius: number, durationMs: number): void;
  propagateChargedNetwork(sourceIndex: number, damage: number, falloff: number, weaponId?: SiegeWeaponId): void;
  applyGlobalSlow(multiplier: number, durationMs: number, weaponId?: SiegeWeaponId): void;
  startDeadlockCluster(cx: number, cy: number, radius: number, pullDurationMs: number): void;
  splitBug(index: number): void;
  allyBug(index: number, durationMs: number): void;
  startEventHorizon(x: number, y: number, radius: number, durationMs: number, weaponId?: SiegeWeaponId): void;
  triggerKernelPanicExplosion(index: number, splashRadius: number, damage: number, weaponId?: SiegeWeaponId): void;
  triggerAutoScalerPulse(hpThreshold: number, weaponId?: SiegeWeaponId): void;
}

// ---------------------------------------------------------------------------
// Weapon context — passed to createSession() on each fire
// ---------------------------------------------------------------------------

export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WeaponContext {
  /** Canvas-local X where the weapon is aimed */
  readonly targetX: number;
  /** Canvas-local Y where the weapon is aimed */
  readonly targetY: number;
  /** Canvas horizontal center */
  readonly centerX: number;
  /** Canvas vertical center */
  readonly centerY: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  /** Original viewport X (for overlay position calculations) */
  readonly viewportX: number;
  /** Original viewport Y (for overlay position calculations) */
  readonly viewportY: number;
  readonly bounds: CanvasBounds;
  /** performance.now() at fire time */
  readonly now: number;
  readonly engine: GameEngine;
  /** Current evolution tier of the weapon being fired. */
  readonly tier: WeaponTier;
  /** The weapon ID being fired (for kill attribution in commands). */
  readonly weaponId: SiegeWeaponId;
}

// ---------------------------------------------------------------------------
// WeaponEffectDescriptor — discriminated union of all possible visual effects
// ---------------------------------------------------------------------------

/** Viewport-space line segment for the laser bouncing disc overlay. */
export interface ViewportSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type WeaponEffectDescriptor =
  | {
      type: "sprayParticles";
      x: number;
      y: number;
      angleDeg: number;
      coneDeg?: number;
      count?: number;
    }
  | {
      type: "toxicCloud";
      x: number;
      y: number;
      radius: number;
      durationMs: number;
    }
  | {
      type: "firePatch";
      x: number;
      y: number;
      radius: number;
      durationMs: number;
    }
  | {
      type: "flameTrailBurst";
      x: number;
      y: number;
      angleDeg: number;
      count?: number;
    }
  | {
      type: "fireTrailStamp";
      x: number;
      y: number;
      radius: number;
      durationMs: number;
    }
  | { type: "burnScar"; x1: number; y1: number; x2: number; y2: number }
  | { type: "crack"; x: number; y: number }
  | {
      type: "explosion";
      x: number;
      y: number;
      radius: number;
      colorHex?: number;
    }
  | {
      type: "snowflakeDecals";
      x: number;
      y: number;
      count: number;
      radius: number;
    }
  | {
      type: "lightning";
      nodes: Array<{ x: number; y: number }>;
      lifetimeMs?: number;
      colorHex?: number;
    }
  | { type: "sparkCrown"; x: number; y: number; colorHex?: number }
  | { type: "binaryBurst"; x: number; y: number }
  | {
      type: "netCast";
      x: number;
      y: number;
      radius: number;
      durationMs: number;
    }
  | { type: "empBurst"; x: number; y: number; count?: number }
  | { type: "plasmaImplosion"; x: number; y: number; radius: number }
  | { type: "plasmaExplosion"; x: number; y: number; delayMs: number }
  | { type: "createBlackHole"; x: number; y: number }
  | { type: "voidCollapse"; x: number; y: number; radius: number }
  | {
      type: "tracerLine";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs?: number;
    }
  | {
      type: "overlayEffect";
      weaponId: SiegeWeaponId;
      viewportX: number;
      viewportY: number;
      extras?: {
        angle?: number;
        chainNodes?: Array<{ x: number; y: number }>;
        targetX?: number;
        targetY?: number;
        segments?: ViewportSegment[];
        color?: string;
      };
    };

// ---------------------------------------------------------------------------
// WeaponCommand — discriminated union of all game-state mutations
// ---------------------------------------------------------------------------

export type WeaponCommand =
  | {
      kind: "damage";
      targetIndex: number;
      amount: number;
      creditOnDeath?: boolean;
    }
  | {
      kind: "applyPoison";
      targetIndex: number;
      dps: number;
      durationMs: number;
    }
  | {
      kind: "applyBurn";
      targetIndex: number;
      dps: number;
      durationMs: number;
      decayPerSecond: number;
    }
  | {
      kind: "applyFreeze";
      targetIndex: number;
      intensity: number;
      durationMs: number;
    }
  | { kind: "applyEnsnare"; targetIndex: number; durationMs: number }
  | { kind: "knockback"; targetIndex: number; dx: number; dy: number }
  | {
      kind: "poisonRadius";
      cx: number;
      cy: number;
      radius: number;
      dps: number;
      durationMs: number;
    }
  | {
      kind: "burnRadius";
      cx: number;
      cy: number;
      radius: number;
      peakDps: number;
      durationMs: number;
      decayPerSecond: number;
    }
  | {
      kind: "ensnareRadius";
      cx: number;
      cy: number;
      radius: number;
      durationMs: number;
    }
  | {
      kind: "repeatPoisonRadius";
      cx: number;
      cy: number;
      radius: number;
      dps: number;
      durationMs: number;
      intervalMs: number;
      totalMs: number;
    }
  | {
      kind: "startBlackHole";
      x: number;
      y: number;
      radius: number;
      coreRadius: number;
      durationMs: number;
      collapseDamage: number;
    }
  | { kind: "applyCharged"; targetIndex: number; durationMs: number }
  | { kind: "applyMarked"; targetIndex: number; durationMs: number }
  | { kind: "applyUnstable"; targetIndex: number; durationMs: number }
  | { kind: "applyLooped"; targetIndex: number; dps: number; durationMs: number }
  | { kind: "chargedRadius"; cx: number; cy: number; radius: number; durationMs: number }
  | { kind: "markedRadius"; cx: number; cy: number; radius: number; durationMs: number }
  | { kind: "unstableRadius"; cx: number; cy: number; radius: number; durationMs: number }
  | { kind: "propagateChargedNetwork"; sourceIndex: number; damage: number; falloff: number }
  | { kind: "applyGlobalSlow"; multiplier: number; durationMs: number }
  | { kind: "startDeadlockCluster"; cx: number; cy: number; radius: number; pullDurationMs: number }
  | { kind: "splitBug"; targetIndex: number }
  | { kind: "allyBug"; targetIndex: number; durationMs: number }
  | { kind: "startEventHorizon"; x: number; y: number; radius: number; durationMs: number }
  | { kind: "triggerKernelPanic"; targetIndex: number; splashRadius: number; damage: number }
  | { kind: "autoScalerPulse"; hpThreshold: number }
  | { kind: "spawnEffect"; descriptor: WeaponEffectDescriptor };

// ---------------------------------------------------------------------------
// Fire session variants
// ---------------------------------------------------------------------------

/** Single-click weapon: returns its commands immediately and is done. */
export interface ClickFireResult {
  mode: "once";
  commands: WeaponCommand[];
}

/**
 * Hold-to-fire weapon (flame, bug spray).
 * begin() fires on mousedown; tick() fires each time the cooldown elapses;
 * paint() is called on every mousemove for visual-only interpolated trail;
 * end() cleans up when the mouse is released.
 */
export interface HoldFireSession {
  mode: "hold";
  begin(ctx: WeaponContext): WeaponCommand[];
  tick(ctx: WeaponContext): WeaponCommand[];
  paint?(ctx: WeaponContext): WeaponCommand[];
  end(): void;
}

/**
 * Persistent weapon (currently void pulse).
 * begin() starts the effect; the caller checks active to gate re-fire;
 * abort() cancels any pending timers before destruction.
 */
export interface PersistentFireSession {
  mode: "persistent";
  begin(ctx: WeaponContext): WeaponCommand[];
  abort(): void;
  readonly active: boolean;
}

export type FireSession = ClickFireResult | HoldFireSession | PersistentFireSession;

// ---------------------------------------------------------------------------
// WeaponEntry — the plugin contract registered per weapon
// ---------------------------------------------------------------------------

export interface WeaponEntry {
  readonly weaponId: SiegeWeaponId;
  /** Static weapon data (re-uses the existing WeaponDef for compatibility). */
  readonly config: WeaponDef;
  createSession(ctx: WeaponContext): FireSession;
}

// ---------------------------------------------------------------------------
// BugHitPayload — passed to the onHit callback after each kill|damage
// ---------------------------------------------------------------------------

export interface BugHitPayload {
  defeated: boolean;
  remainingHp: number;
  variant: string;
  x: number;
  y: number;
  pointValue?: number;
  frozen?: boolean;
}

// ---------------------------------------------------------------------------
// ExecutionContext — caller-supplied context for the executor
// ---------------------------------------------------------------------------

export interface ExecutionContext {
  readonly engine: GameEngine;
  /** VfxEngine instance — may be null during tests. */
  readonly vfx: unknown;
  readonly damageMultiplier?: number;
  /** Canvas element used for screen shake — null during tests. */
  readonly canvas: HTMLElement | null;
  readonly bounds: CanvasBounds;
  /** Current fire viewport position (for onHit fallback coordinates). */
  readonly viewportX: number;
  readonly viewportY: number;
  readonly weaponId: SiegeWeaponId;
  readonly onHit: (payload: BugHitPayload) => void;
  readonly updateQaLastHit: (payload: Omit<BugHitPayload, "pointValue" | "frozen">) => void;
  /** Called with overlay data for weapons in OVERLAY_EFFECT_WEAPONS set. */
  readonly enqueueOverlay: (
    weaponId: SiegeWeaponId,
    viewportX: number,
    viewportY: number,
    extras?: OverlayExtras,
  ) => void;
  /** Mutable ref that tracks the active black hole VFX ID for renderFrame ticking. */
  readonly blackHoleVfxIdRef: { current: string | null };
}

// ---------------------------------------------------------------------------
// OverlayExtras — matches the extras parameter of createEffectEvent()
// ---------------------------------------------------------------------------

export type OverlayExtras = {
  angle?: number;
  chainNodes?: Array<{ x: number; y: number }>;
  targetX?: number;
  targetY?: number;
  color?: string;
  segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};
