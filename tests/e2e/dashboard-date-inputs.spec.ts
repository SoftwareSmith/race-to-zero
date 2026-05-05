import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  expectMetricValue,
  getExpectedOverviewMetrics,
  seedDashboardState,
} from "./support/dashboardQa";

const UPDATED_DEADLINE_FROM = "2026-04-01";
const UPDATED_DEADLINE_DATE = "2026-11-15";

test.describe("dashboard date input QA", () => {
  test("updates overview metrics when deadline inputs change and persists them across reload", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const expected = getExpectedOverviewMetrics({
      deadlineDate: UPDATED_DEADLINE_DATE,
      deadlineFromDate: UPDATED_DEADLINE_FROM,
    });

    await page.setViewportSize({ height: 1200, width: 1440 });
    await seedDashboardState(page, { clearStorage: false });
    await page.goto("./");

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(UPDATED_DEADLINE_FROM);
    await dateInputs.nth(1).fill(UPDATED_DEADLINE_DATE);

    await expectMetricValue(page, "Days left", expected.viewMetrics.daysLeft);
    await expectMetricValue(
      page,
      "Required net burn",
      expected.viewMetrics.requiredNetBurn,
    );

    await page.reload();

    const reloadedDateInputs = page.locator('input[type="date"]');
    await expect(reloadedDateInputs.nth(0)).toHaveValue(UPDATED_DEADLINE_FROM);
    await expect(reloadedDateInputs.nth(1)).toHaveValue(UPDATED_DEADLINE_DATE);
    await expectMetricValue(page, "Days left", expected.viewMetrics.daysLeft);

    await clientErrors.expectNoClientErrors();
  });
});