import { useState } from "react";
import { format, subDays } from "date-fns";
import type { CompareRangeKey } from "../../../types/dashboard";

export function useCompareRange() {
  const [compareRangeKey, setCompareRangeKey] = useState<CompareRangeKey>("30");
  const [customFromDate, setCustomFromDate] = useState(() =>
    format(subDays(new Date(), 29), "yyyy-MM-dd"),
  );
  const [customToDate, setCustomToDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  return {
    compareRangeKey,
    customFromDate,
    customToDate,
    setCompareRangeKey,
    setCustomFromDate,
    setCustomToDate,
  };
}
