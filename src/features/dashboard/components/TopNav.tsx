import type { ChangeEventHandler } from "react";
import { memo } from "react";
import Tabs from "@shared/components/Tabs";
import CompactDateField from "@shared/components/forms/CompactDateField";
import CompareRangePicker from "@dashboard/components/CompareRangePicker";
import { TAB_ITEMS } from "../utils/dashboard";
import type { ActiveTab, CompareRangeKey } from "../../../types/dashboard";

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
      className="flex flex-col gap-[0.3125rem] lg:flex-row lg:items-center lg:justify-between"
      onMouseDownCapture={() => onInteract()}
      onTouchStartCapture={() => onInteract()}
    >
      <Tabs
        activeTab={activeTab}
        onChange={onTabChange}
        size="compact"
        tabs={TAB_ITEMS}
      />

      {activeTab === "overview" ? (
        <div className="flex w-full flex-wrap gap-[0.3125rem] lg:w-auto lg:justify-end">
          <CompactDateField
            label="From"
            max={deadlineDate}
            onChange={onDeadlineFromDateChange}
            size="compact"
            value={deadlineFromDate}
          />
          <CompactDateField
            label="Deadline"
            min={todayDate}
            onChange={onDeadlineDateChange}
            size="compact"
            value={deadlineDate}
          />
        </div>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-[0.3125rem] lg:w-auto lg:justify-end">
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
                size="compact"
                value={customFromDate}
              />
              <CompactDateField
                label="To"
                min={customFromDate}
                onChange={onCustomToDateChange}
                size="compact"
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
