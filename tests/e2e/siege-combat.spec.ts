import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  enableCanvasQa,
  getQaBugPositions,
  getQaLastHit,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  waitForQaBugPositions,
} from "./support/dashboardQa";

const singleLowBugMetrics = {
  bugs: [
    {
      completedAt: null,
      createdAt: "2026-04-01",
      priority: 4,
      stateName: "Backlog",
      stateType: "backlog",
      teamKey: "QA",
    },
  ],
  generatedAt: "2026-04-09T12:00:00.000Z",
  lastUpdated: "2026-04-09T12:00:00.000Z",
};

test.describe("siege combat QA", () => {
  test("clicking a bug kills it and updates siege HUD counts", async ({ page }) => {
    const clientErrors = createConsoleCollectors(page);

    await page.setViewportSize({ height: 1200, width: 1440 });
    await enableCanvasQa(page);
    await mockMetrics(page, singleLowBugMetrics);
    await seedDashboardState(page, {
      gameConfig: getStaticSiegeGameConfig(),
    });

    await page.goto("./");
    await page.getByRole("button", { name: "Open interactive bug game" }).click();

    const hud = page.getByTestId("siege-hud");
    await expect(hud).toBeVisible();
    await expect(hud.locator("strong").nth(0)).toHaveText("1");
    await expect(hud.locator("strong").nth(1)).toHaveText("0");

    await waitForQaBugPositions(page);
    const [bug] = await getQaBugPositions(page);
    expect(bug).toBeTruthy();
    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    const clickPosition = {
      x: bug.x - (canvasBox?.x ?? 0),
      y: bug.y - (canvasBox?.y ?? 0),
    };

    await canvas.click({ force: true, position: clickPosition });
    const firstHit = await getQaLastHit(page);
    expect(firstHit).toBeTruthy();
    expect(firstHit?.variant).toBe("low");
    expect(firstHit?.defeated).toBe(true);
    await expect(hud.locator("strong").nth(0)).toHaveText("0");
    await expect(hud.locator("strong").nth(1)).toHaveText("1");

    await clientErrors.expectNoClientErrors();
  });

  test("shows the completion overlay after the final live bug is killed", async ({ page }) => {
    await page.setViewportSize({ height: 1200, width: 1440 });
    await enableCanvasQa(page);
    await mockMetrics(page, singleLowBugMetrics);
    await seedDashboardState(page, {
      gameConfig: getStaticSiegeGameConfig(),
    });

    await page.goto("./");
    await page.getByRole("button", { name: "Open interactive bug game" }).click();

    const hud = page.getByTestId("siege-hud");
    await expect(hud).toBeVisible();
    await expect(hud.locator("strong").nth(0)).toHaveText("1");

    await waitForQaBugPositions(page);
    const [bug] = await getQaBugPositions(page);
    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();
    expect(bug).toBeTruthy();
    expect(canvasBox).toBeTruthy();

    await canvas.click({
      force: true,
      position: {
        x: bug.x - (canvasBox?.x ?? 0),
        y: bug.y - (canvasBox?.y ?? 0),
      },
    });

    await expect(hud.locator("strong").nth(0)).toHaveText("0");
    await expect(page.getByTestId("siege-complete-overlay")).toBeVisible();
  });
});