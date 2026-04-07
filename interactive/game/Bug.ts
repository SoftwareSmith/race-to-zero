import { drawBugSprite } from "../../src/utils/bugSprite";

export type BugType = "http400" | "nullPointer" | "uiBug" | "zeroDay";

export type DamageSource = "click" | "gun" | "laser";

export interface BugSpawnConfig {
  id: string;
  level: number;
  maxHp: number;
  radius: number;
  speed: number;
  type: BugType;
  x: number;
  y: number;
}

export interface BugBounds {
  height: number;
  width: number;
}

export interface BugUpdateEvent {}

interface DamageResult {
  appliedDamage: number;
  immune: boolean;
  killed: boolean;
}

function getBugColor(_type: BugType, isElite: boolean) {
  return isElite ? "rgba(252,165,165,0.72)" : "rgba(252,165,165,0.52)";
}

export class Bug {
  readonly id: string;
  readonly level: number;
  readonly type: BugType;

  private dashCooldown = 0;
  private readonly color: string;
  private hp: number;
  private readonly maxHp: number;
  readonly radius: number;
  private readonly speed: number;
  private teleportCooldown = 2.2;
  private velocityX: number;
  private velocityY: number;
  x: number;
  y: number;

  constructor(config: BugSpawnConfig) {
    this.id = config.id;
    this.type = config.type;
    this.level = config.level;
    this.x = config.x;
    this.y = config.y;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.radius = config.radius;
    this.speed = config.speed;
    this.color = getBugColor(config.type, config.level >= 4);

    const angle = Math.random() * Math.PI * 2;
    this.velocityX = Math.cos(angle) * this.speed;
    this.velocityY = Math.sin(angle) * this.speed;
  }

  get currentHp() {
    return this.hp;
  }

  get threatScore() {
    return this.hp + this.radius * 0.35 + this.level;
  }

  containsPoint(x: number, y: number) {
    return Math.hypot(this.x - x, this.y - y) <= this.radius;
  }

  hit(amount: number, source: DamageSource): DamageResult {
    void source;
    const nextHp = Math.max(0, this.hp - amount);
    const appliedDamage = this.hp - nextHp;
    this.hp = nextHp;

    return {
      appliedDamage,
      immune: false,
      killed: this.hp <= 0,
    };
  }

  update(dt: number, bounds: BugBounds): BugUpdateEvent[] {
    const events: BugUpdateEvent[] = [];

    if (this.type === "http400") {
      this.dashCooldown -= dt;
      if (this.dashCooldown <= 0) {
        this.dashCooldown = 1.6;
        this.velocityX *= 1.18;
        this.velocityY *= 1.18;
      }
    }

    if (this.type === "zeroDay") {
      this.velocityX += Math.sin(this.y * 0.012) * dt * 8;
      this.velocityY += Math.cos(this.x * 0.014) * dt * 8;
    }

    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    if (this.x <= this.radius || this.x >= bounds.width - this.radius) {
      this.velocityX *= -1;
      this.x = Math.max(this.radius, Math.min(bounds.width - this.radius, this.x));
    }

    if (this.y <= this.radius || this.y >= bounds.height - this.radius) {
      this.velocityY *= -1;
      this.y = Math.max(this.radius, Math.min(bounds.height - this.radius, this.y));
    }

    if (this.type === "nullPointer") {
      this.teleportCooldown -= dt;
      if (this.teleportCooldown <= 0) {
        this.teleportCooldown = 2 + Math.random() * 1.1;
        this.x = this.radius + 10 + Math.random() * (bounds.width - this.radius * 2 - 20);
        this.y = this.radius + 10 + Math.random() * (bounds.height - this.radius * 2 - 20);
      }
    }

    return events;
  }

  render(ctx: CanvasRenderingContext2D, now: number) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const pulse = 1 + Math.sin(now * 2.4 + this.x * 0.02) * 0.035;
    ctx.scale(pulse, pulse);

    drawBugSprite(ctx, {
      color: this.color,
      opacity: this.level >= 4 ? 0.82 : 0.62,
      rotation: Math.sin(now * 2.2 + this.level) * 0.18,
      size: this.radius * 1.8,
      x: 0,
      y: 0,
    });

    ctx.restore();
  }
}