import { STORAGE_KEYS } from "../../../constants/storageKeys";
import { useStoredState } from "@shared/hooks/useStoredState";
import { parseStoredString } from "@shared/utils/storage";

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultDeadlineDate() {
  const date = new Date();
  date.setMonth(11, 31);

  return formatDateInputValue(date);
}

function getDefaultTrackingStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29);

  return formatDateInputValue(date);
}

export function useDeadlineRange() {
  const [deadlineDate, setDeadlineDate] = useStoredState(
    STORAGE_KEYS.deadlineDate,
    getDefaultDeadlineDate(),
    { parse: parseStoredString },
  );
  const [deadlineFromDate, setDeadlineFromDate] = useStoredState(
    STORAGE_KEYS.deadlineFromDate,
    getDefaultTrackingStartDate(),
    { parse: parseStoredString },
  );

  return {
    deadlineDate,
    deadlineFromDate,
    setDeadlineDate,
    setDeadlineFromDate,
  };
}
