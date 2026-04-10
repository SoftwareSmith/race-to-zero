import type { MouseEvent } from "react";
import { useCallback } from "react";
import { cn } from "@shared/utils/cn";
import { COMPARE_RANGE_OPTIONS } from "../utils/dashboard";
import type { CompareRangeKey } from "../../../types/dashboard";

interface CompareRangePickerProps {
  compareRangeKey: CompareRangeKey;
  onChange: (rangeKey: CompareRangeKey) => void;
}

export default function CompareRangePicker({
  compareRangeKey,
  onChange,
}: CompareRangePickerProps) {
  const handleRangeClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const nextRangeKey = event.currentTarget.dataset.rangeKey as
        | CompareRangeKey
        | undefined;
      if (!nextRangeKey) {
        return;
      }

      onChange(nextRangeKey);
    },
    [onChange],
  );

  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Comparison period selector"
    >
      {COMPARE_RANGE_OPTIONS.map((option) => {
        const isActive = compareRangeKey === option.value;

        return (
          <button
            key={option.value}
            aria-selected={isActive}
            className={cn(
              "h-9 rounded-full border px-3.5 text-[0.82rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
              isActive
                ? "border-sky-400/24 bg-sky-400/8 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]"
                : "border-white/6 bg-zinc-950/60 text-stone-400 hover:-translate-y-0.5 hover:border-white/10 hover:bg-zinc-900/88 hover:text-stone-100",
            )}
            data-range-key={option.value}
            onClick={handleRangeClick}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
