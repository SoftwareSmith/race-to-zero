import { endOfYear, format, subDays } from "date-fns";
import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { useStoredState } from "../../../hooks/useStoredState";
import { parseStoredString } from "@shared/utils/storage";

export function useDeadlineRange() {
  const [deadlineDate, setDeadlineDate] = useStoredState(
    STORAGE_KEYS.deadlineDate,
    format(endOfYear(new Date()), "yyyy-MM-dd"),
    { parse: parseStoredString },
  );
  const [deadlineFromDate, setDeadlineFromDate] = useStoredState(
    STORAGE_KEYS.deadlineFromDate,
    format(subDays(new Date(), 29), "yyyy-MM-dd"),
    { parse: parseStoredString },
  );

  return {
    deadlineDate,
    deadlineFromDate,
    setDeadlineDate,
    setDeadlineFromDate,
  };
}
