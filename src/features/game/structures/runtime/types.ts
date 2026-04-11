/**
 * Structure runtime contracts — typed interfaces shared across all structure
 * plugins, the registry, and the Engine seam. No structure-specific logic here.
 *
 * Dependency direction:  plugin → contracts (never contracts → plugin)
 */

import type { StructureDef } from "@config/structureConfig";
import type { StructureId } from "@game/types";

// Re-exports for convenience
export type { StructureId, StructureDef };

// ---------------------------------------------------------------------------
// StructureEntry — the live instance of a placed structure in the simulation.
// Mirrors the private StructureEntry in Engine.ts; kept in sync manually.
// ---------------------------------------------------------------------------

export interface AbsorbingState {
  variant: string;
  bugX: number;
  bugY: number;
  pullFromX: number;
  pullFromY: number;
  pullStartedAt: number;
  size: number;
  completesAt: number;
  failChance: number;
}

export interface AimPhase {
  targetX: number;
  targetY: number;
  angle: number;
  firesAt: number;
}

export interface StructureEntry {
  id: string;
  type: StructureId;
  x: number;
  y: number;
  nextCaptureAt: number;
  absorbing: AbsorbingState | null;
  lastFireAngle?: number;
  aimPhase?: AimPhase | null;
  placedAt?: number;
  firewallNextDamageAt?: number;
}

// ---------------------------------------------------------------------------
// StructureGameEngine — typed facade over Engine.ts methods available to behaviors.
// Behaviors do not receive the full Engine; they get only this interface.
// ---------------------------------------------------------------------------

export interface BugSnapshot {
  x: number;
  y: number;
  variant: string;
  state: string;
  size?: number;
}

export interface HitResult {
  defeated: boolean;
  remainingHp: number;
  pointValue: number;
  frozen: boolean;
  variant: string;
}

export interface StructureGameEngine {
  /** All live entities in the simulation (including dying; behaviors must guard state). */
  getEntities(): BugSnapshot[];
  /** Remove entity at index from the simulation immediately (for agent captures). */
  spliceEntity(index: number): BugSnapshot;
  /** Take a BugEntity from the pool (restores after splice). */
  returnToPool(entity: BugSnapshot): void;
  /** Deal damage to entity at index. Returns null if index is out of bounds. */
  handleHit(index: number, damage: number, creditOnDeath: boolean): HitResult | null;
  /** Current elapsed simulation time in milliseconds. */
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// StructureCallbacks — the EngineOptions callbacks pre-bound for behaviors.
// ---------------------------------------------------------------------------

export interface AgentAbsorbData {
  structureId: string;
  phase: "absorbing" | "pulling" | "done" | "failed";
  variant: string;
  bugX: number;
  bugY: number;
  srcX?: number;
  srcY?: number;
  processingMs?: number;
}

export interface TurretFireData {
  structureId: string;
  srcX: number;
  srcY: number;
  targetX: number;
  targetY: number;
  angle: number;
  phase: "aim" | "fire";
}

export interface TeslaFireData {
  structureId: string;
  nodes: Array<{ x: number; y: number }>;
}

export interface StructureCallbacks {
  onStructureKill?(x: number, y: number, variant: string): void;
  onAgentAbsorb?(data: AgentAbsorbData): void;
  onTurretFire?(data: TurretFireData): void;
  onTeslaFire?(data: TeslaFireData): void;
}

// ---------------------------------------------------------------------------
// StructureTickContext — everything a behavior receives on each tick.
// ---------------------------------------------------------------------------

export interface StructureTickContext {
  /** Current elapsed ms — same as engine.elapsedMs, provided for convenience. */
  readonly now: number;
  /** Delta-time for this tick in milliseconds. */
  readonly dtMs: number;
  readonly engine: StructureGameEngine;
  readonly callbacks: StructureCallbacks;
}

// ---------------------------------------------------------------------------
// StructureBehavior — the plugin contract registered per structure type.
// ---------------------------------------------------------------------------

export interface StructureBehavior {
  readonly structureId: StructureId;
  readonly config: StructureDef;
  /**
   * Called for every live instance of this structure each engine tick.
   * Mutates `entry` for state tracking (cooldowns, aim phase, etc.).
   * Returns void — all side-effects go through engine mutation methods
   * or the callbacks in ctx.callbacks.
   */
  tick(entry: StructureEntry, ctx: StructureTickContext): void;
}
