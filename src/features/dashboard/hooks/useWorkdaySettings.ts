import { useMemo } from "react";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { useStoredState } from "../../../hooks/useStoredState";
import { parseStoredBoolean } from "@shared/utils/storage";
import type { WorkdaySettings } from "../../../types/dashboard";

export function useWorkdaySettings() {
  const [excludeWeekends, setExcludeWeekends] = useStoredState(
    STORAGE_KEYS.excludeWeekends,
    false,
    { parse: parseStoredBoolean },
  );
  const [excludePublicHolidays, setExcludePublicHolidays] = useStoredState(
    STORAGE_KEYS.excludePublicHolidays,
    false,
    { parse: parseStoredBoolean },
  );
  const workdaySettings = useMemo<WorkdaySettings>(
    () => ({ excludePublicHolidays, excludeWeekends }),
    [excludePublicHolidays, excludeWeekends],
  );

  return {
    excludePublicHolidays,
    excludeWeekends,
    setExcludePublicHolidays,
    setExcludeWeekends,
    workdaySettings,
  };
}
