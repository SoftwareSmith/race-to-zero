import { useCallback, useState } from "react";
import type { SetStateAction } from "react";
import type { StorageKey } from "../constants/storageKeys";
import {
  readStorageValue,
  serializeStoredValue,
  setStorageValue,
} from "@shared/utils/storage";

interface StoredStateOptions<T> {
  parse: (rawValue: string) => T | null;
  serialize?: (value: T) => string;
}

export function useStoredState<T>(
  key: StorageKey,
  fallbackValue: T,
  options: StoredStateOptions<T>,
) {
  const serializer = options.serialize ?? serializeStoredValue;
  const [value, setValue] = useState<T>(() =>
    readStorageValue(key, fallbackValue, options.parse),
  );

  const setStoredState = useCallback(
    (nextValue: SetStateAction<T>) => {
      setValue((currentValue) => {
        const resolvedValue =
          typeof nextValue === "function"
            ? (nextValue as (previousValue: T) => T)(currentValue)
            : nextValue;

        setStorageValue(key, resolvedValue, serializer);
        return resolvedValue;
      });
    },
    [key, serializer],
  );

  return [value, setStoredState] as const;
}
