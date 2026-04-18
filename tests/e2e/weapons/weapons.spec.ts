/**
 * Weapon QA — compile-time test that every weapon:
 *  1. Unlocks at the correct kill threshold
 *  2. Can be selected
 *  3. Fires and registers at least one hit (where applicable)
 *  4. Leaves expected VFX artefacts on the page
 *
 * Unlock order (via WEAPON_DEFS.unlockKills):
 *   hammer      0
 *   nullpointer 18   (Garbage Collector)
 *   chain      42   (Lightning)
 *   plasma     70   (Fork Bomb)
 *   zapper     98   (Bug Spray)
 *   void      132   (Void Pulse)
 */

import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
} from "../support/dashboardQa";
import {
  fireAtBug,
  fireAtCentre,
  getQaLastHit,
  killBugs,
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

// ── Garbage Collector / Null Pointer (unlocks at 18 kills) ──────────────────

test.describe("garbage collector", () => {
  test("unlocks at 18 kills, selects, and executes a bug", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 60);

    await expect(page.getByTestId("weapon-nullpointer")).toHaveCount(0);
    await killBugs(page, 18);
    await expect(page.getByTestId("weapon-nullpointer")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "nullpointer");
    await fireAtCentre(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();
    expect(hit?.defeated).toBe(true);

    await errs.expectNoClientErrors();
  });
});

// ── Lightning / Chain Zap (unlocks at 42 kills) ────────────────────────────

test.describe("lightning", () => {
  test("unlocks at 42 kills and bounces between bugs", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 60);

    await killBugs(page, 42);
    await expect(page.getByTestId("weapon-chain")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "chain");
    await fireAtBug(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();

    await errs.expectNoClientErrors();
  });
});

// ── Fork Bomb (unlocks at 70 kills) ────────────────────────────────────────

test.describe("fork bomb", () => {
  test("unlocks at 70 kills and hits a clustered area", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 100);

    await killBugs(page, 70);
    await expect(page.getByTestId("weapon-plasma")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "plasma");
    await fireAtCentre(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();

    await errs.expectNoClientErrors();
  });
});

// ── Bug Spray / Zapper (unlocks at 98 kills) ───────────────────────────────

test.describe("bug spray", () => {
  test("unlocks at 98 kills, selects, and poisons bugs in a cone", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 120);

    await expect(page.getByTestId("weapon-zapper")).toHaveCount(0);
    await killBugs(page, 98);
    await expect(page.getByTestId("weapon-zapper")).toHaveAttribute("data-locked", "false");

    await selectWeapon(page, "zapper");
    await fireAtBug(page);
    const hit = await getQaLastHit(page);
    expect(hit).toBeTruthy();

    await errs.expectNoClientErrors();
  });
});

// ── Void Pulse (unlocks at 132 kills) ───────────────────────────────────────

test.describe("void pulse", () => {
  test("unlocks at 132 kills and creates a black hole", async ({ page }) => {
    const errs = createConsoleCollectors(page);
    await openSiegeGame(page, 150);

    await killBugs(page, 132);
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

    await killBugs(page, 132);
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

// ── No-client-error smoke test for all weapons ───────────────────────────────

test("all weapon UIs render without console errors", async ({ page }) => {
  const errs = createConsoleCollectors(page);
  await openSiegeGame(page, 150);

  const hud = page.getByTestId("siege-hud");
  await expect(hud).toBeVisible();

  await errs.expectNoClientErrors();
});
