import { expect, test } from "@playwright/test";
import {
  enableCanvasQa,
  getStaticSiegeGameConfig,
  getQaBugPositions,
  mockMetrics,
  seedDashboardState,
  setQaSiegeProgress,
} from "./support/dashboardQa";

const completionMetrics = {
  bugs: Array.from({ length: 36 }, (_, index) => ({
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

test("arms siege mode from the dashboard", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const statsHud = page.getByTestId("siege-hud");

  await expect(statsHud).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeVisible();
  await expect(statsHud.getByText("Bugs")).toBeVisible();
  await expect(statsHud.getByText("Kills")).toBeVisible();
  await expect(statsHud.getByText("Active tool")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kill all bugs" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toHaveCount(0);

  const box = await statsHud.boundingBox();
  expect(box?.width ?? 0).toBeLessThan(380);
});

test("keeps siege controls stable during pointer movement and exits cleanly", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  await page.mouse.move(120, 120);
  await page.mouse.move(640, 220);
  await page.mouse.move(980, 520);

  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await page.getByRole("button", { name: "Back to dashboard" }).click();

  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toBeVisible();
  await expect(page.getByTestId("siege-hud")).toBeHidden();
});

test("esc exits siege mode", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toBeVisible();
  await expect(page.getByTestId("siege-hud")).toBeHidden();
});

test("shows the completion overlay and allows a doubled rerun", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, completionMetrics);
  await seedDashboardState(page, {
    gameConfig: getStaticSiegeGameConfig(),
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await setQaSiegeProgress(page, { kills: 36, remainingBugs: 0 });

  const overlay = page.getByTestId("siege-complete-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText("Swarm cleared. The lane is stable.")).toBeVisible();
  await expect(overlay.getByText(/36 bugs cleared in 00:00/i)).toBeVisible();

  await overlay.getByRole("button", { name: "Double bug count" }).click();
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId("siege-hud").locator("strong").nth(0)).toHaveText("72");
  await expect(page.getByTestId("siege-hud").locator("strong").nth(1)).toHaveText("0");
});

test("debug mode can kill all bugs to force the completion overlay", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, completionMetrics);
  await seedDashboardState(page, {
    gameConfig: getStaticSiegeGameConfig(),
  });

  await page.goto("./?siegeDebug=1");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const killAllButton = page.getByRole("button", { name: "Kill all bugs" });
  await expect(killAllButton).toBeVisible();
  await killAllButton.click();

  const overlay = page.getByTestId("siege-complete-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText(/36 bugs cleared in 00:00/i)).toBeVisible();
  await expect.poll(async () => (await getQaBugPositions(page)).length).toBe(0);
});

test("advances the visible siege timer during a live run", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const hud = page.getByTestId("siege-hud");
  await expect(hud).toBeVisible();
  await expect(hud.locator("strong").nth(3)).toHaveText("00:00");

  await page.waitForTimeout(1400);

  await expect(hud.locator("strong").nth(3)).toHaveText("00:01");
});

test("opening the codex pauses the timer and hides the top toggle in detail view", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const hud = page.getByTestId("siege-hud");
  await expect(hud).toBeVisible();
  await expect(hud.locator("strong").nth(3)).toHaveText("00:00");

  await page.getByRole("button", { name: "Open codex" }).click();

  const codexModal = page.getByTestId("codex-modal");
  await expect(codexModal).toBeVisible();
  await expect
    .poll(() => codexModal.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("default");
  await page.waitForTimeout(1400);
  await expect(hud.locator("strong").nth(3)).toHaveText("00:00");

  const summaryCard = codexModal.getByTestId("codex-summary-card").first();
  await expect
    .poll(() => summaryCard.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("pointer");

  await summaryCard.click();
  await expect(page.getByTestId("codex-detail-view")).toBeVisible();
  await expect(page.getByTestId("codex-tabs")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(codexModal).toBeHidden();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toHaveCount(0);

  await page.waitForTimeout(1400);
  await expect(hud.locator("strong").nth(3)).toHaveText("00:01");
});

test("shows the completion overlay when the live siege progress reaches zero bugs", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, completionMetrics);
  await seedDashboardState(page, {
    gameConfig: getStaticSiegeGameConfig(),
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await setQaSiegeProgress(page, { kills: 36, remainingBugs: 1 });
  await setQaSiegeProgress(page, { kills: 36, remainingBugs: 0 });

  const overlay = page.getByTestId("siege-complete-overlay");
  await expect(overlay).toBeVisible();
});