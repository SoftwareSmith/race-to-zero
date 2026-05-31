import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "date-fns";
import type { ComparisonWindowMetrics, HistoryOutcomeKey, MetricsSource } from "../src/types/dashboard.js";
import { getBugTerminalEvent, getLinearStatusLabel } from "../src/features/dashboard/utils/bugLifecycle.js";
import {
  getComparisonMetrics,
  getDeadlineMetrics,
  getHistoryMetrics,
  getInsightsMetrics,
} from "../src/features/dashboard/utils/metrics.js";
import { buildMetrics, fetchBugIssues, getTeamKeys, isBugIssue, toDay } from "./fetch-linear.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const ANALYTICS_OUTPUT_PATH = path.join(ROOT_DIR, "public", "data", "metrics-analytics.json");

type ClosureBreakdown = Record<HistoryOutcomeKey, number>;

interface OverlapDiagnostics {
  multipleTerminalMarkers: number;
  completedAndArchived: number;
  duplicateWithCanceledAt: number;
  canceledAndArchived: number;
  assignmentBreakdown: ClosureBreakdown;
}

interface BucketIssueEntry {
  identifier: string | null;
  title: string | null;
  teamKey: string | null;
  statusLabel: string;
  stateName: string | null;
  stateType: string | null;
  createdAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  autoClosedAt: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
  terminalDate: string;
  labels: Array<{
    name: string | null;
    parentName: string | null;
  }>;
}

interface BucketSummaryEntry {
  count: number;
  byTeam: Array<{ teamKey: string; count: number }>;
  byStatusLabel: Array<{ label: string; count: number }>;
  byStateCombo: Array<{ label: string; count: number }>;
  sampleIssues: BucketIssueEntry[];
}

type BucketSummary = Record<HistoryOutcomeKey, BucketSummaryEntry>;

interface BucketDiffSignatureEntry {
  signature: string;
  count: number;
}

interface BucketParityEntry {
  liveCount: number;
  exportedCount: number;
  delta: number;
  liveByTeam: Array<{ teamKey: string; count: number }>;
  exportedByTeam: Array<{ teamKey: string; count: number }>;
  liveOnlyIssues: BucketIssueEntry[];
  exportedOnlySignatures: BucketDiffSignatureEntry[];
}

type BucketParity = Record<HistoryOutcomeKey, BucketParityEntry>;

interface AuditSummary {
  comparison: ComparisonWindowMetrics;
  deadline: ReturnType<typeof getDeadlineMetrics>;
  history: ReturnType<typeof getHistoryMetrics>;
  insights: ReturnType<typeof getInsightsMetrics>;
  closureBreakdown: ClosureBreakdown;
  overlapDiagnostics: OverlapDiagnostics;
}

function createEmptyBucketSummaryEntry(): BucketSummaryEntry {
  return {
    count: 0,
    byStateCombo: [],
    byStatusLabel: [],
    byTeam: [],
    sampleIssues: [],
  };
}

function createEmptyBucketSummary(): BucketSummary {
  return {
    archived: createEmptyBucketSummaryEntry(),
    autoClosed: createEmptyBucketSummaryEntry(),
    cancelled: createEmptyBucketSummaryEntry(),
    completed: createEmptyBucketSummaryEntry(),
    duplicated: createEmptyBucketSummaryEntry(),
  };
}

function createEmptyBucketParityEntry(): BucketParityEntry {
  return {
    delta: 0,
    exportedByTeam: [],
    exportedCount: 0,
    exportedOnlySignatures: [],
    liveByTeam: [],
    liveCount: 0,
    liveOnlyIssues: [],
  };
}

function createEmptyBucketParity(): BucketParity {
  return {
    archived: createEmptyBucketParityEntry(),
    autoClosed: createEmptyBucketParityEntry(),
    cancelled: createEmptyBucketParityEntry(),
    completed: createEmptyBucketParityEntry(),
    duplicated: createEmptyBucketParityEntry(),
  };
}

function createEmptyClosureBreakdown(): ClosureBreakdown {
  return {
    completed: 0,
    cancelled: 0,
    duplicated: 0,
    autoClosed: 0,
    archived: 0,
  };
}

function isDateWithinWindow(dateValue: string | null | undefined, startKey: string, endKey: string) {
  return Boolean(dateValue && dateValue >= startKey && dateValue <= endKey);
}

function toSortedCountList(counts: Map<string, number>, keyName: "label" | "teamKey") {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, count]) => ({
      [keyName]: key,
      count,
    })) as Array<{ [K in typeof keyName]: string } & { count: number }>;
}

function buildMetricBugFromIssue(issue: Awaited<ReturnType<typeof fetchBugIssues>>[number]) {
  return {
    archivedAt: issue.archivedAt ? toDay(issue.archivedAt) : null,
    autoClosedAt: issue.autoClosedAt ? toDay(issue.autoClosedAt) : null,
    canceledAt: issue.canceledAt ? toDay(issue.canceledAt) : null,
    createdAt: toDay(issue.createdAt),
    dueDate: issue.dueDate ? toDay(issue.dueDate) : null,
    completedAt: issue.completedAt ? toDay(issue.completedAt) : null,
    priority: issue.priority ?? 0,
    stateName: issue.state?.name ?? null,
    stateType: issue.state?.type ?? null,
    teamKey: issue.team?.key ?? null,
    updatedAt: issue.updatedAt ? toDay(issue.updatedAt) : null,
  };
}

function buildBucketIssueEntry(
  issue: Awaited<ReturnType<typeof fetchBugIssues>>[number],
  terminalDate: string,
): BucketIssueEntry {
  const bug = buildMetricBugFromIssue(issue);

  return {
    archivedAt: bug.archivedAt,
    autoClosedAt: bug.autoClosedAt,
    canceledAt: bug.canceledAt,
    completedAt: bug.completedAt,
    createdAt: bug.createdAt,
    identifier: issue.identifier ?? null,
    labels: toLabelList(issue),
    stateName: bug.stateName,
    stateType: bug.stateType,
    statusLabel: getLinearStatusLabel(bug),
    teamKey: bug.teamKey,
    terminalDate,
    title: issue.title ?? null,
    updatedAt: bug.updatedAt,
  };
}

function getMetricsBugSignature(bug: NonNullable<MetricsSource["bugs"]>[number]) {
  return JSON.stringify({
    archivedAt: bug.archivedAt ?? null,
    autoClosedAt: bug.autoClosedAt ?? null,
    canceledAt: bug.canceledAt ?? null,
    completedAt: bug.completedAt ?? null,
    createdAt: bug.createdAt,
    stateName: bug.stateName ?? null,
    stateType: bug.stateType ?? null,
    teamKey: bug.teamKey ?? null,
  });
}

function buildBucketSummary(
  issues: Awaited<ReturnType<typeof fetchBugIssues>>,
  comparison: ComparisonWindowMetrics,
): BucketSummary {
  const startKey = format(comparison.startDate, "yyyy-MM-dd");
  const endKey = format(comparison.endDate, "yyyy-MM-dd");
  const byBucket = new Map<HistoryOutcomeKey, {
    count: number;
    teamCounts: Map<string, number>;
    statusCounts: Map<string, number>;
    stateCounts: Map<string, number>;
    sampleIssues: BucketIssueEntry[];
  }>();

  for (const key of ["completed", "cancelled", "duplicated", "autoClosed", "archived"] as HistoryOutcomeKey[]) {
    byBucket.set(key, {
      count: 0,
      sampleIssues: [],
      stateCounts: new Map<string, number>(),
      statusCounts: new Map<string, number>(),
      teamCounts: new Map<string, number>(),
    });
  }

  for (const issue of issues.filter(isBugIssue)) {
    const bug = buildMetricBugFromIssue(issue);
    const terminalEvent = getBugTerminalEvent(bug);
    if (!terminalEvent || !isDateWithinWindow(terminalEvent.date, startKey, endKey)) {
      continue;
    }

    const bucket = byBucket.get(terminalEvent.outcome);
    if (!bucket) {
      continue;
    }

    bucket.count += 1;
    const teamKey = bug.teamKey ?? "unknown";
    const statusLabel = getLinearStatusLabel(bug);
    const stateCombo = `${bug.stateName ?? "null"} | ${bug.stateType ?? "null"}`;
    bucket.teamCounts.set(teamKey, (bucket.teamCounts.get(teamKey) ?? 0) + 1);
    bucket.statusCounts.set(statusLabel, (bucket.statusCounts.get(statusLabel) ?? 0) + 1);
    bucket.stateCounts.set(stateCombo, (bucket.stateCounts.get(stateCombo) ?? 0) + 1);

    if (bucket.sampleIssues.length < 25) {
      bucket.sampleIssues.push(buildBucketIssueEntry(issue, terminalEvent.date));
    }
  }

  const summary = createEmptyBucketSummary();

  for (const key of Object.keys(summary) as HistoryOutcomeKey[]) {
    const bucket = byBucket.get(key);
    if (!bucket) {
      continue;
    }

    summary[key] = {
      byStateCombo: toSortedCountList(bucket.stateCounts, "label"),
      byStatusLabel: toSortedCountList(bucket.statusCounts, "label"),
      byTeam: toSortedCountList(bucket.teamCounts, "teamKey"),
      count: bucket.count,
      sampleIssues: bucket.sampleIssues,
    };
  }

  return summary;
}

function buildBucketParity(
  issues: Awaited<ReturnType<typeof fetchBugIssues>>,
  exportedMetrics: MetricsSource,
  comparison: ComparisonWindowMetrics,
): BucketParity {
  const startKey = format(comparison.startDate, "yyyy-MM-dd");
  const endKey = format(comparison.endDate, "yyyy-MM-dd");
  const parity = createEmptyBucketParity();
  const liveIssuesByBucket = new Map<
    HistoryOutcomeKey,
    Array<{ entry: BucketIssueEntry; signature: string }>
  >();
  const liveCountsByBucket = new Map<HistoryOutcomeKey, Map<string, number>>();
  const exportedCountsByBucket = new Map<HistoryOutcomeKey, Map<string, number>>();
  const liveTeamCountsByBucket = new Map<HistoryOutcomeKey, Map<string, number>>();
  const exportedTeamCountsByBucket = new Map<HistoryOutcomeKey, Map<string, number>>();

  for (const key of ["completed", "cancelled", "duplicated", "autoClosed", "archived"] as HistoryOutcomeKey[]) {
    liveIssuesByBucket.set(key, []);
    liveCountsByBucket.set(key, new Map<string, number>());
    exportedCountsByBucket.set(key, new Map<string, number>());
    liveTeamCountsByBucket.set(key, new Map<string, number>());
    exportedTeamCountsByBucket.set(key, new Map<string, number>());
  }

  for (const issue of issues.filter(isBugIssue)) {
    const bug = buildMetricBugFromIssue(issue);
    const terminalEvent = getBugTerminalEvent(bug);
    if (!terminalEvent || !isDateWithinWindow(terminalEvent.date, startKey, endKey)) {
      continue;
    }

    const signature = getMetricsBugSignature(bug);
    const liveCounts = liveCountsByBucket.get(terminalEvent.outcome);
    const liveTeams = liveTeamCountsByBucket.get(terminalEvent.outcome);
    const liveEntries = liveIssuesByBucket.get(terminalEvent.outcome);

    if (!liveCounts || !liveTeams || !liveEntries) {
      continue;
    }

    liveCounts.set(signature, (liveCounts.get(signature) ?? 0) + 1);
    const teamKey = bug.teamKey ?? "unknown";
    liveTeams.set(teamKey, (liveTeams.get(teamKey) ?? 0) + 1);
    liveEntries.push({
      entry: buildBucketIssueEntry(issue, terminalEvent.date),
      signature,
    });
  }

  for (const bug of exportedMetrics.bugs ?? []) {
    const terminalEvent = getBugTerminalEvent(bug);
    if (!terminalEvent || !isDateWithinWindow(terminalEvent.date, startKey, endKey)) {
      continue;
    }

    const signature = getMetricsBugSignature(bug);
    const exportedCounts = exportedCountsByBucket.get(terminalEvent.outcome);
    const exportedTeams = exportedTeamCountsByBucket.get(terminalEvent.outcome);
    if (!exportedCounts || !exportedTeams) {
      continue;
    }

    exportedCounts.set(signature, (exportedCounts.get(signature) ?? 0) + 1);
    const teamKey = bug.teamKey ?? "unknown";
    exportedTeams.set(teamKey, (exportedTeams.get(teamKey) ?? 0) + 1);
  }

  for (const key of Object.keys(parity) as HistoryOutcomeKey[]) {
    const liveCounts = liveCountsByBucket.get(key) ?? new Map<string, number>();
    const exportedCounts = exportedCountsByBucket.get(key) ?? new Map<string, number>();
    const liveEntries = liveIssuesByBucket.get(key) ?? [];
    const liveOnlyIssues: BucketIssueEntry[] = [];
    const usedLiveCounts = new Map<string, number>();
    const exportedOnlySignatures: BucketDiffSignatureEntry[] = [];

    for (const { entry, signature } of liveEntries) {
      const liveAllowed = liveCounts.get(signature) ?? 0;
      const exportedAllowed = exportedCounts.get(signature) ?? 0;
      const currentUsed = usedLiveCounts.get(signature) ?? 0;

      if (currentUsed < liveAllowed - exportedAllowed) {
        liveOnlyIssues.push(entry);
        usedLiveCounts.set(signature, currentUsed + 1);
      }
    }

    for (const [signature, exportedCount] of exportedCounts.entries()) {
      const liveCount = liveCounts.get(signature) ?? 0;
      if (exportedCount > liveCount) {
        exportedOnlySignatures.push({
          count: exportedCount - liveCount,
          signature,
        });
      }
    }

    const liveCount = [...liveCounts.values()].reduce((sum, count) => sum + count, 0);
    const exportedCount = [...exportedCounts.values()].reduce((sum, count) => sum + count, 0);
    parity[key] = {
      delta: liveCount - exportedCount,
      exportedByTeam: toSortedCountList(
        exportedTeamCountsByBucket.get(key) ?? new Map<string, number>(),
        "teamKey",
      ),
      exportedCount,
      exportedOnlySignatures,
      liveByTeam: toSortedCountList(
        liveTeamCountsByBucket.get(key) ?? new Map<string, number>(),
        "teamKey",
      ),
      liveCount,
      liveOnlyIssues,
    };
  }

  return parity;
}

function buildClosureBreakdown(metrics: MetricsSource, comparison: ComparisonWindowMetrics) {
  const startKey = format(comparison.startDate, "yyyy-MM-dd");
  const endKey = format(comparison.endDate, "yyyy-MM-dd");
  const breakdown = createEmptyClosureBreakdown();

  for (const bug of metrics.bugs ?? []) {
    const terminalEvent = getBugTerminalEvent(bug);
    if (!terminalEvent || !isDateWithinWindow(terminalEvent.date, startKey, endKey)) {
      continue;
    }

    const outcome = terminalEvent.outcome as keyof ClosureBreakdown;
    breakdown[outcome] += 1;
  }

  return breakdown;
}

function buildOverlapDiagnostics(metrics: MetricsSource): OverlapDiagnostics {
  const assignmentBreakdown = createEmptyClosureBreakdown();
  let multipleTerminalMarkers = 0;
  let completedAndArchived = 0;
  let duplicateWithCanceledAt = 0;
  let canceledAndArchived = 0;

  for (const bug of metrics.bugs ?? []) {
    const markerCount = [bug.completedAt, bug.canceledAt, bug.autoClosedAt, bug.archivedAt].filter(
      Boolean,
    ).length;
    const statusLabel = getLinearStatusLabel(bug);
    const terminalEvent = getBugTerminalEvent(bug);

    if (markerCount > 1) {
      multipleTerminalMarkers += 1;
    }

    if (bug.completedAt && bug.archivedAt) {
      completedAndArchived += 1;
    }

    if (statusLabel === "Duplicated" && bug.canceledAt) {
      duplicateWithCanceledAt += 1;
    }

    if (bug.canceledAt && bug.archivedAt) {
      canceledAndArchived += 1;
    }

    if (markerCount > 1 && terminalEvent) {
      const outcome = terminalEvent.outcome as keyof ClosureBreakdown;
      assignmentBreakdown[outcome] += 1;
    }
  }

  return {
    multipleTerminalMarkers,
    completedAndArchived,
    duplicateWithCanceledAt,
    canceledAndArchived,
    assignmentBreakdown,
  };
}

function summarizeMetrics(metrics: MetricsSource): AuditSummary {
  const comparisonMetrics = getComparisonMetrics(metrics, { rangeKey: "30" });
  const deadlineMetrics = getDeadlineMetrics(metrics, {
    workdaySettings: {
      excludePublicHolidays: false,
      excludeWeekends: false,
    },
  });
  const historyMetrics = getHistoryMetrics(metrics, { rangeKey: "30" });
  const insightsMetrics = getInsightsMetrics(metrics, { rangeKey: "30" });

  return {
    comparison: comparisonMetrics.currentWindow,
    deadline: deadlineMetrics,
    history: historyMetrics,
    insights: insightsMetrics,
    closureBreakdown: buildClosureBreakdown(metrics, comparisonMetrics.currentWindow),
    overlapDiagnostics: buildOverlapDiagnostics(metrics),
  };
}

function toLabelList(issue: Awaited<ReturnType<typeof fetchBugIssues>>[number]) {
  return (issue.labels?.nodes ?? []).map((label) => ({
    name: label.name ?? null,
    parentName: label.parent?.name ?? null,
  }));
}

function buildSelectionAudit(issues: Awaited<ReturnType<typeof fetchBugIssues>>) {
  const labelCounts = new Map<string, number>();
  const parentCounts = new Map<string, number>();
  const suspiciousExcludedIssues = issues
    .filter((issue) => !isBugIssue(issue))
    .filter((issue) =>
      (issue.labels?.nodes ?? []).some((label) => {
        const labelName = label.name?.toLowerCase() ?? "";
        const parentName = label.parent?.name?.toLowerCase() ?? "";
        return labelName.includes("bug") || parentName.includes("bug");
      }),
    )
    .slice(0, 25)
    .map((issue) => ({
      identifier: issue.identifier ?? null,
      title: issue.title ?? null,
      teamKey: issue.team?.key ?? null,
      stateName: issue.state?.name ?? null,
      labels: toLabelList(issue),
    }));

  for (const issue of issues.filter(isBugIssue)) {
    for (const label of issue.labels?.nodes ?? []) {
      const labelName = label.name?.trim() ?? "";
      const parentName = label.parent?.name?.trim() ?? "";

      if (labelName) {
        labelCounts.set(labelName, (labelCounts.get(labelName) ?? 0) + 1);
      }

      if (parentName) {
        parentCounts.set(parentName, (parentCounts.get(parentName) ?? 0) + 1);
      }
    }
  }

  return {
    includedBugIssues: issues.filter(isBugIssue).length,
    excludedIssues: issues.filter((issue) => !isBugIssue(issue)).length,
    topIncludedLabels: [...labelCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 15)
      .map(([label, count]) => ({ label, count })),
    topIncludedParentLabels: [...parentCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 15)
      .map(([label, count]) => ({ label, count })),
    suspiciousExcludedIssues,
  };
}

async function readExportedMetrics() {
  const rawValue = await fs.readFile(ANALYTICS_OUTPUT_PATH, "utf8");
  return JSON.parse(rawValue) as MetricsSource;
}

function buildCurrentWindowSamples(issues: Awaited<ReturnType<typeof fetchBugIssues>>, comparison: ComparisonWindowMetrics) {
  const startKey = format(comparison.startDate, "yyyy-MM-dd");
  const endKey = format(comparison.endDate, "yyyy-MM-dd");

  const created = issues
    .filter(isBugIssue)
    .filter((issue) => isDateWithinWindow(issue.createdAt ? issue.createdAt.slice(0, 10) : null, startKey, endKey))
    .slice(0, 50)
    .map((issue) => ({
      identifier: issue.identifier ?? null,
      title: issue.title ?? null,
      createdAt: issue.createdAt.slice(0, 10),
      teamKey: issue.team?.key ?? null,
      stateName: issue.state?.name ?? null,
      labels: toLabelList(issue),
    }));

  const closed = issues
    .filter(isBugIssue)
    .map((issue) => {
      const metrics = buildMetrics([issue]).bugs?.[0];
      const terminalEvent = metrics ? getBugTerminalEvent(metrics) : null;

      return terminalEvent
        ? {
            identifier: issue.identifier ?? null,
            title: issue.title ?? null,
            closedAt: terminalEvent.date,
            outcome: terminalEvent.outcome,
            teamKey: issue.team?.key ?? null,
            stateName: issue.state?.name ?? null,
            labels: toLabelList(issue),
          }
        : null;
    })
    .filter((entry) => entry != null && isDateWithinWindow(entry.closedAt, startKey, endKey))
    .slice(0, 50);

  return { created, closed };
}

function buildStatusSnapshot(metrics: MetricsSource) {
  const counts = new Map<string, number>();

  for (const bug of metrics.bugs ?? []) {
    const statusLabel = getLinearStatusLabel(bug);
    counts.set(statusLabel, (counts.get(statusLabel) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

async function main() {
  const [issues, exportedMetrics] = await Promise.all([
    fetchBugIssues(),
    readExportedMetrics(),
  ]);
  const liveMetrics = buildMetrics(issues);
  const liveSummary = summarizeMetrics(liveMetrics);
  const exportedSummary = summarizeMetrics(exportedMetrics);
  const bucketAudit30 = buildBucketSummary(issues, liveSummary.comparison);
  const bucketParity30 = buildBucketParity(issues, exportedMetrics, liveSummary.comparison);
  const report = {
    generatedAt: new Date().toISOString(),
    teamKeys: getTeamKeys(),
    issueCounts: {
      fetched: issues.length,
      bugIssues: issues.filter(isBugIssue).length,
      exportedBugRecords: exportedMetrics.bugs?.length ?? 0,
    },
    live: {
      comparison30: liveSummary.comparison,
      closureBreakdown30: liveSummary.closureBreakdown,
      overlapDiagnostics: liveSummary.overlapDiagnostics,
      remainingBugs: liveSummary.deadline.remainingBugs,
      doneCount: liveSummary.deadline.doneCount,
      statusDistribution: liveSummary.deadline.statusDistribution,
      insights: {
        totalCompleted: liveSummary.insights.totalCompleted,
        eligibleCompleted: liveSummary.insights.eligibleCompleted,
        onTimeCompleted: liveSummary.insights.onTimeCompleted,
        overdueCompleted: liveSummary.insights.overdueCompleted,
        missingDueDate: liveSummary.insights.missingDueDate,
        slaHitRate: liveSummary.insights.slaHitRate,
      },
      history30: liveSummary.history.currentWindow,
    },
    exported: {
      comparison30: exportedSummary.comparison,
      closureBreakdown30: exportedSummary.closureBreakdown,
      overlapDiagnostics: exportedSummary.overlapDiagnostics,
      remainingBugs: exportedSummary.deadline.remainingBugs,
      doneCount: exportedSummary.deadline.doneCount,
      statusDistribution: exportedSummary.deadline.statusDistribution,
      insights: {
        totalCompleted: exportedSummary.insights.totalCompleted,
        eligibleCompleted: exportedSummary.insights.eligibleCompleted,
        onTimeCompleted: exportedSummary.insights.onTimeCompleted,
        overdueCompleted: exportedSummary.insights.overdueCompleted,
        missingDueDate: exportedSummary.insights.missingDueDate,
        slaHitRate: exportedSummary.insights.slaHitRate,
      },
      history30: exportedSummary.history.currentWindow,
    },
    deltas: {
      created30: liveSummary.comparison.created - exportedSummary.comparison.created,
      completed30: liveSummary.comparison.completed - exportedSummary.comparison.completed,
      netChange30: liveSummary.comparison.netChange - exportedSummary.comparison.netChange,
      remainingBugs: liveSummary.deadline.remainingBugs - exportedSummary.deadline.remainingBugs,
      totalCompleted30: liveSummary.insights.totalCompleted - exportedSummary.insights.totalCompleted,
    },
    bucketAudit30,
    bucketParity30,
    selectionAudit: buildSelectionAudit(issues),
    currentWindowSamples: buildCurrentWindowSamples(issues, liveSummary.comparison),
    exportedStatusSnapshot: buildStatusSnapshot(exportedMetrics),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});