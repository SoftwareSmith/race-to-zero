import type { AllyConversionConfig } from "@game/weapons/runtime/types";

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

export interface BugStatusApplicationTarget {
  ally: AllyStatus | null;
  allyContactReadyAt: number;
  burn: BurnStatus | null;
  charged: TimedStatus | null;
  dotSourceWeaponId: string | null;
  ensnare: EnsnareStatus | null;
  fleeTimer: number | null;
  looped: DotStatus | null;
  marked: TimedStatus | null;
  poison: DotStatus | null;
  slow: FreezeStatus | null;
  state: string;
  unstable: TimedStatus | null;
  vx: number;
  vy: number;
}

export function applyFreezeToBug(
  bug: BugStatusApplicationTarget,
  multiplier: number,
  durationMs: number,
  now: number,
) {
  if (bug.slow && now < bug.slow.expiresAt) {
    bug.slow.expiresAt += durationMs;
  } else {
    bug.slow = { multiplier, expiresAt: now + durationMs };
  }
}

export function applyPoisonToBug(
  bug: BugStatusApplicationTarget,
  dps: number,
  durationMs: number,
  now: number,
  sourceWeaponId?: string,
) {
  if (bug.poison && now < bug.poison.expiresAt) {
    bug.poison.expiresAt += durationMs;
    bug.poison.sourceWeaponId = sourceWeaponId ?? bug.poison.sourceWeaponId;
  } else {
    bug.poison = {
      dps,
      expiresAt: now + durationMs,
      accumulatedDmg: 0,
      sourceWeaponId,
    };
  }

  if (sourceWeaponId) {
    bug.dotSourceWeaponId = sourceWeaponId;
  }
}

export function applyBurnToBug(
  bug: BugStatusApplicationTarget,
  dps: number,
  durationMs: number,
  now: number,
  decayPerSecond = 3.2,
  sourceWeaponId?: string,
) {
  if (bug.burn && now < bug.burn.expiresAt) {
    bug.burn.dps = Math.max(bug.burn.dps, dps);
    bug.burn.decayPerSecond = Math.max(bug.burn.decayPerSecond, decayPerSecond);
    bug.burn.expiresAt = Math.max(bug.burn.expiresAt, now + durationMs);
    bug.burn.sourceWeaponId = sourceWeaponId ?? bug.burn.sourceWeaponId;
  } else {
    bug.burn = {
      dps,
      expiresAt: now + durationMs,
      accumulatedDmg: 0,
      decayPerSecond,
      sourceWeaponId,
    };
  }

  if (sourceWeaponId) {
    bug.dotSourceWeaponId = sourceWeaponId;
  }
}

function applyTimedStatus(
  current: TimedStatus | null,
  durationMs: number,
  now: number,
): TimedStatus {
  if (current && now < current.expiresAt) {
    current.expiresAt += durationMs;
    return current;
  }

  return { expiresAt: now + durationMs };
}

export function applyChargedToBug(
  bug: BugStatusApplicationTarget,
  durationMs: number,
  now: number,
) {
  bug.charged = applyTimedStatus(bug.charged, durationMs, now);
}

export function applyMarkedToBug(
  bug: BugStatusApplicationTarget,
  durationMs: number,
  now: number,
) {
  bug.marked = applyTimedStatus(bug.marked, durationMs, now);
}

export function applyUnstableToBug(
  bug: BugStatusApplicationTarget,
  durationMs: number,
  now: number,
) {
  bug.unstable = applyTimedStatus(bug.unstable, durationMs, now);
}

export function applyLoopedToBug(
  bug: BugStatusApplicationTarget,
  dps: number,
  durationMs: number,
  now: number,
  sourceWeaponId?: string,
) {
  if (bug.looped && now < bug.looped.expiresAt) {
    bug.looped.dps = Math.max(bug.looped.dps, dps);
    bug.looped.expiresAt = Math.max(bug.looped.expiresAt, now + durationMs);
  } else {
    bug.looped = { dps, expiresAt: now + durationMs, accumulatedDmg: 0 };
  }

  if (sourceWeaponId) {
    bug.dotSourceWeaponId = sourceWeaponId;
  }
}

export function applyAllyToBug(
  bug: BugStatusApplicationTarget,
  config: AllyConversionConfig,
  now: number,
) {
  bug.ally = {
    expiresAt: now + config.durationMs,
    expireBurstDamage: config.expireBurstDamage ?? 0,
    expireBurstRadius: config.expireBurstRadius ?? 0,
    interceptForce: config.interceptForce ?? 2.5,
  };
  bug.allyContactReadyAt = now + 180;
  bug.dotSourceWeaponId = null;
  bug.state = "patrol";
  bug.fleeTimer = null;
}

export function applyEnsnareToBug(
  bug: BugStatusApplicationTarget,
  durationMs: number,
  now: number,
) {
  bug.ensnare = { expiresAt: now + durationMs, canInstakill: true };
  bug.vx = 0;
  bug.vy = 0;
  bug.state = "patrol";
  bug.fleeTimer = null;
}