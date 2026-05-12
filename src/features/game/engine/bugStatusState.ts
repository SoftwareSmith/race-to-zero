import type { SiegeStatusId } from "@game/status/statusCatalog";
import { STATUS_PRIORITY } from "@game/status/statusCatalog";

type ExpiringStatus =
  | { expiresAt: number }
  | { expiresAt: number; dps: number; accumulatedDmg: number }
  | null;

export interface BugStatusSnapshot {
  ally: ExpiringStatus;
  burn: ExpiringStatus;
  charged: ExpiringStatus;
  ensnare: ExpiringStatus;
  looped: ExpiringStatus;
  marked: ExpiringStatus;
  poison: ExpiringStatus;
  slow: ExpiringStatus;
  unstable: ExpiringStatus;
}

export function isStatusActive(status: ExpiringStatus, now: number) {
  return status !== null && now < status.expiresAt;
}

export function collectActiveSupportStatuses(
  snapshot: BugStatusSnapshot,
  now: number,
  finisherStatus?: SiegeStatusId | null,
) {
  const statuses: SiegeStatusId[] = [];

  if (isStatusActive(snapshot.ally, now)) statuses.push("ally");
  if (isStatusActive(snapshot.burn, now)) statuses.push("burn");
  if (isStatusActive(snapshot.charged, now)) statuses.push("charged");
  if (isStatusActive(snapshot.ensnare, now)) statuses.push("ensnare");
  if (isStatusActive(snapshot.slow, now)) statuses.push("freeze");
  if (isStatusActive(snapshot.looped, now)) statuses.push("looped");
  if (isStatusActive(snapshot.marked, now)) statuses.push("marked");
  if (isStatusActive(snapshot.poison, now)) statuses.push("poison");
  if (isStatusActive(snapshot.unstable, now)) statuses.push("unstable");

  const filtered = finisherStatus
    ? statuses.filter((status) => status !== finisherStatus)
    : statuses;

  return STATUS_PRIORITY.filter((status) => filtered.includes(status));
}