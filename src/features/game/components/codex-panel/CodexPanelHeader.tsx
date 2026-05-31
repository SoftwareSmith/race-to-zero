import type { BugType } from "@game/engine/bugCodex";
import type { WeaponDef } from "@game/weapons/types";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { cn } from "@shared/utils/cn";
import type { BugVariant } from "../../../../types/dashboard";
import {
  getBehaviorLabel,
  getThreatLabel,
  type VariantAccent,
} from "../codexPanel.helpers";
import { Badge, getHitPatternLabel, getTabIconSrc } from "./shared";

export function CodexPanelHeader({
  activeView,
  bugEntry,
  fallbackId,
  onBackToGrid,
  onClose,
  selectedAccent,
  selectedEntryId,
  selectedVariant,
  selectedWeapon,
}: {
  activeView: "bugs" | "weapons";
  bugEntry: BugType | null;
  fallbackId: string;
  onBackToGrid: () => void;
  onClose: () => void;
  selectedAccent: VariantAccent;
  selectedEntryId?: string;
  selectedVariant: BugVariant | null;
  selectedWeapon: WeaponDef | null;
}) {
  const hasSelection = !!bugEntry || !!selectedWeapon;

  return (
    <div className="relative flex items-start justify-between gap-4 border-b border-white/8 px-4 py-3.5">
      <div className="min-w-0 flex-1 pr-28">
        {bugEntry && selectedVariant ? (
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border bg-gradient-to-br p-2.5 shadow-[0_0_20px_rgba(0,0,0,0.16)] ring-1 ring-white/12",
                  selectedAccent.iconPanel,
                  selectedAccent.iconBorderClass,
                )}
              >
                <img
                  alt=""
                  className="h-7 w-7 object-contain"
                  src={getTabIconSrc(bugEntry, selectedEntryId ?? fallbackId)}
                />
              </div>

              <h3 className="min-w-0 truncate text-[1.15rem] font-semibold tracking-[-0.03em] text-stone-50">
                {bugEntry.name}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className={selectedAccent.badgeClass}>
                {getThreatLabel(selectedVariant)}
              </Badge>
              <Badge className={selectedAccent.behaviorClass}>
                {getBehaviorLabel(bugEntry.profile.behavior)}
              </Badge>
            </div>
          </div>
        ) : selectedWeapon ? (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] text-stone-50 shadow-[0_0_20px_rgba(0,0,0,0.16)] ring-1 ring-white/10">
              <WeaponGlyph className="h-7 w-7" id={selectedWeapon.id} />
            </div>
            <div className="min-w-0">
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-[1.15rem] font-semibold tracking-[-0.03em] text-stone-50">
                  {selectedWeapon.title}
                </h3>
                <Badge className="border-white/16 bg-black/18 text-stone-100">
                  {selectedWeapon.typeLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-300/80">
                {getHitPatternLabel(selectedWeapon.hitPattern)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.04em] text-stone-50">
              {activeView === "weapons" ? "Weapon Codex" : "Bug Codex"}
            </h2>
            <p className="mt-1.5 text-[0.82rem] leading-5 text-stone-300">
              {activeView === "weapons"
                ? "Pattern, matchups, and progression at a glance."
                : "Scout the swarm — a pocket reference for every bug type."}
            </p>
          </>
        )}
      </div>

      <div className="absolute right-4 top-3.5 z-20 flex items-center gap-2">
        {hasSelection ? (
          <button
            data-hud-cursor="pointer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
            onClick={onBackToGrid}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
        ) : null}
        <button
          data-hud-cursor="pointer"
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
