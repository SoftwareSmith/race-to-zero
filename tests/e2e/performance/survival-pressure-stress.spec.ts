import { expect, test } from "@playwright/test";

import {
  createConsoleCollectors,
  enableCanvasQa,
  getQaPerformanceMetrics,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  setQaSiegeProgress,
  setQaSurvivalState,
  startQaPerformanceMeasurement,
  waitForQaAvailability,
  waitForQaRenderedBugCount,
} from "../support/dashboardQa";

test.describe.configure({ timeout: 300000 });

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

type PerfSnapshot = {
  frameDurationsMs?: number[];
  maxFrameDurationMs?: number;
  maxRenderedBugCount?: number;
};

function getPercentile(values: number[], percentile: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function summarizeMetrics(metrics: PerfSnapshot) {
  const samples = metrics.frameDurationsMs ?? [];
  const mean =
    samples.length > 0
      ? samples.reduce((total, value) => total + value, 0) / samples.length
      : 0;

  return {
    maxFrameMs: metrics.maxFrameDurationMs ?? 0,
    meanFrameMs: mean,
    p95FrameMs: getPercentile(samples, 95),
    p99FrameMs: getPercentile(samples, 99),
    renderedBugCount: metrics.maxRenderedBugCount ?? 0,
    sampleCount: samples.length,
  };
}

test("@nightly profiles survival pressure at elevated waves", async ({ page }) => {
  const errors = createConsoleCollectors(page);

  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page, { stabilizeEngine: false });
  await mockMetrics(page, completionMetrics);
  await seedDashboardState(page, {
    gameConfig: {
      ...getStaticSiegeGameConfig(),
      baseSpeed: 1.15,
    },
  });

  await page.goto("./");
  await waitForQaAvailability(page);
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await setQaSiegeProgress(page, { kills: 36, remainingBugs: 0 });

  const overlay = page.getByTestId("siege-complete-overlay");
  await expect(overlay).toBeVisible();
  await overlay.getByTestId("siege-complete-switch-mode").click();
  await expect(overlay).toBeHidden();
  await expect(page.getByRole("tab", { name: "Survival", selected: true })).toBeVisible();

  await startQaPerformanceMeasurement(page, 240);

  for (let burst = 0; burst < 8; burst += 1) {
    await setQaSurvivalState(page, { spawnNow: true, wave: 25 });
    await page.waitForTimeout(160);
  }

  await waitForQaRenderedBugCount(page, 24);
  await page.waitForTimeout(2200);

  const summary = summarizeMetrics((await getQaPerformanceMetrics(page)) ?? {});
  console.log("[survival-pressure-stress] wave 25", summary);

  expect(summary.renderedBugCount).toBeGreaterThanOrEqual(24);
  expect(summary.sampleCount).toBeGreaterThanOrEqual(20);
  expect(summary.meanFrameMs).toBeLessThan(120);
  expect(summary.p95FrameMs).toBeLessThan(180);
  expect(summary.p99FrameMs).toBeLessThan(260);

  await errors.expectNoClientErrors();
});
