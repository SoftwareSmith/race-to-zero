import { useCallback, useEffect, useMemo, useState } from "react";
import type { BugVariant } from "../../../../types/dashboard";
import type { BugHitPayload, GameState } from "./types";

function createSessionState(
  sessionKey: string,
  totalBugCount: number,
): GameState {
  return {
    remainingTargets: totalBugCount,
    sessionKey,
    splats: [],
  };
}

function appendSplat(
  state: GameState,
  variant: BugVariant,
  x: number,
  y: number,
): GameState {
  return {
    ...state,
    remainingTargets: Math.max(0, state.remainingTargets - 1),
    splats: [
      ...state.splats.slice(-5),
      {
        id: `${x}-${y}-${Date.now()}`,
        variant,
        x,
        y,
      },
    ],
  };
}

interface UseBackgroundGameStateOptions {
  gameSessionKey: string;
  onBugHit?: (payload: BugHitPayload) => void;
  onStructureKill?: (structureId: string) => void;
  totalBugCount: number;
  triggerHammerSwing: () => void;
}

export function useBackgroundGameState({
  gameSessionKey,
  onBugHit,
  onStructureKill,
  totalBugCount,
  triggerHammerSwing,
}: UseBackgroundGameStateOptions) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createSessionState(gameSessionKey, totalBugCount),
  );

  const activeGameState = useMemo(
    () =>
      gameState.sessionKey === gameSessionKey
        ? gameState
        : createSessionState(gameSessionKey, totalBugCount),
    [gameSessionKey, gameState, totalBugCount],
  );

  useEffect(() => {
    if (activeGameState.splats.length === 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setGameState((currentValue) => {
        if (
          currentValue.sessionKey !== gameSessionKey ||
          currentValue.splats.length <= 3
        ) {
          return currentValue;
        }

        return {
          ...currentValue,
          splats: currentValue.splats.slice(-3),
        };
      });
    }, 420);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeGameState.splats.length, gameSessionKey]);

  const handleBugHit = useCallback(
    (payload: BugHitPayload) => {
      triggerHammerSwing();
      onBugHit?.(payload);
      setGameState((currentValue) => {
        const nextState =
          currentValue.sessionKey === gameSessionKey
            ? currentValue
            : createSessionState(gameSessionKey, totalBugCount);

        if (!payload.defeated) {
          return {
            ...nextState,
            sessionKey: gameSessionKey,
          };
        }

        return appendSplat(
          { ...nextState, sessionKey: gameSessionKey },
          payload.variant,
          payload.x,
          payload.y,
        );
      });
    },
    [gameSessionKey, onBugHit, totalBugCount, triggerHammerSwing],
  );

  const handleStructureKill = useCallback(
    (structureId: string, x: number, y: number, variant: string) => {
      const bugVariant = variant as BugVariant;
      onBugHit?.({
        defeated: true,
        remainingHp: 0,
        variant: bugVariant,
        x,
        y,
        pointValue: 1,
      });

      setGameState((currentValue) => {
        const nextState =
          currentValue.sessionKey === gameSessionKey
            ? currentValue
            : createSessionState(gameSessionKey, totalBugCount);

        return appendSplat(nextState, bugVariant, x, y);
      });
      onStructureKill?.(structureId);
    },
    [gameSessionKey, onBugHit, onStructureKill, totalBugCount],
  );

  const handleEntityDeath = useCallback(
    (
      x: number,
      y: number,
      variant: string,
      meta: { credited: boolean; frozen: boolean; pointValue: number },
    ) => {
      if (meta.credited) {
        return;
      }

      const bugVariant = variant as BugVariant;
      onBugHit?.({
        defeated: true,
        remainingHp: 0,
        variant: bugVariant,
        x,
        y,
        pointValue: meta.pointValue,
        frozen: meta.frozen,
      });

      setGameState((currentValue) => {
        const nextState =
          currentValue.sessionKey === gameSessionKey
            ? currentValue
            : createSessionState(gameSessionKey, totalBugCount);

        return appendSplat(nextState, bugVariant, x, y);
      });
    },
    [gameSessionKey, onBugHit, totalBugCount],
  );

  return {
    activeGameState,
    handleBugHit,
    handleEntityDeath,
    handleStructureKill,
  };
}