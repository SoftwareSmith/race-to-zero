import { Entity } from "./Entity";
import type { Vec2 } from "./types";
import { DEFAULT_GAME_CONFIG } from "./types";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class BugEntity extends Entity {
  seed: number;
  phase: number;
  // simple internal wander angle
  wanderAngle: number;
  // health and lifecycle
  hp: number;
  maxHp: number;
  // richer state-machine for behaviors
  state: "patrol" | "chase" | "flee" | "alive" | "dying" | "dead";
  deathProgress: number;
  deathDuration: number;
  respawnTimer: number | null;
  fleeTimer: number | null;

  constructor(opts: Partial<Entity> & { id?: string } = {}) {
    super(opts as any);
    this.seed = Math.random();
    this.phase = Math.random() * Math.PI * 2;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.maxHp = 1;
    this.hp = this.maxHp;
    this.state = "patrol";
    this.deathProgress = 0;
    this.deathDuration = 0.6;
    this.respawnTimer = null;
    this.fleeTimer = null;
  }

  update(dt: number, ctx: { getNeighbors: (e: BugEntity, r: number) => BugEntity[]; targetX?: number | null; targetY?: number | null; config?: typeof DEFAULT_GAME_CONFIG }) {
    const config = ctx.config ?? DEFAULT_GAME_CONFIG;

    // dying / dead handling
    if (this.state === "dying") {
      this.deathProgress += dt / this.deathDuration;
      this.opacity = Math.max(0, 1 - this.deathProgress);
      this.size *= Math.max(0.3, 1 - this.deathProgress * 0.9);
      if (this.deathProgress >= 1) {
        this.state = "dead";
        this.respawnTimer = 1.2 + Math.random() * 2.2;
      }
      return;
    }

    if (this.state === "dead") {
      if (this.respawnTimer != null) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.revive(800, 600);
        }
      }
      return;
    }

    // neighbors separation (soft nudge to avoid overlaps)
    const neighbors = ctx.getNeighbors(this, config.separationRadius);
    let sepX = 0;
    let sepY = 0;
    for (const n of neighbors) {
      const dx = this.x - n.x;
      const dy = this.y - n.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 0) continue;
      const d = Math.sqrt(d2);
      const inv = 1 / d;
      sepX += (dx * inv) / d;
      sepY += (dy * inv) / d;
    }
    sepX *= config.separationStrength;
    sepY *= config.separationStrength;

    // simple wander to generate a patrol heading
    const jitter = 0.9;
    this.wanderAngle += (Math.random() - 0.5) * jitter * dt * 6;

    // decide behavior state transitions (chase if target present and close)
    let targetDist = Infinity;
    let targetAngle = 0;
    if (typeof ctx.targetX === "number" && typeof ctx.targetY === "number") {
      const dx = ctx.targetX - this.x;
      const dy = ctx.targetY - this.y;
      targetDist = Math.hypot(dx, dy) || Infinity;
      targetAngle = Math.atan2(dy, dx);
    }

    if (this.fleeTimer != null && this.fleeTimer > 0) {
      this.state = "flee";
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) {
        this.fleeTimer = null;
        this.state = "patrol";
      }
    } else if (targetDist < config.chaseRadius) {
      this.state = "chase";
    } else {
      this.state = this.state === "chase" ? "patrol" : this.state || "patrol";
    }

    // desired heading selection
    let desired = this.heading;
    if (this.state === "chase") {
      desired = targetAngle;
    } else if (this.state === "flee") {
      // flee away from target if possible, otherwise pick random
      if (isFinite(targetDist)) {
        desired = targetAngle + Math.PI;
      } else {
        desired = this.wanderAngle;
      }
    } else {
      // patrol: slowly wander
      desired = this.wanderAngle;
    }

    // heading smoothing (limit turning rate) to create crawling feeling
    const diff = ((desired - this.heading + Math.PI) % (Math.PI * 2)) - Math.PI;
    const maxTurn = 2.4 * dt; // radians per frame (small for slow turning)
    this.heading += clamp(diff, -maxTurn, maxTurn);

    // forward speed is mostly aligned to heading; add slight bobbing for gait
    const bob = Math.sin((Date.now() / 1000) * 6 + this.phase) * 0.06 + 0.94;
    const forwardSpeed = config.baseSpeed * bob;
    this.vx = Math.cos(this.heading) * forwardSpeed;
    this.vy = Math.sin(this.heading) * forwardSpeed;

    // apply separation nudges directly to velocity for short avoidance
    this.vx += sepX * 0.6;
    this.vy += sepY * 0.6;

    // small lateral sway for organic look
    const sway = Math.sin((Date.now() / 1000) * 2 + this.phase) * 0.06;
    this.vx += -Math.sin(this.heading) * sway;
    this.vy += Math.cos(this.heading) * sway;

    // integrate position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // keep on canvas by clamping/bounce — engine may override
    if (this.x < 0) {
      this.x = 0;
      this.vx = Math.abs(this.vx) * 0.5;
    }
    if (this.y < 0) {
      this.y = 0;
      this.vy = Math.abs(this.vy) * 0.5;
    }
  }

  onHit(damage = 1) {
    if (this.state === "dying" || this.state === "dead") return { defeated: false, remainingHp: this.hp };
    // if in patrol/chase/flee treat hit similarly
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) {
      this.state = "dying";
      this.deathProgress = 0;
      // stop movement
      this.vx = 0;
      this.vy = 0;
      return { defeated: true, remainingHp: 0 };
    }
    // non-lethal hit: briefly flee
    this.state = "flee";
    this.fleeTimer = 0.9 + Math.random() * 1.2;
    return { defeated: false, remainingHp: this.hp };
  }

  revive(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.0 + Math.random() * 0.8;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.hp = this.maxHp;
    this.state = "patrol";
    this.deathProgress = 0;
    this.opacity = 1;
  }
}
