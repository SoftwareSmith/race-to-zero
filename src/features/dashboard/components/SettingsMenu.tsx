import type { RefObject } from "react";
import { MenuIconButton, MenuPanel, ToggleField } from "@shared/components/MenuControls";
import type { MenuSettingsState, SettingToggleKey } from "../../../types/dashboard";

interface SettingsMenuProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onMenuToggle: () => void;
  onToggle: (settingKey: SettingToggleKey) => void;
  open: boolean;
  settings: MenuSettingsState;
}

function SettingsMenu({
  containerRef,
  open,
  onMenuToggle,
  settings,
  onToggle,
}: SettingsMenuProps) {
  return (
    <div className="relative" ref={containerRef}>
      <MenuIconButton
        ariaLabel="Open settings"
        onClick={onMenuToggle}
        tooltip="Deadline and workday assumptions for the pace math."
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path d="M12 3v2.4M12 18.6V21M4.93 4.93l1.7 1.7M17.37 17.37l1.7 1.7M3 12h2.4M18.6 12H21M4.93 19.07l1.7-1.7M17.37 6.63l1.7-1.7" />
          <circle cx="12" cy="12" r="3.25" />
        </svg>
      </MenuIconButton>

      {open ? (
        <MenuPanel title="Settings">
          <ToggleField
            checked={settings.excludeWeekends}
            description="Use weekdays only when calculating days left and required pace."
            label="Exclude weekends"
            onChange={() => onToggle("excludeWeekends")}
          />
          <ToggleField
            checked={settings.excludePublicHolidays}
            description="Exclude Western Australia public holidays from workday calculations."
            label="Exclude public holidays (AWST)"
            onChange={() => onToggle("excludePublicHolidays")}
          />
        </MenuPanel>
      ) : null}
    </div>
  );
}

export default SettingsMenu;
