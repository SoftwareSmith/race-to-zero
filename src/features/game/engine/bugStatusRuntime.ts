interface ExpiringStatus {
  expiresAt: number;
}

interface DotStatus extends ExpiringStatus {
  accumulatedDmg: number;
  dps: number;
}

export interface BurnStatus extends DotStatus {
  decayPerSecond: number;
  sourceWeaponId?: string;
}

export interface RuntimeDotStatus extends DotStatus {
  sourceWeaponId?: string;
}

export function clearExpiredStatus<T extends ExpiringStatus>(
  status: T | null,
  now: number,
) {
  return status !== null && now >= status.expiresAt ? null : status;
}

export function tickDotStatus<T extends DotStatus>(status: T | null, dt: number) {
  if (!status) {
    return { damage: 0, status: null };
  }

  status.accumulatedDmg += status.dps * dt;
  if (status.accumulatedDmg < 1) {
    return { damage: 0, status };
  }

  const damage = Math.floor(status.accumulatedDmg);
  status.accumulatedDmg -= damage;

  return {
    damage,
    status,
  };
}

export function tickBurnStatus(
  status: BurnStatus | null,
  dt: number,
  minDps = 0.05,
) {
  if (!status) {
    return { damage: 0, status: null };
  }

  status.dps *= Math.exp(-status.decayPerSecond * dt);
  const nextTick = tickDotStatus(status, dt);

  if (nextTick.status && nextTick.status.dps < minDps) {
    return {
      damage: nextTick.damage,
      status: null,
    };
  }

  return nextTick;
}