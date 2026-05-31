import { describe, expect, it } from "vitest";

import { getSurvivalWavePlan } from "@game/sim/survivalDirector";
import { createSurvivalRuntimeStatus } from "./useSiegeGameSupport";
import {
  applySiteIntegrityOverride,
  applySurvivalMetricOverrides,
} from "./useSiegeGameSurvivalOverrides";

describe("useSiegeGameSurvivalOverrides", () => {
  it("applies site-integrity failures and clamps values", () => {
    const status = createSurvivalRuntimeStatus(getSurvivalWavePlan(1));
    const updated = applySiteIntegrityOverride(status, -10);

    expect(updated.siteIntegrity).toBe(0);
    expect(updated.failureKind).toBe("uptimeFailure");
    expect(updated.failureLabel).toBe("Uptime");
    expect(updated.secondsUntilOffline).toBe(0);
  });

  it("applies metric overrides and derives failures when a metric collapses", () => {
    const status = createSurvivalRuntimeStatus(getSurvivalWavePlan(1));
    const updated = applySurvivalMetricOverrides(status, {
      errors: 20,
      speed: 0,
    });

    expect(updated.metrics.errors.value).toBe(20);
    expect(updated.metrics.errors.status).toBe("critical");
    expect(updated.failureKind).toBe("speedCollapse");
    expect(updated.failureLabel).toBe("Speed");
    expect(updated.offlineReason).toBe("Load pushed the site into a crawl.");
  });

  it("respects explicit failure metrics over derived ones", () => {
    const status = createSurvivalRuntimeStatus(getSurvivalWavePlan(1));
    const updated = applySurvivalMetricOverrides(status, {
      failMetric: "errors",
      speed: 80,
      uptime: 90,
    });

    expect(updated.failureKind).toBe("errorFlood");
    expect(updated.failureLabel).toBe("Errors");
  });
});