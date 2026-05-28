import { describe, expect, it } from "vitest";
import { buildMetrics, isBugIssue } from "./fetch-linear";

describe("fetch-linear", () => {
  it("classifies bug issues by label or parent label name", () => {
    expect(
      isBugIssue({
        createdAt: "2026-05-01T00:00:00.000Z",
        labels: {
          nodes: [{ name: " Bug ", parent: null }],
        },
      }),
    ).toBe(true);

    expect(
      isBugIssue({
        createdAt: "2026-05-01T00:00:00.000Z",
        labels: {
          nodes: [{ name: "Escalation", parent: { name: "Bug Reason" } }],
        },
      }),
    ).toBe(true);

    expect(
      isBugIssue({
        createdAt: "2026-05-01T00:00:00.000Z",
        labels: {
          nodes: [{ name: "Incident", parent: { name: "Operations" } }],
        },
      }),
    ).toBe(false);
  });

  it("filters non-bugs and sorts bug metrics by creation date", () => {
    const metrics = buildMetrics([
      {
        createdAt: "2026-05-03T09:00:00.000Z",
        completedAt: "2026-05-04T09:00:00.000Z",
        labels: { nodes: [{ name: "Bug", parent: null }] },
        priority: 2,
        state: { name: "Done", type: "completed" },
        team: { key: "CP" },
      },
      {
        createdAt: "2026-05-01T09:00:00.000Z",
        labels: { nodes: [{ name: "Maintenance", parent: null }] },
        priority: 3,
        state: { name: "Backlog", type: "backlog" },
        team: { key: "CP" },
      },
      {
        archivedAt: "2026-05-05T09:00:00.000Z",
        createdAt: "2026-05-02T09:00:00.000Z",
        labels: { nodes: [{ name: "Customer", parent: { name: "Bug Reason" } }] },
        priority: 1,
        state: { name: "Canceled", type: "canceled" },
        team: { key: "TA" },
        updatedAt: "2026-05-05T09:00:00.000Z",
      },
    ]);

    expect(metrics.bugs).toEqual([
      {
        archivedAt: "2026-05-05",
        autoClosedAt: null,
        canceledAt: null,
        completedAt: null,
        createdAt: "2026-05-02",
        dueDate: null,
        priority: 1,
        stateName: "Canceled",
        stateType: "canceled",
        teamKey: "TA",
        updatedAt: "2026-05-05",
      },
      {
        archivedAt: null,
        autoClosedAt: null,
        canceledAt: null,
        completedAt: "2026-05-04",
        createdAt: "2026-05-03",
        dueDate: null,
        priority: 2,
        stateName: "Done",
        stateType: "completed",
        teamKey: "CP",
        updatedAt: null,
      },
    ]);
  });
});