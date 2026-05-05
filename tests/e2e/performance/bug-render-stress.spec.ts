import { expect, test } from "@playwright/test";
import {
  createConsoleCollectors,
  enableCanvasQa,
  getQaPerformanceMetrics,
  getStaticSiegeGameConfig,
  mockMetrics,
  seedDashboardState,
  startQaPerformanceMeasurement,
  waitForQaAvailability,
  waitForQaRenderedBugCount,
} from "../support/dashboardQa";
import { makeBugMetrics } from "../weapons/weaponQa";

test.describe.configure({ timeout: 300000 });

type PerfSnapshot = {
  firstBugPositionsAtMs?: number;
  firstFrameAtMs?: number;
  frameDurationsMs?: number[];
  maxFrameDurationMs?: number;
  maxRenderedBugCount?: number;
  measurementStartAtMs?: number;
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
    firstBugRenderMs:
      metrics.firstBugPositionsAtMs != null && metrics.measurementStartAtMs != null
        ? metrics.firstBugPositionsAtMs - metrics.measurementStartAtMs
        : Number.POSITIVE_INFINITY,
    firstFrameMs:
      metrics.firstFrameAtMs != null && metrics.measurementStartAtMs != null
        ? metrics.firstFrameAtMs - metrics.measurementStartAtMs
        : Number.POSITIVE_INFINITY,
    jankFrames: samples.filter((value) => value > 50).length,
    maxFrameMs: metrics.maxFrameDurationMs ?? 0,
    meanFrameMs: mean,
    p95FrameMs: getPercentile(samples, 95),
    p99FrameMs: getPercentile(samples, 99),
    renderedBugCount: metrics.maxRenderedBugCount ?? 0,
    sampleCount: samples.length,
  };
}

async function profileSiegeRender(page: Parameters<typeof test>[0]["page"], bugCount: number) {
  const errors = createConsoleCollectors(page);

  await page.setViewportSize({ height: 1200, width: 1440 });
  await enableCanvasQa(page, { stabilizeEngine: false });
  await mockMetrics(page, makeBugMetrics(bugCount));
  await seedDashboardState(page, {
    gameConfig: getStaticSiegeGameConfig(),
  });

  await page.goto("./");
  await waitForQaAvailability(page);
  await startQaPerformanceMeasurement(page, 240);
  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await waitForQaRenderedBugCount(page, bugCount);
  await page.waitForTimeout(
    bugCount >= 5000 ? 4000 : bugCount >= 1000 ? 2200 : 1200,
  );

  const metrics = await getQaPerformanceMetrics(page);
  const summary = summarizeMetrics(metrics ?? {});
  console.log(`[bug-render-stress] ${bugCount} bugs`, summary);

  await errors.expectNoClientErrors();
  return summary;
}

test.describe("bug render stress", () => {
  test("profiles 500 bugs", async ({ page }) => {
    const result = await profileSiegeRender(page, 500);

    expect(result.renderedBugCount).toBeGreaterThanOrEqual(500);
    expect(result.sampleCount).toBeGreaterThanOrEqual(20);
    expect(result.firstFrameMs).toBeLessThan(1200);
    expect(result.firstBugRenderMs).toBeLessThan(1500);
    expect(result.meanFrameMs).toBeLessThan(25);
    expect(result.p95FrameMs).toBeLessThan(40);
    expect(result.p99FrameMs).toBeLessThan(55);
  });

  test("profiles 1000 bugs", async ({ page }) => {
    const result = await profileSiegeRender(page, 1000);

    expect(result.renderedBugCount).toBeGreaterThanOrEqual(1000);
    expect(result.sampleCount).toBeGreaterThanOrEqual(20);
    expect(result.firstFrameMs).toBeLessThan(1500);
    expect(result.firstBugRenderMs).toBeLessThan(1800);
    expect(result.meanFrameMs).toBeLessThan(80);
    expect(result.p95FrameMs).toBeLessThan(130);
    expect(result.p99FrameMs).toBeLessThan(150);
  });

  test("@nightly profiles 5000 bugs", async ({ page }) => {
    test.slow();

    const result = await profileSiegeRender(page, 5000);

    expect(result.renderedBugCount).toBeGreaterThanOrEqual(5000);
    expect(result.sampleCount).toBeGreaterThanOrEqual(5);
    expect(result.firstFrameMs).toBeLessThan(3000);
    expect(result.firstBugRenderMs).toBeLessThan(3500);
    expect(result.meanFrameMs).toBeLessThan(2200);
    expect(result.p95FrameMs).toBeLessThan(1900);
    expect(result.p99FrameMs).toBeLessThan(1900);
  });
});