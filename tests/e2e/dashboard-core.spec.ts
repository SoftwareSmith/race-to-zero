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

    await expect(page.getByRole("tab", { name: "Target" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Trend" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.getByLabel("Team filter")).toBeVisible();

    await expectMetricValue(page, "Open bugs", expected.viewMetrics.openBugs);
    await expectMetricValue(page, "Days left", expected.viewMetrics.daysLeft);
    await expectMetricValue(
      page,
      "Net backlog change",
      expected.viewMetrics.currentNetBurn,
    );
    await expectMetricValue(
      page,
      "Required reduction",
      expected.viewMetrics.requiredNetBurn,
    );
    await expectMetricValue(page, "Confidence", expected.viewMetrics.confidence);

    await expect(page.getByText(expected.overlayLabel)).toBeVisible();
    await expect(page.getByText("Bug burndown")).toBeVisible();
    await expect(page.getByText("Open bugs by priority")).toBeVisible();
    await expect(page.getByText("Active bugs by status")).toBeVisible();
    await expect(page.getByText("Active bug age")).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });

  test("renders deterministic periods metrics for the default 30 day range", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const expected = getExpectedPeriodsMetrics("30");

    await gotoDashboard(page);
    await page.getByRole("tab", { name: "Trend" }).click();

    await expect(page.getByRole("tab", { name: "Trend" })).toHaveAttribute(
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
    await expectMetricValue(
      page,
      "Other closures",
      expected.viewMetrics.otherClosures,
    );
    await expectMetricValue(
      page,
      "Bugs closed",
      expected.viewMetrics.bugsClosed,
    );
    await expectMetricValue(page, "Net change", expected.viewMetrics.netChange);

    await expect(page.getByText("Created vs closed")).toBeVisible();
    await expect(page.getByText("Current vs previous window")).toBeVisible();
    await expect(page.getByText("Period-by-period net change")).toBeVisible();
    await expect(page.getByText("Creation vs closure rate trend")).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });

  test("stays usable on a narrow dashboard viewport", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoDashboard(page);

    await expect(page.getByRole("tab", { name: "Target" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "History" })).toBeVisible();
    await expect(page.getByLabel("Team filter")).toBeVisible();
    await expect(page.getByLabel("Tracking start date")).toBeVisible();
    await expect(page.getByLabel("Target deadline date")).toBeVisible();
    await expect(page.getByText("Bug burndown")).toBeVisible();
    await expect(page.getByText("Active bugs by status")).toBeVisible();
    await expect(page.getByText("Active bug age")).toBeVisible();

    await clientErrors.expectNoClientErrors();
  });

  test("uses pointer only for actionable dashboard controls", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await gotoDashboard(page);

    await expect(page.getByRole("tab", { name: "Target" })).toHaveCSS(
      "cursor",
      "pointer",
    );
    await expect(page.getByRole("button", { name: "Open settings" })).toHaveCSS(
      "cursor",
      "pointer",
    );
    await expect(page.getByLabel("Team filter")).toHaveCSS("cursor", "pointer");
    await expect(page.getByLabel("Tracking start date")).toHaveCSS(
      "cursor",
      "pointer",
    );
    await expect(page.locator('[data-siege-panel="open-bugs"]')).toHaveCSS(
      "cursor",
      "default",
    );

    await page.getByRole("tab", { name: "Trend" }).click();
    await expect(page.getByRole("button", { name: "30D" })).toHaveCSS(
      "cursor",
      "pointer",
    );

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.getByText("Settings", { exact: true })).toHaveCSS(
      "cursor",
      "default",
    );
    await expect(
      page.locator('label:has-text("Exclude weekends")'),
    ).toHaveCSS("cursor", "pointer");

    await clientErrors.expectNoClientErrors();
  });
});