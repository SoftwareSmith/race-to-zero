import { expect, test } from "@playwright/test";
import {
  QA_CUSTOM_FROM,
  QA_CUSTOM_TO,
  chooseCustomPeriod,
  createConsoleCollectors,
  expectMetricValue,
  getExpectedHistoryMetrics,
  getExpectedInsightsMetrics,
  getExpectedOverviewMetrics,
  getExpectedPeriodsMetrics,
  gotoDashboard,
} from "./support/dashboardQa";

test.describe("dashboard navigation QA", () => {
  test("supports switching between dashboard tabs with a deterministic custom range", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const overview = getExpectedOverviewMetrics({ teamKey: "CP" });
    const custom = getExpectedPeriodsMetrics("custom", "CP");
    const insights = getExpectedInsightsMetrics("custom", "CP");
    const history = getExpectedHistoryMetrics("custom", "CP");

    await gotoDashboard(page);
    await page.getByLabel("Team filter").selectOption("CP");
    await expect(page.getByLabel("Team filter")).toHaveValue("CP");
    await expectMetricValue(page, "Open bugs", overview.viewMetrics.openBugs);

    await page.getByRole("tab", { name: "Trend" }).click();
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

    await page.getByRole("tab", { name: "SLAs" }).click();
    await expect(page.getByRole("tab", { name: "SLAs" })).toHaveAttribute(
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
      "SLA breaches",
      insights.viewMetrics.overdue,
    );

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "Custom" }),
    ).toHaveAttribute("aria-selected", "true");
    await expectMetricValue(
      page,
      "Closed work",
      history.viewMetrics.closedWork,
    );
    await expectMetricValue(
      page,
      "Completed share",
      history.viewMetrics.completedShare,
    );
    await expectMetricValue(
      page,
      "Cancelled share",
      history.viewMetrics.cancelledShare,
    );
    await expectMetricValue(
      page,
      "Median cycle",
      history.viewMetrics.medianCycle,
    );
    await expectMetricValue(
      page,
      "P75 cycle",
      history.viewMetrics.p75Cycle,
    );
    await expectMetricValue(
      page,
      "P90 cycle",
      history.viewMetrics.p90Cycle,
    );

    await expect(page.getByLabel("Team filter")).toHaveValue("CP");
    await expectMetricValue(
      page,
      "Closed work",
      history.viewMetrics.closedWork,
    );

    await page.getByRole("tab", { name: "Target" }).click();
    await expect(page.getByRole("tab", { name: "Target" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Team filter")).toHaveValue("CP");
    await expectMetricValue(page, "Open bugs", overview.viewMetrics.openBugs);
    await expect(page.getByText(overview.overlayLabel)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Team filter")).toHaveValue("CP");
    await expectMetricValue(page, "Open bugs", overview.viewMetrics.openBugs);

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

  test("hides dashboard chart tooltips when siege mode opens", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await gotoDashboard(page);

    const chartCanvas = page.locator('[data-siege-panel="priority-breakdown"] canvas');
    const customTooltip = page.locator('[data-chart-tooltip="custom"]').first();

    await chartCanvas.hover();
    await expect(customTooltip).toHaveCSS("opacity", "1");

    await page
      .getByRole("button", { name: "Open interactive bug game" })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
      });

    await expect(page.getByTestId("siege-hud")).toBeVisible();
    await expect(customTooltip).toHaveCSS("opacity", "0");

    await clientErrors.expectNoClientErrors();
  });
});