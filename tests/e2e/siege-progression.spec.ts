import { expect, test } from "@playwright/test";
import { killBugs } from "./weapons/weaponQa";
import {
  createConsoleCollectors,
  enableCanvasQa,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  waitForQaBugPositions,
} from "./support/dashboardQa";

test.describe.configure({ timeout: 120000 });

const progressionMetrics = {
  bugs: Array.from({ length: 68 }, (_, index) => ({
    completedAt: null,
    createdAt: `2026-04-${String((index % 9) + 1).padStart(2, "0")}`,
    priority: 4,
    stateName: "Backlog",
    stateType: "backlog",
    teamKey: "QA",
  })),
  generatedAt: "2026-04-09T12:00:00.000Z",
  lastUpdated: "2026-04-09T12:00:00.000Z",
};

test.describe("siege progression QA", () => {
  test("unlocks zapper at 12 kills and tracer bloom at 68 kills", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await page.setViewportSize({ height: 1200, width: 1440 });
    await enableCanvasQa(page);
    await mockMetrics(page, progressionMetrics);
    await seedDashboardState(page, {
      gameConfig: getStaticSiegeGameConfig(),
      showParticleCount: false,
    });

    await page.goto("./");
    await page.getByRole("button", { name: "Open interactive bug game" }).click();

    const hud = page.getByTestId("siege-hud");
    await expect(hud).toBeVisible();
    await waitForQaBugPositions(page);

    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(page.getByTestId("weapon-zapper")).toHaveAttribute(
      "data-locked",
      "true",
    );
    await expect(page.getByTestId("weapon-laser")).toHaveAttribute(
      "data-locked",
      "true",
    );

    await killBugs(page, 12);

    await expect(hud.locator("strong").nth(0)).toHaveText("56");
    await expect(hud.locator("strong").nth(1)).toHaveText("12");
    await expect(page.getByTestId("weapon-zapper")).toHaveAttribute(
      "data-locked",
      "false",
    );
    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(page.getByTestId("weapon-laser")).toHaveAttribute(
      "data-locked",
      "true",
    );

    await killBugs(page, 68);

    await expect(hud.locator("strong").nth(0)).toHaveText("0");
    await expect(hud.locator("strong").nth(1)).toHaveText("68");
    await expect(page.getByTestId("weapon-laser")).toHaveAttribute(
      "data-locked",
      "false",
    );
    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute(
      "data-current",
      "true",
    );

    await clientErrors.expectNoClientErrors();
  });
});