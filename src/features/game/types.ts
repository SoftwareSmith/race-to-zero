export interface SiegeZoneRect {
  height: number;
  id: string;
  left: number;
  top: number;
  width: number;
}

export type SiegeWeaponId =
  | "hammer"
  | "zapper"
  | "freeze"
  | "chain"
  | "flame"
  | "laser"
  | "shockwave"
  | "nullpointer"
  | "plasma"
  | "void";

/** Current evolution tier of a weapon (1 = base, 2 = enhanced, 3 = catastrophic). */
export type WeaponTier = 1 | 2 | 3;

/** Per-weapon kill count and tier, persisted across sessions. */
export interface WeaponEvolutionState {
  tier: WeaponTier;
  /** Total kills credited to this weapon (direct + DoT). */
  kills: number;
}

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
  /** For directional laser: beam angle in radians (0 = right, π/2 = down) */
  angle?: number;
  /** For chain zap: canvas-local bounce node positions including start */
  chainNodes?: Array<{ x: number; y: number }>;
  /** For chain zap: pre-seeded jag offsets (pairs: [mx0,my0, mx1,my1, ...]) so arc doesn’t flicker */
  jagOffsets?: number[];
  /** For seeking weapons: viewport x of the target bug */
  targetX?: number;
  /** For seeking weapons: viewport y of the target bug */
  targetY?: number;
  /** Optional viewport-space segments for path-based overlay effects. */
  segments?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  /** Optional color tint override for effect rendering (e.g. turret pointer in cyan). */
  color?: string;
}

export interface WeaponProgressSnapshot {
  current: boolean;
  cooldownMs: number;
  detail: string;
  hint: string;
  id: SiegeWeaponId;
  inputMode: "click" | "directional" | "seeking" | "hold";
  locked: boolean;
  progressText: string;
  title: string;
  /** Current evolution tier (1–3). */
  tier: WeaponTier;
  /** Kills earned with this weapon so far. */
  weaponKills: number;
  /** Kills needed to reach next tier. null when already at T3. */
  killsToNextTier: number | null;
}

export interface SiegeCombatStats {
  /** Ordered list of currently-unlocked weapon IDs (always includes "wrench"). */
  unlockedWeapons: SiegeWeaponId[];
  currentToolLabel: string;
  /** Ordered list of currently-unlocked structure IDs. */
  unlockedStructures: StructureId[];
}

// ── Structure types ──────────────────────────────────────────────

export type StructureId = "lantern" | "agent" | "turret" | "tesla" | "firewall";

export interface PlacedStructure {
  id: string;
  structureType: StructureId;
  /** Viewport x coordinate */
  x: number;
  /** Viewport y coordinate */
  y: number;
  placedAt: number;

  /** Canvas-local x (relative to BugCanvas top-left) */
  canvasX: number;
  /** Canvas-local y (relative to BugCanvas top-left) */
  canvasY: number;
}

export interface AgentCaptureState {
  structureId: string;
  phase: "absorbing" | "done" | "failed";
  startedAt: number;
  processingMs: number;
  variant: string;
  bugX: number;
  bugY: number;
}