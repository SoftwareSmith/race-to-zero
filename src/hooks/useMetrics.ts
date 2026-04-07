import { useCallback, useEffect, useState } from "react";
import type { MetricsSource } from "../types/dashboard";

const METRICS_PATH = `${import.meta.env.BASE_URL}data/metrics.json`;

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

        const nextMetrics = (await response.json()) as MetricsSource;
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
