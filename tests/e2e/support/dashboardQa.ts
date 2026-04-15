import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { format } from "date-fns";
import { STORAGE_KEYS } from "../../../src/constants/storageKeys";
import {
  DEFAULT_GAME_CONFIG,
  type GameConfig,
} from "../../../src/features/game/engine/types";
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
} from "../../../src/features/dashboard/utils/dashboard";
import {
  getComparisonMetrics,
  getDeadlineMetrics,
  getSummaryMetrics,
} from "../../../src/features/dashboard/utils/metrics";
import type { MetricsSource, WorkdaySettings } from "../../../src/types/dashboard";

export const QA_TODAY_ISO = "2026-04-09T12:00:00.000Z";
export const QA_DEADLINE_FROM = "2026-03-11";
export const QA_DEADLINE_DATE = "2026-12-31";
export const QA_CUSTOM_FROM = "2026-03-01";
export const QA_CUSTOM_TO = "2026-03-31";

const metricsPath = new URL("../../../public/data/metrics.json", import.meta.url);
const metricsText = readFileSync(metricsPath, "utf8");

export const qaMetrics = JSON.parse(metricsText) as MetricsSource;

export const qaWorkdaySettings: WorkdaySettings = {
  excludePublicHolidays: false,
  excludeWeekends: false,
};

interface DashboardSeedOptions {
  clearStorage?: boolean;
  deadlineDate?: string;
  deadlineFromDate?: string;
  excludePublicHolidays?: boolean;
  excludeWeekends?: boolean;
  frozenDateIso?: string;
  gameConfig?: Partial<GameConfig>;
  terminatorMode?: boolean;
}

interface QaSiegeProgress {
  kills: number;
  points?: number;
  remainingBugs?: number;
}

interface QaPerformanceMetrics {
  firstBugPositionsAtMs?: number;
  firstFrameAtMs?: number;
  frameDurationsMs?: number[];
  lastFrameDurationMs?: number;
  lastRenderedBugCount?: number;
  maxFrameDurationMs?: number;
  maxRenderedBugCount?: number;
  measurementStartAtMs?: number;
  sampleLimit?: number;
}

interface EnableCanvasQaOptions {
  performanceSampleLimit?: number;
  startMeasurementOnInit?: boolean;
  stabilizeEngine?: boolean;
}

interface OverviewMetricOptions {
  deadlineDate?: string;
  deadlineFromDate?: string;
  workdaySettings?: WorkdaySettings;
}

function withFrozenDate<T>(isoString: string, callback: () => T): T {
  const RealDate = Date;
  const frozenTime = new RealDate(isoString).valueOf();

  class MockDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(frozenTime);
        return;
      }

      super(...args);
    }

    static now() {
      return frozenTime;
    }
  }

  // Node-side metric helpers use the global Date constructor directly.
  globalThis.Date = MockDate as DateConstructor;

  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

export function getExpectedOverviewMetrics(
  options: OverviewMetricOptions = {},
) {
  const {
    deadlineDate = QA_DEADLINE_DATE,
    deadlineFromDate = QA_DEADLINE_FROM,
    workdaySettings = qaWorkdaySettings,
  } = options;

  return withFrozenDate(QA_TODAY_ISO, () => {
    const deadlineMetrics = getDeadlineMetrics(qaMetrics, {
      deadlineDate,
      trackingStartDate: deadlineFromDate,
      workdaySettings,
    });
    const summary = getSummaryMetrics(deadlineMetrics);
    const paceGap = summary.currentFixRate - summary.bugsPerDayRequired;

    return {
      commandCenter: {
        fixVelocity: `${formatNumber(summary.currentFixRate, 2)}/day`,
        netDifference: `${formatSignedNumber(paceGap, 2)}/day`,
        requiredPace: `${formatNumber(summary.bugsPerDayRequired, 2)}/day`,
      },
      deadlineMetrics,
      overlayLabel: `${formatNumber(summary.bugCount)} open bugs`,
      summary,
      viewMetrics: {
        confidence: formatPercent(summary.likelihoodScore),
        currentNetBurn: `${formatNumber(summary.currentNetBurnRate, 2)}/day`,
        daysLeft: formatNumber(summary.daysUntilDeadline),
        openBugs: formatNumber(summary.bugCount),
        requiredNetBurn: `${formatNumber(deadlineMetrics.neededNetBurnRate, 2)}/day`,
      },
    };
  });
}

export function getExpectedPeriodsMetrics(rangeKey: "7" | "30" | "90" | "all" | "custom" = "30") {
  return withFrozenDate(QA_TODAY_ISO, () => {
    const comparisonMetrics = getComparisonMetrics(qaMetrics, {
      customFromDate: QA_CUSTOM_FROM,
      customToDate: QA_CUSTOM_TO,
      rangeKey,
    });

    return {
      comparisonMetrics,
      viewMetrics: {
        bugsCompleted: formatNumber(comparisonMetrics.currentWindow.fixed),
        bugsCreated: formatNumber(comparisonMetrics.currentWindow.created),
        completionRate: formatPercent(comparisonMetrics.currentWindow.completionRate, 1),
        netChange: formatSignedNumber(comparisonMetrics.currentWindow.netChange),
      },
    };
  });
}

export async function seedDashboardState(
  page: Page,
  options: DashboardSeedOptions = {},
) {
  const {
    deadlineDate = QA_DEADLINE_DATE,
    deadlineFromDate = QA_DEADLINE_FROM,
    excludePublicHolidays = false,
    excludeWeekends = false,
    frozenDateIso = QA_TODAY_ISO,
    gameConfig,
    clearStorage = true,
    terminatorMode = false,
  } = options;

  await page.addInitScript(
    ({
      clearStorage,
      deadlineDate,
      deadlineFromDate,
      excludePublicHolidays,
      excludeWeekends,
      frozenDateIso,
      gameConfig,
      storageKeys,
      terminatorMode,
    }) => {
      const NativeDate = Date;
      const frozenTimestamp = new NativeDate(frozenDateIso).valueOf();

      class FrozenDate extends NativeDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) {
            super(frozenTimestamp);
            return;
          }

          super(...args);
        }

        static now() {
          return frozenTimestamp;
        }
      }

      window.Date = FrozenDate as DateConstructor;
      if (clearStorage) {
        window.localStorage.clear();
        window.sessionStorage.clear();
      }

      if (!window.localStorage.getItem(storageKeys.deadlineDate)) {
        window.localStorage.setItem(storageKeys.deadlineDate, deadlineDate);
      }

      if (!window.localStorage.getItem(storageKeys.deadlineFromDate)) {
        window.localStorage.setItem(storageKeys.deadlineFromDate, deadlineFromDate);
      }

      if (!window.localStorage.getItem(storageKeys.excludePublicHolidays)) {
        window.localStorage.setItem(
          storageKeys.excludePublicHolidays,
          String(excludePublicHolidays),
        );
      }

      if (!window.localStorage.getItem(storageKeys.excludeWeekends)) {
        window.localStorage.setItem(
          storageKeys.excludeWeekends,
          String(excludeWeekends),
        );
      }

      if (!window.localStorage.getItem(storageKeys.terminatorMode)) {
        window.localStorage.setItem(storageKeys.terminatorMode, String(terminatorMode));
      }

      if (gameConfig) {
        if (clearStorage || !window.localStorage.getItem(storageKeys.gameConfig)) {
          window.localStorage.setItem(storageKeys.gameConfig, JSON.stringify(gameConfig));
        }
      }
    },
    {
      clearStorage,
      deadlineDate,
      deadlineFromDate,
      excludePublicHolidays,
      excludeWeekends,
      frozenDateIso,
      gameConfig,
      storageKeys: STORAGE_KEYS,
      terminatorMode,
    },
  );
}

export async function mockMetrics(page: Page, metrics: MetricsSource) {
  await page.route("**/data/metrics.json**", async (route) => {
    await route.fulfill({
      body: JSON.stringify(metrics),
      contentType: "application/json",
      status: 200,
    });
  });
}

export async function enableCanvasQa(
  page: Page,
  options: EnableCanvasQaOptions = {},
) {
  const {
    performanceSampleLimit = 180,
    startMeasurementOnInit = false,
    stabilizeEngine = true,
  } = options;

  await page.addInitScript(
    ({ performanceSampleLimit, startMeasurementOnInit, stabilizeEngine }) => {
      const qaState: {
        enabled: boolean;
        performanceMetrics?: QaPerformanceMetrics;
        stabilizeEngine?: boolean;
      } = {
        enabled: true,
        stabilizeEngine,
      };

      if (startMeasurementOnInit) {
        qaState.performanceMetrics = {
          frameDurationsMs: [],
          maxFrameDurationMs: 0,
          maxRenderedBugCount: 0,
          measurementStartAtMs: performance.now(),
          sampleLimit: performanceSampleLimit,
        };
      }

      (window as Window & { __RTZ_QA__?: typeof qaState }).__RTZ_QA__ = qaState;
    },
    {
      performanceSampleLimit,
      startMeasurementOnInit,
      stabilizeEngine,
    },
  );
}

export async function waitForQaAvailability(page: Page) {
  await page.waitForFunction(() => {
    const qaState = (window as Window & {
      __RTZ_QA__?: { enabled?: boolean };
    }).__RTZ_QA__;

    return qaState?.enabled === true;
  });
}

export async function startQaPerformanceMeasurement(
  page: Page,
  sampleLimit = 180,
) {
  await waitForQaAvailability(page);

  await page.evaluate((nextSampleLimit) => {
    const qaState = (window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        performanceMetrics?: QaPerformanceMetrics;
      };
    }).__RTZ_QA__;

    if (!qaState?.enabled) {
      throw new Error("QA state is unavailable");
    }

    qaState.performanceMetrics = {
      frameDurationsMs: [],
      maxFrameDurationMs: 0,
      maxRenderedBugCount: 0,
      measurementStartAtMs: performance.now(),
      sampleLimit: nextSampleLimit,
    };
  }, sampleLimit);
}

export async function getQaPerformanceMetrics(page: Page) {
  return page.evaluate(() => {
    const qaState = (window as Window & {
      __RTZ_QA__?: {
        performanceMetrics?: QaPerformanceMetrics;
      };
    }).__RTZ_QA__;

    return qaState?.performanceMetrics ?? null;
  });
}

export async function waitForQaRenderedBugCount(page: Page, expectedCount: number) {
  await page.waitForFunction((nextCount) => {
    const qaState = (window as Window & {
      __RTZ_QA__?: { bugPositions?: Array<unknown>; enabled?: boolean };
    }).__RTZ_QA__;

    return Boolean(
      qaState?.enabled &&
        Array.isArray(qaState.bugPositions) &&
        qaState.bugPositions.length >= nextCount,
    );
  }, expectedCount);
}

export async function waitForQaBugPositions(page: Page) {
  await page.waitForFunction(() => {
    const qaState = (window as Window & {
      __RTZ_QA__?: { bugPositions?: Array<unknown>; enabled?: boolean };
    }).__RTZ_QA__;
    return Boolean(qaState?.enabled && qaState.bugPositions?.length);
  });
}

export async function getQaBugPositions(page: Page) {
  return page.evaluate(() => {
    const qaState = (window as Window & {
      __RTZ_QA__?: {
        bugPositions?: Array<{ index: number; radius: number; x: number; y: number }>;
      };
    }).__RTZ_QA__;
    return qaState?.bugPositions ?? [];
  });
}

export async function getQaLastHit(page: Page) {
  return page.evaluate(() => {
    const qaState = (window as Window & {
      __RTZ_QA__?: {
        lastHit?: {
          defeated: boolean;
          remainingHp: number;
          variant: string;
          x: number;
          y: number;
        };
      };
    }).__RTZ_QA__;
    return qaState?.lastHit ?? null;
  });
}

export async function setQaSiegeProgress(page: Page, progress: QaSiegeProgress) {
  await page.evaluate((nextProgress) => {
    const qaState = (window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        setSiegeProgress?: (progress: QaSiegeProgress) => void;
      };
    }).__RTZ_QA__;

    if (!qaState?.enabled || !qaState.setSiegeProgress) {
      throw new Error("QA siege progress setter is unavailable");
    }

    qaState.setSiegeProgress(nextProgress);
  }, progress);
}

export function getStaticSiegeGameConfig(): GameConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    baseSpeed: 0,
    sizeMultiplier: 4,
  };
}

export async function clickQaBug(page: Page, repeatCount = 1) {
  const canvas = page.locator("canvas").first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox, "expected bug canvas bounding box").toBeTruthy();

  const getKillCount = async () => {
    const text = await page.getByTestId("siege-hud").locator("strong").nth(1).textContent();
    return Number.parseInt(text ?? "0", 10);
  };

  for (let index = 0; index < repeatCount; index += 1) {
    const startingKills = await getKillCount();
    let defeated = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await waitForQaBugPositions(page);
      const [bug] = await getQaBugPositions(page);
      expect(bug, "expected at least one QA bug position").toBeTruthy();

      await canvas.click({
        force: true,
        position: {
          x: bug.x - (canvasBox?.x ?? 0),
          y: bug.y - (canvasBox?.y ?? 0),
        },
      });

      try {
        await expect
          .poll(getKillCount, { interval: 100, timeout: 1200 })
          .toBeGreaterThan(startingKills);
        defeated = true;
        break;
      } catch {
        await page.waitForTimeout(150);
      }
    }

    expect(defeated, "expected QA click to register a kill").toBe(true);
  }
}

export function createConsoleCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  return {
    expectNoClientErrors: async () => {
      expect(consoleErrors, "browser console errors").toEqual([]);
      expect(pageErrors, "browser runtime errors").toEqual([]);
    },
  };
}

export function getMetricCard(page: Page, label: string) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return page.locator(`[data-siege-panel="${slug}"]`).first();
}

export async function expectMetricValue(page: Page, label: string, expectedValue: string) {
  await expect(getMetricCard(page, label)).toContainText(label);
  await expect(getMetricCard(page, label).locator("strong")).toHaveText(expectedValue);
}

export async function gotoDashboard(page: Page) {
  await page.setViewportSize({ height: 1200, width: 1440 });
  await seedDashboardState(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Race to Zero Bugs" })).toBeVisible();
  await expect(page.getByText("Delivery outlook")).toBeVisible();
}

export async function chooseCustomPeriod(page: Page) {
  await page.getByRole("button", { name: "Custom" }).click();
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(QA_CUSTOM_FROM);
  await dateInputs.nth(1).fill(QA_CUSTOM_TO);
}

export function getFrozenTodayLabel() {
  return format(new Date(QA_TODAY_ISO), "yyyy-MM-dd");
}