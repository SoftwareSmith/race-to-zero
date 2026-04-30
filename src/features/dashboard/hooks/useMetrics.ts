import { useCallback, useEffect, useState } from "react";
import type { MetricsSource } from "../../../types/dashboard";
import { isStoredRecord } from "@shared/utils/storage";

const METRICS_PATH = `${import.meta.env.BASE_URL}data/metrics.json`;

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

        const nextMetrics: unknown = await response.json();

        if (!isMetricsSource(nextMetrics)) {
          throw new Error("Metrics payload has an unexpected shape");
        }

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
