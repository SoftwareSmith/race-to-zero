import { describe, expect, it } from "vitest";
import {
  buildDeadlineBurndownChartData,
  buildComparisonWindowHistoryChartData,
  buildOpenAgeChartData,
  buildComparisonRateHistoryChartData,
  buildSlaHitRateChartData,
  buildSlaOutcomeChartData,
  buildStatusChartData,
  getComparisonMetrics,
  getDeadlineMetrics,
  getInsightsMetrics,
  getSummaryMetrics,
} from "./metrics";

function withFrozenDate<T>(isoString: string, callback: () => T): T {
  const RealDate = Date;
  const frozenTime = new RealDate(isoString).valueOf();

  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      if (value == null) {
        super(frozenTime);
        return;
      }

      super(value);
    }

    static now() {
      return frozenTime;
    }
  }

  globalThis.Date = MockDate as DateConstructor;

  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

describe("metrics", () => {
  it("calculates remaining bugs and summary rates from a simple snapshot", () => {
    const metrics = {
      bugs: [
        {
          completedAt: null,
          createdAt: "2026-03-20",
          priority: 2,
          stateName: null,
          stateType: null,
        },
        {
          completedAt: "2026-03-24",
          createdAt: "2026-03-21",
          priority: 3,
          stateName: null,
          stateType: null,
        },
        {
          completedAt: null,
          createdAt: "2026-03-22",
          priority: 1,
          stateName: null,
          stateType: null,
        },
        {
          completedAt: null,
          createdAt: "2026-03-23",
          priority: 4,
          stateName: "Canceled",
          stateType: "canceled",
        },
      ],
    };

    const deadlineMetrics = getDeadlineMetrics(metrics, {
      deadlineDate: "2026-12-31",
      trackingStartDate: "2026-03-20",
      workdaySettings: {
        excludePublicHolidays: false,
        excludeWeekends: false,
      },
    });
    const summary = getSummaryMetrics(deadlineMetrics);

    expect(deadlineMetrics.remainingBugs).toBe(2);
    expect(deadlineMetrics.priorityDistribution.find((entry) => entry.label === "Urgent")?.count).toBe(1);
    expect(summary.bugCount).toBe(2);
    expect(summary.currentAddRate).toBeGreaterThan(0);
  });

  it("keeps terminal bugs in backlog history until they actually leave the queue", () => {
    const deadlineMetrics = withFrozenDate("2026-03-06T12:00:00.000Z", () =>
      getDeadlineMetrics(
        {
          bugs: [
            {
              canceledAt: "2026-03-04",
              completedAt: null,
              createdAt: "2026-03-01",
              priority: 2,
              stateName: "Canceled",
              stateType: "canceled",
              updatedAt: "2026-03-04",
            },
            {
              completedAt: null,
              createdAt: "2026-03-02",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
            {
              completedAt: "2026-03-05",
              createdAt: "2026-03-03",
              priority: 2,
              stateName: "Done",
              stateType: "completed",
            },
            {
              archivedAt: "2026-03-06",
              completedAt: null,
              createdAt: "2026-03-04",
              priority: 4,
              stateName: "Duplicate",
              stateType: "canceled",
              updatedAt: "2026-03-06",
            },
          ],
        },
        {
          deadlineDate: "2026-12-31",
          trackingStartDate: "2026-03-04",
          workdaySettings: {
            excludePublicHolidays: false,
            excludeWeekends: false,
          },
        },
      ),
    );

    expect(deadlineMetrics.remainingBugs).toBe(1);
    expect(deadlineMetrics.allRemainingPerDay).toEqual([
      { date: "2026-03-01", count: 1 },
      { date: "2026-03-02", count: 2 },
      { date: "2026-03-03", count: 3 },
      { date: "2026-03-04", count: 3 },
      { date: "2026-03-05", count: 2 },
      { date: "2026-03-06", count: 1 },
    ]);
    expect(deadlineMetrics.trackingStartBacklog).toBe(3);
    expect(deadlineMetrics.currentAddRate).toBe(0);
    expect(deadlineMetrics.currentFixRate).toBeCloseTo(1 / 3, 5);
  });

  it("starts the burndown chart at the selected date even when no event lands that day", () => {
    const deadlineMetrics = withFrozenDate("2026-01-06T12:00:00.000Z", () =>
      getDeadlineMetrics(
        {
          bugs: [
            {
              completedAt: null,
              createdAt: "2025-12-20",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
            {
              completedAt: "2026-01-04",
              createdAt: "2025-12-28",
              priority: 2,
              stateName: "Done",
              stateType: "completed",
            },
            {
              completedAt: null,
              createdAt: "2026-01-04",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
          ],
        },
        {
          deadlineDate: "2026-01-10",
          trackingStartDate: "2026-01-01",
          workdaySettings: {
            excludePublicHolidays: false,
            excludeWeekends: false,
          },
        },
      ),
    );

    const chartData = buildDeadlineBurndownChartData(deadlineMetrics);

    expect(deadlineMetrics.trackingStartBacklog).toBe(2);
    expect(chartData.labels?.slice(0, 6)).toEqual([
      "Jan 1",
      "Jan 2",
      "Jan 3",
      "Jan 4",
      "Jan 5",
      "Jan 6",
    ]);
    expect(chartData.datasets[0]?.data.slice(0, 6)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it("builds a status chart using the fixed Linear column order", () => {
    const metrics = {
      bugs: [
        {
          completedAt: null,
          createdAt: "2026-03-20",
          priority: 2,
          stateName: "Backlog",
          stateType: "backlog",
        },
        {
          completedAt: null,
          createdAt: "2026-03-21",
          priority: 3,
          stateName: "In Review",
          stateType: "started",
        },
        {
          completedAt: null,
          createdAt: "2026-03-22",
          priority: 1,
          stateName: "Triage",
          stateType: "unstarted",
        },
        {
          completedAt: "2026-03-24",
          createdAt: "2026-03-23",
          priority: 4,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: null,
          createdAt: "2026-03-25",
          priority: 4,
          stateName: "Duplicate",
          stateType: "canceled",
        },
      ],
    };

    const deadlineMetrics = getDeadlineMetrics(metrics, {
      deadlineDate: "2026-12-31",
      trackingStartDate: "2026-03-20",
      workdaySettings: {
        excludePublicHolidays: false,
        excludeWeekends: false,
      },
    });
    const chartData = buildStatusChartData(deadlineMetrics);

    expect(deadlineMetrics.statusDistribution.map((entry) => entry.label)).toEqual([
      "Backlog",
      "Triage",
      "Todo",
      "In progress",
      "In review",
      "Deploy ready",
      "Other",
    ]);
    expect(chartData.labels).toEqual([
      "Backlog",
      "Triage",
      "Todo",
      "In progress",
      "In review",
      "Deploy ready",
      "Other",
    ]);
    expect(chartData.datasets[0]?.data).toEqual([1, 1, 0, 0, 1, 0, 0]);
  });

  it("builds an open age chart for unresolved backlog buckets", () => {
    const deadlineMetrics = withFrozenDate("2026-04-16T12:00:00.000Z", () =>
      getDeadlineMetrics(
        {
          bugs: [
            {
              completedAt: null,
              createdAt: "2026-04-15",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
            {
              completedAt: null,
              createdAt: "2026-04-01",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
            {
              completedAt: null,
              createdAt: "2026-02-01",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
            {
              completedAt: null,
              createdAt: "2025-10-01",
              priority: 2,
              stateName: "Backlog",
              stateType: "backlog",
            },
            {
              completedAt: null,
              createdAt: "2026-03-20",
              priority: 2,
              stateName: "Canceled",
              stateType: "canceled",
            },
          ],
        },
        {
          deadlineDate: "2026-12-31",
          trackingStartDate: "2026-02-01",
          workdaySettings: {
            excludePublicHolidays: false,
            excludeWeekends: false,
          },
        },
      ),
    );
    const chartData = buildOpenAgeChartData(deadlineMetrics);

    expect(chartData.labels).toEqual(["0-7d", "8-30d", "31-90d", "91-180d", "181d+"]);
    expect(chartData.datasets[0]?.data).toEqual([1, 1, 1, 0, 1]);
  });

  it("builds historical net-change windows for the selected period length", () => {
    const metrics = {
      bugs: [
        {
          completedAt: null,
          createdAt: "2026-02-20",
          priority: 2,
          stateName: "Backlog",
          stateType: "backlog",
        },
        {
          completedAt: "2026-03-10",
          createdAt: "2026-02-21",
          priority: 2,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: null,
          createdAt: "2026-03-03",
          priority: 3,
          stateName: "Backlog",
          stateType: "backlog",
        },
        {
          completedAt: null,
          createdAt: "2026-03-04",
          priority: 3,
          stateName: "Backlog",
          stateType: "backlog",
        },
        {
          completedAt: "2026-03-09",
          createdAt: "2026-03-06",
          priority: 4,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: "2026-03-08",
          createdAt: "2026-02-19",
          priority: 4,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: "2026-03-13",
          createdAt: "2026-03-12",
          priority: 2,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: "2026-03-15",
          createdAt: "2026-03-14",
          priority: 1,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: null,
          createdAt: "2026-03-17",
          priority: 1,
          stateName: "Backlog",
          stateType: "backlog",
        },
      ],
    };

    const comparisonMetrics = withFrozenDate("2026-03-17T12:00:00.000Z", () =>
      getComparisonMetrics(metrics, { rangeKey: "7" }),
    );
    const chartData = buildComparisonWindowHistoryChartData(comparisonMetrics);

    expect(comparisonMetrics.historicalWindows.length).toBeGreaterThan(1);
    expect(chartData.labels?.length).toBe(
      comparisonMetrics.historicalWindows.length,
    );
    expect(chartData.datasets[0]?.data.at(-1)).toBe(
      comparisonMetrics.currentWindow.netChange,
    );
    expect(chartData.datasets[0]?.data).toContain(-1);
    expect(chartData.datasets[0]?.data).toContain(1);

    const rateChartData = buildComparisonRateHistoryChartData(comparisonMetrics);
    expect(rateChartData.datasets).toHaveLength(2);
    expect(rateChartData.labels?.length).toBe(
      comparisonMetrics.historicalWindows.length,
    );
  });

  it("counts archived terminal tickets as backlog closures in period comparisons", () => {
    const metrics = {
      bugs: [
        {
          archivedAt: null,
          autoClosedAt: null,
          canceledAt: "2026-03-05",
          completedAt: null,
          createdAt: "2026-03-01",
          priority: 2,
          stateName: "Canceled",
          stateType: "canceled",
          updatedAt: "2026-03-05",
        },
      ],
    };

    const comparisonMetrics = withFrozenDate("2026-03-10T12:00:00.000Z", () =>
      getComparisonMetrics(metrics, {
        customFromDate: "2026-03-05",
        customToDate: "2026-03-10",
        rangeKey: "custom",
      }),
    );

    expect(comparisonMetrics.currentWindow.created).toBe(0);
    expect(comparisonMetrics.currentWindow.fixed).toBe(1);
    expect(comparisonMetrics.currentWindow.netChange).toBe(-1);
  });

  it("calculates SLA insights from due dates and completed dates", () => {
    const metrics = {
      bugs: [
        {
          completedAt: "2026-04-03",
          createdAt: "2026-04-01",
          dueDate: "2026-04-03",
          priority: 1,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: "2026-04-06",
          createdAt: "2026-04-01",
          dueDate: "2026-04-04",
          priority: 2,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: "2026-04-07",
          createdAt: "2026-04-05",
          dueDate: null,
          priority: 3,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: "2026-03-30",
          createdAt: "2026-03-25",
          dueDate: "2026-03-29",
          priority: 1,
          stateName: "Done",
          stateType: "completed",
        },
        {
          completedAt: null,
          createdAt: "2026-03-20",
          dueDate: "2026-04-08",
          priority: 2,
          stateName: "In progress",
          stateType: "started",
        },
        {
          completedAt: null,
          createdAt: "2026-04-01",
          dueDate: "2026-04-13",
          priority: 4,
          stateName: "Backlog",
          stateType: "backlog",
        },
        {
          completedAt: null,
          createdAt: "2026-04-02",
          dueDate: "2026-04-03",
          priority: 2,
          stateName: "Canceled",
          stateType: "canceled",
        },
        {
          completedAt: null,
          createdAt: "2026-04-02",
          dueDate: "2026-04-11",
          priority: 2,
          stateName: "Duplicate",
          stateType: "canceled",
        },
      ],
    };

    const insightsMetrics = withFrozenDate("2026-04-10T12:00:00.000Z", () =>
      getInsightsMetrics(metrics, {
        customFromDate: "2026-04-01",
        customToDate: "2026-04-10",
        rangeKey: "custom",
      }),
    );

    expect(insightsMetrics.totalCompleted).toBe(3);
    expect(insightsMetrics.eligibleCompleted).toBe(2);
    expect(insightsMetrics.onTimeCompleted).toBe(1);
    expect(insightsMetrics.overdueCompleted).toBe(1);
    expect(insightsMetrics.missingDueDate).toBe(1);
    expect(insightsMetrics.slaHitRate).toBe(50);
    expect(insightsMetrics.averageOverdueDays).toBe(2);
    expect(insightsMetrics.medianOverdueDays).toBe(2);
    expect(insightsMetrics.medianResolutionDays).toBe(2);
    expect(insightsMetrics.openOverdue).toBe(1);
    expect(insightsMetrics.openPending).toBe(1);

    const urgentMetrics = insightsMetrics.priorityMetrics.find(
      (entry) => entry.label === "Urgent",
    );
    const highMetrics = insightsMetrics.priorityMetrics.find(
      (entry) => entry.label === "High",
    );
    const normalMetrics = insightsMetrics.priorityMetrics.find(
      (entry) => entry.label === "Normal",
    );

    expect(urgentMetrics?.onTime).toBe(1);
    expect(highMetrics?.overdueCompleted).toBe(1);
    expect(normalMetrics?.totalCompleted).toBe(1);
    expect(normalMetrics?.missingDueDate).toBe(1);

    const hitRateChart = buildSlaHitRateChartData(insightsMetrics);
    expect(hitRateChart.datasets[0]?.data.slice(0, 3)).toEqual([100, 0, 0]);

    const outcomeChart = buildSlaOutcomeChartData(insightsMetrics);
    expect(outcomeChart.datasets).toHaveLength(3);
    expect(outcomeChart.datasets[0]?.data[0]).toBe(1);
    expect(outcomeChart.datasets[1]?.data[1]).toBe(1);
    expect(outcomeChart.datasets[2]?.data[2]).toBe(1);
  });
});