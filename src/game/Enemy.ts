import { IEntity } from "./Entity";

export type EnemyVariant = "urgent" | "high" | "medium" | "low";

export interface EnemyOptions {
  id?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  size?: number;
  opacity?: number;
  variant?: EnemyVariant;
  delay?: number;
  duration?: number;
}

export class Enemy implements IEntity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  variant: EnemyVariant;
  delay: number;
  duration: number;
  // health & state
  hp: number;
  maxHp: number;
  state: "alive" | "dying" | "dead";
  rotation: number;
  respawnTimer?: number | null;

  constructor(opts: EnemyOptions = {}) {
    this.id = opts.id ?? `enemy:${Math.random().toString(36).slice(2, 9)}`;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? 0;
    this.size = opts.size ?? 16;
    this.opacity = opts.opacity ?? 1;
    this.variant = opts.variant ?? "low";
    this.delay = opts.delay ?? 0;
    this.duration = opts.duration ?? 8;
    this.maxHp = opts.variant === "urgent" ? 4 : opts.variant === "high" ? 3 : opts.variant === "medium" ? 2 : 1;
    this.hp = this.maxHp;
    this.state = "alive";
    this.rotation = 0;
    this.respawnTimer = null;
  }

  update(dt = 1 / 60) {
    // simple physics step: move by velocity, no forces yet
    if (this.state === "dead") return;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    // update facing based on velocity
    this.rotation = Math.atan2(this.vy, this.vx);
  }

  onHit(damage = 1) {
    if (this.state !== "alive") return { defeated: false, remainingHp: this.hp };
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) {
      // mark dead — no automatic respawn; let manager or game logic
      // decide whether to remove or recycle the entity. Stop movement.
      this.state = "dead";
      this.vx = 0;
      this.vy = 0;
      this.respawnTimer = null;
      return { defeated: true, remainingHp: 0 };
    }
    return { defeated: false, remainingHp: this.hp };
  }

  respawn(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 0.6;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.hp = this.maxHp;
    this.state = "alive";
    this.respawnTimer = null;
  }
}
