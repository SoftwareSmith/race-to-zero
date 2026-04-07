import type { ChangeEventHandler, MouseEvent } from "react";
import { memo, useCallback } from "react";
import Tabs from "./Tabs";
import { cn } from "../utils/cn";
import {
  COMPARE_RANGE_OPTIONS,
  getDateInputBounds,
  TAB_ITEMS,
} from "../utils/dashboard";
import type { ActiveTab, CompareRangeKey } from "../types/dashboard";

interface CompactDateFieldProps {
  disabled?: boolean;
  label: string;
  max?: string;
  min?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  value: string;
}

function CompactDateField({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
}: CompactDateFieldProps) {
  const bounds = getDateInputBounds(min, max);

  return (
    <label
      className={cn(
        "flex h-9 min-w-[128px] items-center gap-2 rounded-full border border-white/6 bg-white/[0.02] px-3 text-sm shadow-[0_8px_18px_rgba(0,0,0,0.1)] transition duration-200 backdrop-blur-xl",
        disabled
          ? "cursor-default opacity-38"
          : "hover:border-white/10 hover:bg-white/[0.04]",
      )}
    >
      <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent text-[0.82rem] font-medium text-stone-100 outline-none disabled:cursor-default"
        disabled={disabled}
        max={bounds.max}
        min={bounds.min}
        onChange={onChange}
        type="date"
        value={value}
      />
    </label>
  );
}

interface CompareRangePickerProps {
  compareRangeKey: CompareRangeKey;
  onChange: (rangeKey: CompareRangeKey) => void;
}

function CompareRangePicker({
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

interface TopNavProps {
  activeTab: ActiveTab;
  compareRangeKey: CompareRangeKey;
  customFromDate: string;
  customToDate: string;
  deadlineDate: string;
  deadlineFromDate: string;
  onCompareRangeChange: (rangeKey: CompareRangeKey) => void;
  onCustomFromDateChange: ChangeEventHandler<HTMLInputElement>;
  onCustomToDateChange: ChangeEventHandler<HTMLInputElement>;
  onDeadlineDateChange: ChangeEventHandler<HTMLInputElement>;
  onDeadlineFromDateChange: ChangeEventHandler<HTMLInputElement>;
  onInteract: () => void;
  onTabChange: (tabId: ActiveTab) => void;
  todayDate: string;
}

const TopNav = memo(function TopNav({
  activeTab,
  compareRangeKey,
  customFromDate,
  customToDate,
  deadlineDate,
  deadlineFromDate,
  onInteract,
  onCompareRangeChange,
  onCustomFromDateChange,
  onCustomToDateChange,
  onDeadlineDateChange,
  onDeadlineFromDateChange,
  onTabChange,
  todayDate,
}: TopNavProps) {
  return (
    <div
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      onMouseDownCapture={() => onInteract()}
      onTouchStartCapture={() => onInteract()}
    >
      <Tabs activeTab={activeTab} onChange={onTabChange} tabs={TAB_ITEMS} />

      {activeTab === "overview" ? (
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          <CompactDateField
            label="From"
            max={deadlineDate}
            onChange={onDeadlineFromDateChange}
            value={deadlineFromDate}
          />
          <CompactDateField
            label="Deadline"
            min={todayDate}
            onChange={onDeadlineDateChange}
            value={deadlineDate}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <CompareRangePicker
            compareRangeKey={compareRangeKey}
            onChange={onCompareRangeChange}
          />
          {compareRangeKey === "custom" ? (
            <>
              <CompactDateField
                label="From"
                max={customToDate}
                onChange={onCustomFromDateChange}
                value={customFromDate}
              />
              <CompactDateField
                label="To"
                min={customFromDate}
                onChange={onCustomToDateChange}
                value={customToDate}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});

export default TopNav;
