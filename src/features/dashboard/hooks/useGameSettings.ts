import { useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { DEFAULT_GAME_CONFIG, type GameConfig } from "@game/engine/types";
import { useStoredState } from "../../../hooks/useStoredState";
import {
  createStoredJsonParser,
  isStoredRecord,
  parseStoredBoolean,
  parseStoredPositiveNumber,
  serializeStoredValue,
} from "@shared/utils/storage";
import type { BugVisualSettingKey } from "../../../types/dashboard";

function isGameConfig(value: unknown): value is GameConfig {
  if (!isStoredRecord(value)) {
    return false;
  }

  return Object.entries(DEFAULT_GAME_CONFIG).every(([key, defaultValue]) => {
    const candidateValue = value[key];
    return (
      typeof defaultValue === "number" &&
      typeof candidateValue === "number" &&
      Number.isFinite(candidateValue)
    );
  });
}

export function useGameSettings() {
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
  const [showBugParticleCount, setShowBugParticleCount] = useStoredState(
    STORAGE_KEYS.bugParticleCountVisible,
    true,
    {
      parse: parseStoredBoolean,
      serialize: serializeStoredValue,
    },
  );
  const [gameConfig] = useStoredState(
    STORAGE_KEYS.gameConfig,
    DEFAULT_GAME_CONFIG,
    {
      parse: createStoredJsonParser(isGameConfig),
      serialize: JSON.stringify,
    },
  );

  const bugVisualSettings = useMemo(
    () => ({
      chaosMultiplier: bugChaosMultiplier,
      showParticleCount: showBugParticleCount,
      sizeMultiplier: bugSizeMultiplier,
    }),
    [bugChaosMultiplier, bugSizeMultiplier, showBugParticleCount],
  );

  const handleBugVisualSetting = useCallback(
    (settingKey: BugVisualSettingKey, value: number) => {
      if (settingKey === "sizeMultiplier") {
        setBugSizeMultiplier(value);
        return;
      }

      if (settingKey === "chaosMultiplier") {
        setBugChaosMultiplier(value);
      }
    },
    [setBugChaosMultiplier, setBugSizeMultiplier],
  );

  const toggleShowBugParticleCount = useCallback(() => {
    setShowBugParticleCount((currentValue) => !currentValue);
  }, [setShowBugParticleCount]);

  return {
    bugVisualSettings,
    gameConfig,
    handleBugVisualSetting,
    setBugChaosMultiplier,
    setBugSizeMultiplier,
    showBugParticleCount,
    toggleShowBugParticleCount,
  };
}
