import { describe, expect, it } from "vitest";
import {
  createEmptyBugCounts,
  getBugCountsFromPriorityDistribution,
  getBugCountsKey,
  getBugTotal,
  normalizeBugCounts,
} from "./bugs";

describe("bug utilities", () => {
  it("creates empty bug counts", () => {
    expect(createEmptyBugCounts()).toEqual({
      high: 0,
      low: 0,
      medium: 0,
      urgent: 0,
    });
  });

  it("normalizes missing and invalid values", () => {
    expect(
      normalizeBugCounts({
        high: 3.9,
        low: -10,
        urgent: 2,
      }),
    ).toEqual({
      high: 3,
      low: 0,
      medium: 0,
      urgent: 2,
    });
  });

  it("maps priority distribution into bug variants", () => {
    expect(
      getBugCountsFromPriorityDistribution([
        { count: 4, label: "Urgent" },
        { count: 6, label: "High" },
        { count: 8, label: "Normal" },
        { count: 10, label: "Low" },
        { count: 3, label: "Unspecified" },
      ]),
    ).toEqual({
      high: 6,
      low: 13,
      medium: 8,
      urgent: 4,
    });
  });

  it("builds a stable bug count key", () => {
    expect(getBugCountsKey({ low: 2, urgent: 1 })).toBe(
      "low:2|medium:0|high:0|urgent:1",
    );
    expect(getBugCountsKey({ high: 0, low: 2, medium: 0, urgent: 1 })).toBe(
      getBugCountsKey({ low: 2, urgent: 1 }),
    );
  });

  it("totals normalized bug counts", () => {
    expect(getBugTotal({ high: 3, low: 4.8, medium: -2, urgent: 1 })).toBe(8);
  });
});