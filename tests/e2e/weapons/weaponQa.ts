/**
 * Shared utilities for weapon E2E tests.
 */
import { expect, type Page } from "@playwright/test";
import {
  enableCanvasQa,
  getQaBugPositions,
  getQaLastHit,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  waitForQaBugPositions,
} from "../support/dashboardQa";

export { getQaLastHit, waitForQaBugPositions };

// ── Metrics helpers ──────────────────────────────────────────────────────────

/** Build a metrics fixture with `count` bugs in Backlog. */
export function makeBugMetrics(count: number) {
  return {
    bugs: Array.from({ length: count }, (_, i) => ({
      completedAt: null,
      createdAt: `2026-04-${String((i % 9) + 1).padStart(2, "0")}`,
      priority: 4,
      stateName: "Backlog",
      stateType: "backlog",
      teamKey: "QA",
    })),
    generatedAt: "2026-04-09T12:00:00.000Z",
    lastUpdated: "2026-04-09T12:00:00.000Z",
  };
}

// ── Game setup ───────────────────────────────────────────────────────────────

/** Navigate to the siege game with a static, frozen config. */
export async function openSiegeGame(page: Page, bugCount = 60) {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page);
  await mockMetrics(page, makeBugMetrics(bugCount));
  await seedDashboardState(page, {
    gameConfig: getStaticSiegeGameConfig(),
    showParticleCount: false,
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await waitForQaBugPositions(page);
}

// ── Weapon helpers ───────────────────────────────────────────────────────────

/** Click bugs until `killsNeeded` kills are registered (unlocks highest weapon). */
export async function killBugs(page: Page, killsNeeded: number) {
  const canvas = page.locator("canvas").first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();

  for (let k = 0; k < killsNeeded; k++) {
    await waitForQaBugPositions(page);
    const positions = await getQaBugPositions(page);
    if (positions.length === 0) break;
    const bug = positions[0];
    await canvas.click({
      force: true,
      position: {
        x: bug.x - (canvasBox?.x ?? 0),
        y: bug.y - (canvasBox?.y ?? 0),
      },
    });
  }
}

/** Select a weapon by its test-id. Asserts that it is unlocked first. */
export async function selectWeapon(page: Page, weaponId: string) {
  const btn = page.getByTestId(`weapon-${weaponId}`);
  await expect(btn).toHaveAttribute("data-locked", "false");
  await btn.getByRole("radio").click();
  await expect(btn).toHaveAttribute("data-current", "true");
}

/** Fire the currently selected weapon at the first available bug. */
export async function fireAtBug(page: Page) {
  const canvas = page.locator("canvas").first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();

  await waitForQaBugPositions(page);
  const positions = await getQaBugPositions(page);
  expect(positions.length, "expected at least one bug to fire at").toBeGreaterThan(0);
  const bug = positions[0];
  await canvas.click({
    force: true,
    position: {
      x: bug.x - (canvasBox?.x ?? 0),
      y: bug.y - (canvasBox?.y ?? 0),
    },
  });
}

/** Fire at the centre of the canvas (useful for area weapons). */
export async function fireAtCentre(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.click({ force: true });
}
