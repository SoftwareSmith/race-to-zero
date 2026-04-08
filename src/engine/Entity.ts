import type { Vec2 } from "./types";
import { drawBugSprite } from "../utils/bugSprite";

export type Variant = "low" | "medium" | "high" | "urgent";

export abstract class Entity {
  id: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  heading: number; // radians
  size: number;
  opacity: number;
  variant: Variant;

  constructor(opts: Partial<Entity> & { id?: string } = {}) {
    this.id = opts.id ?? `ent:${Math.random().toString(36).slice(2, 9)}`;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.heading = opts.heading ?? 0;
    this.size = opts.size ?? 6;
    this.opacity = opts.opacity ?? 1;
    this.variant = (opts.variant as Variant) ?? "low";
  }

  abstract update(dt: number, ctx: any): void;

  render(ctx2d: CanvasRenderingContext2D, alpha = 1) {
    const renderX = this.prevX * (1 - alpha) + this.x * alpha;
    const renderY = this.prevY * (1 - alpha) + this.y * alpha;
    drawBugSprite(ctx2d, {
      x: renderX,
      y: renderY,
      size: this.size,
      rotation: this.heading,
      opacity: this.opacity,
      variant: this.variant,
    });
  }

  beginStep() {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
