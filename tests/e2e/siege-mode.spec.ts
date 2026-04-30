import { expect, test } from "@playwright/test";
import {
  clickQaBug,
  clearQaLiveBugs,
  enableCanvasQa,
  getQaLiveBugCount,
  getStaticSiegeGameConfig,
  getQaBugPositions,
  mockMetrics,
  seedDashboardState,
  setQaSiegeProgress,
  setQaSurvivalState,
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

const singleBugMetrics = {
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

test("arms siege mode from the dashboard", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const statsHud = page.getByTestId("siege-hud");

  await expect(statsHud).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Time Attack", selected: true })).toBeVisible();
  await expect(page.getByTestId("siege-remaining-stat")).toBeVisible();
  await expect(statsHud.getByText("Kills")).toBeVisible();
  await expect(statsHud.getByText("Active tool")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kill all bugs" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toHaveCount(0);

  const box = await statsHud.boundingBox();
  expect(box?.height ?? 0).toBeLessThan(160);
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

test("time attack bugs keep a screen-wide organic distribution", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page, { stabilizeEngine: false });
  await mockMetrics(page, completionMetrics);

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await page.waitForTimeout(2200);

  const positions = await getQaBugPositions(page);
  expect(positions.length).toBeGreaterThan(20);

  const quadrants = new Set(
    positions.map((position) =>
      `${position.x >= 720 ? "right" : "left"}-${position.y >= 600 ? "bottom" : "top"}`,
    ),
  );
  const centralCount = positions.filter(
    (position) =>
      position.x > 1440 * 0.34 &&
      position.x < 1440 * 0.66 &&
      position.y > 1200 * 0.28 &&
      position.y < 1200 * 0.72,
  ).length;

  expect(quadrants.size).toBe(4);
  expect(centralCount / positions.length).toBeLessThan(0.55);
});

test("esc exits siege mode", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toBeVisible();
  await expect(page.getByTestId("siege-hud")).toBeHidden();
});

test("shows the completion overlay and allows a replay", async ({ page }) => {
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
  await expect(overlay.getByTestId("siege-complete-title")).toHaveText("Swarm cleared.");
  await expect(overlay.getByTestId("siege-complete-quip")).toBeVisible();
  await expect(overlay.getByText(/36 bugs cleared in 00:00/i)).toBeVisible();

  await overlay.getByTestId("siege-complete-replay").click();
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("36");
  await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("0");
});

test("survival shows wave pressure and advances after a cleared wave", async ({ page }) => {
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
  await overlay.getByTestId("siege-complete-switch-mode").click();
  await expect(overlay).toBeHidden();

  await expect(page.getByRole("tab", { name: "Survival", selected: true })).toBeVisible();
  await expect(page.getByTestId("siege-wave-toast")).toContainText("Wave 1");
  await expect(page.getByTestId("siege-wave-stat").locator("strong")).toHaveText("1");
  await expect(page.getByTestId("siege-spawn-rate-stat").locator("strong")).toContainText("/s");
  await expect(page.getByTestId("siege-wave-loader-pill")).toBeVisible();
  await expect(page.getByTestId("siege-wave-loader-fill")).toBeVisible();
  await expect(page.getByTestId("siege-offline-pressure")).toBeVisible();

  const initialLoaderWidth = await page
    .getByTestId("siege-wave-loader-fill")
    .evaluate((element) => element.getBoundingClientRect().width);
  await page.waitForTimeout(900);
  await expect
    .poll(() =>
      page
        .getByTestId("siege-wave-loader-fill")
        .evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(initialLoaderWidth);

  await setQaSurvivalState(page, { completeWave: true });
  await expect(page.getByTestId("siege-wave-stat").locator("strong")).toHaveText("2");
  await expect(page.getByTestId("siege-wave-toast")).toContainText("Wave 2");
});

test("switching the HUD mode tab starts a fresh Survival run with active spawning", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, completionMetrics);

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await setQaSiegeProgress(page, { kills: 12, remainingBugs: 24 });
  await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("12");

  await page.getByRole("tab", { name: "Survival" }).click();
  await expect(page.getByRole("tab", { name: "Survival", selected: true })).toBeVisible();
  await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("0");
  await expect(page.getByTestId("siege-time-stat").locator("strong")).toHaveText("00:00");
  await expect(page.getByTestId("siege-wave-loader-pill")).toBeVisible();

  const initialAlive = Number.parseInt(
    (await page.getByTestId("siege-remaining-stat").locator("strong").textContent()) ?? "0",
    10,
  );
  const initialLoaderWidth = await page
    .getByTestId("siege-wave-loader-fill")
    .evaluate((element) => element.getBoundingClientRect().width);

  await expect
    .poll(async () =>
      page
        .getByTestId("siege-wave-loader-fill")
        .evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(initialLoaderWidth);
  await expect
    .poll(async () =>
      Number.parseInt(
        (await page.getByTestId("siege-remaining-stat").locator("strong").textContent()) ?? "0",
        10,
      ),
    )
    .toBeGreaterThan(initialAlive);
});

test("survival does not collapse in the opening seconds before the player can act", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, completionMetrics);

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await page.getByRole("tab", { name: "Survival" }).click();
  await expect(page.getByRole("tab", { name: "Survival", selected: true })).toBeVisible();

  await page.waitForTimeout(5_000);

  await expect(page.getByTestId("siege-complete-overlay")).toHaveCount(0);
  await expect
    .poll(async () => Number.parseInt(
      (await page.getByTestId("siege-offline-pressure").locator("strong").textContent()) ?? "0",
      10,
    ))
    .toBeGreaterThan(80);
  await expect.poll(() => getQaLiveBugCount(page)).toBeGreaterThan(0);
});

test("survival site offline opens the completion overlay", async ({ page }) => {
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
  await overlay.getByTestId("siege-complete-switch-mode").click();
  await expect(overlay).toBeHidden();

  await setQaSurvivalState(page, { siteIntegrity: 0 });

  await expect(page.getByTestId("siege-complete-overlay")).toBeVisible();
  await expect(page.getByTestId("siege-complete-title")).toHaveText("Site overrun.");
  await expect(page.getByTestId("siege-complete-outcome")).toBeVisible();
  await expect(page.getByText("Wave reached", { exact: true })).toBeVisible();
});

test("completion overlay traps keyboard focus between actions", async ({ page }) => {
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
  const replayButton = overlay.getByTestId("siege-complete-replay");
  const switchButton = overlay.getByTestId("siege-complete-switch-mode");
  const backButton = overlay.getByTestId("siege-complete-back-dashboard");

  await expect(overlay).toBeVisible();
  await expect(replayButton).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(switchButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(backButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(replayButton).toBeFocused();
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
  await expect(page.getByTestId("siege-time-stat").locator("strong")).toHaveText("00:00");

  await page.waitForTimeout(1400);

  await expect(page.getByTestId("siege-time-stat").locator("strong")).toHaveText("00:01");
});

test("opening the codex pauses the timer and hides the top toggle in detail view", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const hud = page.getByTestId("siege-hud");
  await expect(hud).toBeVisible();
  await expect(page.getByTestId("siege-time-stat").locator("strong")).toHaveText("00:00");

  await page.getByRole("button", { name: "Open codex" }).click();

  const codexModal = page.getByTestId("codex-modal");
  await expect(codexModal).toBeVisible();
  await expect
    .poll(() => codexModal.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("default");
  await page.waitForTimeout(1400);
  await expect(page.getByTestId("siege-time-stat").locator("strong")).toHaveText("00:00");

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
  await expect(page.getByTestId("siege-time-stat").locator("strong")).toHaveText("00:01");
});

test("codex shows weapon and structure grids with drill-down detail views", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await page.getByRole("button", { name: "Open codex" }).click();

  const codexModal = page.getByTestId("codex-modal");
  await expect(codexModal).toBeVisible();

  await codexModal.getByRole("tab", { name: "Weapons" }).click();
  await expect(page.getByTestId("codex-weapon-card-hammer")).toBeVisible();

  await page
    .getByTestId("codex-weapon-card-hammer")
    .getByTestId("codex-matchup-bug")
    .first()
    .click();
  await expect(page.getByTestId("codex-detail-view")).toBeVisible();
  await expect(page.getByTestId("codex-tabs")).toHaveCount(0);

  await codexModal.getByRole("button", { name: "Back" }).click();
  await expect(page.getByTestId("codex-tabs")).toBeVisible();
  await codexModal.getByRole("tab", { name: "Weapons" }).click();

  await page.getByTestId("codex-weapon-card-hammer").click();
  await expect(page.getByTestId("codex-weapon-detail-view")).toBeVisible();
  await expect(page.getByText("Tier Comparison")).toBeVisible();
  await expect(page.getByText("Overdrive", { exact: true })).toBeVisible();
  await expect(page.getByTestId("codex-tabs")).toHaveCount(0);

  await codexModal.getByRole("button", { name: "Back" }).click();
  await expect(page.getByTestId("codex-tabs")).toBeVisible();
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
  await expect(page.getByTestId("siege-complete-title")).toHaveText("Swarm cleared.");
});

test("shows the completion overlay when the live engine swarm is actually cleared", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, completionMetrics);

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await expect.poll(() => getQaLiveBugCount(page)).toBeGreaterThan(0);

  await clearQaLiveBugs(page);

  await expect(page.getByTestId("siege-complete-overlay")).toBeVisible();
  await expect(page.getByTestId("siege-complete-title")).toHaveText("Swarm cleared.");
  await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("0");
  await expect.poll(() => getQaLiveBugCount(page)).toBe(0);
});

test("shows the completion overlay when the final live bug is killed through gameplay", async ({ page }) => {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, singleBugMetrics);
  await seedDashboardState(page, {
    gameConfig: getStaticSiegeGameConfig(),
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("1");

  await clickQaBug(page, 1);

  await expect(page.getByTestId("siege-complete-overlay")).toBeVisible();
  await expect(page.getByTestId("siege-complete-title")).toHaveText("Swarm cleared.");
  await expect(page.getByTestId("siege-remaining-stat").locator("strong")).toHaveText("0");
});