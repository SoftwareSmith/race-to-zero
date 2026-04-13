import { useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { DEFAULT_GAME_CONFIG } from "@game/engine/types";
import { useStoredState } from "../../../hooks/useStoredState";
import {
  parseStoredBoolean,
  parseStoredPositiveNumber,
} from "@shared/utils/storage";
import type { BugVisualSettingKey } from "../../../types/dashboard";

export function useGameSettings() {
  const [showParticleCount, setShowParticleCount] = useStoredState(
    STORAGE_KEYS.showParticleCount,
    true,
    { parse: parseStoredBoolean },
  );
  const [bugSizeMultiplier, setBugSizeMultiplier] = useStoredState(
    STORAGE_KEYS.bugSizeMultiplier,
    2.5,
    { parse: parseStoredPositiveNumber },
  );
  const [bugChaosMultiplier, setBugChaosMultiplier] = useStoredState(
    STORAGE_KEYS.bugChaosMultiplier,
    1.4,
    { parse: parseStoredPositiveNumber },
  );
  const [gameConfig] = useStoredState(
    STORAGE_KEYS.gameConfig,
    DEFAULT_GAME_CONFIG,
    {
      parse: (raw: string) => {
        try {
          return JSON.parse(raw) as typeof DEFAULT_GAME_CONFIG;
        } catch {
          return null;
        }
      },
      serialize: (value: typeof DEFAULT_GAME_CONFIG) => JSON.stringify(value),
    } as never,
  );

  const bugVisualSettings = useMemo(
    () => ({
      chaosMultiplier: bugChaosMultiplier,
      sizeMultiplier: bugSizeMultiplier,
    }),
    [bugChaosMultiplier, bugSizeMultiplier],
  );

  const handleBugVisualSetting = useCallback(
    (settingKey: BugVisualSettingKey, value: number) => {
      if (settingKey === "sizeMultiplier") setBugSizeMultiplier(value);
      if (settingKey === "chaosMultiplier") setBugChaosMultiplier(value);
    },
    [setBugChaosMultiplier, setBugSizeMultiplier],
  );

  return {
    bugVisualSettings,
    gameConfig,
    handleBugVisualSetting,
    setBugChaosMultiplier,
    setBugSizeMultiplier,
    setShowParticleCount,
    showParticleCount,
  };
}
