import type { GameConfig } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";
import { BugEntity } from "./BugEntity";
import { Entity } from "./Entity";
import { getBugVariantMaxHp } from "../../../constants/bugs";
import type { StructureId } from "../types";

interface StructureEntry {
  id: string;
  type: StructureId;
  x: number;
  y: number;
  /** engine ticks until next agent capture or turret shot */
  nextCaptureAt: number;
  /** When the agent is processing a captured bug, holds capture state */
  absorbing: {
    variant: string;
    bugX: number;
    bugY: number;
    size: number;
    completesAt: number;
    failChance: number;
  } | null;
  /** Last fire angle in radians for turret visual rotation */
  lastFireAngle?: number;
}

export interface EngineOptions {
  width: number;
  height: number;
  config?: Partial<GameConfig>;
  onEntityDeath?: (x: number, y: number, variant: string) => void;
  /** Called when a structure (lantern/agent/turret) kills a bug — counts toward the player kill tally */
  onStructureKill?: (x: number, y: number, variant: string) => void;
  /** Called when the agent starts/finishes/fails absorbing a bug */
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    processingMs?: number;
  }) => void;
  /** Called when the turret fires at a bug (canvas-local coords) */
  onTurretFire?: (data: {
    structureId: string;
    srcX: number;
    srcY: number;
    targetX: number;
    targetY: number;
    angle: number;
  }) => void;
}

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  entities: Entity[] = [];
  config: GameConfig;
  pool: BugEntity[] = [];
  onEntityDeath?: (x: number, y: number, variant: string) => void;
  onStructureKill?: (x: number, y: number, variant: string) => void;
  onAgentAbsorb?: (data: {
    structureId: string;
    phase: "absorbing" | "done" | "failed";
    variant: string;
    bugX: number;
    bugY: number;
    processingMs?: number;
  }) => void;
  onTurretFire?: (data: {
    structureId: string;
    srcX: number;
    srcY: number;
    targetX: number;
    targetY: number;
    angle: number;
  }) => void;
  private structures: StructureEntry[] = [];
  private elapsedMs = 0;

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
    this.onTurretFire = opts.onTurretFire;
  }

  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  spawnFromCounts(
    counts: Record<string, number>,
    spawnZones: Array<{
      height: number;
      left: number;
      top: number;
      width: number;
    }> = [],
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
      if (!usableZones.length || Math.random() > 0.84 || totalZoneArea <= 0) {
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

  // hit-test in canvas-local coordinates (x,y) -> returns nearest entity index within radius
  hitTest(x: number, y: number) {
    let best: { index: number; distance: number } | null = null;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
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
      if (e.state === "dead" || e.state === "dying") continue;

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
      if (e.state === "dead" || e.state === "dying") continue;

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

  getNeighbors(e: Entity, radius: number) {
    const r2 = radius * radius;
    const out: Entity[] = [];
    for (const o of this.entities) {
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

    for (const entity of this.entities) {
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
    for (const ent of this.entities) {
      ent.beginStep();
    }

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
      if ((ent as any).state === "dead") {
        const be = ent as any as BugEntity;
        try {
          this.onEntityDeath?.(be.x, be.y, be.variant);
        } catch {
          void 0;
        }
        // push to pool for reuse and remove from active entities
        this.pool.push(be);
        this.entities.splice(i, 1);
      }
    }

    // tick structures AFTER entity updates so position fields reflect the current frame
    this.tickStructures(dt * 1000);
  }

  handleHit(index: number, damage = 1) {
    const e = this.entities[index];
    if (!e) return null;
    if (typeof (e as any).onHit === "function") {
      const res = (e as any).onHit(damage);
      return {
        defeated: res.defeated,
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
      if (e.state === "dead" || e.state === "dying") continue;

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
        if (e.state === "dead" || e.state === "dying") continue;
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
      if (e.state === "dead" || e.state === "dying") continue;
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
    const MAX = 3;
    const existing = this.structures.filter((s) => s.type === type);
    if (existing.length >= MAX) {
      const oldest = existing[0];
      this.structures = this.structures.filter((s) => s.id !== oldest.id);
    }
    const id =
      forcedId ??
      `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const initialDelay = type === "turret" ? 1000 : 2000;
    this.structures.push({ id, type, x, y, nextCaptureAt: this.elapsedMs + initialDelay, absorbing: null });
    return id;
  }

  removeStructure(id: string): void {
    this.structures = this.structures.filter((s) => s.id !== id);
  }

  getStructures(): Array<{ id: string; type: StructureId; x: number; y: number }> {
    return this.structures.map(({ id, type, x, y }) => ({ id, type, x, y }));
  }

  private tickStructures(dtMs: number): void {
    this.elapsedMs += dtMs;
    for (const s of this.structures) {
      if (s.type === "lantern") {
        this.tickLantern(s);
      } else if (s.type === "agent") {
        this.tickAgent(s);
      } else if (s.type === "turret") {
        this.tickTurret(s);
      }
    }
  }

  private tickLantern(s: StructureEntry): void {
    const ATTRACT_RADIUS = 280;
    const ORBIT_SPEED = 1.2;  // tangential pixels per tick
    const PULL_PX = 0.6;      // inward pull strength

    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
      const dx = s.x - e.x;
      const dy = s.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > ATTRACT_RADIUS || dist < 1) continue;

      // Tangential component (left-turn orbit)
      const tx = (-dy / dist) * ORBIT_SPEED;
      const ty = (dx / dist) * ORBIT_SPEED;
      // Inward radial component (diminishing toward edge)
      const inwardFactor = (1 - dist / ATTRACT_RADIUS) * PULL_PX;
      const rx = (dx / dist) * inwardFactor;
      const ry = (dy / dist) * inwardFactor;

      e.x += tx + rx;
      e.y += ty + ry;
    }
  }

  private tickAgent(s: StructureEntry): void {
    const CAPTURE_RADIUS = 80;

    // Phase 2: processing an already-captured bug
    if (s.absorbing) {
      if (this.elapsedMs >= s.absorbing.completesAt) {
        const fail = Math.random() < s.absorbing.failChance;
        if (!fail) {
          try { this.onStructureKill?.(s.absorbing.bugX, s.absorbing.bugY, s.absorbing.variant); } catch { void 0; }
        }
        try {
          this.onAgentAbsorb?.({
            structureId: s.id,
            phase: fail ? "failed" : "done",
            variant: s.absorbing.variant,
            bugX: s.absorbing.bugX,
            bugY: s.absorbing.bugY,
          });
        } catch { void 0; }
        s.absorbing = null;
        s.nextCaptureAt = this.elapsedMs + 2000;
      }
      return;
    }

    if (this.elapsedMs < s.nextCaptureAt) return;

    // Phase 1: find and immediately capture nearest bug in range
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
      const dist = Math.hypot(e.x - s.x, e.y - s.y);
      if (dist <= CAPTURE_RADIUS && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const e = this.entities[bestIdx] as any;
      const size = e.size ?? 12;
      const processingMs = Math.round(800 + size * 80);
      s.absorbing = {
        variant: e.variant,
        bugX: e.x,
        bugY: e.y,
        size,
        completesAt: this.elapsedMs + processingMs,
        failChance: 0.2,
      };
      // Remove bug from simulation immediately
      const be = e as BugEntity;
      this.pool.push(be);
      this.entities.splice(bestIdx, 1);
      try {
        this.onAgentAbsorb?.({
          structureId: s.id,
          phase: "absorbing",
          variant: e.variant,
          bugX: e.x,
          bugY: e.y,
          processingMs,
        });
      } catch { void 0; }
    }
  }
  private tickTurret(s: StructureEntry): void {
    const SHOOT_RADIUS = 150;
    const SHOOT_INTERVAL_MS = 2000;

    if (this.elapsedMs < s.nextCaptureAt) return;

    // Find nearest alive bug in range
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
      const dist = Math.hypot(e.x - s.x, e.y - s.y);
      if (dist <= SHOOT_RADIUS && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) return;

    const target = this.entities[bestIdx] as any;
    const angle = Math.atan2(target.y - s.y, target.x - s.x);
    s.lastFireAngle = angle;
    s.nextCaptureAt = this.elapsedMs + SHOOT_INTERVAL_MS;

    // Deal damage
    const result = this.handleHit(bestIdx, 1);
    if (result?.defeated) {
      try { this.onStructureKill?.(target.x, target.y, target.variant); } catch { void 0; }
    }

    // Notify for visual effect
    try {
      this.onTurretFire?.({
        structureId: s.id,
        srcX: s.x,
        srcY: s.y,
        targetX: target.x,
        targetY: target.y,
        angle,
      });
    } catch { void 0; }
  }
  render(alpha = 1) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const ent of this.entities) {
      ent.render(ctx, alpha);
    }
  }
}

export default Engine;
