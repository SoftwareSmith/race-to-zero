import type { CombatStats } from "./Upgrades";

export interface TargetBug {
  currentHp: number;
  id: string;
  radius: number;
  x: number;
  y: number;
}

export interface WeaponHitEvent {
  amount: number;
  bugId: string;
  source: "gun" | "laser";
  x: number;
  y: number;
}

interface Projectile {
  damage: number;
  hitBugIds: Set<string>;
  radius: number;
  remainingDistance: number;
  remainingHits: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

interface BeamState {
  fromX: number;
  fromY: number;
  life: number;
  toX: number;
  toY: number;
}

interface UpdateResult {
  hitEvents: WeaponHitEvent[];
  statusMessages: string[];
}

interface UpdateOptions {
  bugs: TargetBug[];
  now: number;
  origin: { x: number; y: number };
  overwhelmed: boolean;
  realDt: number;
  simDt: number;
  stats: CombatStats;
}

function distanceSquared(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function getLineDistance(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const lineLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return (
    Math.abs(
      (end.y - start.y) * point.x -
        (end.x - start.x) * point.y +
        end.x * start.y -
        end.y * start.x,
    ) / lineLength
  );
}

export class WeaponsSystem {
  private beam: BeamState | null = null;
  private gunCooldown = 0;
  private readonly projectiles: Projectile[] = [];
  private slowdownCooldownUntil = 0;
  private slowdownUntil = 0;

  getTimeScale(now: number) {
    return this.slowdownUntil > now ? 0.5 : 1;
  }

  update({
    bugs,
    now,
    origin,
    overwhelmed,
    realDt,
    simDt,
    stats,
  }: UpdateOptions): UpdateResult {
    const hitEvents: WeaponHitEvent[] = [];
    const statusMessages: string[] = [];

    if (overwhelmed && now >= this.slowdownCooldownUntil && now >= this.slowdownUntil) {
      this.slowdownUntil = now + 4;
      this.slowdownCooldownUntil = now + 24;
      statusMessages.push(
        "Stability protocol engaged. Incoming time slowed for 4 seconds.",
      );
    }

    if (this.beam) {
      this.beam.life = Math.max(0, this.beam.life - realDt * 3);
      if (this.beam.life <= 0) {
        this.beam = null;
      }
    }

    if (stats.gunUnlocked && bugs.length > 0) {
      this.gunCooldown -= simDt;
      if (this.gunCooldown <= 0) {
        const target = [...bugs].sort(
          (left, right) =>
            distanceSquared(left, origin) - distanceSquared(right, origin),
        )[0];

        if (target) {
          const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
          this.projectiles.push({
            damage: stats.gunDamage,
            hitBugIds: new Set<string>(),
            radius: 8,
            remainingDistance: stats.gunRange,
            remainingHits: stats.gunPierce,
            vx: Math.cos(angle) * 520,
            vy: Math.sin(angle) * 520,
            x: origin.x,
            y: origin.y,
          });
          this.gunCooldown = stats.gunFireInterval;
        }
      }
    }

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      const stepDistance = Math.hypot(projectile.vx, projectile.vy) * simDt;

      projectile.x += projectile.vx * simDt;
      projectile.y += projectile.vy * simDt;
      projectile.remainingDistance -= stepDistance;

      for (const bug of bugs) {
        if (projectile.hitBugIds.has(bug.id)) {
          continue;
        }

        const distance = Math.hypot(projectile.x - bug.x, projectile.y - bug.y);
        if (distance <= bug.radius + projectile.radius) {
          projectile.hitBugIds.add(bug.id);
          projectile.remainingHits -= 1;
          hitEvents.push({
            amount: projectile.damage,
            bugId: bug.id,
            source: "gun",
            x: bug.x,
            y: bug.y,
          });
        }
      }

      if (projectile.remainingDistance <= 0 || projectile.remainingHits <= 0) {
        this.projectiles.splice(index, 1);
      }
    }

    if (stats.laserUnlocked && bugs.length > 0) {
      const target = [...bugs].sort(
        (left, right) => distanceSquared(left, origin) - distanceSquared(right, origin),
      )[0];

      if (target) {
        const beamDistance = Math.max(
          1,
          Math.hypot(target.x - origin.x, target.y - origin.y),
        );
        const beamLength = beamDistance + 80;
        const beamEnd = {
          x: origin.x + ((target.x - origin.x) / beamDistance) * beamLength,
          y: origin.y + ((target.y - origin.y) / beamDistance) * beamLength,
        };

        const impacted = [...bugs]
          .filter((bug) => getLineDistance(bug, origin, beamEnd) <= bug.radius + 10)
          .sort(
            (left, right) =>
              distanceSquared(left, origin) - distanceSquared(right, origin),
          )
          .slice(0, stats.laserPierce);

        impacted.forEach((bug) => {
          hitEvents.push({
            amount: stats.laserDps * simDt,
            bugId: bug.id,
            source: "laser",
            x: bug.x,
            y: bug.y,
          });
        });

        this.beam = {
          fromX: origin.x,
          fromY: origin.y,
          life: 1,
          toX: beamEnd.x,
          toY: beamEnd.y,
        };
      }
    }

    return { hitEvents, statusMessages };
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.beam) {
      ctx.save();
      ctx.strokeStyle = `rgba(109,255,207,${0.3 * this.beam.life})`;
      ctx.lineWidth = 5;
      ctx.shadowColor = "rgba(109,255,207,0.45)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(this.beam.fromX, this.beam.fromY);
      ctx.lineTo(this.beam.toX, this.beam.toY);
      ctx.stroke();
      ctx.restore();
    }

    this.projectiles.forEach((projectile) => {
      ctx.save();
      ctx.fillStyle = "#ffb06c";
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  reset() {
    this.beam = null;
    this.gunCooldown = 0;
    this.projectiles.length = 0;
    this.slowdownCooldownUntil = 0;
    this.slowdownUntil = 0;
  }
}