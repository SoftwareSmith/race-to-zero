import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  expectMetricValue,
  getExpectedOverviewMetrics,
  getExpectedPeriodsMetrics,
  gotoDashboard,
} from "./support/dashboardQa";

test.describe("dashboard core QA", () => {
  test("renders deterministic overview metrics and navigation chrome", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const expected = getExpectedOverviewMetrics();

    await gotoDashboard(page);

    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Periods" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await expectMetricValue(page, "Open bugs", expected.viewMetrics.openBugs);
    await expectMetricValue(page, "Days left", expected.viewMetrics.daysLeft);
    await expectMetricValue(
      page,
      "Current net burn",
      expected.viewMetrics.currentNetBurn,
    );
    await expectMetricValue(
      page,
      "Required net burn",
      expected.viewMetrics.requiredNetBurn,
    );
    await expectMetricValue(page, "Confidence", expected.viewMetrics.confidence);

    await expectMetricValue(
      page,
      "Fix velocity",
      expected.commandCenter.fixVelocity,
    );
    await expectMetricValue(
      page,
      "Required pace",
      expected.commandCenter.requiredPace,
    );
    await expectMetricValue(
      page,
      "Net difference",
      expected.commandCenter.netDifference,
    );

    await expect(page.getByText(expected.overlayLabel)).toBeVisible();
    await expect(page.getByText("Bug burndown")).toBeVisible();
    await expect(page.getByText("Open bugs by priority")).toBeVisible();
    await expect(page.getByText("Bugs by status")).toBeVisible();
    await expect(page.getByText("Open bug age")).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });

  test("renders deterministic periods metrics for the default 30 day range", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const expected = getExpectedPeriodsMetrics("30");

    await gotoDashboard(page);
    await page.getByRole("tab", { name: "Periods" }).click();

    await expect(page.getByRole("tab", { name: "Periods" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "30D" }),
    ).toHaveAttribute("aria-selected", "true");

    await expectMetricValue(
      page,
      "Bugs created",
      expected.viewMetrics.bugsCreated,
    );
    await expectMetricValue(
      page,
      "Bugs completed",
      expected.viewMetrics.bugsCompleted,
    );
    await expectMetricValue(page, "Net change", expected.viewMetrics.netChange);
    await expectMetricValue(
      page,
      "Completion rate",
      expected.viewMetrics.completionRate,
    );

    await expect(page.getByText("Created vs completed over time")).toBeVisible();
    await expect(page.getByText("Current vs previous window")).toBeVisible();
    await expect(page.getByText("Period-by-period net change")).toBeVisible();
    await expect(page.getByText("Fix vs intake trend")).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });

  test("stays usable on a narrow dashboard viewport", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoDashboard(page);

    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByLabel("From date")).toBeVisible();
    await expect(page.getByLabel("Deadline date")).toBeVisible();
    await expect(page.getByText("Bug burndown")).toBeVisible();
    await expect(page.getByText("Bugs by status")).toBeVisible();
    await expect(page.getByText("Open bug age")).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });
});