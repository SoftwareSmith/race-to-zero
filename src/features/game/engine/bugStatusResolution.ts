import { clearExpiredStatus, tickBurnStatus, tickDotStatus } from "./bugStatusRuntime";
import { isTerminalEntityState } from "../types";

interface FreezeStatus {
  multiplier: number;
  expiresAt: number;
}

interface DotStatus {
  dps: number;
  expiresAt: number;
  accumulatedDmg: number;
  sourceWeaponId?: string;
}

interface BurnStatus extends DotStatus {
  decayPerSecond: number;
}

interface TimedStatus {
  expiresAt: number;
}

interface EnsnareStatus {
  expiresAt: number;
  canInstakill: boolean;
}

interface AllyStatus {
  expiresAt: number;
  expireBurstDamage: number;
  expireBurstRadius: number;
  interceptForce: number;
}

export interface BugStatusResolutionTarget {
  ally: AllyStatus | null;
  baseSize: number;
  burn: BurnStatus | null;
  charged: TimedStatus | null;
  ensnare: EnsnareStatus | null;
  fleeTimer: number | null;
  looped: DotStatus | null;
  marked: TimedStatus | null;
  movementMood: string;
  opacity: number;
  poison: DotStatus | null;
  size: number;
  slow: FreezeStatus | null;
  state: string;
  unstable: TimedStatus | null;
  vx: number;
  vy: number;
}

export interface BugStatusResolutionBurstTarget {
  fleeTimer: number | null;
  state: string;
}

interface ResolveBugStatusRuntimeOptions<TTarget extends BugStatusResolutionBurstTarget> {
  bug: BugStatusResolutionTarget;
  dt: number;
  now: number;
  separationRadius: number;
  getExpireBurstTargets: (radius: number) => TTarget[];
  getTargetDistance: (target: TTarget) => number;
  onBurstHit: (target: TTarget, damage: number) => void;
  onSelfDamage: (damage: number, finisherStatus: "poison" | "burn" | "looped") => void;
}

export function resolveBugStatusRuntime<TTarget extends BugStatusResolutionBurstTarget>({
  bug,
  dt,
  now,
  separationRadius,
  getExpireBurstTargets,
  getTargetDistance,
  onBurstHit,
  onSelfDamage,
}: ResolveBugStatusRuntimeOptions<TTarget>) {
  const expiredAlly = bug.ally !== null && now >= bug.ally.expiresAt ? bug.ally : null;

  bug.slow = clearExpiredStatus(bug.slow, now);
  bug.ensnare = clearExpiredStatus(bug.ensnare, now);
  bug.poison = clearExpiredStatus(bug.poison, now);
  bug.burn = clearExpiredStatus(bug.burn, now);
  bug.charged = clearExpiredStatus(bug.charged, now);
  bug.marked = clearExpiredStatus(bug.marked, now);
  bug.unstable = clearExpiredStatus(bug.unstable, now);
  bug.looped = clearExpiredStatus(bug.looped, now);

  if (expiredAlly) {
    const expireBurstRadius = expiredAlly.expireBurstRadius;
    const expireBurstDamage = expiredAlly.expireBurstDamage;
    if (expireBurstRadius > 0 && expireBurstDamage > 0) {
      const burstTargets = getExpireBurstTargets(
        Math.max(expireBurstRadius, separationRadius * 2),
      );

      for (const hostile of burstTargets) {
        if (getTargetDistance(hostile) > expireBurstRadius) {
          continue;
        }

        onBurstHit(hostile, expireBurstDamage);
        hostile.state = "flee";
        hostile.fleeTimer = Math.max(hostile.fleeTimer ?? 0, 0.32);
      }
    }

    bug.ally = null;
    bug.state = "flee";
    bug.fleeTimer = 0.36;
  }

  if (!isTerminalEntityState(bug.state as any)) {
    const poisonTick = tickDotStatus(bug.poison, dt);
    bug.poison = poisonTick.status;
    if (poisonTick.damage > 0) {
      onSelfDamage(poisonTick.damage, "poison");
    }

    const burnTick = tickBurnStatus(bug.burn, dt);
    bug.burn = burnTick.status;
    if (burnTick.damage > 0) {
      onSelfDamage(burnTick.damage, "burn");
    }

    const loopedTick = tickDotStatus(bug.looped, dt);
    bug.looped = loopedTick.status;
    if (loopedTick.damage > 0) {
      onSelfDamage(loopedTick.damage, "looped");
    }
  }

  const movementLocked = bug.ensnare != null && now < bug.ensnare.expiresAt;
  if (movementLocked) {
    bug.vx = 0;
    bug.vy = 0;
    bug.movementMood = "patrol";
    bug.opacity = 1;
    bug.size = bug.baseSize;
  }

  return { movementLocked };
}