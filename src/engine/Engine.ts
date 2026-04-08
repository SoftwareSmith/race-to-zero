import type { GameConfig } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";
import { BugEntity } from "./BugEntity";
import { Entity } from "./Entity";

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

  spawnFromCounts(counts: Record<string, number>) {
    // reuse pool when possible
    this.entities = [];
    const variants = Object.keys(counts);
    for (const v of variants) {
      const n = counts[v] ?? 0;
      for (let i = 0; i < n; i++) {
        let be: BugEntity | undefined = undefined;
        if (this.pool.length > 0) {
          be = this.pool.pop()!;
          be.revive(this.width, this.height);
          be.variant = (v as any) || "low";
          be.size = (6 + Math.random() * 2) * this.config.sizeMultiplier;
        } else {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.2 + Math.random() * 0.8;
          be = new BugEntity({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (6 + Math.random() * 2) * this.config.sizeMultiplier,
            opacity: 1,
            variant: (v as any) || "low",
          } as any);
        }
        this.entities.push(be);
      }
    }
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
          targetX,
          targetY,
          config: this.config,
        });
      } else {
        (ent as any).update(dt);
      }

      // clamp inside canvas
      if (ent.x < 0) ent.x = 0;
      if (ent.y < 0) ent.y = 0;
      if (ent.x > this.width) ent.x = this.width;
      if (ent.y > this.height) ent.y = this.height;

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
      return { defeated: res.defeated, remainingHp: res.remainingHp, variant: (e as any).variant };
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
