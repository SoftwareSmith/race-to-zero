export interface SiegeZoneRect {
  height: number;
  id: string;
  left: number;
  top: number;
  width: number;
}

/**
 * Named weapon ID constants — use these instead of string literals.
 * e.g. WeaponId.NullPointer instead of "nullpointer"
 */
export enum WeaponId {
  Hammer = "hammer",
  BugSpray = "zapper",
  Freeze = "freeze",
  ChainZap = "chain",
  Flame = "flame",
  TracerBloom = "laser",
  StaticNet = "shockwave",
  NullPointer = "nullpointer",
  ForkBomb = "plasma",
  VoidPulse = "void",
}

/** Union of all valid weapon ID strings. */
export type SiegeWeaponId = `${WeaponId}`;

export const ALL_WEAPON_IDS: readonly SiegeWeaponId[] = [
  WeaponId.Hammer,
  WeaponId.BugSpray,
  WeaponId.Freeze,
  WeaponId.ChainZap,
  WeaponId.Flame,
  WeaponId.TracerBloom,
  WeaponId.StaticNet,
  WeaponId.NullPointer,
  WeaponId.ForkBomb,
  WeaponId.VoidPulse,
] as const;

/** @deprecated Use WeaponId instead. Kept as alias for backward compatibility. */
export type WeaponIdValue = SiegeWeaponId;

export enum EntityState {
  Alive = "alive",
  Dying = "dying",
  Dead = "dead",
}

export function isTerminalEntityState(
  state: string | null | undefined,
): state is EntityState.Dead | EntityState.Dying {
  return state === EntityState.Dead || state === EntityState.Dying;
}

export type WeaponType =
  | "blunt"
  | "toxin"
  | "cryo"
  | "thermal"
  | "electric"
  | "precision"
  | "plasma"
  | "gravity";

export enum WeaponMatchup {
  Strong = "favored",
  Neutral = "steady",
  Weak = "risky",
  Immune = "immune",
  Favored = "favored",
  Steady = "steady",
  Risky = "risky",
}

export type WeaponMatchupState = `${WeaponMatchup}`;

export interface WeaponMatchupSummaryItem {
  state: WeaponMatchupState;
  variant: "low" | "medium" | "high" | "urgent";
}

/**
 * Named tier constants — use these instead of magic numbers.
 * e.g. WeaponTier.TIER_TWO instead of 2
 */
export enum WeaponTier {
  TIER_ONE = 1,
  TIER_TWO = 2,
  TIER_THREE = 3,
}

/** Current evolution tier of a weapon (1 = base, 2 = enhanced, 3 = catastrophic). */
export type WeaponTierValue = WeaponTier;

/** Per-weapon kill count and tier for the current siege session. */
export interface WeaponEvolutionState {
  tier: WeaponTier;
  /** Total kills credited to this weapon (direct + DoT). */
  kills: number;
}

export type SiegePhase = "idle" | "entering" | "active" | "exiting";

export type SiegeGameMode = "purge" | "outbreak";

export const SIEGE_GAME_MODE_META: Record<
  SiegeGameMode,
  {
    description: string;
    label: string;
    shortLabel: string;
  }
> = {
  purge: {
    description: "Fastest time to clear the current bug loadout.",
    label: "Purge Mode",
    shortLabel: "Time Attack",
  },
  outbreak: {
    description: "Survive a shifting outbreak with bugs spawning and changing over time.",
    label: "Outbreak",
    shortLabel: "Survival",
  },
};

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
  /** Optional shared heat-system stage for tier feedback. */
  heatStage?: "warm" | "hot" | "overdrive";
  /** Optional shared heat accent for tier feedback bursts. */
  heatColor?: string;
  /** Optional bright shared heat core for tier feedback bursts. */
  heatCore?: string;
  /** Optional shared scale multiplier for tier feedback bursts. */
  heatScale?: number;
}

export interface WeaponProgressSnapshot {
  current: boolean;
  cooldownMs: number;
  currentTierStartKills: number;
  detail: string;
  hint: string;
  id: SiegeWeaponId;
  inputMode: "click" | "directional" | "seeking" | "hold";
  locked: boolean;
  matchupSummary: WeaponMatchupSummaryItem[];
  nextTierGoalKills: number | null;
  progressText: string;
  title: string;
  typeHint: string;
  typeLabel: string;
  unlockKills: number;
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
  tier: WeaponTier;
  xp: number;
  nextTierXp: number | null;
  kills: number;
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