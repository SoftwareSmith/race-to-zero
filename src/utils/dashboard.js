export const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'periods', label: 'Periods' },
]

export const COMPARE_RANGE_OPTIONS = [
  { label: '7D', value: '7' },
  { label: '30D', value: '30' },
  { label: '90D', value: '90' },
  { label: 'All time', value: 'all' },
  { label: 'Custom', value: 'custom' },
]

export function readStoredDate(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  const storedValue = window.localStorage.getItem(key)
  return storedValue || fallbackValue
}

export function readStoredFlag(key, fallbackValue = false) {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  const storedValue = window.localStorage.getItem(key)

  if (storedValue == null) {
    return fallbackValue
  }

  return storedValue === 'true'
}

export function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatSignedNumber(value, digits = 0) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatNumber(value, digits)}`
}

export function formatPercent(value, digits = 0) {
  return `${formatNumber(value, digits)}%`
}

export function getNetChangeTone(netChange) {
  if (netChange > 0) {
    return 'negative'
  }

  if (netChange < 0) {
    return 'positive'
  }

  return 'neutral'
}

export function getMetricTone(currentValue, previousValue, higherIsBetter) {
  if (previousValue == null) {
    return 'neutral'
  }

  if (Math.abs(currentValue - previousValue) < 0.01) {
    return 'neutral'
  }

  const improved = higherIsBetter ? currentValue > previousValue : currentValue < previousValue
  return improved ? 'positive' : 'negative'
}

export function getDeltaTone(value) {
  if (Math.abs(value) < 0.01) {
    return 'neutral'
  }

  return value > 0 ? 'positive' : 'negative'
}

export function getStatusTagText(tone) {
  if (tone === 'positive') {
    return 'Ahead'
  }

  if (tone === 'negative') {
    return 'Behind'
  }

  return 'Flat'
}

export function getDateInputBounds(min, max) {
  if (min && max && min > max) {
    return {}
  }

  return { min, max }
}