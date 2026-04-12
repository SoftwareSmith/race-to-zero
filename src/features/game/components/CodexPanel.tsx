import type { CSSProperties, RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MenuIconButton } from "@shared/components/MenuControls";
import { getCodex } from "@game/engine/bugCodex";
import type {
  BugType,
  BugWeaponId,
  BugWeaponMatchup,
  BugWeaponMatchupState,
} from "@game/engine/bugCodex";
import {
  BUG_VARIANT_CONFIG,
  getBugVariantColor,
  getBugVariantMaxHp,
} from "../../../constants/bugs";
import type { BugVariant } from "../../../types/dashboard";
import { getColoredSvgUrl } from "@game/utils/bugSprite";
import { cn } from "@shared/utils/cn";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import Tooltip from "@shared/components/Tooltip";
import MetricInfoCard from "@dashboard/components/MetricInfoCard";

interface CodexPanelProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onMenuToggle: () => void;
  open: boolean;
}

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

function getThreatLabel(variant: BugVariant) {
  if (variant === "urgent") return "Critical";
  if (variant === "high") return "High";
  if (variant === "medium") return "Medium";
  return "Low";
}

function getBehaviorLabel(behavior: BugType["profile"]["behavior"]) {
  if (behavior === "panic") return "Erratic";
  if (behavior === "stalk") return "Hunter";
  if (behavior === "patrol") return "Patrol";
  return "Skitter";
}

function getSpeedLabel(entry: BugType) {
  if (entry.profile.speedMultiplier >= 1.02) return "Moves quickly";
  if (entry.profile.speedMultiplier <= 0.86) return "Slow mover";
  return "Steady pace";
}

function getResilienceLabel(hp: number) {
  if (hp >= 4) return "Very tanky";
  if (hp >= 3) return "Tough";
  if (hp >= 2) return "Moderately durable";
  return "Fragile";
}

function getPresenceLabel(presence: number) {
  if (presence >= 88) return "Very visible";
  if (presence >= 72) return "Notable on the board";
  if (presence >= 56) return "Easily missed at a glance";
  return "Low presence";
}

function getWeaponEffectiveness(state: BugWeaponMatchupState) {
  if (state === "favored") return 88;
  if (state === "risky") return 28;
  return 58;
}

function getWeaponStateClasses(state: BugWeaponMatchupState) {
  if (state === "favored") {
    return {
      badge: "border-emerald-400/24 bg-emerald-500/12 text-emerald-100",
      panel: "border-emerald-400/16 bg-emerald-500/8",
      tile: "border-emerald-300/16 bg-emerald-400/10 text-emerald-50",
      fill: "bg-emerald-500/90",
      glow: "0 0 18px rgba(52,211,153,0.45)",
    };
  }

  if (state === "risky") {
    return {
      badge: "border-amber-400/24 bg-amber-500/12 text-amber-100",
      panel: "border-amber-400/16 bg-amber-500/8",
      tile: "border-amber-300/16 bg-amber-400/10 text-amber-50",
      fill: "bg-amber-500/90",
      glow: "0 0 18px rgba(251,191,36,0.4)",
    };
  }

  return {
    badge: "border-sky-400/18 bg-sky-500/10 text-sky-100",
    panel: "border-white/8 bg-white/[0.03]",
    tile: "border-white/8 bg-white/[0.04] text-stone-100",
    fill: "bg-sky-400/90",
    glow: "0 0 16px rgba(56,189,248,0.38)",
  };
}

type VariantAccent = ReturnType<typeof getVariantAccent>;

function getVariantAccent(variant: BugVariant) {
  function hexToRgb(hex: string) {
    const cleaned = hex.replace("#", "");
    const bigint = parseInt(cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
  }

  // Explicit hex mapping per visual variant to ensure the progress gradient
  // matches the accent colors (avoid using BUG_VARIANT_CONFIG which may
  // contain sprite/base colors that aren't the UI accent colors).
  const VARIANT_HEX: Record<BugVariant, string> = {
    low: "#10b981", // emerald-500
    medium: "#f59e0b", // amber-500
    high: "#ef4444", // red-500
    urgent: "#a78bfa", // violet-400/500
  };

  const baseRgb = hexToRgb(VARIANT_HEX[variant]);
  const fullGradient = `linear-gradient(90deg, rgba(${baseRgb},1) 0%, rgba(${baseRgb},0) 100%)`;
  if (variant === "urgent") {
    return {
      badgeClass:
        "border-violet-400/30 bg-violet-500/14 text-violet-100 shadow-[0_0_22px_rgba(167,139,250,0.18)]",
      iconBorderClass: "border-violet-400/30",
      metricValueClass:
        "border-violet-400/36 bg-violet-500/36 text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.18)]",
      metricFillClass: "bg-violet-500",
      metricGlow: "0 0 32px rgba(167,139,250,0.52)",
      metricGlowStrong: "0 0 44px rgba(167,139,250,0.68)",
      behaviorClass: "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100",
      cardClass: "from-violet-500/12 via-fuchsia-500/6 to-black/20",
      iconHalo: "rgba(167,139,250,0.34)",
      iconPanel: "from-violet-500/18 via-fuchsia-500/8 to-red-500/12",
      washA: "rgba(167,139,250,0.18)",
      washB: "rgba(244,63,94,0.14)",
      metricFillGradient: fullGradient,
    };
  }

  if (variant === "high") {
    return {
      badgeClass:
        "border-red-400/28 bg-red-500/14 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.16)]",
      iconBorderClass: "border-red-400/28",
      metricValueClass:
        "border-red-400/36 bg-red-500/36 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.18)]",
      metricFillClass: "bg-red-500",
      metricGlow: "0 0 32px rgba(248,113,113,0.52)",
      metricGlowStrong: "0 0 44px rgba(248,113,113,0.68)",
      behaviorClass: "border-orange-400/20 bg-orange-500/10 text-orange-100",
      cardClass: "from-red-500/12 via-orange-500/6 to-black/20",
      iconHalo: "rgba(248,113,113,0.28)",
      iconPanel: "from-red-500/18 via-orange-500/8 to-sky-400/10",
      washA: "rgba(248,113,113,0.16)",
      washB: "rgba(251,146,60,0.12)",
      metricFillGradient: fullGradient,
    };
  }

  if (variant === "medium") {
    return {
      badgeClass:
        "border-amber-400/28 bg-amber-500/12 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.15)]",
      iconBorderClass: "border-amber-400/28",
      metricValueClass:
        "border-amber-400/36 bg-amber-500/36 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.18)]",
      metricFillClass: "bg-amber-500",
      metricGlow: "0 0 30px rgba(251,191,36,0.5)",
      metricGlowStrong: "0 0 42px rgba(251,191,36,0.64)",
      behaviorClass: "border-orange-300/18 bg-orange-400/10 text-orange-100",
      cardClass: "from-amber-500/12 via-orange-500/6 to-black/20",
      iconHalo: "rgba(251,191,36,0.22)",
      iconPanel: "from-amber-500/16 via-orange-500/8 to-sky-400/10",
      washA: "rgba(251,191,36,0.16)",
      washB: "rgba(249,115,22,0.10)",
      metricFillGradient: fullGradient,
    };
  }

  return {
    badgeClass:
      "border-emerald-400/22 bg-emerald-500/10 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.12)]",
    iconBorderClass: "border-emerald-400/22",
    metricValueClass:
      "border-emerald-400/32 bg-emerald-500/32 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.16)]",
    metricFillClass: "bg-emerald-500",
    metricGlow: "0 0 30px rgba(45,212,191,0.5)",
    metricGlowStrong: "0 0 42px rgba(45,212,191,0.66)",
    behaviorClass: "border-sky-400/16 bg-sky-500/8 text-sky-100",
    cardClass: "from-emerald-500/12 via-cyan-500/6 to-black/20",
    iconHalo: "rgba(45,212,191,0.18)",
    iconPanel: "from-emerald-500/14 via-cyan-500/6 to-white/8",
    washA: "rgba(45,212,191,0.14)",
    washB: "rgba(56,189,248,0.10)",
    metricFillGradient: fullGradient,
  };
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
  // BugWeaponId "wrench" maps to the renamed SiegeWeaponId "hammer"
  const glyphId = (
    weaponId === "wrench" ? "hammer" : weaponId
  ) as import("@game/types").SiegeWeaponId;

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
        isHighlighted={matchup.state === "favored"}
        valueClassName={accent.metricValueClass}
        valueAccentClass={accent.metricValueClass}
        className={cn("min-h-[5.9rem]", tone.panel)}
      />
    </Tooltip>
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
}: CodexPanelProps) {
  const codex = useMemo(() => getCodex(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // When the codex is opened, reset any previous selection so it
      // always starts on the list view. Defer to avoid synchronous
      // setState inside an effect.
      const t = setTimeout(() => setSelectedId(null), 0);
      return () => clearTimeout(t);
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
      <MenuIconButton
        ariaLabel="Open bug codex"
        onClick={handleMenuButtonClick}
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

      {open ? (
        <>
          <button
            aria-label="Close bug codex"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            onClick={onMenuToggle}
            type="button"
          />
          <div
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[78vh] w-full max-w-[58rem] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.52)] backdrop-blur-xl"
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
                            {getBehaviorLabel(selectedEntry.profile.behavior)}
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
                        {selectedEntry ? selectedEntry.name : "Bug Codex"}
                      </h2>
                      <p className="mt-2 max-w-[40rem] text-sm leading-6 text-stone-300">
                        {selectedEntry
                          ? "Review full encounter details, pressure profile, and field notes for the selected bug."
                          : "Scout the swarm, a pocket catalog of the midnight bugs that keep engineers up."}
                      </p>
                    </>
                  )}
                </div>

                <div className="absolute right-5 top-4 z-20 flex items-center gap-2">
                  {selectedEntry ? (
                    <button
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
                      onClick={handleBackToGrid}
                      type="button"
                    >
                      Back
                    </button>
                  ) : null}
                  <button
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
                    onClick={onMenuToggle}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </div>

              {selectedEntry && selectedVariant ? (
                <div className="flex-1 overflow-hidden px-5 py-4 mb-6">
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
              ) : (
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
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
