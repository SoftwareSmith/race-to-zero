import { addDays, eachDayOfInterval, format, isWeekend } from "date-fns";
import type { WorkdaySettings } from "../types/dashboard";

const WA_PUBLIC_HOLIDAYS: Record<number, string[]> = {
  2024: [
    "2024-01-01",
    "2024-01-26",
    "2024-03-04",
    "2024-03-29",
    "2024-04-01",
    "2024-04-25",
    "2024-06-03",
    "2024-09-23",
    "2024-12-25",
    "2024-12-26",
  ],
  2025: [
    "2025-01-01",
    "2025-01-27",
    "2025-03-03",
    "2025-04-18",
    "2025-04-21",
    "2025-04-25",
    "2025-06-02",
    "2025-09-29",
    "2025-12-25",
    "2025-12-26",
  ],
  2026: [
    "2026-01-01",
    "2026-01-26",
    "2026-03-02",
    "2026-04-03",
    "2026-04-06",
    "2026-04-25",
    "2026-04-27",
    "2026-06-01",
    "2026-09-28",
    "2026-12-25",
    "2026-12-26",
    "2026-12-28",
  ],
  2027: [
    "2027-01-01",
    "2027-01-26",
    "2027-03-01",
    "2027-03-26",
    "2027-03-29",
    "2027-04-25",
    "2027-04-26",
    "2027-06-07",
    "2027-09-27",
    "2027-12-25",
    "2027-12-26",
    "2027-12-27",
    "2027-12-28",
  ],
  2028: [
    "2028-01-01",
    "2028-01-03",
    "2028-01-26",
    "2028-03-06",
    "2028-04-14",
    "2028-04-17",
    "2028-04-25",
    "2028-06-05",
    "2028-09-25",
    "2028-12-25",
    "2028-12-26",
  ],
  2029: [
    "2029-01-01",
    "2029-01-26",
    "2029-03-05",
    "2029-03-30",
    "2029-04-02",
    "2029-04-25",
    "2029-06-04",
    "2029-09-24",
    "2029-12-25",
    "2029-12-26",
  ],
  2030: [
    "2030-01-01",
    "2030-01-28",
    "2030-03-04",
    "2030-04-19",
    "2030-04-22",
    "2030-04-25",
    "2030-06-03",
    "2030-09-30",
    "2030-12-25",
    "2030-12-26",
  ],
  2031: [
    "2031-01-01",
    "2031-01-27",
    "2031-03-03",
    "2031-04-11",
    "2031-04-14",
    "2031-04-25",
    "2031-06-02",
    "2031-09-29",
    "2031-12-25",
    "2031-12-26",
  ],
  2032: [
    "2032-01-01",
    "2032-01-26",
    "2032-03-01",
    "2032-03-26",
    "2032-03-29",
    "2032-04-25",
    "2032-04-26",
    "2032-06-07",
    "2032-09-27",
    "2032-12-25",
    "2032-12-26",
    "2032-12-27",
    "2032-12-28",
  ],
  2033: [
    "2033-01-01",
    "2033-01-03",
    "2033-01-26",
    "2033-03-07",
    "2033-04-15",
    "2033-04-18",
    "2033-04-25",
    "2033-06-06",
    "2033-09-26",
    "2033-12-25",
    "2033-12-26",
    "2033-12-27",
  ],
  2034: [
    "2034-01-01",
    "2034-01-02",
    "2034-01-26",
    "2034-03-06",
    "2034-04-07",
    "2034-04-10",
    "2034-04-25",
    "2034-06-05",
    "2034-09-25",
    "2034-12-25",
    "2034-12-26",
  ],
  2035: [
    "2035-01-01",
    "2035-01-26",
    "2035-03-05",
    "2035-03-23",
    "2035-03-26",
    "2035-04-25",
    "2035-06-04",
    "2035-09-24",
    "2035-12-25",
    "2035-12-26",
  ],
};

function getYearRange(startDate: Date, endDate: Date) {
  const years = [];

  for (
    let year = startDate.getFullYear();
    year <= endDate.getFullYear();
    year += 1
  ) {
    years.push(year);
  }

  return years;
}

function getHolidayKeySet(startDate: Date, endDate: Date) {
  const keys = new Set<string>();

  for (const year of getYearRange(startDate, endDate)) {
    for (const holiday of WA_PUBLIC_HOLIDAYS[year] ?? []) {
      keys.add(holiday);
    }
  }

  return keys;
}

export function countConfiguredDays(
  startDate: Date,
  endDate: Date,
  settings: WorkdaySettings = {
    excludePublicHolidays: false,
    excludeWeekends: false,
  },
  { inclusive = true }: { inclusive?: boolean } = {},
) {
  if (!startDate || !endDate || startDate > endDate) {
    return 0;
  }

  const intervalStart = inclusive ? startDate : addDays(startDate, 1);

  if (intervalStart > endDate) {
    return 0;
  }

  const holidayKeys = settings.excludePublicHolidays
    ? getHolidayKeySet(intervalStart, endDate)
    : null;

  return eachDayOfInterval({ start: intervalStart, end: endDate }).filter(
    (date) => {
      if (settings.excludeWeekends && isWeekend(date)) {
        return false;
      }

      if (holidayKeys?.has(format(date, "yyyy-MM-dd"))) {
        return false;
      }

      return true;
    },
  ).length;
}
