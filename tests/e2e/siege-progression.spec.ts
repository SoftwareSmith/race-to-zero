import { expect, test } from "@playwright/test";
import { killBugs } from "./weapons/weaponQa";
import {
  createConsoleCollectors,
  enableCanvasQa,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  setQaSiegeProgress,
  waitForQaBugPositions,
} from "./support/dashboardQa";

test.describe.configure({ timeout: 120000 });

const progressionMetrics = {
  bugs: Array.from({ length: 90 }, (_, index) => ({
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
  test("unlocks garbage collector at 14 kills, lightning at 32, and fork bomb at 54", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await page.setViewportSize({ height: 1200, width: 1440 });
    await enableCanvasQa(page);
    await mockMetrics(page, progressionMetrics);
    await seedDashboardState(page, {
      gameConfig: getStaticSiegeGameConfig(),
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
    await expect(page.getByTestId("weapon-nullpointer")).toHaveAttribute(
      "data-locked",
      "true",
    );
    await expect(page.getByTestId("weapon-chain")).toHaveAttribute(
      "data-locked",
      "true",
    );

    await setQaSiegeProgress(page, { kills: 14, remainingBugs: 76 });

    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("76");
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("14");
    await expect(page.getByText("New Garbage Collector weapon unlocked")).toBeVisible();
    await expect(page.getByTestId("weapon-nullpointer")).toHaveAttribute(
      "data-locked",
      "false",
    );
    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute(
      "data-current",
      "true",
    );
    await expect(page.getByTestId("weapon-chain")).toHaveAttribute(
      "data-locked",
      "true",
    );

    await setQaSiegeProgress(page, { kills: 32, remainingBugs: 58 });

    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("58");
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("32");
    await expect(page.getByText("New Lightning weapon unlocked")).toBeVisible();
    await expect(page.getByTestId("weapon-chain")).toHaveAttribute(
      "data-locked",
      "false",
    );
    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute(
      "data-current",
      "true",
    );

    await setQaSiegeProgress(page, { kills: 54, remainingBugs: 36 });

    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("36");
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("54");
    await expect(page.getByText("New Fork Bomb weapon unlocked")).toBeVisible();
    await expect(page.getByTestId("weapon-plasma")).toHaveAttribute(
      "data-locked",
      "false",
    );

    await clientErrors.expectNoClientErrors();
  });

  test("hammer levels up through both upgrades in the live HUD", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await page.setViewportSize({ height: 1200, width: 1440 });
    await enableCanvasQa(page);
    await mockMetrics(page, progressionMetrics);
    await seedDashboardState(page, {
      gameConfig: getStaticSiegeGameConfig(),
    });

    await page.goto("./");
    await page.getByRole("button", { name: "Open interactive bug game" }).click();

    const progressToggle = page.getByRole("button", {
      name: /expand progress details|collapse progress details/i,
    });

    await expect(progressToggle).toContainText("Hammer");
    await expect(progressToggle).toContainText("Level 1");

    await killBugs(page, 20);

    await expect(progressToggle).toContainText("Refactor Tool");
    await expect(progressToggle).toContainText("Level 2");

    await killBugs(page, 60);

    await expect(progressToggle).toContainText("Rewrite Engine");
    await expect(progressToggle).toContainText("Level 3");

    await clientErrors.expectNoClientErrors();
  });
});