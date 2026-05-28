import type { HistoryOutcomeKey, MetricsBug } from "../../../types/dashboard";

export interface BugTerminalEvent {
  date: string;
  outcome: HistoryOutcomeKey;
}

export function getLinearStatusLabel(bug: MetricsBug) {
  const rawValue = bug.stateName?.trim() || bug.stateType?.trim() || "";
  const normalizedValue = rawValue.toLowerCase();

  if (normalizedValue === "backlog") {
    return "Backlog";
  }

  if (normalizedValue === "triage" || normalizedValue === "triaged") {
    return "Triage";
  }

  if (
    normalizedValue === "todo" ||
    normalizedValue === "to do" ||
    normalizedValue === "unstarted"
  ) {
    return "Todo";
  }

  if (
    normalizedValue === "in progress" ||
    normalizedValue === "in-progress" ||
    normalizedValue === "started" ||
    normalizedValue === "doing"
  ) {
    return "In progress";
  }

  if (
    normalizedValue === "in review" ||
    normalizedValue === "review" ||
    normalizedValue === "qa" ||
    normalizedValue === "testing"
  ) {
    return "In review";
  }

  if (
    normalizedValue === "deploy ready" ||
    normalizedValue === "ready to deploy" ||
    normalizedValue === "deploy-ready" ||
    normalizedValue === "ready for deploy"
  ) {
    return "Deploy ready";
  }

  if (
    normalizedValue === "done" ||
    normalizedValue === "completed" ||
    normalizedValue === "complete" ||
    (!normalizedValue && bug.completedAt)
  ) {
    return "Done";
  }

  if (
    normalizedValue === "cancelled" ||
    normalizedValue === "canceled" ||
    normalizedValue === "cancel"
  ) {
    return "Cancelled";
  }

  if (
    normalizedValue === "duplicated" ||
    normalizedValue === "duplicate" ||
    normalizedValue === "duplicate bug"
  ) {
    return "Duplicated";
  }

  return "Other";
}

export function isTerminalStatusLabel(statusLabel: string) {
  return statusLabel === "Cancelled" || statusLabel === "Duplicated";
}

export function getBugTerminalEvent(bug: MetricsBug): BugTerminalEvent | null {
  if (bug.completedAt) {
    return {
      date: bug.completedAt,
      outcome: "completed",
    };
  }

  const statusLabel = getLinearStatusLabel(bug);

  if (statusLabel === "Cancelled") {
    const date =
      bug.canceledAt ?? bug.updatedAt ?? bug.autoClosedAt ?? bug.archivedAt;

    return date
      ? {
          date,
          outcome: "cancelled",
        }
      : null;
  }

  if (statusLabel === "Duplicated") {
    const date =
      bug.canceledAt ?? bug.autoClosedAt ?? bug.archivedAt ?? bug.updatedAt;

    return date
      ? {
          date,
          outcome: "duplicated",
        }
      : null;
  }

  if (bug.autoClosedAt) {
    return {
      date: bug.autoClosedAt,
      outcome: "autoClosed",
    };
  }

  if (bug.archivedAt) {
    return {
      date: bug.archivedAt,
      outcome: "archived",
    };
  }

  if (bug.canceledAt) {
    return {
      date: bug.canceledAt,
      outcome: "cancelled",
    };
  }

  return null;
}

export function getBugClosureDate(bug: MetricsBug) {
  return getBugTerminalEvent(bug)?.date ?? null;
}