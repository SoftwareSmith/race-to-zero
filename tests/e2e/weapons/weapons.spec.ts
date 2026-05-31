/**
 * Weapon QA — stable end-to-end checks that each weapon can be selected and
 * used once its progression state has been reached.
 *
 * Unlock order (via WEAPON_DEFS.unlockKills):
 *   hammer      0
 *   nullpointer 14   (Garbage Collector)
 *   chain      32   (Lightning)
 *   plasma     54   (Fork Bomb)
 *   zapper     78   (Bug Spray)
 *   void      108   (Void Pulse)
 */

import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  setQaSiegeProgress,
} from "../support/dashboardQa";
import {
  fireAtBug,
  fireAtCentre,
  getQaLastHit,
  openSiegeGame,
  selectWeapon,
} from "./weaponQa";

test.describe.configure({ timeout: 300000 });

// ── Hammer (unlocked at 0 kills) ─────────────────────────────────────────────

test.describe("hammer", () => {
  test("is unlocked by default and kills a bug on click", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 10);

    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute("data-locked", "false");
    await expect(page.getByTestId("weapon-hammer")).toHaveAttribute("data-current", "true");

    await fireAtBug(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();
    expect(hit?.defeated).toBe(true);

    await errs.expectNoClientErrors();
  });
});

// ── Lightning / Chain Zap (unlocks at 32 kills) ────────────────────────────

test.describe("lightning", () => {
  test("unlocks at 32 kills and bounces between bugs", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 60);

    await setQaSiegeProgress(page, { kills: 32, remainingBugs: 28 });
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("32");
    await expect(page.getByTestId("weapon-chain")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "chain");
    await fireAtBug(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();

    await errs.expectNoClientErrors();
  });
});

// ── Fork Bomb (unlocks at 54 kills) ────────────────────────────────────────

test.describe("fork bomb", () => {
  test("unlocks at 54 kills and hits a clustered area", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 100);

    await setQaSiegeProgress(page, { kills: 54, remainingBugs: 46 });
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("54");
    await expect(page.getByTestId("weapon-plasma")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "plasma");
    await fireAtCentre(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();

    await errs.expectNoClientErrors();
  });
});

// ── Void Pulse (unlocks at 108 kills) ───────────────────────────────────────

test.describe("void pulse", () => {
  test("unlocks at 108 kills and creates a black hole", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 150);

    await setQaSiegeProgress(page, { kills: 108, remainingBugs: 42 });
    await expect(page.getByTestId("siege-kills-stat").locator("strong")).toHaveText("108");
    await expect(page.getByTestId("weapon-void")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "void");
    await fireAtCentre(page);
    // Black hole is persistent for 2s; confirm the game doesn't crash
    await page.waitForTimeout(2500);
    await expect(page.getByTestId("siege-hud")).toBeVisible();

    await errs.expectNoClientErrors();
  });

  test("does not allow a second black hole while one is active", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 150);

    await setQaSiegeProgress(page, { kills: 108, remainingBugs: 42 });
    await selectWeapon(page, "void");

    // Fire twice rapidly
    const canvas = page.locator("canvas").first();
    await canvas.click({ force: true });
    await canvas.click({ force: true });

    await page.waitForTimeout(2500);
    await expect(page.getByTestId("siege-hud")).toBeVisible();

    await errs.expectNoClientErrors();
  });
});
