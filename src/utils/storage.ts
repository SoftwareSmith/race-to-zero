import type { StorageKey } from "../constants/storageKeys";

type StorageParser<T> = (rawValue: string) => T | null;
type StorageSerializer<T> = (value: T) => string;

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

  const rawValue = window.localStorage.getItem(key);
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
    return;
  }

  window.localStorage.setItem(key, serializer(value));
}

export function parseStoredString(rawValue: string) {
  return rawValue;
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

export function serializeStoredValue<T>(value: T) {
  return String(value);
}
