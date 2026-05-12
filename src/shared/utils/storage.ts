import type { StorageKey } from "../../constants/storageKeys";

type StorageParser<T> = (rawValue: string) => T | null;
type StorageSerializer<T> = (value: T) => string;
type StorageValidator<T> = (value: unknown) => value is T;

const MAX_STORED_VALUE_CHARS = 1_000_000;
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isBrowserEnvironment() {
  return typeof window !== "undefined";
}

export function readStorageValue<T>(
  key: StorageKey,
  fallbackValue: T,
  parser: StorageParser<T>,
) {
  if (!isBrowserEnvironment()) {
    return fallbackValue;
  }

  let rawValue: string | null = null;
  try {
    rawValue = window.localStorage.getItem(key);
  } catch {
    return fallbackValue;
  }
  if (rawValue == null) {
    return fallbackValue;
  }

  const parsedValue = parser(rawValue);
  return parsedValue == null ? fallbackValue : parsedValue;
}

export function setStorageValue<T>(
  key: StorageKey,
  value: T,
  serializer: StorageSerializer<T>,
) {
  if (!isBrowserEnvironment()) {
    return false;
  }

  let serializedValue = "";

  try {
    serializedValue = serializer(value);
  } catch {
    return false;
  }

  if (serializedValue.length > MAX_STORED_VALUE_CHARS) {
    return false;
  }

  try {
    window.localStorage.setItem(key, serializedValue);
    return true;
  } catch {
    return false;
  }
}

export function parseStoredString(rawValue: string) {
  return rawValue;
}

export function isStoredRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.keys(value).every((key) => !UNSAFE_OBJECT_KEYS.has(key));
}

export function createStoredJsonParser<T>(
  validator?: StorageValidator<T>,
): StorageParser<T> {
  return (rawValue: string) => {
    try {
      const parsedValue: unknown = JSON.parse(rawValue);

      if (validator && !validator(parsedValue)) {
        return null;
      }

      return parsedValue as T;
    } catch {
      return null;
    }
  };
}

export function parseStoredBoolean(rawValue: string) {
  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  return null;
}

export function parseStoredPositiveNumber(rawValue: string) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue;
}

export function parseStoredNumberInRange(
  rawValue: string,
  min: number,
  max: number,
) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(max, Math.max(min, numericValue));
}

export function serializeStoredValue<T>(value: T) {
  return String(value);
}
