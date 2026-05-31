import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MenuIconButton } from "@shared/components/MenuControls";
import { getCodex } from "@game/engine/bugCodex";
import { WEAPON_DEFS } from "@config/weaponConfig";
import type { BugVariant } from "../../../types/dashboard";
import type { SiegeWeaponId } from "@game/types";
import Tabs from "@shared/components/Tabs";
import { getVariantAccent } from "./codexPanel.helpers";
import { CodexPanelHeader } from "./codex-panel/CodexPanelHeader";
import { SummaryCard, WeaponSummaryCard } from "./codex-panel/SummaryCards";
import { WeaponDetailView } from "./codex-panel/WeaponDetailView";

interface CodexPanelProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onMenuToggle: () => void;
  open: boolean;
  trigger?: ReactNode;
}

type CodexView = "bugs" | "weapons";
type SelectedCodexEntry =
  | { id: string; kind: "bug" }
  | { id: SiegeWeaponId; kind: "weapon" }
  | null;

const CODEX_TABS = [
  { id: "bugs", label: "Bugs" },
  { id: "weapons", label: "Weapons" },
] as const;

export default function CodexPanel({
  containerRef,
  onMenuToggle,
  open,
  trigger,
}: CodexPanelProps) {
  const codex = useMemo(() => getCodex(), []);
  const [activeView, setActiveView] = useState<CodexView>("bugs");
  const [selectedEntry, setSelectedEntry] = useState<SelectedCodexEntry>(null);

  useEffect(() => {
    if (open) {
      // When the codex is opened, reset any previous selection so it
      // always starts on the list view. Defer to avoid synchronous
      // setState inside an effect.
      const t1 = setTimeout(() => setActiveView("bugs"), 0);
      const t2 = setTimeout(() => setSelectedEntry(null), 0);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    // don't reset when already open and a selection changes
  }, [open]);

  const entries = useMemo(() => Object.entries(codex), [codex]);
  const fallbackId = entries[0]?.[0] ?? "low";
  const bugEntry =
    selectedEntry?.kind === "bug" ? codex[selectedEntry.id] : null;
  const selectedWeapon =
    selectedEntry?.kind === "weapon"
      ? (WEAPON_DEFS.find((weapon) => weapon.id === selectedEntry.id) ?? null)
      : null;
  const backdropId =
    selectedEntry?.kind === "bug" ? selectedEntry.id : fallbackId;
  const backdropEntry = codex[backdropId];

  const handleMenuButtonClick = useCallback(() => {
    onMenuToggle();
  }, [onMenuToggle]);

  const handleSelectBug = useCallback((id: string) => {
    setSelectedEntry({ id, kind: "bug" });
  }, []);

  const handleSelectWeapon = useCallback((id: SiegeWeaponId) => {
    setSelectedEntry({ id, kind: "weapon" });
  }, []);

  const handleJumpToBug = useCallback((id: string) => {
    setActiveView("bugs");
    setSelectedEntry({ id, kind: "bug" });
  }, []);

  const handleJumpToWeapon = useCallback((id: SiegeWeaponId) => {
    setActiveView("weapons");
    setSelectedEntry({ id, kind: "weapon" });
  }, []);

  const handleBackToGrid = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveView(tabId as CodexView);
    setSelectedEntry(null);
  }, []);

  const backdropVariant = (backdropEntry?.iconVariant ??
    backdropId) as BugVariant;
  const backdropAccent = getVariantAccent(backdropVariant);
  const selectedVariant = bugEntry
    ? ((bugEntry.iconVariant ?? selectedEntry?.id) as BugVariant)
    : null;
  const selectedAccent = selectedVariant
    ? getVariantAccent(selectedVariant)
    : backdropAccent;
  const backdropStyle = useMemo<CSSProperties>(
    () => ({
      background: `radial-gradient(circle at 24% 28%, ${backdropAccent.washA}, transparent 32%), radial-gradient(circle at 74% 30%, ${backdropAccent.washB}, transparent 30%), radial-gradient(circle at 52% 82%, rgba(255,255,255,0.02), transparent 28%), linear-gradient(180deg, rgba(12,14,20,0.985), rgba(16,19,27,0.985))`,
    }),
    [backdropAccent],
  );

  return (
    <div className="relative" ref={containerRef}>
      {trigger ?? (
        <MenuIconButton
          ariaLabel="Open bug codex"
          onClick={handleMenuButtonClick}
          open={open}
          tooltip="Open the bug codex and review bug types."
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            viewBox="0 0 24 24"
          >
            <path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h10.5v15.5A2.5 2.5 0 0 0 16 16H5.5Z" />
            <path d="M8 3.5v12.3A2.2 2.2 0 0 0 10.2 18H18" />
            <path d="M10.1 7.2h5.8M10.1 10.4h5.8" />
            <path d="M11 14.6 9 13.5m4.9 1.1 2 1.1M10.4 17.1H8.4m6.2 0h2" />
            <circle
              cx="12.5"
              cy="13.4"
              r="1.2"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </MenuIconButton>
      )}

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                aria-label="Close bug codex"
                data-hud-cursor="default"
                data-no-hammer="true"
                className="fixed inset-0 z-[260] bg-black/45 backdrop-blur-[2px]"
                onClick={onMenuToggle}
                type="button"
              />
              <div
                className="fixed inset-x-4 top-[8vh] z-[270] mx-auto flex max-h-[78vh] w-full max-w-[58rem] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.52)] backdrop-blur-xl"
                data-codex-modal-root="true"
                data-hud-cursor="default"
                data-no-hammer="true"
                data-testid="codex-modal"
                style={backdropStyle}
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div
                    className="absolute left-[14%] top-[14%] h-40 w-40 rounded-full blur-3xl transition duration-500"
                    style={{ background: backdropAccent.washA }}
                  />
                  <div
                    className="absolute right-[10%] top-[24%] h-32 w-32 rounded-full blur-3xl transition duration-500"
                    style={{ background: backdropAccent.washB }}
                  />
                  <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.7)_1px,transparent_0)] [background-size:20px_20px]" />
                </div>

                <div className="relative flex min-w-0 flex-1 flex-col">
                  <CodexPanelHeader
                    activeView={activeView}
                    bugEntry={bugEntry}
                    fallbackId={fallbackId}
                    onBackToGrid={handleBackToGrid}
                    onClose={onMenuToggle}
                    selectedAccent={selectedAccent}
                    selectedEntryId={selectedEntry?.id}
                    selectedVariant={selectedVariant}
                    selectedWeapon={selectedWeapon}
                  />

                  {!(activeView === "weapons" && selectedWeapon) ? (
                    <div
                      className="relative border-b border-white/8 px-4 py-2.5"
                      data-testid="codex-tabs"
                    >
                      <Tabs
                        activeTab={activeView as any}
                        hudPointer
                        onChange={handleTabChange}
                        tabs={CODEX_TABS as any}
                      />
                    </div>
                  ) : null}

                  {activeView === "bugs" ? (
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                        {entries.map(([id, entry]) => (
                          <SummaryCard
                            key={id}
                            id={id}
                            entry={entry}
                            onSelect={handleSelectBug}
                            onSelectWeapon={handleJumpToWeapon}
                          />
                        ))}
                      </div>
                    </div>
                  ) : activeView === "weapons" && selectedWeapon ? (
                    <div className="mb-4 flex-1 overflow-y-auto px-4 py-3">
                      <WeaponDetailView
                        bugEntries={entries}
                        onJumpToBug={handleJumpToBug}
                        weapon={selectedWeapon}
                      />
                    </div>
                  ) : activeView === "weapons" ? (
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                        {WEAPON_DEFS.map((weapon) => (
                          <WeaponSummaryCard
                            key={weapon.id}
                            bugEntries={entries}
                            onJumpToBug={handleJumpToBug}
                            onSelect={handleSelectWeapon}
                            weapon={weapon}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-4 py-4" />
                  )}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
