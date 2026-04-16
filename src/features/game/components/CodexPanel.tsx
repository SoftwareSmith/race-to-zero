import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MenuIconButton } from "@shared/components/MenuControls";
import { getCodex } from "@game/engine/bugCodex";
import type {
  BugType,
  BugWeaponId,
  BugWeaponMatchup,
} from "@game/engine/bugCodex";
import { WEAPON_DEFS } from "@config/weaponConfig";
import {
  BUG_VARIANT_CONFIG,
  getBugVariantColor,
  getBugVariantMaxHp,
} from "../../../constants/bugs";
import type { BugVariant } from "../../../types/dashboard";
import {
  WeaponMatchup,
  type SiegeWeaponId,
  type WeaponType,
} from "@game/types";
import { getColoredSvgUrl } from "@game/utils/bugSprite";
import { cn } from "@shared/utils/cn";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import Tooltip from "@shared/components/Tooltip";
import MetricInfoCard from "@dashboard/components/MetricInfoCard";
import Tabs from "@shared/components/Tabs";
import { getWeaponTiers } from "@game/weapons/progression";
import {
  getBehaviorLabel,
  getPresenceLabel,
  getResilienceLabel,
  getSpeedLabel,
  getThreatLabel,
  getVariantAccent,
  getWeaponEffectiveness,
  getWeaponStateClasses,
  type VariantAccent,
} from "./codexPanel.helpers";

interface CodexPanelProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onMenuToggle: () => void;
  open: boolean;
  trigger?: ReactNode;
}

type CodexView = "bugs" | "weapons";

const CODEX_TABS = [
  { id: "bugs", label: "Bugs" },
  { id: "weapons", label: "Weapons" },
] as const;

const WEAPON_TYPE_ORDER: WeaponType[] = [
  "blunt",
  "toxin",
  "cryo",
  "thermal",
  "electric",
  "precision",
  "plasma",
  "gravity",
];

const BUILTIN_ICON_VARIANTS: BugVariant[] = ["low", "medium", "high", "urgent"];

function getTabIconSrc(entry: BugType, id: string) {
  if (entry.iconUrl) return entry.iconUrl;
  const variant = (entry.iconVariant ?? id) as BugVariant;
  const baseColor = entry.color ?? getBugVariantColor(variant);
  if (BUILTIN_ICON_VARIANTS.includes(variant)) {
    return getColoredSvgUrl(variant, baseColor);
  }
  return getColoredSvgUrl("low", baseColor);
}

function getAffinityLabel(affinity = 0) {
  if (affinity >= 0.35) return "Tends to hunt in packs";
  if (affinity <= -0.2) return "Prefers to hunt alone";
  return "Flexible hunting style";
}

function Badge({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.18em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-stone-500">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div>
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h4 className="mt-1 text-[1.08rem] font-semibold tracking-[-0.03em] text-stone-50">
        {title}
      </h4>
      {subtitle ? (
        <p className="mt-1 text-sm leading-6 text-stone-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

function CompactReadoutCard({
  accent,
  metricLabel,
  signalLabel,
  signalValue,
}: {
  accent: VariantAccent;
  metricLabel: string;
  signalLabel: string;
  signalValue: number;
}) {
  return (
    <MetricInfoCard
      label={signalLabel}
      subLabel={metricLabel}
      value={signalValue}
      progressClassName={accent.metricFillClass}
      progressGlow={accent.metricGlowStrong}
      progressStyle={{
        background: accent.metricFillGradient,
      }}
      valueClassName={accent.metricValueClass}
      valueAccentClass={accent.metricValueClass}
      className="min-h-[5.9rem]"
    />
  );
}

function WeaponEffectivenessRow({
  matchup,
  weaponId,
  accent,
}: {
  matchup: BugWeaponMatchup;
  weaponId: BugWeaponId;
  accent: VariantAccent;
}) {
  const tone = getWeaponStateClasses(matchup.state);
  const effectiveness = getWeaponEffectiveness(matchup.state);
  const glyphId = weaponId as SiegeWeaponId;

  return (
    <Tooltip
      content={
        <p className="text-sm leading-6 text-stone-200">{matchup.note}</p>
      }
      triggerClassName="block w-full"
    >
      <MetricInfoCard
        icon={<WeaponGlyph className="h-5 w-5" id={glyphId} />}
        iconClassName={cn(tone.tile)}
        label={weaponId}
        value={effectiveness}
        progressClassName={tone.fill}
        progressGlow={accent.metricGlowStrong}
        progressStyle={{
          background: accent.metricFillGradient,
        }}
        isHighlighted={matchup.state === WeaponMatchup.Favored}
        valueClassName={accent.metricValueClass}
        valueAccentClass={accent.metricValueClass}
        className={cn("min-h-[5.9rem]", tone.panel)}
      />
    </Tooltip>
  );
}

function WeaponTypeCard({
  bugEntries,
  type,
}: {
  bugEntries: Array<[string, BugType]>;
  type: WeaponType;
}) {
  const weapons = WEAPON_DEFS.filter((weapon) => weapon.weaponType === type);
  if (weapons.length === 0) {
    return null;
  }

  const lead = weapons[0];
  const bugsByState = {
    favored: [] as Array<[string, BugType]>,
    immune: [] as Array<[string, BugType]>,
    risky: [] as Array<[string, BugType]>,
  };

  for (const [bugId, entry] of bugEntries) {
    const states = weapons.map(
      (weapon) => entry.weaponMatchups[weapon.id].state,
    );
    if (states.includes(WeaponMatchup.Favored))
      bugsByState.favored.push([bugId, entry]);
    if (states.includes(WeaponMatchup.Immune))
      bugsByState.immune.push([bugId, entry]);
    if (states.includes(WeaponMatchup.Risky))
      bugsByState.risky.push([bugId, entry]);
  }

  const favoredPreview = bugsByState.favored
    .slice(0, 3)
    .map(([, entry]) => entry.name)
    .join(", ");
  const riskyPreview = [...bugsByState.immune, ...bugsByState.risky]
    .slice(0, 3)
    .map(([, entry]) => entry.name)
    .join(", ");

  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionEyebrow>Weapon Type</SectionEyebrow>
          <h3 className="mt-1 text-[1.15rem] font-semibold tracking-[-0.03em] text-stone-50">
            {lead.typeLabel}
          </h3>
          <p className="mt-1 max-w-[36rem] text-sm leading-6 text-stone-400">
            {lead.typeHint}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {(
          [
            ["Favored", bugsByState.favored.length, "text-emerald-200"],
            ["Risky", bugsByState.risky.length, "text-amber-200"],
            ["Immune", bugsByState.immune.length, "text-rose-200"],
          ] as const
        ).map(([label, count, tone]) => (
          <div
            key={label}
            className="rounded-[18px] border border-white/8 bg-black/16 p-3"
          >
            <p
              className={cn(
                "text-[0.65rem] font-semibold uppercase tracking-[0.18em]",
                tone,
              )}
            >
              {label}
            </p>
            <strong className="mt-2 block text-[1.35rem] font-semibold tracking-[-0.03em] text-stone-50">
              {count}
            </strong>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {weapons.map((weapon) => (
          <div
            key={weapon.id}
            className="rounded-[18px] border border-white/8 bg-black/20 p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] text-stone-50">
                <WeaponGlyph className="h-5 w-5" id={weapon.id} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-100">
                  {weapon.title}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                  {weapon.typeLabel}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-400">
              Unlock at {weapon.unlockKills} kills.{" "}
              {getWeaponTiers(weapon).length} tiers.
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-[18px] border border-white/8 bg-black/16 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Best Into
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            {favoredPreview ||
              "No strong bug matchups are currently mapped for this damage family."}
          </p>
        </div>
        <div className="rounded-[18px] border border-white/8 bg-black/16 p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-rose-200">
            Avoid Into
          </p>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            {riskyPreview ||
              "No major immunity or risk pockets are currently mapped for this damage family."}
          </p>
        </div>
      </div>
    </section>
  );
}

function DossierStats({
  activeEntry,
  activeMaxHp,
  activeVariantConfig,
  accent,
}: {
  activeEntry: BugType;
  activeMaxHp: number;
  activeVariantConfig: (typeof BUG_VARIANT_CONFIG)[BugVariant] | null;
  accent: VariantAccent;
}) {
  const visibility = Math.round(
    (activeVariantConfig?.defaultOpacity ?? 1) * 100,
  );

  return (
    <div className="space-y-2 p-2">
      <SectionHeading eyebrow="Core Readout" title="Tactical Profile" />

      <div className="grid gap-3 sm:grid-cols-2">
        <CompactReadoutCard
          accent={accent}
          metricLabel={getResilienceLabel(activeMaxHp)}
          signalLabel="Durability"
          signalValue={(activeMaxHp / 4) * 100}
        />
        <CompactReadoutCard
          accent={accent}
          metricLabel={getSpeedLabel(activeEntry)}
          signalLabel="Mobility"
          signalValue={Math.min(
            100,
            Math.max(24, activeEntry.profile.speedMultiplier * 72),
          )}
        />
        <CompactReadoutCard
          accent={accent}
          metricLabel={getAffinityLabel(activeEntry.socialAffinity)}
          signalLabel="Social affinity"
          signalValue={Math.min(
            100,
            Math.max(
              18,
              100 - Math.abs(activeEntry.profile.turnMultiplier - 1) * 64,
            ),
          )}
        />
        <CompactReadoutCard
          accent={accent}
          metricLabel={getPresenceLabel(visibility)}
          signalLabel="Presence"
          signalValue={visibility}
        />
      </div>
    </div>
  );
}

function FieldNotes({
  activeEntry,
  accent,
}: {
  activeEntry: BugType;
  accent: VariantAccent;
}) {
  return (
    <div className="space-y-2 p-2">
      <SectionHeading eyebrow="Field Notes" title="Strengths + Weaknesses" />

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          Object.entries(activeEntry.weaponMatchups) as Array<
            [BugWeaponId, BugWeaponMatchup]
          >
        ).map(([weaponId, matchup]) => (
          <WeaponEffectivenessRow
            key={weaponId}
            matchup={matchup}
            weaponId={weaponId}
            accent={accent}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  id,
  entry,
  onSelect,
}: {
  id: string;
  entry: BugType;
  onSelect: (id: string) => void;
}) {
  const variant = (entry.iconVariant ?? id) as BugVariant;
  const accent = getVariantAccent(variant);

  return (
    <button
      data-hud-cursor="pointer"
      data-testid="codex-summary-card"
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        "group relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br p-4 text-left transition duration-200 hover:-translate-y-1 hover:border-white/18 hover:bg-white/[0.05]",
        accent.cardClass,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div
          className="absolute left-2 top-2 h-20 w-20 rounded-full blur-3xl"
          style={{ background: accent.washA }}
        />
        <div
          className="absolute right-2 bottom-2 h-16 w-16 rounded-full blur-3xl"
          style={{ background: accent.washB }}
        />
      </div>

      <div className="relative flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-white/20 bg-gradient-to-br p-3 shadow-[0_0_24px_rgba(0,0,0,0.18)]",
                accent.iconPanel,
              )}
            >
              <img
                alt=""
                className="h-8 w-8 object-contain transition duration-200 group-hover:scale-110"
                src={getTabIconSrc(entry, id)}
              />
            </div>

            <h3 className="min-w-0 truncate text-[1.4rem] font-semibold tracking-[-0.03em] text-stone-50">
              {entry.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-shrink-0">
              <Badge className={accent.badgeClass}>
                {getThreatLabel(variant)}
              </Badge>
            </div>
            <div className="flex-shrink-0">
              <Badge className={accent.behaviorClass}>
                {getBehaviorLabel(entry.profile.behavior)}
              </Badge>
            </div>
          </div>
        </div>

        <p className="text-sm leading-6 text-stone-200">{entry.description}</p>
      </div>
    </button>
  );
}

export default function CodexPanel({
  containerRef,
  onMenuToggle,
  open,
  trigger,
}: CodexPanelProps) {
  const codex = useMemo(() => getCodex(), []);
  const [activeView, setActiveView] = useState<CodexView>("bugs");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // When the codex is opened, reset any previous selection so it
      // always starts on the list view. Defer to avoid synchronous
      // setState inside an effect.
      const t1 = setTimeout(() => setActiveView("bugs"), 0);
      const t2 = setTimeout(() => setSelectedId(null), 0);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    // don't reset when already open and a selection changes
  }, [open]);

  const entries = useMemo(() => Object.entries(codex), [codex]);
  const fallbackId = entries[0]?.[0] ?? "low";
  const backdropId = selectedId ?? fallbackId;
  const backdropEntry = codex[backdropId];
  const selectedEntry = selectedId ? codex[selectedId] : null;

  const handleMenuButtonClick = useCallback(() => {
    onMenuToggle();
  }, [onMenuToggle]);

  const handleSelectEntry = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleBackToGrid = useCallback(() => {
    setSelectedId(null);
  }, []);

  const backdropVariant = (backdropEntry?.iconVariant ??
    backdropId) as BugVariant;
  const backdropAccent = getVariantAccent(backdropVariant);
  const selectedVariant = selectedEntry
    ? ((selectedEntry.iconVariant ?? selectedId) as BugVariant)
    : null;
  const selectedAccent = selectedVariant
    ? getVariantAccent(selectedVariant)
    : backdropAccent;
  const selectedMaxHp =
    selectedEntry && selectedVariant ? getBugVariantMaxHp(selectedVariant) : 0;
  const selectedVariantConfig = selectedVariant
    ? (BUG_VARIANT_CONFIG[selectedVariant] ?? null)
    : null;

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
                className="fixed inset-0 z-[260] bg-black/45 backdrop-blur-[2px]"
                onClick={onMenuToggle}
                type="button"
              />
              <div
                className="fixed inset-x-4 top-[8vh] z-[270] mx-auto flex max-h-[78vh] w-full max-w-[58rem] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.52)] backdrop-blur-xl"
                data-codex-modal-root="true"
                data-hud-cursor="default"
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
                  <div className="relative flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
                    <div className="min-w-0 flex-1 pr-28">
                      {selectedEntry && selectedVariant ? (
                        <>
                          <div className="flex min-w-0 flex-wrap items-center gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border bg-gradient-to-br p-3 shadow-[0_0_24px_rgba(0,0,0,0.18)]",
                                  selectedAccent.iconPanel,
                                  selectedAccent.iconBorderClass,
                                )}
                              >
                                <img
                                  alt=""
                                  className="h-8 w-8 object-contain"
                                  src={getTabIconSrc(
                                    selectedEntry,
                                    selectedId ?? fallbackId,
                                  )}
                                />
                              </div>

                              <h3 className="min-w-0 truncate text-[1.4rem] font-semibold tracking-[-0.03em] text-stone-50">
                                {selectedEntry.name}
                              </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={selectedAccent.badgeClass}>
                                {getThreatLabel(selectedVariant)}
                              </Badge>
                              <Badge className={selectedAccent.behaviorClass}>
                                {getBehaviorLabel(
                                  selectedEntry.profile.behavior,
                                )}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-2 px-1">
                            <p className="max-w-[44rem] text-sm leading-6 text-stone-300">
                              {selectedEntry.description}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* eyebrow intentionally hidden on list view */}
                          <h2 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.04em] text-stone-50">
                            {activeView === "weapons"
                              ? "Weapon Codex"
                              : selectedEntry
                                ? selectedEntry.name
                                : "Bug Codex"}
                          </h2>
                          <p className="mt-2 max-w-[40rem] text-sm leading-6 text-stone-300">
                            {activeView === "weapons"
                              ? "Review weapon types, tier names, and which bugs each damage family punishes or fails against."
                              : selectedEntry
                                ? "Review full encounter details, pressure profile, and field notes for the selected bug."
                                : "Scout the swarm, a pocket catalog of the midnight bugs that keep engineers up."}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="absolute right-5 top-4 z-20 flex items-center gap-2">
                      {selectedEntry ? (
                        <button
                          data-hud-cursor="pointer"
                          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
                          onClick={handleBackToGrid}
                          type="button"
                        >
                          Back
                        </button>
                      ) : null}
                      <button
                        data-hud-cursor="pointer"
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
                        onClick={onMenuToggle}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {!selectedEntry ? (
                    <div
                      className="relative border-b border-white/8 px-5 py-3"
                      data-testid="codex-tabs"
                    >
                      <Tabs
                        activeTab={activeView as any}
                        onChange={(tabId) => setActiveView(tabId as CodexView)}
                        tabs={CODEX_TABS as any}
                      />
                    </div>
                  ) : null}

                  {activeView === "bugs" && selectedEntry && selectedVariant ? (
                    <div
                      className="mb-6 flex-1 overflow-hidden px-5 py-4"
                      data-testid="codex-detail-view"
                    >
                      <div className="mx-auto flex h-full w-full max-w-[46rem] flex-col gap-4">
                        <DossierStats
                          accent={selectedAccent}
                          activeEntry={selectedEntry}
                          activeMaxHp={selectedMaxHp}
                          activeVariantConfig={selectedVariantConfig}
                        />
                        <FieldNotes
                          activeEntry={selectedEntry}
                          accent={selectedAccent}
                        />
                      </div>
                    </div>
                  ) : activeView === "bugs" ? (
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                        {entries.map(([id, entry]) => (
                          <SummaryCard
                            key={id}
                            id={id}
                            entry={entry}
                            onSelect={handleSelectEntry}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-5 py-5">
                      <div className="space-y-4">
                        {WEAPON_TYPE_ORDER.map((type) => (
                          <WeaponTypeCard
                            key={type}
                            bugEntries={entries}
                            type={type}
                          />
                        ))}
                      </div>
                    </div>
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
