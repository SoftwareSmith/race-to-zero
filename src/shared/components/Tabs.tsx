import type { MouseEvent } from "react";
import { memo, useCallback } from "react";
import { cn } from "@shared/utils/cn";
import type { ActiveTab, TabItem } from "../../types/dashboard";

interface TabsProps {
  activeTab: ActiveTab;
  onChange: (tabId: ActiveTab) => void;
  size?: "default" | "compact";
  tabs: TabItem[];
}

const Tabs = memo(function Tabs({
  tabs,
  activeTab,
  onChange,
  size = "default",
}: TabsProps) {
  const handleTabClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const nextTabId = event.currentTarget.dataset.tabId as
        | ActiveTab
        | undefined;
      if (!nextTabId) {
        return;
      }

      onChange(nextTabId);
    },
    [onChange],
  );

  return (
    <div
      aria-label="Dashboard sections"
      className={cn(
        "inline-flex max-w-full flex-wrap rounded-full border border-white/6 bg-white/[0.03] backdrop-blur-xl",
        size === "compact"
          ? "p-[3px] shadow-[0_6px_14px_rgba(0,0,0,0.12)]"
          : "p-0.5 shadow-[0_8px_18px_rgba(0,0,0,0.12)]",
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            aria-selected={isActive}
            className={cn(
              size === "compact"
                ? "rounded-full px-2.5 py-[0.32rem] text-[0.66rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40 sm:text-[0.7rem]"
                : "rounded-full px-3 py-1.5 text-[0.72rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40 sm:text-[0.76rem]",
              isActive
                ? "bg-sky-400/8 text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]"
                : "text-stone-400 hover:bg-white/4 hover:text-stone-100",
            )}
            data-tab-id={tab.id}
            onClick={handleTabClick}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
});

export default Tabs;
