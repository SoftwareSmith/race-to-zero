/**
 * Number and percentage formatters shared across dashboard views,
 * chart labels, and other display contexts.
 */

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
