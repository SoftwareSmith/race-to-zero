import type { SurvivalRuntimeStatus } from "./useSiegeGameSupport";

type SurvivalFailMetric = "errors" | "speed" | "uptime";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getMetricStatus(value: number) {
  return value <= 34 ? "critical" : value <= 67 ? "warning" : "stable";
}

function getFailureSummary(metric: SurvivalFailMetric | null) {
  if (metric === "errors") {
    return "Errors spiked faster than the platform could recover.";
  }
  if (metric === "speed") {
    return "Load pushed the site into a crawl.";
  }
  if (metric === "uptime") {
    return "Too many bugs broke through and took the platform down.";
  }
  return null;
}

export function applySiteIntegrityOverride(
  current: SurvivalRuntimeStatus,
  siteIntegrity: number,
): SurvivalRuntimeStatus {
  const clampedIntegrity = clampPercent(siteIntegrity);
  const failed = clampedIntegrity <= 0;

  return {
    ...current,
    failureKind: failed ? "uptimeFailure" : null,
    failureLabel: failed ? "Uptime" : null,
    failureSummary: failed
      ? "Too many bugs broke through and took the platform down."
      : null,
    metrics: {
      ...current.metrics,
      uptime: {
        ...current.metrics.uptime,
        secondsToFail: failed ? 0 : current.metrics.uptime.secondsToFail,
        status: getMetricStatus(clampedIntegrity),
        value: clampedIntegrity,
      },
    },
    offlineReason: failed
      ? "Too many bugs broke through and took the platform down."
      : null,
    secondsUntilOffline: failed ? 0 : current.secondsUntilOffline,
    siteIntegrity: clampedIntegrity,
  };
}

export function applySurvivalMetricOverrides(
  current: SurvivalRuntimeStatus,
  options: {
    errors?: number;
    failMetric?: SurvivalFailMetric;
    speed?: number;
    uptime?: number;
  },
): SurvivalRuntimeStatus {
  const nextMetrics = {
    ...current.metrics,
    errors: {
      ...current.metrics.errors,
      secondsToFail:
        options.errors != null && options.errors <= 0
          ? 0
          : current.metrics.errors.secondsToFail,
      status:
        options.errors != null
          ? getMetricStatus(clampPercent(options.errors))
          : current.metrics.errors.status,
      value:
        options.errors != null
          ? clampPercent(options.errors)
          : current.metrics.errors.value,
    },
    speed: {
      ...current.metrics.speed,
      secondsToFail:
        options.speed != null && options.speed <= 0
          ? 0
          : current.metrics.speed.secondsToFail,
      status:
        options.speed != null
          ? getMetricStatus(clampPercent(options.speed))
          : current.metrics.speed.status,
      value:
        options.speed != null
          ? clampPercent(options.speed)
          : current.metrics.speed.value,
    },
    uptime: {
      ...current.metrics.uptime,
      secondsToFail:
        options.uptime != null && options.uptime <= 0
          ? 0
          : current.metrics.uptime.secondsToFail,
      status:
        options.uptime != null
          ? getMetricStatus(clampPercent(options.uptime))
          : current.metrics.uptime.status,
      value:
        options.uptime != null
          ? clampPercent(options.uptime)
          : current.metrics.uptime.value,
    },
  };

  const nextFailureMetric: SurvivalFailMetric | null =
    options.failMetric ??
    (nextMetrics.errors.value <= 0
      ? "errors"
      : nextMetrics.speed.value <= 0
        ? "speed"
        : nextMetrics.uptime.value <= 0
          ? "uptime"
          : null);
  const failureSummary = getFailureSummary(nextFailureMetric);

  return {
    ...current,
    failureKind:
      nextFailureMetric === "errors"
        ? "errorFlood"
        : nextFailureMetric === "speed"
          ? "speedCollapse"
          : nextFailureMetric === "uptime"
            ? "uptimeFailure"
            : null,
    failureLabel:
      nextFailureMetric === "errors"
        ? "Errors"
        : nextFailureMetric === "speed"
          ? "Speed"
          : nextFailureMetric === "uptime"
            ? "Uptime"
            : null,
    failureSummary,
    metrics: nextMetrics,
    offlineReason: failureSummary,
    secondsUntilOffline:
      nextFailureMetric === "uptime" ? 0 : nextMetrics.uptime.secondsToFail,
    siteIntegrity: nextMetrics.uptime.value,
  };
}