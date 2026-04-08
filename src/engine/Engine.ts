import type { GameConfig } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";
import { BugEntity } from "./BugEntity";
import { Entity } from "./Entity";
import { getBugVariantMaxHp } from "../constants/bugs";

export interface EngineOptions {
  width: number;
  height: number;
  config?: Partial<GameConfig>;
  onEntityDeath?: (x: number, y: number, variant: string) => void;
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

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;
    this.width = opts.width ?? canvas.clientWidth;
    this.height = opts.height ?? canvas.clientHeight;
    this.config = { ...DEFAULT_GAME_CONFIG, ...(opts.config ?? {}) };
    this.onEntityDeath = opts.onEntityDeath;
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

      // keep entities inside the canvas without pinning them to the boundary.
      if (ent.x < 0) {
        ent.x = 0;
        if ((ent as any).vx < 0) {
          (ent as any).vx = Math.abs((ent as any).vx) * 0.82;
        }
      }
      if (ent.y < 0) {
        ent.y = 0;
        if ((ent as any).vy < 0) {
          (ent as any).vy = Math.abs((ent as any).vy) * 0.82;
        }
      }
      if (ent.x > this.width) {
        ent.x = this.width;
        if ((ent as any).vx > 0) {
          (ent as any).vx = -Math.abs((ent as any).vx) * 0.82;
        }
      }
      if (ent.y > this.height) {
        ent.y = this.height;
        if ((ent as any).vy > 0) {
          (ent as any).vy = -Math.abs((ent as any).vy) * 0.82;
        }
      }

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
  }

  handleHit(index: number, damage = 1) {
    const e = this.entities[index];
    if (!e) return null;
    if (typeof (e as any).onHit === "function") {
      const res = (e as any).onHit(damage);
      return {
        defeated: res.defeated,
        remainingHp: res.remainingHp,
        variant: (e as any).variant,
      };
    }
    return null;
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
