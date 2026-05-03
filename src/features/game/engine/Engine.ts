import type { GameConfig } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";
import { BugEntity } from "./BugEntity";
import { Entity } from "./Entity";
import { getBugVariantMaxHp } from "../../../constants/bugs";
import { ALL_WEAPON_IDS, EntityState, WeaponMatchup, WeaponTier, isTerminalEntityState } from "../types";
import type { StructureId, SiegeWeaponId, WeaponEvolutionState } from "../types";
import type { SiegeStatusId } from "@game/status/statusCatalog";
import { WEAPON_EVOLVE_THRESHOLDS } from "@config/gameDefaults";
import { applyMatchupDamage, getBugWeaponMatchup } from "@game/combat/weaponMatchups";
import type { AllyConversionConfig } from "@game/weapons/runtime/types";
import type { BugVariant } from "../../../types/dashboard";
import type { BugTransitionSnapshotItem } from "@game/components/BackgroundField/types";

interface StructureEntry {
  id: string;
  type: StructureId;
  tier: WeaponTier;
  x: number;
  y: number;
  /** engine ticks until next agent capture */
  nextCaptureAt: number;
  /** When the agent is processing a captured bug, holds capture state */
  absorbing: {
    variant: string;
    bugX: number;
    bugY: number;
    /** original capture position for pull animation */
    pullFromX: number;
    pullFromY: number;
    /** elapsedMs when pull started */
    pullStartedAt: number;
    size: number;
    completesAt: number;
    failChance: number;
  } | null;
}

const DEFAULT_MAX_ACTIVE_ALLIES = 5;
const GOLDEN_RATIO_CONJUGATE = 0.61803398875;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fract(value: number) {
  return value - Math.floor(value);
}

type SpatialCell = Entity[];

interface SpawnZone {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface EngineOptions {
  width: number;
  height: number;
  config?: Partial<GameConfig>;
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: {
      credited: boolean;
      finisherStatus?: SiegeStatusId | null;
      frozen: boolean;
      pointValue: number;
      supportStatuses?: SiegeStatusId[];
    },
  ) => void;
  /** Called when a structure kills a bug — counts toward the player kill tally */
  onStructureKill?: (structureId: string, x: number, y: number, variant: string) => void;
  /** Called when the agent starts/finishes/fails absorbing a bug */
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "pulling" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    /** Agent canvas position (for lasso VFX during pull phase) */
    srcX?: number;
    srcY?: number;
    processingMs?: number;
  }) => void;
  /** Called whenever a weapon evolves to a new tier */
  onWeaponEvolution?: (weaponId: SiegeWeaponId, newTier: WeaponTier) => void;
  /** Initial evolution states loaded from localStorage */
  initialEvolutionStates?: Partial<Record<SiegeWeaponId, WeaponEvolutionState>>;
  /** Highest weapon tier allowed for the active game mode. */
  maxWeaponTier?: WeaponTier;
}

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  entities: Entity[] = [];
  config: GameConfig;
  pool: BugEntity[] = [];
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: {
      credited: boolean;
      finisherStatus?: SiegeStatusId | null;
      frozen: boolean;
      pointValue: number;
      supportStatuses?: SiegeStatusId[];
    },
  ) => void;
  onStructureKill?: (structureId: string, x: number, y: number, variant: string) => void;
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "pulling" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    srcX?: number;
    srcY?: number;
    processingMs?: number;
  }) => void;
  private structures: StructureEntry[] = [];
  private elapsedMs = 0;
  /** Per-weapon kill counts and tiers for the evolution system. */
  weaponEvolutionStates: Map<SiegeWeaponId, WeaponEvolutionState>;
  onWeaponEvolution?: (weaponId: SiegeWeaponId, newTier: WeaponTier) => void;
  private maxWeaponTier: WeaponTier;
  /** Active event horizons: consume unstable bugs on contact. */
  private eventHorizons: Array<{
    x: number;
    y: number;
    radius: number;
    expiresAt: number;
    weaponId?: SiegeWeaponId;
  }> = [];
  private spatialGrid = new Map<string, SpatialCell>();
  private spatialCellSize = Math.max(
    DEFAULT_GAME_CONFIG.separationRadius * 2,
    56,
  );

  /**
   * Black hole state for Void Pulse.
   * Only one black hole can exist at a time.
   */
  private blackHole: {
    x: number;
    y: number;
    radius: number;
    coreRadius: number;
    collapseDamage: number;
    startedAt: number;
    durationMs: number;
    active: boolean;
    weaponId?: SiegeWeaponId;
    eventHorizonRadius?: number;
    eventHorizonDurationMs?: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;
    this.width = opts.width ?? canvas.clientWidth;
    this.height = opts.height ?? canvas.clientHeight;
    this.config = { ...DEFAULT_GAME_CONFIG, ...(opts.config ?? {}) };
    this.onEntityDeath = opts.onEntityDeath;
    this.onStructureKill = opts.onStructureKill;
    this.onAgentAbsorb = opts.onAgentAbsorb;
    this.onWeaponEvolution = opts.onWeaponEvolution;
    this.maxWeaponTier = opts.maxWeaponTier ?? WeaponTier.TIER_THREE;
    this.weaponEvolutionStates = new Map(
      ALL_WEAPON_IDS.map((id) => [
        id,
        {
          kills: opts.initialEvolutionStates?.[id]?.kills ?? 0,
          tier: Math.min(
            opts.initialEvolutionStates?.[id]?.tier ?? WeaponTier.TIER_ONE,
            this.maxWeaponTier,
          ) as WeaponTier,
        },
      ]),
    );
  }

  /** Record a weapon kill and check for evolution. */
  recordWeaponKill(weaponId: SiegeWeaponId | undefined | null): void {
    if (!weaponId) return;
    const state = this.weaponEvolutionStates.get(weaponId);
    if (!state) return;
    state.kills++;

    if (state.tier >= this.maxWeaponTier) {
      return;
    }

    this.checkEvolution(weaponId);
  }

  private checkEvolution(weaponId: SiegeWeaponId): void {
    const state = this.weaponEvolutionStates.get(weaponId);
    if (!state) return;
    if (state.tier >= this.maxWeaponTier) return;

    const nextTier = (state.tier + 1) as WeaponTier;
    if (nextTier > this.maxWeaponTier) return;

    const threshold = WEAPON_EVOLVE_THRESHOLDS[weaponId][state.tier - 1];
    if (threshold != null && state.kills >= threshold) {
      state.tier = nextTier;
      this.onWeaponEvolution?.(weaponId, nextTier);
    }
  }

  /** Get all current evolution states (for persistence). */
  getWeaponEvolutionStates(): Map<SiegeWeaponId, WeaponEvolutionState> {
    return this.weaponEvolutionStates;
  }

  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  private getSpatialKey(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`;
  }

  private rebuildSpatialGrid(): void {
    this.spatialGrid.clear();

    for (const entity of this.entities) {
      if (isTerminalEntityState((entity as any).state)) {
        continue;
      }

      const cellX = Math.floor(entity.x / this.spatialCellSize);
      const cellY = Math.floor(entity.y / this.spatialCellSize);
      const key = this.getSpatialKey(cellX, cellY);
      const bucket = this.spatialGrid.get(key);
      if (bucket) {
        bucket.push(entity);
        continue;
      }

      this.spatialGrid.set(key, [entity]);
    }
  }

  private getSpatialCandidates(x: number, y: number, radius: number): Entity[] {
    const minCellX = Math.floor((x - radius) / this.spatialCellSize);
    const maxCellX = Math.floor((x + radius) / this.spatialCellSize);
    const minCellY = Math.floor((y - radius) / this.spatialCellSize);
    const maxCellY = Math.floor((y + radius) / this.spatialCellSize);
    const candidates: Entity[] = [];

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const bucket = this.spatialGrid.get(this.getSpatialKey(cellX, cellY));
        if (!bucket?.length) {
          continue;
        }

        candidates.push(...bucket);
      }
    }

    return candidates;
  }

  spawnFromCounts(
    counts: Record<string, number>,
    spawnZones: SpawnZone[] = [],
  ) {
    const usableZones = spawnZones.filter(
      (zone) => zone.width > 24 && zone.height > 24,
    );
    const totalZoneArea = usableZones.reduce(
      (total, zone) => total + zone.width * zone.height,
      0,
    );
    const getSpawnPoint = () => {
      const padding = 18;
      if (!usableZones.length || Math.random() > 0.38 || totalZoneArea <= 0) {
        return {
          x: padding + Math.random() * Math.max(1, this.width - padding * 2),
          y: padding + Math.random() * Math.max(1, this.height - padding * 2),
        };
      }

      let roll = Math.random() * totalZoneArea;
      let selectedZone = usableZones[0];
      for (const zone of usableZones) {
        roll -= zone.width * zone.height;
        if (roll <= 0) {
          selectedZone = zone;
          break;
        }
      }

      return {
        x: Math.min(
          this.width - padding,
          Math.max(
            padding,
            selectedZone.left + Math.random() * selectedZone.width,
          ),
        ),
        y: Math.min(
          this.height - padding,
          Math.max(
            padding,
            selectedZone.top + Math.random() * selectedZone.height,
          ),
        ),
      };
    };

    // reuse pool when possible
    this.entities = [];
    const variants = Object.keys(counts);
    for (const v of variants) {
      const n = counts[v] ?? 0;
      for (let i = 0; i < n; i++) {
        let be: BugEntity | undefined = undefined;
        // spawn uniformly across the canvas with random initial headings
        const { x: spawnX, y: spawnY } = getSpawnPoint();
        const heading = Math.random() * Math.PI * 2;
        const speed = this.config.baseSpeed * (0.8 + Math.random() * 0.6);

        if (this.pool.length > 0) {
          be = this.pool.pop()!;
          be.revive(this.width, this.height);
          be.variant = (v as any) || "low";
          be.size = (6 + Math.random() * 2) * this.config.sizeMultiplier;
          be.baseSize = be.size;
          be.maxHp = getBugVariantMaxHp(be.variant as any);
          be.hp = be.maxHp;
          be.x = spawnX;
          be.y = spawnY;
          be.vx = Math.cos(heading) * speed;
          be.vy = Math.sin(heading) * speed;
          be.heading = heading;
        } else {
          be = new BugEntity({
            x: spawnX,
            y: spawnY,
            vx: Math.cos(heading) * speed,
            vy: Math.sin(heading) * speed,
            size: (6 + Math.random() * 2) * this.config.sizeMultiplier,
            opacity: 1,
            variant: (v as any) || "low",
            heading,
          } as any);
          be.baseSize = be.size;
          be.maxHp = getBugVariantMaxHp(be.variant as any);
          be.hp = be.maxHp;
        }
        this.entities.push(be);
      }
    }
  }

  private getEdgeSpawnPoint(spawnIndex = 0, totalCount = 1) {
    const padding = 18;
    const edge = Math.floor(Math.random() * 4);
    const spanPosition =
      totalCount > 1
        ? fract(spawnIndex * GOLDEN_RATIO_CONJUGATE + Math.random() * 0.35)
        : Math.random();
    const jitterScale = Math.min(0.22, 0.9 / Math.max(3, totalCount));
    const lanePosition = clamp(
      spanPosition + (Math.random() - 0.5) * jitterScale,
      0.03,
      0.97,
    );
    const x = padding + lanePosition * Math.max(1, this.width - padding * 2);
    const y = padding + lanePosition * Math.max(1, this.height - padding * 2);

    if (edge === 0) {
      return { heading: Math.PI / 2, x, y: -padding };
    }

    if (edge === 1) {
      return { heading: Math.PI, x: this.width + padding, y };
    }

    if (edge === 2) {
      return { heading: -Math.PI / 2, x, y: this.height + padding };
    }

    return { heading: 0, x: -padding, y };
  }

  spawnBurst(counts: Record<string, number>, spawnZones: SpawnZone[] = []) {
    void spawnZones;
    const variants = Object.keys(counts);
    const totalCount = variants.reduce(
      (total, variant) => total + Math.max(0, counts[variant] ?? 0),
      0,
    );
    let spawnIndex = 0;

    for (const variant of variants) {
      const count = counts[variant] ?? 0;
      for (let index = 0; index < count; index += 1) {
        const spawnPoint = this.getEdgeSpawnPoint(spawnIndex, totalCount);
        const targetX = this.width * (0.18 + Math.random() * 0.64);
        const targetY = this.height * (0.18 + Math.random() * 0.64);
        const inwardHeading = Math.atan2(targetY - spawnPoint.y, targetX - spawnPoint.x);
        const heading = inwardHeading + (Math.random() - 0.5) * 0.55;
        const speed = this.config.baseSpeed * (0.9 + Math.random() * 0.85);
        let bug: BugEntity;

        if (this.pool.length > 0) {
          bug = this.pool.pop()!;
          bug.revive(this.width, this.height);
          bug.variant = (variant as any) || "low";
          bug.size = (6 + Math.random() * 2) * this.config.sizeMultiplier;
          bug.baseSize = bug.size;
          bug.maxHp = getBugVariantMaxHp(bug.variant as any);
          bug.hp = bug.maxHp;
          bug.x = spawnPoint.x;
          bug.y = spawnPoint.y;
          bug.vx = Math.cos(heading) * speed;
          bug.vy = Math.sin(heading) * speed;
          bug.heading = heading;
        } else {
          bug = new BugEntity({
            heading,
            opacity: 1,
            size: (6 + Math.random() * 2) * this.config.sizeMultiplier,
            variant: (variant as any) || "low",
            vx: Math.cos(heading) * speed,
            vy: Math.sin(heading) * speed,
            x: spawnPoint.x,
            y: spawnPoint.y,
          } as any);
          bug.baseSize = bug.size;
          bug.maxHp = getBugVariantMaxHp(bug.variant as any);
          bug.hp = bug.maxHp;
        }

        this.entities.push(bug);
        spawnIndex += 1;
      }
    }
  }

  spawnFromSnapshot(snapshot: BugTransitionSnapshotItem[]) {
    this.entities = [];

    for (const item of snapshot) {
      let bug = this.pool.pop();

      if (bug) {
        bug.revive(this.width, this.height);
        bug.variant = item.variant;
        bug.size = item.size;
        bug.baseSize = item.size;
        bug.maxHp = item.maxHp;
        bug.hp = item.hp;
        bug.x = item.x;
        bug.y = item.y;
        bug.vx = item.vx;
        bug.vy = item.vy;
        bug.heading = item.heading;
        bug.opacity = item.opacity;
      } else {
        bug = new BugEntity({
          heading: item.heading,
          opacity: item.opacity,
          size: item.size,
          variant: item.variant,
          vx: item.vx,
          vy: item.vy,
          x: item.x,
          y: item.y,
        } as any);
        bug.baseSize = item.size;
        bug.maxHp = item.maxHp;
        bug.hp = item.hp;
      }

      this.entities.push(bug);
    }
  }

  // hit-test in canvas-local coordinates (x,y) -> returns nearest entity index within radius
  hitTest(x: number, y: number) {
    let best: { index: number; distance: number } | null = null;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      const dx = x - e.x;
      const dy = y - e.y;
      const dist = Math.hypot(dx, dy);
      const radius = Math.max((e.size ?? 12) * 0.5, 12);
      if (dist <= radius && (!best || dist < best.distance)) {
        best = { index: i, distance: dist };
      }
    }
    return best;
  }

  /**
   * Returns indexes of all active entities whose bounding circle intersects
   * the line segment from (x1,y1) to (x2,y2). Used by the laser weapon.
   * @param hitRadius - extra tolerance added to each entity's size radius
   */
  lineHitTest(x1: number, y1: number, x2: number, y2: number, hitRadius = 12): number[] {
    const result: number[] = [];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (isTerminalEntityState(e.state)) continue;

      // Closest point on segment to entity center
      let t = 0;
      if (lenSq > 0) {
        t = Math.max(0, Math.min(1, ((e.x - x1) * dx + (e.y - y1) * dy) / lenSq));
      }
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      const dist = Math.hypot(e.x - closestX, e.y - closestY);

      if (dist <= Math.max((e.size ?? 12) * 0.5, 8) + hitRadius) {
        result.push(i);
      }
    }

    return result;
  }

  /**
   * Returns indexes of all active entities within the given radius from (cx, cy).
   * Used by the pulse weapon.
   */
  radiusHitTest(cx: number, cy: number, radius: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (isTerminalEntityState(e.state)) continue;

      const dist = Math.hypot(e.x - cx, e.y - cy);
      if (dist <= radius + Math.max((e.size ?? 12) * 0.5, 8)) {
        result.push(i);
      }
    }

    return result;
  }

  addEntity(e: Entity) {
    this.entities.push(e);
  }

  // compatibility helper used by BackgroundField (replaces legacy BugSwarm API)
  getAllBugs() {
    return this.entities;
  }

  clearAllBugs(): number {
    const clearedCount = this.entities.reduce((total, entity) => {
      if (isTerminalEntityState((entity as any).state)) {
        return total;
      }

      this.pool.push(entity as BugEntity);
      return total + 1;
    }, 0);

    this.entities = [];
    return clearedCount;
  }

  getNeighbors(e: Entity, radius: number) {
    const r2 = radius * radius;
    const out: Entity[] = [];
    const candidates = this.getSpatialCandidates(e.x, e.y, radius);

    for (const o of candidates) {
      if (o === e) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      if (dx * dx + dy * dy <= r2) out.push(o);
    }
    return out;
  }

  getCrowdingAt(x: number, y: number, radius: number, exclude?: Entity) {
    const r2 = radius * radius;
    let count = 0;
    let weightedCount = 0;
    let centerX = 0;
    let centerY = 0;

    const candidates = this.getSpatialCandidates(x, y, radius);

    for (const entity of candidates) {
      if (entity === exclude) continue;
      const dx = entity.x - x;
      const dy = entity.y - y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > r2) continue;

      const distance = Math.max(1, Math.sqrt(distanceSquared));
      const weight = 1 - distance / radius;
      count += 1;
      weightedCount += weight;
      centerX += entity.x * weight;
      centerY += entity.y * weight;
    }

    return {
      centerX: weightedCount > 0 ? centerX / weightedCount : x,
      centerY: weightedCount > 0 ? centerY / weightedCount : y,
      count,
      score: weightedCount,
    };
  }

  update(dt: number, targetX?: number | null, targetY?: number | null) {
    // simple fixed-step update called by the host render loop
    this.elapsedMs += dt * 1000;

    for (const ent of this.entities) {
      ent.beginStep();
    }

    this.rebuildSpatialGrid();

    // iterate backwards so we can safely remove dead entities into the pool
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      if ((ent as any).update.length >= 2) {
        // pass context expected by BugEntity
        (ent as any).update(dt, {
          getNeighbors: (e: any, r: number) => this.getNeighbors(e, r),
          getCrowdingAt: (x: number, y: number, r: number, exclude?: any) =>
            this.getCrowdingAt(x, y, r, exclude),
          targetX,
          targetY,
          config: this.config,
          bounds: { width: this.width, height: this.height },
        });
      } else {
        (ent as any).update(dt);
      }

      // Keep a final safety clamp here, but leave edge behavior to the entity.
      ent.x = Math.min(this.width, Math.max(0, ent.x));
      ent.y = Math.min(this.height, Math.max(0, ent.y));

      // handle dead entities: move to pool and remove from active list once
      if ((ent as any).state === EntityState.Dead) {
        const be = ent as any as BugEntity;
        // Attribute DOT kills to the source weapon
        if (
          be.dotSourceWeaponId &&
          !be.deathCredited &&
          (be.finalBlowStatus === "poison" ||
            be.finalBlowStatus === "burn" ||
            be.finalBlowStatus === "looped")
        ) {
          this.recordWeaponKill(be.dotSourceWeaponId as SiegeWeaponId);
        }
        try {
          this.onEntityDeath?.(be.x, be.y, be.variant, {
            credited: be.deathCredited,
            finisherStatus: be.finalBlowStatus,
            frozen:
              be.slow !== null && performance.now() < be.slow.expiresAt,
            pointValue: be.deathPointValue,
            supportStatuses: be.supportStatusesAtDeath,
          });
        } catch {
          void 0;
        }
        // push to pool for reuse and remove from active entities
        this.pool.push(be);
        this.entities.splice(i, 1);
      }
    }

    // tick T3 evolution effects (event horizons)
    this.tickEvolutionEffects(dt * 1000);
  }

  handleHit(index: number, damage = 1, creditOnDeath = false, weaponId?: SiegeWeaponId) {
    const e = this.entities[index];
    if (!e) return null;
    const matchup = weaponId
      ? getBugWeaponMatchup((e as any).variant as BugVariant, weaponId)
      : WeaponMatchup.Steady;
    const adjustedDamage = applyMatchupDamage(damage, matchup);
    if (matchup === WeaponMatchup.Immune) {
      return {
        defeated: false,
        matchup,
        remainingHp: (e as any).hp ?? 0,
        pointValue: 0,
        frozen: false,
        variant: (e as any).variant,
      };
    }
    if (typeof (e as any).onHit === "function") {
      const res = (e as any).onHit(adjustedDamage);
      if (res.defeated && "deathCredited" in (e as any)) {
        (e as any).deathCredited = creditOnDeath;
        // Credit direct kills immediately (DOT kills are credited in the update loop)
        this.recordWeaponKill(weaponId);
      }
      return {
        defeated: res.defeated,
        matchup,
        remainingHp: res.remainingHp,
        pointValue: res.pointValue ?? 1,
        frozen: res.frozen ?? false,
        variant: (e as any).variant,
      };
    }
    return null;
  }

  /**
   * Returns indexes of all active entities inside a cone sector aimed from
   * (cx, cy) in the given direction.
   * @param angleDeg - centre direction in degrees (0 = right, 90 = down)
   * @param arcDeg   - full opening angle in degrees
   * @param depth    - reach of the cone in pixels
   */
  coneHitTest(
    cx: number,
    cy: number,
    angleDeg: number,
    arcDeg: number,
    depth: number,
  ): number[] {
    const result: number[] = [];
    const halfArc = (arcDeg / 2) * (Math.PI / 180);
    const centreAngle = angleDeg * (Math.PI / 180);

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (isTerminalEntityState(e.state)) continue;

      const dx = e.x - cx;
      const dy = e.y - cy;
      const dist = Math.hypot(dx, dy);
      const entityRadius = Math.max((e.size ?? 12) * 0.5, 8);

      if (dist > depth + entityRadius) continue;

      // Entities very close to the origin are always hit
      if (dist < 1) {
        result.push(i);
        continue;
      }

      let diff = Math.atan2(dy, dx) - centreAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) result.push(i);
    }
    return result;
  }

  /**
   * Starting from startIndex, finds up to maxBounces additional entities
   * each within chainRadius of the previous node (BFS nearest-first).
   * Returns the extra indexes only (does not include startIndex).
   */
  chainHitTest(
    startIndex: number,
    chainRadius: number,
    maxBounces: number,
  ): number[] {
    const result: number[] = [];
    if (startIndex < 0 || startIndex >= this.entities.length) return result;

    const visited = new Set<number>([startIndex]);
    let currentIndex = startIndex;

    for (let bounce = 0; bounce < maxBounces; bounce++) {
      const current = this.entities[currentIndex] as any;
      if (!current) break;

      let bestDist = Infinity;
      let bestIndex = -1;

      for (let i = 0; i < this.entities.length; i++) {
        if (visited.has(i)) continue;
        const e = this.entities[i] as any;
        if (isTerminalEntityState(e.state)) continue;
        const dist = Math.hypot(current.x - e.x, current.y - e.y);
        if (dist <= chainRadius && dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) break;
      result.push(bestIndex);
      visited.add(bestIndex);
      currentIndex = bestIndex;
    }
    return result;
  }

  /**
   * Returns the index of the highest-HP active entity within searchRadius
   * of (cx, cy). Pass Infinity for searchRadius to search the whole canvas.
   * Returns -1 when nothing is found.
   */
  closestTargetIndex(
    cx: number,
    cy: number,
    searchRadius: number,
  ): number {
    let bestIndex = -1;
    let bestHp = -1;
    let bestDist = Infinity;
    const useRadius = Number.isFinite(searchRadius) ? searchRadius : Infinity;

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      const dist = Math.hypot(e.x - cx, e.y - cy);
      if (dist > useRadius) continue;
      const hp = e.hp ?? 1;
      if (hp > bestHp || (hp === bestHp && dist < bestDist)) {
        bestHp = hp;
        bestDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  // ── Structure management ──────────────────────────────────────────────────

  /**
   * Add a structure at canvas-local (x, y). If already at maxPlaced (3),
   * the oldest entry of that type is removed first.
   */
  addStructure(
    x: number,
    y: number,
    type: StructureId,
    forcedId?: string,
  ): string {
    const maxPlaced = 2;
    const existing = this.structures.filter((s) => s.type === type);
    if (existing.length >= maxPlaced) {
      const oldest = existing[0];
      this.structures = this.structures.filter((s) => s.id !== oldest.id);
    }
    const id =
      forcedId ??
      `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.structures.push({
      id, type, tier: WeaponTier.TIER_ONE, x, y,
      nextCaptureAt: this.elapsedMs + 1400,
      absorbing: null,
    });
    return id;
  }

  updateStructureTier(id: string, tier: WeaponTier): void {
    const structure = this.structures.find((entry) => entry.id === id);
    if (structure) {
      structure.tier = tier;
    }
  }

  removeStructure(id: string): void {
    this.structures = this.structures.filter((s) => s.id !== id);
  }

  getStructures(): Array<{ id: string; type: StructureId; tier: WeaponTier; x: number; y: number }> {
    return this.structures.map(({ id, type, tier, x, y }) => ({ id, type, tier, x, y }));
  }

  // ── Status-effect area applicators ─────────────────────────────────

  applyPoisonInRadius(cx: number, cy: number, radius: number, dps: number, durationMs: number, weaponId?: SiegeWeaponId): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius) {
        if (weaponId) {
          const matchup = getBugWeaponMatchup(bug.variant as BugVariant, weaponId);
          if (matchup === WeaponMatchup.Immune) continue;
        }
        if (typeof bug.applyPoison === "function") bug.applyPoison(dps, durationMs, weaponId);
      }
    }
  }

  applyBurnInRadius(
    cx: number,
    cy: number,
    radius: number,
    peakDps: number,
    durationMs: number,
    decayPerSecond = 3.2,
    weaponId?: SiegeWeaponId,
  ): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      const dist = Math.hypot(e.x - cx, e.y - cy);
      if (dist > radius) continue;
      if (weaponId) {
        const matchup = getBugWeaponMatchup(bug.variant as BugVariant, weaponId);
        if (matchup === WeaponMatchup.Immune) continue;
      }
      const normalized = dist / Math.max(1, radius);
      const intensity = 0.2 + 0.8 * Math.exp(-3.2 * normalized * normalized);
      if (typeof bug.applyBurn === "function") {
        bug.applyBurn(peakDps * intensity, durationMs, decayPerSecond, weaponId);
      }
    }
  }

  applyEnsnareInRadius(cx: number, cy: number, radius: number, durationMs: number, weaponId?: SiegeWeaponId): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius) {
        if (weaponId) {
          const matchup = getBugWeaponMatchup(bug.variant as BugVariant, weaponId);
          if (matchup === WeaponMatchup.Immune) continue;
        }
        if (typeof bug.applyEnsnare === "function") bug.applyEnsnare(durationMs);
      }
    }
  }

  // ── Black-hole lifecycle ─────────────────────────────────────────────

  /** Returns false when a black hole is already active (throttle duplicate fires). */
  startBlackHole(
    x: number, y: number,
    radius: number, coreRadius: number,
    durationMs: number, collapseDamage: number,
    weaponId?: SiegeWeaponId,
    eventHorizonRadius?: number,
    eventHorizonDurationMs?: number,
  ): boolean {
    if (this.blackHole?.active) return false;
    this.blackHole = {
      x, y, radius, coreRadius,
      collapseDamage,
      startedAt: this.elapsedMs,
      durationMs,
      active: true,
      weaponId,
      eventHorizonRadius,
      eventHorizonDurationMs,
    };
    return true;
  }

  getBlackHole() {
    return this.blackHole;
  }

  /** Call each tick; fires onCollapse callback once when duration expires. */
  tickBlackHole(dtMs: number, onCollapse: (x: number, y: number, radius: number) => void): void {
    if (!this.blackHole?.active) return;
    const age = this.elapsedMs - this.blackHole.startedAt;
    const {
      x,
      y,
      radius,
      coreRadius,
      collapseDamage,
      durationMs,
      weaponId,
      eventHorizonRadius,
      eventHorizonDurationMs,
    } = this.blackHole;

    // Gravity pull towards core
    for (let index = 0; index < this.entities.length; index++) {
      const bug = this.entities[index] as any;
      if (isTerminalEntityState(bug.state)) continue;
      const dx = x - bug.x;
      const dy = y - bug.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius || dist < 1) continue;
      const pull = (1 - dist / radius) * 2.5 * (dtMs / 16);
      bug.x += (dx / dist) * pull;
      bug.y += (dy / dist) * pull;
      // Core contact: instant kill tick
      if (dist <= coreRadius) {
        this.handleHit(index, bug.maxHp ?? 99, false, weaponId);
      }
    }

    // Collapse when time expires
    if (age >= durationMs) {
      const hits = this.radiusHitTest(x, y, radius);
      for (const idx of hits) this.handleHit(idx, collapseDamage, false, weaponId);
      if (eventHorizonRadius && eventHorizonDurationMs) {
        this.startEventHorizon(
          x,
          y,
          eventHorizonRadius,
          eventHorizonDurationMs,
          weaponId,
        );
      }
      onCollapse(x, y, radius);
      this.blackHole = null;
    }
  }

  // ── Chain-zap synergy: prefer unfrozen targets ──────────────────────

  chainHitTestPreferUnfrozen(startIndex: number, chainRadius: number, maxBounces: number): number[] {
    const result: number[] = [];
    if (startIndex < 0 || startIndex >= this.entities.length) return result;
    const visited = new Set<number>([startIndex]);
    let currentIndex = startIndex;
    for (let bounce = 0; bounce < maxBounces; bounce++) {
      const current = this.entities[currentIndex] as any;
      if (!current) break;
      let bestDist = Infinity;
      let bestIndex = -1;
      let bestFrozen = true;
      for (let i = 0; i < this.entities.length; i++) {
        if (visited.has(i)) continue;
        const e = this.entities[i] as any;
        if (isTerminalEntityState(e.state)) continue;
        const dist = Math.hypot(current.x - e.x, current.y - e.y);
        if (dist > chainRadius) continue;
        const now = performance.now();
        const frozen = e.slow != null && now < (e.slow?.expiresAt ?? 0);
        // Prefer unfrozen; within the same freeze category prefer closest
        if (
          bestIndex === -1 ||
          (!frozen && bestFrozen) ||
          (frozen === bestFrozen && dist < bestDist)
        ) {
          bestDist = dist;
          bestIndex = i;
          bestFrozen = frozen;
        }
      }
      if (bestIndex === -1) break;
      result.push(bestIndex);
      visited.add(bestIndex);
      currentIndex = bestIndex;
    }
    return result;
  }

  render(alpha = 1) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const ent of this.entities) {
      ent.render(ctx, alpha);
    }
  }

  // ── T3 / Evolution-era Engine methods ───────────────────────────────

  applyChargedInRadius(cx: number, cy: number, radius: number, durationMs: number): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius && typeof bug.applyCharged === "function") {
        bug.applyCharged(durationMs);
      }
    }
  }

  applyMarkedInRadius(cx: number, cy: number, radius: number, durationMs: number): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius && typeof bug.applyMarked === "function") {
        bug.applyMarked(durationMs);
      }
    }
  }

  applyUnstableInRadius(cx: number, cy: number, radius: number, durationMs: number): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius && typeof bug.applyUnstable === "function") {
        bug.applyUnstable(durationMs);
      }
    }
  }

  /** Hits all charged bugs with decaying damage (hop falloff per charged bug encountered). */
  propagateChargedNetwork(
    sourceIndex: number,
    damage: number,
    falloff: number,
    weaponId?: SiegeWeaponId,
  ): void {
    let currentDmg = damage;
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (bug.charged && currentDmg >= 1) {
        bug.hp = Math.max(0, bug.hp - Math.round(currentDmg));
        bug.lastHitTime = performance.now();
        if (bug.hp === 0) {
          bug.state = EntityState.Dying;
          bug.deathProgress = 0;
          bug.vx = 0;
          bug.vy = 0;
          bug.deathCredited = false;
          if (weaponId) bug.dotSourceWeaponId = weaponId;
        }
        currentDmg *= falloff;
      }
    }
  }

  /** Reduce target to 50% HP and spawn a second half-HP clone nearby. */
  splitBug(index: number): void {
    const e = this.entities[index] as any;
    if (!e || isTerminalEntityState(e.state)) return;
    e.hp = Math.max(1, Math.ceil(e.maxHp / 2));
    // Spawn clone from pool
    const clone = this.pool.pop() ?? new BugEntity();
    clone.x = e.x + (Math.random() - 0.5) * 40;
    clone.y = e.y + (Math.random() - 0.5) * 40;
    clone.maxHp = e.maxHp;
    clone.hp = Math.max(1, Math.ceil(e.maxHp / 2));
    clone.variant = e.variant;
    clone.state = "patrol";
    clone.deathCredited = false;
    clone.deathProgress = 0;
    clone.dotSourceWeaponId = null;
    clone.slow = null; clone.poison = null; clone.burn = null; clone.ensnare = null;
    clone.charged = null; clone.marked = null; clone.unstable = null; clone.looped = null; clone.ally = null;
    this.entities.push(clone);
  }

  /** Put a bug in ally state — it stops targeting the player base. */
  allyBug(index: number, config: AllyConversionConfig): void {
    const e = this.entities[index] as any;
    if (!e || isTerminalEntityState(e.state)) return;
    const maxActiveAllies = config.maxActiveAllies ?? DEFAULT_MAX_ACTIVE_ALLIES;
    const activeAllies = this.entities.reduce((count, entity) => {
      const bug = entity as any;
      return bug.ally && !isTerminalEntityState(bug.state) ? count + 1 : count;
    }, 0);
    if (!e.ally && activeAllies >= maxActiveAllies) {
      return;
    }
    if (typeof e.applyAlly === "function") e.applyAlly(config);
  }

  /** Leave a persistent trap zone that instantly kills unstable bugs on contact. */
  startEventHorizon(
    x: number,
    y: number,
    radius: number,
    durationMs: number,
    weaponId?: SiegeWeaponId,
  ): void {
    this.eventHorizons.push({
      x,
      y,
      radius,
      expiresAt: this.elapsedMs + durationMs,
      weaponId,
    });
  }

  /** AoE explosion centered on a burning bug — called by T3 Kernel Panic behavior. */
  triggerKernelPanicExplosion(
    index: number,
    splashRadius: number,
    damage: number,
    weaponId?: SiegeWeaponId,
  ): void {
    const src = this.entities[index] as any;
    if (!src) return;
    const { x, y } = src;
    for (let i = 0; i < this.entities.length; i++) {
      if (i === index) continue;
      const e = this.entities[i] as any;
      if (isTerminalEntityState(e.state)) continue;
      if (Math.hypot(e.x - x, e.y - y) <= splashRadius) {
        this.handleHit(i, damage, false, weaponId);
      }
    }
  }

  /** Kill all marked bugs below the given HP threshold globally. */
  triggerAutoScalerPulse(hpThreshold: number, weaponId?: SiegeWeaponId): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (isTerminalEntityState(bug.state)) continue;
      if (bug.marked && (bug.hp / (bug.maxHp || 1)) <= hpThreshold) {
        bug.hp = 0;
        bug.state = EntityState.Dying;
        bug.deathProgress = 0;
        bug.vx = 0;
        bug.vy = 0;
        bug.deathCredited = false;
        if (weaponId) bug.dotSourceWeaponId = weaponId;
      }
    }
  }

  /** Must be called each update tick to process event horizon kills. */
  private tickEvolutionEffects(_dtMs: number): void {
    void _dtMs;
    // Event horizon unstable-bug consumption
    this.eventHorizons = this.eventHorizons.filter(h => h.expiresAt > this.elapsedMs);
    for (const hz of this.eventHorizons) {
      for (let i = 0; i < this.entities.length; i++) {
        const bug = this.entities[i] as any;
        if (isTerminalEntityState(bug.state)) continue;
        if (bug.unstable && Math.hypot(bug.x - hz.x, bug.y - hz.y) <= hz.radius) {
          bug.unstable = null;
          this.handleHit(i, bug.maxHp ?? 99, false, hz.weaponId);
        }
      }
    }
  }
}

export default Engine;
