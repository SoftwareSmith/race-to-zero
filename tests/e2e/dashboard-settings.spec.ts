import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  expectMetricValue,
  getExpectedOverviewMetrics,
  seedDashboardState,
} from "./support/dashboardQa";

test.describe("dashboard settings QA", () => {
  test("updates deadline math when excluding weekends and persists bug overlay visibility", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const defaultMetrics = getExpectedOverviewMetrics({
      workdaySettings: {
        excludePublicHolidays: false,
        excludeWeekends: false,
      },
    });
    const workdayMetrics = getExpectedOverviewMetrics({
      workdaySettings: {
        excludePublicHolidays: false,
        excludeWeekends: true,
      },
    });

    await page.setViewportSize({ height: 1200, width: 1440 });
    await seedDashboardState(page, { clearStorage: false });
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1, name: "Race to Zero Bugs" })).toBeVisible();

    await expectMetricValue(page, "Days left", defaultMetrics.viewMetrics.daysLeft);
    await expect(page.getByText(defaultMetrics.overlayLabel)).toBeVisible();

    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByText("Exclude weekends").click();

    await expectMetricValue(page, "Workdays left", workdayMetrics.viewMetrics.daysLeft);
    await expectMetricValue(
      page,
      "Required net burn",
      workdayMetrics.viewMetrics.requiredNetBurn,
    );

    await page.getByRole("button", { name: "Open bug field settings" }).click();
    await page.getByText("Show bug particle count").click();
    await expect(page.getByText(defaultMetrics.overlayLabel)).toHaveCount(0);

    await page.reload();

    await expectMetricValue(page, "Workdays left", workdayMetrics.viewMetrics.daysLeft);
    await expect(page.getByText(defaultMetrics.overlayLabel)).toHaveCount(0);

    await clientErrors.expectNoClientErrors();
  });
});