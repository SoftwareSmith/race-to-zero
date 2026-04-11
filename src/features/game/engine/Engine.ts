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
    /** original capture position for pull animation */
    pullFromX: number;
    pullFromY: number;
    /** elapsedMs when pull started */
    pullStartedAt: number;
    size: number;
    completesAt: number;
    failChance: number;
  } | null;
  /** Last fire angle in radians for turret visual rotation */
  lastFireAngle?: number;
  /** Turret aim phase: locks target while waiting to fire */
  aimPhase?: {
    targetX: number;
    targetY: number;
    angle: number;
    firesAt: number;
  } | null;
  /** Elapsed-ms timestamp when this structure was placed (for firewall expiry) */
  placedAt?: number;
  /** Elapsed-ms timestamp of next firewall damage tick */
  firewallNextDamageAt?: number;
}

export interface EngineOptions {
  width: number;
  height: number;
  config?: Partial<GameConfig>;
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: { credited: boolean; frozen: boolean; pointValue: number },
  ) => void;
  /** Called when a structure (lantern/agent/turret) kills a bug — counts toward the player kill tally */
  onStructureKill?: (x: number, y: number, variant: string) => void;
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
  /** Called when the turret fires at a bug (canvas-local coords) */
  onTurretFire?: (data: {
    structureId: string;
    srcX: number;
    srcY: number;
    targetX: number;
    targetY: number;
    angle: number;
    /** "aim" = locking on (tracer shown), "fire" = damage dealt */
    phase: "aim" | "fire";
  }) => void;
  /** Called when the tesla coil chain-zaps bugs (canvas-local coords) */
  onTeslaFire?: (data: {
    structureId: string;
    nodes: Array<{ x: number; y: number }>;
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
  onEntityDeath?: (
    x: number,
    y: number,
    variant: string,
    meta: { credited: boolean; frozen: boolean; pointValue: number },
  ) => void;
  onStructureKill?: (x: number, y: number, variant: string) => void;
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
  onTurretFire?: (data: {
    structureId: string;
    srcX: number;
    srcY: number;
    targetX: number;
    targetY: number;
    angle: number;
    phase: "aim" | "fire";
  }) => void;
  onTeslaFire?: (data: {
    structureId: string;
    nodes: Array<{ x: number; y: number }>;
  }) => void;
  private structures: StructureEntry[] = [];
  private elapsedMs = 0;

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
    this.onTurretFire = opts.onTurretFire;
    this.onTeslaFire = opts.onTeslaFire;
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
          this.onEntityDeath?.(be.x, be.y, be.variant, {
            credited: be.deathCredited,
            frozen:
              be.slow !== null && performance.now() < be.slow.expiresAt,
            pointValue: be.typeSpec?.pointValue ?? 1,
          });
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

  handleHit(index: number, damage = 1, creditOnDeath = false) {
    const e = this.entities[index];
    if (!e) return null;
    if (typeof (e as any).onHit === "function") {
      const res = (e as any).onHit(damage);
      if (res.defeated && "deathCredited" in (e as any)) {
        (e as any).deathCredited = creditOnDeath;
      }
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
    const initialDelay = type === "turret" || type === "tesla" ? 1000 : 2000;
    const placedAt = this.elapsedMs;
    this.structures.push({
      id, type, x, y,
      nextCaptureAt: this.elapsedMs + initialDelay,
      absorbing: null,
      placedAt,
      firewallNextDamageAt: this.elapsedMs + 1000,
    });
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
    // Expire firewall structures after 8 seconds
    this.structures = this.structures.filter(
      (s) => s.type !== "firewall" || (s.placedAt != null && this.elapsedMs - s.placedAt < 8000),
    );
    for (const s of this.structures) {
      if (s.type === "lantern") {
        this.tickLantern(s);
      } else if (s.type === "agent") {
        this.tickAgent(s);
      } else if (s.type === "turret") {
        this.tickTurret(s);
      } else if (s.type === "tesla") {
        this.tickTesla(s);
      } else if (s.type === "firewall") {
        this.tickFirewall(s);
      }
    }
  }

  private tickLantern(s: StructureEntry): void {
    const ATTRACT_RADIUS = 280;
    const ORBIT_SPEED = 0.65;  // tangential pixels per tick
    const PULL_PX = 0.18;      // inward pull strength

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
    const PULL_DURATION_MS = 500;

    // Phase 2: processing an already-captured bug
    if (s.absorbing) {
      // Animate bug position toward agent during pull window
      const pullElapsed = this.elapsedMs - s.absorbing.pullStartedAt;
      if (pullElapsed < PULL_DURATION_MS) {
        const t = pullElapsed / PULL_DURATION_MS;
        s.absorbing.bugX = s.absorbing.pullFromX + (s.x - s.absorbing.pullFromX) * t;
        s.absorbing.bugY = s.absorbing.pullFromY + (s.y - s.absorbing.pullFromY) * t;
        try {
          this.onAgentAbsorb?.({
            structureId: s.id,
            phase: "pulling",
            variant: s.absorbing.variant,
            bugX: s.absorbing.bugX,
            bugY: s.absorbing.bugY,
            srcX: s.x,
            srcY: s.y,
          });
        } catch { void 0; }
        return;
      }

      if (this.elapsedMs >= s.absorbing.completesAt) {
        const fail = Math.random() < s.absorbing.failChance;
        if (!fail) {
          try { this.onStructureKill?.(s.x, s.y, s.absorbing.variant); } catch { void 0; }
        }
        try {
          this.onAgentAbsorb?.({
            structureId: s.id,
            phase: fail ? "failed" : "done",
            variant: s.absorbing.variant,
            bugX: s.x,
            bugY: s.y,
            srcX: s.x,
            srcY: s.y,
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
        pullFromX: e.x,
        pullFromY: e.y,
        pullStartedAt: this.elapsedMs,
        size,
        completesAt: this.elapsedMs + PULL_DURATION_MS + processingMs,
        failChance: 0.2,
      };
      // Remove bug from simulation immediately — pull is purely visual
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
          srcX: s.x,
          srcY: s.y,
          processingMs,
        });
      } catch { void 0; }
    }
  }
  private tickTurret(s: StructureEntry): void {
    const SHOOT_RADIUS = 150;
    const SHOOT_INTERVAL_MS = 2500;
    const AIM_DURATION_MS = 500;

    // Resolve active aim phase
    if (s.aimPhase) {
      if (this.elapsedMs >= s.aimPhase.firesAt) {
        // Fire phase: deal damage
        const ap = s.aimPhase;
        s.aimPhase = null;
        s.nextCaptureAt = this.elapsedMs + SHOOT_INTERVAL_MS;
        // Find the bug closest to the locked target position (it may have moved)
        let bestDist2 = Infinity;
        let bestIdx2 = -1;
        for (let j = 0; j < this.entities.length; j++) {
          const e2 = this.entities[j] as any;
          if (e2.state === "dead" || e2.state === "dying") continue;
          const d = Math.hypot(e2.x - ap.targetX, e2.y - ap.targetY);
          if (d < bestDist2) { bestDist2 = d; bestIdx2 = j; }
        }
        const fireTarget = bestIdx2 >= 0 ? this.entities[bestIdx2] as any : null;
        if (fireTarget) {
          const angle2 = Math.atan2(fireTarget.y - s.y, fireTarget.x - s.x);
          s.lastFireAngle = angle2;
          const result = this.handleHit(bestIdx2, 1, true);
          if (result?.defeated) {
            try { this.onStructureKill?.(fireTarget.x, fireTarget.y, fireTarget.variant); } catch { void 0; }
          }
          try {
            this.onTurretFire?.({
              structureId: s.id,
              srcX: s.x, srcY: s.y,
              targetX: fireTarget.x, targetY: fireTarget.y,
              angle: angle2, phase: "fire",
            });
          } catch { void 0; }
        }
      }
      return;
    }

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

    // Start aim phase
    s.aimPhase = { targetX: target.x, targetY: target.y, angle, firesAt: this.elapsedMs + AIM_DURATION_MS };

    // Notify for aim VFX
    try {
      this.onTurretFire?.({
        structureId: s.id,
        srcX: s.x, srcY: s.y,
        targetX: target.x, targetY: target.y,
        angle, phase: "aim",
      });
    } catch { void 0; }
  }
  private tickTesla(s: StructureEntry): void {
    const SHOOT_RADIUS = 120;
    const SHOOT_INTERVAL_MS = 2500;
    const MAX_HOPS = 3;

    if (this.elapsedMs < s.nextCaptureAt) return;

    // Gather alive bugs within radius
    const candidates: Array<{ idx: number; dist: number }> = [];
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
      const dist = Math.hypot(e.x - s.x, e.y - s.y);
      if (dist <= SHOOT_RADIUS) candidates.push({ idx: i, dist });
    }
    if (candidates.length === 0) return;

    // Sort by distance, take up to MAX_HOPS
    candidates.sort((a, b) => a.dist - b.dist);
    const targets = candidates.slice(0, MAX_HOPS);

    s.nextCaptureAt = this.elapsedMs + SHOOT_INTERVAL_MS;

    // Build chain nodes: structure origin → each bug
    const nodes: Array<{ x: number; y: number }> = [{ x: s.x, y: s.y }];
    for (const { idx } of targets) {
      const e = this.entities[idx] as any;
      nodes.push({ x: e.x, y: e.y });
      const result = this.handleHit(idx, 1, true);
      if (result?.defeated) {
        try { this.onStructureKill?.(e.x, e.y, e.variant); } catch { void 0; }
      }
    }

    try { this.onTeslaFire?.({ structureId: s.id, nodes }); } catch { void 0; }
  }

  private tickFirewall(s: StructureEntry): void {
    const WALL_HALF_WIDTH = 20;
    const DAMAGE_INTERVAL_MS = 800;

    if (this.elapsedMs < (s.firewallNextDamageAt ?? 0)) return;
    s.firewallNextDamageAt = this.elapsedMs + DAMAGE_INTERVAL_MS;

    // Damage all bugs whose x coordinate falls within the firewall strip
    const dead: number[] = [];
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i] as any;
      if (e.state === "dead" || e.state === "dying") continue;
      if (Math.abs(e.x - s.x) <= WALL_HALF_WIDTH) {
        const result = this.handleHit(i, 1, true);
        if (result?.defeated) {
          dead.push(i);
          try { this.onStructureKill?.(e.x, e.y, e.variant); } catch { void 0; }
        }
      }
    }
  }

  // ── Status-effect area applicators ─────────────────────────────────

  applyPoisonInRadius(cx: number, cy: number, radius: number, dps: number, durationMs: number): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (bug.state === "dead" || bug.state === "dying") continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius) {
        if (typeof bug.applyPoison === "function") bug.applyPoison(dps, durationMs);
      }
    }
  }

  applyEnsnareInRadius(cx: number, cy: number, radius: number, durationMs: number): void {
    for (const e of this.entities) {
      const bug = e as any;
      if (bug.state === "dead" || bug.state === "dying") continue;
      if (Math.hypot(e.x - cx, e.y - cy) <= radius) {
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
  ): boolean {
    if (this.blackHole?.active) return false;
    this.blackHole = {
      x, y, radius, coreRadius,
      collapseDamage,
      startedAt: this.elapsedMs,
      durationMs,
      active: true,
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
    const { x, y, radius, coreRadius, collapseDamage, durationMs } = this.blackHole;

    // Gravity pull towards core
    for (let index = 0; index < this.entities.length; index++) {
      const bug = this.entities[index] as any;
      if (bug.state === "dead" || bug.state === "dying") continue;
      const dx = x - bug.x;
      const dy = y - bug.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius || dist < 1) continue;
      const pull = (1 - dist / radius) * 2.5 * (dtMs / 16);
      bug.x += (dx / dist) * pull;
      bug.y += (dy / dist) * pull;
      // Core contact: instant kill tick
      if (dist <= coreRadius) {
        this.handleHit(index, bug.maxHp ?? 99);
      }
    }

    // Collapse when time expires
    if (age >= durationMs) {
      const hits = this.radiusHitTest(x, y, radius);
      for (const idx of hits) this.handleHit(idx, collapseDamage);
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
        if (e.state === "dead" || e.state === "dying") continue;
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
}

export default Engine;
