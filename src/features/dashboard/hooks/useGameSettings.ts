import { useCallback, useMemo } from "react";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { DEFAULT_GAME_CONFIG, type GameConfig } from "@game/engine/types";
import { useStoredState } from "../../../hooks/useStoredState";
import {
  createStoredJsonParser,
  isStoredRecord,
  parseStoredBoolean,
  parseStoredNumberInRange,
  serializeStoredValue,
} from "@shared/utils/storage";
import type { BugVisualSettingKey } from "../../../types/dashboard";

const BUG_SIZE_MULTIPLIER_MIN = 0.5;
const BUG_SIZE_MULTIPLIER_MAX = 6;
const BUG_CHAOS_MULTIPLIER_MIN = 0.25;
const BUG_CHAOS_MULTIPLIER_MAX = 4;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGameConfigBounds(defaultValue: number) {
  return {
    max: Math.max(1, defaultValue * 10),
    min: defaultValue >= 1 ? 0.1 : 0.01,
  };
}

function sanitizeGameConfig(config: GameConfig): GameConfig {
  const sanitizedConfig = { ...DEFAULT_GAME_CONFIG };

  for (const [key, defaultValue] of Object.entries(DEFAULT_GAME_CONFIG)) {
    const configKey = key as keyof GameConfig;
    const bounds = getGameConfigBounds(defaultValue);
    sanitizedConfig[configKey] = clampNumber(
      config[configKey],
      bounds.min,
      bounds.max,
    );
  }

  return sanitizedConfig;
}

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

const parseStoredGameConfig = createStoredJsonParser<GameConfig>(isGameConfig);

export function useGameSettings() {
  const [bugSizeMultiplier, setBugSizeMultiplier] = useStoredState(
    STORAGE_KEYS.bugSizeMultiplier,
    2.5,
    {
      parse: (rawValue) =>
        parseStoredNumberInRange(
          rawValue,
          BUG_SIZE_MULTIPLIER_MIN,
          BUG_SIZE_MULTIPLIER_MAX,
        ),
    },
  );
  const [bugChaosMultiplier, setBugChaosMultiplier] = useStoredState(
    STORAGE_KEYS.bugChaosMultiplier,
    1.15,
    {
      parse: (rawValue) =>
        parseStoredNumberInRange(
          rawValue,
          BUG_CHAOS_MULTIPLIER_MIN,
          BUG_CHAOS_MULTIPLIER_MAX,
        ),
    },
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
      parse: (rawValue) => {
        const parsedConfig = parseStoredGameConfig(rawValue);
        return parsedConfig ? sanitizeGameConfig(parsedConfig) : null;
      },
      serialize: JSON.stringify,
    },
  );

  const safeBugSizeMultiplier = clampNumber(
    bugSizeMultiplier,
    BUG_SIZE_MULTIPLIER_MIN,
    BUG_SIZE_MULTIPLIER_MAX,
  );
  const safeBugChaosMultiplier = clampNumber(
    bugChaosMultiplier,
    BUG_CHAOS_MULTIPLIER_MIN,
    BUG_CHAOS_MULTIPLIER_MAX,
  );

  const bugVisualSettings = useMemo(
    () => ({
      chaosMultiplier: safeBugChaosMultiplier,
      showParticleCount: showBugParticleCount,
      sizeMultiplier: safeBugSizeMultiplier,
    }),
    [safeBugChaosMultiplier, safeBugSizeMultiplier, showBugParticleCount],
  );

  const setClampedBugSizeMultiplier = useCallback(
    (value: number) => {
      setBugSizeMultiplier(
        clampNumber(value, BUG_SIZE_MULTIPLIER_MIN, BUG_SIZE_MULTIPLIER_MAX),
      );
    },
    [setBugSizeMultiplier],
  );

  const setClampedBugChaosMultiplier = useCallback(
    (value: number) => {
      setBugChaosMultiplier(
        clampNumber(value, BUG_CHAOS_MULTIPLIER_MIN, BUG_CHAOS_MULTIPLIER_MAX),
      );
    },
    [setBugChaosMultiplier],
  );

  const handleBugVisualSetting = useCallback(
    (settingKey: BugVisualSettingKey, value: number) => {
      if (settingKey === "sizeMultiplier") {
        setClampedBugSizeMultiplier(value);
        return;
      }

      if (settingKey === "chaosMultiplier") {
        setClampedBugChaosMultiplier(value);
      }
    },
    [setClampedBugChaosMultiplier, setClampedBugSizeMultiplier],
  );

  const toggleShowBugParticleCount = useCallback(() => {
    setShowBugParticleCount((currentValue) => !currentValue);
  }, [setShowBugParticleCount]);

  return {
    bugVisualSettings,
    gameConfig,
    handleBugVisualSetting,
    setBugChaosMultiplier: setClampedBugChaosMultiplier,
    setBugSizeMultiplier: setClampedBugSizeMultiplier,
    showBugParticleCount,
    toggleShowBugParticleCount,
  };
}
