import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  enableCanvasQa,
  getQaBugPositions,
  getQaLastHit,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  setQaLiveBugPosition,
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
  test("reports wrapped seam copies for a seam-adjacent live bug", async ({ page }) => {
    await page.setViewportSize({ height: 1200, width: 1440 });
    await enableCanvasQa(page);
    await mockMetrics(page, singleLowBugMetrics);
    await seedDashboardState(page, {
      gameConfig: getStaticSiegeGameConfig(),
    });

    await page.goto("./");
    await page.getByRole("button", { name: "Open interactive bug game" }).click();

    await expect(page.getByTestId("siege-hud")).toBeVisible();
    await waitForQaBugPositions(page);

    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    const [bug] = await getQaBugPositions(page);
    expect(bug).toBeTruthy();

    const seamY = Math.round((canvasBox?.height ?? 0) * 0.5);
    const moved = await setQaLiveBugPosition(page, {
      heading: 0,
      index: bug.index,
      vx: 0,
      vy: 0,
      x: 4,
      y: seamY,
    });
    expect(moved).toBe(true);

    await expect
      .poll(async () => {
        const positions = await getQaBugPositions(page);
        return positions.filter((position) => position.index === bug.index).length;
      })
      .toBe(2);

    const seamCopies = (await getQaBugPositions(page)).filter(
      (position) => position.index === bug.index,
    );
    const canonicalCopy = seamCopies.find((position) => !position.isWrappedCopy);
    const wrappedCopy = seamCopies.find((position) => position.isWrappedCopy);

    expect(canonicalCopy).toBeTruthy();
    expect(wrappedCopy).toBeTruthy();

    expect(canonicalCopy?.copyIndex).toBe(0);
    expect(canonicalCopy?.canonicalX).toBeCloseTo((canvasBox?.x ?? 0) + 4, 0);
    expect(canonicalCopy?.canonicalY).toBeCloseTo((canvasBox?.y ?? 0) + seamY, 0);
    expect(canonicalCopy?.x).toBeLessThan((canvasBox?.x ?? 0) + (canonicalCopy?.radius ?? 0) + 8);

    expect(wrappedCopy?.isWrappedCopy).toBe(true);
    expect(wrappedCopy?.canonicalX).toBeCloseTo(canonicalCopy?.canonicalX ?? 0, 0);
    expect(wrappedCopy?.canonicalY).toBeCloseTo(canonicalCopy?.canonicalY ?? 0, 0);
    expect(wrappedCopy?.x).toBeGreaterThan(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) - (wrappedCopy?.radius ?? 0) - 8,
    );
  });

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
    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("1");
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("0");

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
    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("0");
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("1");

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
    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("1");

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

    await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("0");
    await expect(page.getByTestId("siege-complete-overlay")).toBeVisible();
  });
});