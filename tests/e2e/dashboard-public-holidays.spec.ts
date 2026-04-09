import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  expectMetricValue,
  getExpectedOverviewMetrics,
  seedDashboardState,
} from "./support/dashboardQa";

const HOLIDAY_SENSITIVE_DEADLINE = "2026-04-28";

test.describe("dashboard public holiday QA", () => {
  test("excluding WA public holidays changes workday math and persists across reload", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);
    const baselineMetrics = getExpectedOverviewMetrics({
      deadlineDate: HOLIDAY_SENSITIVE_DEADLINE,
      workdaySettings: {
        excludePublicHolidays: false,
        excludeWeekends: false,
      },
    });
    const holidayAdjustedMetrics = getExpectedOverviewMetrics({
      deadlineDate: HOLIDAY_SENSITIVE_DEADLINE,
      workdaySettings: {
        excludePublicHolidays: true,
        excludeWeekends: false,
      },
    });

    await page.setViewportSize({ height: 1200, width: 1440 });
    await seedDashboardState(page, {
      clearStorage: false,
      deadlineDate: HOLIDAY_SENSITIVE_DEADLINE,
    });
    await page.goto("./");
    await expect(
      page.getByRole("heading", { level: 1, name: "Race to Zero Bugs" }),
    ).toBeVisible();

    await expectMetricValue(page, "Days left", baselineMetrics.viewMetrics.daysLeft);

    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByText("Exclude public holidays (AWST)").click();

    await expectMetricValue(
      page,
      "Workdays left",
      holidayAdjustedMetrics.viewMetrics.daysLeft,
    );
    await expectMetricValue(
      page,
      "Required net burn",
      holidayAdjustedMetrics.viewMetrics.requiredNetBurn,
    );
    await expectMetricValue(
      page,
      "Required pace",
      holidayAdjustedMetrics.commandCenter.requiredPace,
    );

    await page.reload();

    await expectMetricValue(
      page,
      "Workdays left",
      holidayAdjustedMetrics.viewMetrics.daysLeft,
    );
    await expectMetricValue(
      page,
      "Required pace",
      holidayAdjustedMetrics.commandCenter.requiredPace,
    );

    await clientErrors.expectNoClientErrors();
  });
});