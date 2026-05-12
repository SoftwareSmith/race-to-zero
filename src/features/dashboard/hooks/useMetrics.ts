import { useCallback, useEffect, useState } from "react";
import type { MetricsSource } from "../../../types/dashboard";
import { isStoredRecord } from "@shared/utils/storage";

const METRICS_PATH = `${import.meta.env.BASE_URL}data/metrics.json`;
const MAX_METRICS_RESPONSE_CHARS = 8_000_000;
const MAX_METRICS_BUG_COUNT = 100_000;

function parseMetricsPayload(rawValue: string) {
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

  return value.bugs.every((bug) => {
    if (!isStoredRecord(bug)) {
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
    } = bug;

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
  });
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<MetricsSource | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const refreshMetrics = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(`${METRICS_PATH}?t=${Date.now()}`, {
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
        const nextMetrics = parseMetricsPayload(rawMetrics);

        setMetrics(nextMetrics);
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
    [],
  );

  useEffect(() => {
    refreshMetrics().catch(() => {});
  }, [refreshMetrics]);

  return {
    metrics,
    error,
    isLoading,
    refreshMetrics,
  };
}
