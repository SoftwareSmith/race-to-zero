import type { RefObject } from "react";
import {
  MenuIconButton,
  MenuPanel,
  RangeField,
  ToggleField,
} from "@shared/components/MenuControls";
import type {
  BugVisualSettingKey,
  BugVisualSettings,
  SettingToggleKey,
} from "../../../types/dashboard";

interface BugSettingsMenuProps {
  bugVisualSettings: BugVisualSettings;
  containerRef: RefObject<HTMLDivElement | null>;
  onChange: (settingKey: BugVisualSettingKey, value: number) => void;
  onMenuToggle: () => void;
  onToggle: (settingKey: SettingToggleKey) => void;
  open: boolean;
  showParticleCount: boolean;
  terminatorMode: boolean;
}

function BugSettingsMenu({
  bugVisualSettings,
  containerRef,
  onChange,
  onMenuToggle,
  open,
  showParticleCount,
  terminatorMode,
  onToggle,
}: BugSettingsMenuProps) {
  return (
    <div className="relative" ref={containerRef}>
      <MenuIconButton
        ariaLabel="Open bug field settings"
        onClick={onMenuToggle}
        tooltip="Bug field controls for size, speed, and debug overlays."
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
          viewBox="0 0 24 24"
        >
          <path d="M8.5 7.5 5.3 5.7M15.5 7.5l3.2-1.8M7.6 11H4.4M16.4 11h3.2M7.7 14.7l-3 1.9M16.3 14.7l3 1.9" />
          <circle cx="12" cy="6.2" r="2.1" fill="currentColor" stroke="none" />
          <path
            d="M9.1 10.4c0-1.6 1.3-2.9 2.9-2.9s2.9 1.3 2.9 2.9v4.2c0 2-1.3 3.8-2.9 3.8s-2.9-1.8-2.9-3.8v-4.2Z"
            fill="currentColor"
            stroke="none"
          />
          <path d="M10.2 18.2 8.8 20M13.8 18.2l1.4 1.8" />
        </svg>
      </MenuIconButton>

      {open ? (
        <MenuPanel title="Bug field">
          <RangeField
            description="Scale the bug sprites up or down across the full background layer."
            label="Bug size"
            max={3.5}
            min={0.8}
            onChange={(value) => onChange("sizeMultiplier", value)}
            step={0.1}
            value={bugVisualSettings.sizeMultiplier}
          />
          <RangeField
            description="Increase the crawl pace. Higher values still move faster, but the curve is now intentionally less extreme."
            label="Bug speed"
            max={3.5}
            min={0.6}
            onChange={(value) => onChange("chaosMultiplier", value)}
            step={0.1}
            value={bugVisualSettings.chaosMultiplier}
          />
          <ToggleField
            checked={terminatorMode}
            description="Swap the normal bug field for a bug-smashing mini-game with a hammer cursor."
            label="Terminator mode"
            onChange={() => onToggle("terminatorMode")}
          />
          <ToggleField
            checked={showParticleCount}
            description="Show the live background particle count for QA while tuning the bug field."
            label="Show bug particle count"
            onChange={() => onToggle("showParticleCount")}
          />
        </MenuPanel>
      ) : null}
    </div>
  );
}

export default BugSettingsMenu;
