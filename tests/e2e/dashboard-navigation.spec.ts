import { expect, test } from "@playwright/test";
import {
  QA_CUSTOM_FROM,
  QA_CUSTOM_TO,
  chooseCustomPeriod,
  createConsoleCollectors,
  expectMetricValue,
  getExpectedInsightsMetrics,
  getExpectedOverviewMetrics,
  getExpectedPeriodsMetrics,
  gotoDashboard,
} from "./support/dashboardQa";

test.describe("dashboard navigation QA", () => {
  test("supports switching between overview, periods, and a deterministic custom range", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const overview = getExpectedOverviewMetrics();
    const custom = getExpectedPeriodsMetrics("custom");
    const insights = getExpectedInsightsMetrics("custom");

    await gotoDashboard(page);
    await expectMetricValue(page, "Open bugs", overview.viewMetrics.openBugs);

    await page.getByRole("tab", { name: "Periods" }).click();
    await chooseCustomPeriod(page);

    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.nth(0)).toHaveValue(QA_CUSTOM_FROM);
    await expect(dateInputs.nth(1)).toHaveValue(QA_CUSTOM_TO);
    await expect(
      page.getByRole("button", { name: "Custom" }),
    ).toHaveAttribute("aria-selected", "true");

    await expectMetricValue(
      page,
      "Bugs created",
      custom.viewMetrics.bugsCreated,
    );
    await expectMetricValue(
      page,
      "Bugs closed",
      custom.viewMetrics.bugsCompleted,
    );
    await expectMetricValue(page, "Net change", custom.viewMetrics.netChange);
    await expectMetricValue(page, "Closure rate", custom.viewMetrics.completionRate);

    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.getByRole("tab", { name: "Insights" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Custom" }),
    ).toHaveAttribute("aria-selected", "true");
    await expectMetricValue(
      page,
      "SLA hit rate",
      insights.viewMetrics.slaHitRate,
    );
    await expectMetricValue(
      page,
      "On time",
      insights.viewMetrics.onTime,
    );
    await expectMetricValue(
      page,
      "Overdue",
      insights.viewMetrics.overdue,
    );

    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectMetricValue(page, "Open bugs", overview.viewMetrics.openBugs);
    await expect(page.getByText(overview.overlayLabel)).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });

  test("keeps siege mode counts aligned with the rendered backlog", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const overview = getExpectedOverviewMetrics();

    await gotoDashboard(page);
    await page.getByRole("button", { name: "Open interactive bug game" }).click();

    const hud = page.getByTestId("siege-hud");
    await expect(hud).toBeVisible();
    await expect(hud.getByText("Bugs")).toBeVisible();
    await expect(hud.getByText("Kills")).toBeVisible();
    await expect(hud.locator("strong").first()).toHaveText(
      overview.viewMetrics.openBugs,
    );
    await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await expect(page.getByRole("button", { name: "Open interactive bug game" })).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });
});