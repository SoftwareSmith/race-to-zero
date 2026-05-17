import { useCallback, useEffect, useState } from "react";
import type {
  BootstrapMetricsSource,
  MetricsSource,
} from "../../../types/dashboard";
import { isStoredRecord } from "@shared/utils/storage";

const BOOTSTRAP_METRICS_PATH = `${import.meta.env.BASE_URL}data/metrics.json`;
const ANALYTICS_METRICS_PATH = `${import.meta.env.BASE_URL}data/metrics-analytics.json`;
const MAX_METRICS_RESPONSE_CHARS = 8_000_000;
const MAX_METRICS_BUG_COUNT = 100_000;

let analyticsMetricsCache: MetricsSource | null = null;

function isMetricsBug(value: unknown) {
  if (!isStoredRecord(value)) {
    return false;
  }

  const {
    archivedAt,
    autoClosedAt,
    canceledAt,
    completedAt,
    createdAt,
    dueDate,
    priority,
    stateName,
    stateType,
    teamKey,
    updatedAt,
  } = value;

  return (
    (archivedAt === null || archivedAt === undefined || typeof archivedAt === "string") &&
    (autoClosedAt === null || autoClosedAt === undefined || typeof autoClosedAt === "string") &&
    (canceledAt === null || canceledAt === undefined || typeof canceledAt === "string") &&
    typeof createdAt === "string" &&
    (completedAt === null || completedAt === undefined || typeof completedAt === "string") &&
    (dueDate === null || dueDate === undefined || typeof dueDate === "string") &&
    (priority === undefined || typeof priority === "number") &&
    (stateName === null || stateName === undefined || typeof stateName === "string") &&
    (stateType === null || stateType === undefined || typeof stateType === "string") &&
    (teamKey === null || teamKey === undefined || typeof teamKey === "string") &&
    (updatedAt === null || updatedAt === undefined || typeof updatedAt === "string")
  );
}

function isDailyCountEntry(value: unknown) {
  return (
    isStoredRecord(value) &&
    typeof value.date === "string" &&
    typeof value.count === "number"
  );
}

function isDistributionEntry(value: unknown) {
  return (
    isStoredRecord(value) &&
    typeof value.label === "string" &&
    typeof value.count === "number"
  );
}

function isBootstrapMetricsSnapshot(value: unknown) {
  return (
    isStoredRecord(value) &&
    (value.firstBugDate === null || value.firstBugDate === undefined || typeof value.firstBugDate === "string") &&
    typeof value.doneCount === "number" &&
    typeof value.remainingBugs === "number" &&
    Array.isArray(value.createdSeries) &&
    value.createdSeries.every(isDailyCountEntry) &&
    Array.isArray(value.completedSeries) &&
    value.completedSeries.every(isDailyCountEntry) &&
    Array.isArray(value.remainingSeries) &&
    value.remainingSeries.every(isDailyCountEntry) &&
    Array.isArray(value.priorityDistribution) &&
    value.priorityDistribution.every(isDistributionEntry) &&
    Array.isArray(value.statusDistribution) &&
    value.statusDistribution.every(isDistributionEntry) &&
    Array.isArray(value.openAgeDistribution) &&
    value.openAgeDistribution.every(isDistributionEntry)
  );
}

function parseJsonPayload(rawValue: string) {
  if (rawValue.length > MAX_METRICS_RESPONSE_CHARS) {
    throw new Error("Metrics payload is too large to load safely");
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("Metrics payload is not valid JSON");
  }

  if (!isMetricsSource(parsedValue)) {
    throw new Error("Metrics payload has an unexpected shape");
  }

  if (parsedValue.bugs && parsedValue.bugs.length > MAX_METRICS_BUG_COUNT) {
    throw new Error("Metrics payload exceeds the supported bug record limit");
  }

  return parsedValue;
}

function parseAnalyticsMetricsPayload(rawValue: string) {
  const parsedValue = parseJsonPayload(rawValue);

  if (!isMetricsSource(parsedValue)) {
    throw new Error("Metrics payload has an unexpected shape");
  }

  if (parsedValue.bugs && parsedValue.bugs.length > MAX_METRICS_BUG_COUNT) {
    throw new Error("Metrics payload exceeds the supported bug record limit");
  }

  return parsedValue;
}

function parseBootstrapMetricsPayload(rawValue: string) {
  const parsedValue = parseJsonPayload(rawValue);

  if (!isBootstrapMetricsSource(parsedValue)) {
    throw new Error("Bootstrap metrics payload has an unexpected shape");
  }

  return parsedValue;
}

function isMetricsSource(value: unknown): value is MetricsSource {
  if (!isStoredRecord(value)) {
    return false;
  }

  if (value.generatedAt !== undefined && typeof value.generatedAt !== "string") {
    return false;
  }

  if (value.lastUpdated !== undefined && typeof value.lastUpdated !== "string") {
    return false;
  }

  if (value.bugs === undefined) {
    return true;
  }

  if (!Array.isArray(value.bugs)) {
    return false;
  }

  if (value.bugs.length > MAX_METRICS_BUG_COUNT) {
    return false;
  }

  return value.bugs.every(isMetricsBug);
}

function isBootstrapMetricsSource(value: unknown): value is BootstrapMetricsSource {
  if (!isStoredRecord(value)) {
    return false;
  }

  if (value.generatedAt !== undefined && typeof value.generatedAt !== "string") {
    return false;
  }

  if (value.lastUpdated !== undefined && typeof value.lastUpdated !== "string") {
    return false;
  }

  if (!Array.isArray(value.teamKeys) || !value.teamKeys.every((entry) => typeof entry === "string")) {
    return false;
  }

  if (!isBootstrapMetricsSnapshot(value.all)) {
    return false;
  }

  if (!isStoredRecord(value.byTeam)) {
    return false;
  }

  return Object.values(value.byTeam).every(isBootstrapMetricsSnapshot);
}

function useJsonMetricsSource<T>({
  enabled = true,
  initialMetrics = null,
  parser,
  path,
  persist,
}: {
  enabled?: boolean;
  initialMetrics?: T | null;
  parser: (rawValue: string) => T;
  path: string;
  persist?: (value: T) => void;
}) {
  const [metrics, setMetrics] = useState<T | null>(initialMetrics);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(enabled && initialMetrics == null);

  const refreshMetrics = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(`${path}?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load metrics (${response.status})`);
        }

        const contentLengthHeader = response.headers.get("content-length");
        const declaredLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAX_METRICS_RESPONSE_CHARS
        ) {
          throw new Error("Metrics payload is too large to load safely");
        }

        const rawMetrics = await response.text();
  const nextMetrics = parser(rawMetrics);

        setMetrics(nextMetrics);
  persist?.(nextMetrics);
        setError("");
        return nextMetrics;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unknown metrics error";
        setError(message);
        throw caughtError;
      } finally {
        setIsLoading(false);
      }
    },
    [parser, path, persist],
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    refreshMetrics().catch(() => {});
  }, [enabled, refreshMetrics]);

  return {
    metrics,
    error,
    isLoading,
    refreshMetrics,
  };
}

export function useMetrics() {
  return useJsonMetricsSource<BootstrapMetricsSource>({
    parser: parseBootstrapMetricsPayload,
    path: BOOTSTRAP_METRICS_PATH,
  });
}

export function useAnalyticsMetrics(enabled: boolean) {
  const persistAnalyticsMetrics = useCallback((value: MetricsSource) => {
    analyticsMetricsCache = value;
  }, []);

  return useJsonMetricsSource<MetricsSource>({
    enabled,
    initialMetrics: analyticsMetricsCache,
    parser: parseAnalyticsMetricsPayload,
    path: ANALYTICS_METRICS_PATH,
    persist: persistAnalyticsMetrics,
  });
}
