import type { ChangeEventHandler } from "react";
import { memo } from "react";
import Tabs from "@shared/components/Tabs";
import CompactDateField from "@shared/components/forms/CompactDateField";
import CompareRangePicker from "@dashboard/components/CompareRangePicker";
import { TAB_ITEMS } from "../../../utils/dashboard";
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
