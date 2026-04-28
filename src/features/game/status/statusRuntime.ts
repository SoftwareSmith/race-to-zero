import { STATUS_PRIORITY, type SiegeStatusId } from "./statusCatalog";

export interface TimedStatusState {
  expiresAt: number;
}

export interface DamageOverTimeStatusState extends TimedStatusState {
  accumulatedDmg: number;
  dps: number;
}

export interface SiegeStatusRuntimeState {
  ally?: (TimedStatusState & {
    expireBurstDamage: number;
    expireBurstRadius: number;
    interceptForce: number;
  }) | null;
  burn?: (DamageOverTimeStatusState & {
    decayPerSecond: number;
    sourceWeaponId?: string;
  }) | null;
  charged?: TimedStatusState | null;
  ensnare?: (TimedStatusState & { canInstakill: boolean }) | null;
  freeze?: (TimedStatusState & { multiplier: number }) | null;
  looped?: DamageOverTimeStatusState | null;
  marked?: TimedStatusState | null;
  poison?: (DamageOverTimeStatusState & { sourceWeaponId?: string }) | null;
  unstable?: TimedStatusState | null;
}

export interface SiegeStatusRuntimeSummary {
  activeStatusIds: SiegeStatusId[];
  controlIntensity: number;
  mobilityMultiplier: number;
}

export function isRuntimeStatusActive(
  status: TimedStatusState | null | undefined,
  now: number,
) {
  return status !== null && status !== undefined && now < status.expiresAt;
}

export function extendTimedStatus<T extends TimedStatusState>(
  status: T | null | undefined,
  now: number,
  durationMs: number,
  create: (expiresAt: number) => T,
) {
  if (isRuntimeStatusActive(status, now)) {
    const activeStatus = status as T;
    return {
      ...activeStatus,
      expiresAt: activeStatus.expiresAt + durationMs,
    };
  }

  return create(now + durationMs);
}

export function refreshTimedStatus<T extends TimedStatusState>(
  status: T | null | undefined,
  now: number,
  durationMs: number,
  create: (expiresAt: number) => T,
) {
  if (isRuntimeStatusActive(status, now)) {
    const activeStatus = status as T;
    return {
      ...activeStatus,
      expiresAt: Math.max(activeStatus.expiresAt, now + durationMs),
    };
  }

  return create(now + durationMs);
}

export function clearExpiredRuntimeStatuses(
  state: SiegeStatusRuntimeState,
  now: number,
) {
  const nextState: SiegeStatusRuntimeState = { ...state };

  for (const statusId of STATUS_PRIORITY) {
    if (!isRuntimeStatusActive(nextState[statusId], now)) {
      nextState[statusId] = null;
    }
  }

  return nextState;
}

export function getOrderedActiveStatusIds(
  state: SiegeStatusRuntimeState,
  now: number,
) {
  return STATUS_PRIORITY.filter((statusId) =>
    isRuntimeStatusActive(state[statusId], now),
  );
}

export function getStatusRuntimeSummary(
  state: SiegeStatusRuntimeState,
  now: number,
): SiegeStatusRuntimeSummary {
  const activeStatusIds = getOrderedActiveStatusIds(state, now);

  let mobilityMultiplier = 1;
  if (isRuntimeStatusActive(state.freeze, now)) {
    mobilityMultiplier *= state.freeze?.multiplier ?? 1;
  }
  if (isRuntimeStatusActive(state.ensnare, now)) {
    mobilityMultiplier = 0;
  }

  const controlIntensity = Math.max(
    isRuntimeStatusActive(state.ensnare, now) ? 1 : 0,
    isRuntimeStatusActive(state.freeze, now)
      ? 1 - (state.freeze?.multiplier ?? 1)
      : 0,
  );

  return {
    activeStatusIds,
    controlIntensity,
    mobilityMultiplier,
  };
}