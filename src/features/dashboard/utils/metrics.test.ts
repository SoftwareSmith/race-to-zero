import { describe, expect, it } from "vitest";
import {
  buildComparisonWindowHistoryChartData,
  buildOpenAgeChartData,
  buildComparisonRateHistoryChartData,
  buildStatusChartData,
  getComparisonMetrics,
  getDeadlineMetrics,
  getSummaryMetrics,
} from "./metrics";

function withFrozenDate<T>(isoString: string, callback: () => T): T {
  const RealDate = Date;
  const frozenTime = new RealDate(isoString).valueOf();

  class MockDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(frozenTime);
        return;
      }

      super(...args);
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
      "Cancelled",
      "Duplicated",
      "Other",
    ]);
    expect(chartData.labels).toEqual([
      "Backlog",
      "Triage",
      "Todo",
      "In progress",
      "In review",
      "Deploy ready",
      "Cancelled",
      "Duplicated",
      "Other",
    ]);
    expect(chartData.datasets[0]?.data).toEqual([1, 1, 0, 0, 1, 0, 0, 1, 0]);
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
});