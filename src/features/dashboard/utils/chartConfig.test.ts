import { describe, expect, it, afterEach } from "vitest";
import {
  getLineChartOptions,
  removeAllCustomChartTooltips,
  showUnifiedAllValuesTooltip,
} from "./chartConfig";

afterEach(() => {
  removeAllCustomChartTooltips();
});

describe("chart tooltip formatting", () => {
  it("shows share-of-total values in unified all-values tooltips", () => {
    const chart = {
      id: 101,
      canvas: {
        getBoundingClientRect: () => ({
          bottom: 280,
          height: 200,
          left: 20,
          right: 420,
          top: 80,
          width: 400,
          x: 20,
          y: 80,
          toJSON: () => null,
        }),
      },
      chartArea: {
        right: 360,
        top: 16,
      },
      data: {
        labels: ["Urgent", "High", "Medium"],
        datasets: [
          {
            backgroundColor: ["#f87171", "#7dd3fc", "#5eead4"],
            data: [10, 30, 60],
          },
        ],
      },
    };

    showUnifiedAllValuesTooltip(
      chart,
      new DOMRect(0, 0, 200, 60),
      "priority-breakdown",
    );

    const tooltip = document.body.querySelector(
      '[data-chart-tooltip="custom"][data-chart-id="101"]',
    );

    expect(tooltip).not.toBeNull();
    expect(tooltip?.innerHTML).toContain("10 (10%)");
    expect(tooltip?.innerHTML).toContain("30 (30%)");
    expect(tooltip?.innerHTML).toContain("60 (60%)");
  });

  it("shows percent-valued unified tooltips with a percent suffix", () => {
    const chart = {
      id: 102,
      canvas: {
        getBoundingClientRect: () => ({
          bottom: 280,
          height: 200,
          left: 20,
          right: 420,
          top: 80,
          width: 400,
          x: 20,
          y: 80,
          toJSON: () => null,
        }),
      },
      chartArea: {
        right: 360,
        top: 16,
      },
      data: {
        labels: ["Urgent", "High"],
        datasets: [
          {
            backgroundColor: ["#f87171", "#7dd3fc"],
            data: [100, 62.5],
          },
        ],
      },
    };

    showUnifiedAllValuesTooltip(
      chart,
      new DOMRect(0, 0, 200, 60),
      "sla-hit-rate-by-priority",
    );

    const tooltip = document.body.querySelector(
      '[data-chart-tooltip="custom"][data-chart-id="102"]',
    );

    expect(tooltip?.innerHTML).toContain("100%");
    expect(tooltip?.innerHTML).toContain("62.5%");
  });

  it("keeps period-rate-history standard tooltips on count-plus-share formatting", () => {
    const options = getLineChartOptions("line", "period-rate-history", 2);
    const labelCallback = options.plugins?.tooltip?.callbacks?.label as
      | ((context: unknown) => string | string[] | void)
      | undefined;
    const label = labelCallback?.({
      dataset: {
        data: [2, 3, 5],
        label: "Closure rate",
      },
      raw: 2,
    });

    expect(label).toBe("Closure rate: 2 (20%)");
  });
});