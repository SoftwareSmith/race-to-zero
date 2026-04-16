import { useEffect, type MutableRefObject } from "react";
import type { SiegeWeaponId } from "@game/types";
import type {
  SiegeCompletionSummary,
  SiegeRuntimeSnapshotLike,
} from "./useSiegeRunCompletion";

interface UseSiegeGameTimerOptions {
  completionSummary: SiegeCompletionSummary | null;
  interactiveBaseElapsedMsRef: MutableRefObject<number>;
  interactiveMode: boolean;
  interactiveRunningSinceRef: MutableRefObject<number | null>;
  interactiveStartedAt: number | null;
  pauseTimer: boolean;
  resetInactiveRuntime: () => void;
  updateRuntimeSnapshot: (
    updater: (current: SiegeRuntimeSnapshotLike) => SiegeRuntimeSnapshotLike,
    force?: boolean,
  ) => void;
}

function scheduleInterval(callback: () => void, delay: number): number {
  if (typeof window !== "undefined") {
    return window.setInterval(callback, delay);
  }

  return globalThis.setInterval(callback, delay) as unknown as number;
}

function cancelInterval(intervalId: number): void {
  globalThis.clearInterval(intervalId);
}

export function useSiegeGameTimer({
  completionSummary,
  interactiveBaseElapsedMsRef,
  interactiveMode,
  interactiveRunningSinceRef,
  interactiveStartedAt,
  pauseTimer,
  resetInactiveRuntime,
  updateRuntimeSnapshot,
}: UseSiegeGameTimerOptions) {
  useEffect(() => {
    if (!interactiveMode || interactiveStartedAt == null) {
      if (!interactiveMode) {
        resetInactiveRuntime();
      }
      return undefined;
    }

    if (pauseTimer || completionSummary != null) {
      if (interactiveRunningSinceRef.current != null) {
        const frozenElapsedMs =
          interactiveBaseElapsedMsRef.current +
          Math.max(0, Date.now() - interactiveRunningSinceRef.current);
        interactiveBaseElapsedMsRef.current = frozenElapsedMs;
        interactiveRunningSinceRef.current = null;
        updateRuntimeSnapshot(
          (current) => ({ ...current, elapsedMs: frozenElapsedMs }),
          true,
        );
      }

      return undefined;
    }

    if (interactiveRunningSinceRef.current == null) {
      interactiveRunningSinceRef.current = Date.now();
    }

    const syncElapsedMs = () => {
      updateRuntimeSnapshot((current) => ({
        ...current,
        elapsedMs:
          interactiveBaseElapsedMsRef.current +
          Math.max(0, Date.now() - (interactiveRunningSinceRef.current ?? Date.now())),
      }));
    };

    syncElapsedMs();
    const intervalId = scheduleInterval(syncElapsedMs, 250);

    return () => {
      cancelInterval(intervalId);
    };
  }, [
    completionSummary,
    interactiveBaseElapsedMsRef,
    interactiveMode,
    interactiveRunningSinceRef,
    interactiveStartedAt,
    pauseTimer,
    resetInactiveRuntime,
    updateRuntimeSnapshot,
  ]);
}