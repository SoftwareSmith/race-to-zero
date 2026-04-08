import { describe, expect, it } from "vitest";
import { getDeadlineMetrics, getSummaryMetrics } from "./metrics";

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
});