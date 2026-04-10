import type { MouseEvent } from "react";
import { memo, useCallback } from "react";
import { cn } from "@shared/utils/cn";
import type { ActiveTab, TabItem } from "../../types/dashboard";

interface TabsProps {
  activeTab: ActiveTab;
  onChange: (tabId: ActiveTab) => void;
  tabs: TabItem[];
}

const Tabs = memo(function Tabs({ tabs, activeTab, onChange }: TabsProps) {
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
      className="inline-flex rounded-full border border-white/6 bg-white/[0.02] p-0.5 shadow-[0_8px_18px_rgba(0,0,0,0.12)] backdrop-blur-xl"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            aria-selected={isActive}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[0.82rem] font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
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
