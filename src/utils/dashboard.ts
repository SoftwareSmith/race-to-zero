import type { CompareRangeOption, TabItem, Tone } from "../types/dashboard";

export const TAB_ITEMS: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "periods", label: "Periods" },
];

export const COMPARE_RANGE_OPTIONS: CompareRangeOption[] = [
  { label: "7D", value: "7" },
  { label: "30D", value: "30" },
  { label: "90D", value: "90" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
];

export function readStoredDate(key: string, fallbackValue: string) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  const storedValue = window.localStorage.getItem(key);
  return storedValue || fallbackValue;
}

export function readStoredFlag(key: string, fallbackValue = false) {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  const storedValue = window.localStorage.getItem(key);

  if (storedValue == null) {
    return fallbackValue;
  }

  return storedValue === "true";
}

export function formatNumber(value: number, digits = 0) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatSignedNumber(value: number, digits = 0) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, digits)}`;
}

export function formatPercent(value: number, digits = 0) {
  return `${formatNumber(value, digits)}%`;
}

export function getNetChangeTone(netChange: number): Tone {
  if (netChange > 0) {
    return "negative";
  }

  if (netChange < 0) {
    return "positive";
  }

  return "neutral";
}

export function getMetricTone(
  currentValue: number,
  previousValue: number | null,
  higherIsBetter: boolean,
): Tone {
  if (previousValue == null) {
    return "neutral";
  }

  if (Math.abs(currentValue - previousValue) < 0.01) {
    return "neutral";
  }

  const improved = higherIsBetter
    ? currentValue > previousValue
    : currentValue < previousValue;
  return improved ? "positive" : "negative";
}

export function getDeltaTone(value: number): Tone {
  if (Math.abs(value) < 0.01) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

export function getStatusTagText(tone: Tone) {
  if (tone === "positive") {
    return "Ahead";
  }

  if (tone === "negative") {
    return "Behind";
  }

  return "Flat";
}

export function getDateInputBounds(min?: string, max?: string) {
  if (min && max && min > max) {
    return { max: undefined, min: undefined };
  }

  return { min, max };
}
