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
import { getBugVariantColor } from "../../../constants/bugs";
import type { BugVariant } from "../../../types/dashboard";
import { WeaponMatchup, WeaponTier, type SiegeWeaponId } from "@game/types";
import { getColoredSvgUrl } from "@game/utils/bugSprite";
import { cn } from "@shared/utils/cn";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import Tabs from "@shared/components/Tabs";
import { getWeaponTiers } from "@game/weapons/progression";
import type { WeaponDef, WeaponTierDefinition } from "@game/weapons/types";
import {
  getBehaviorLabel,
  getThreatLabel,
  getVariantAccent,
} from "./codexPanel.helpers";

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

const BUILTIN_ICON_VARIANTS: BugVariant[] = ["low", "medium", "high", "urgent"];
const WEAPON_STAGE_LABELS: Record<WeaponTier, string> = {
  [WeaponTier.TIER_ONE]: "Tier 1",
  [WeaponTier.TIER_TWO]: "Tier 2",
  [WeaponTier.TIER_THREE]: "Tier 3",
  [WeaponTier.TIER_FOUR]: "Tier 4",
  [WeaponTier.TIER_FIVE]: "Overdrive",
};

function formatDurationMs(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function getInputModeLabel(inputMode: WeaponDef["inputMode"]) {
  switch (inputMode) {
    case "directional":
      return "Directional cast";
    case "hold":
      return "Hold to channel";
    case "seeking":
      return "Seeks target";
    default:
      return "Point click";
  }
}

function getHitPatternLabel(hitPattern: WeaponDef["hitPattern"]) {
  switch (hitPattern) {
    case "area":
      return "Area burst";
    case "blackhole":
      return "Gravity well";
    case "chain":
      return "Chain arc";
    case "cone":
      return "Cone sweep";
    case "line":
      return "Line strike";
    case "seeking":
      return "Seeking path";
    default:
      return "Single impact";
  }
}

function buildCardBackground(primary: string, secondary?: string) {
  return {
    background: `radial-gradient(circle at 18% 18%, color-mix(in srgb, ${primary} 28%, transparent), transparent 26%), radial-gradient(circle at 82% 24%, color-mix(in srgb, ${secondary ?? primary} 18%, transparent), transparent 22%), linear-gradient(145deg, color-mix(in srgb, ${primary} 18%, rgba(12,14,20,0.98)), color-mix(in srgb, ${secondary ?? primary} 14%, rgba(12,14,20,0.9)))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px color-mix(in srgb, ${primary} 12%, rgba(0,0,0,0.28))`,
  } satisfies CSSProperties;
}

function buildNeutralWeaponBackground() {
  return {
    background:
      "radial-gradient(circle at 16% 18%, rgba(255,255,255,0.08), transparent 24%), radial-gradient(circle at 84% 22%, rgba(148,163,184,0.12), transparent 22%), linear-gradient(145deg, rgba(16,19,25,0.98), rgba(22,27,36,0.94))",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 40px rgba(0,0,0,0.24)",
  } satisfies CSSProperties;
}

function getBugCardStyle(entry: BugType, id: string) {
  const variant = (entry.iconVariant ?? id) as BugVariant;
  const primary = entry.color ?? getBugVariantColor(variant);
  const secondary =
    variant === "urgent"
      ? "#f472b6"
      : variant === "high"
        ? "#fb923c"
        : variant === "medium"
          ? "#fde047"
          : "#2dd4bf";

  return buildCardBackground(primary, secondary);
}

function WeaponMotif({ weapon }: { weapon: WeaponDef }) {
  if (weapon.id === "chain") {
    return (
      <>
        <div className="absolute right-8 top-6 h-[2px] w-20 rotate-[18deg] rounded-full bg-white/40 opacity-70 animate-pulse" />
        <div className="absolute right-10 top-12 h-10 w-10 rounded-full border border-white/12 opacity-70 animate-pulse" />
      </>
    );
  }

  if (weapon.id === "void") {
    return (
      <>
        <div className="absolute right-7 top-5 h-14 w-14 rounded-full border border-white/12 opacity-80 animate-pulse" />
        <div className="absolute right-10 top-8 h-8 w-8 rounded-full border border-slate-200/10 opacity-70 animate-pulse" />
      </>
    );
  }

  if (weapon.id === "plasma") {
    return (
      <>
        <div className="absolute right-8 top-6 h-12 w-12 rounded-full bg-white/6 blur-xl animate-pulse" />
        <div className="absolute right-12 top-10 h-5 w-5 rounded-full border border-white/12 animate-pulse" />
        <div className="absolute right-4 top-14 h-3 w-3 rounded-full bg-slate-200/16 animate-pulse" />
      </>
    );
  }

  if (weapon.id === "zapper") {
    return (
      <>
        <div className="absolute right-10 top-6 h-12 w-16 rounded-[100%_0_100%_0/100%_0_100%_0] border border-white/12 opacity-80 animate-pulse" />
        <div className="absolute right-8 top-10 h-2 w-2 rounded-full bg-white/24 animate-pulse" />
        <div className="absolute right-4 top-16 h-1.5 w-1.5 rounded-full bg-slate-200/24 animate-pulse" />
      </>
    );
  }

  if (weapon.id === "nullpointer") {
    return (
      <>
        <div className="absolute right-8 top-5 h-16 w-[2px] bg-white/24 animate-pulse" />
        <div className="absolute right-14 top-8 h-12 w-[2px] bg-white/14 animate-pulse" />
        <div className="absolute right-2 top-10 h-10 w-[2px] bg-slate-200/14 animate-pulse" />
      </>
    );
  }

  return (
    <>
      <div className="absolute right-7 top-8 h-3.5 w-14 rounded-[8px] bg-white/8 animate-pulse" />
      <div className="absolute right-10 top-14 h-3.5 w-10 rounded-[8px] bg-white/6 animate-pulse" />
    </>
  );
}

function getWeaponMatchupBuckets(
  bugEntries: Array<[string, BugType]>,
  weaponId: SiegeWeaponId,
) {
  const favored = bugEntries.filter(
    ([, entry]) =>
      entry.weaponMatchups[weaponId].state === WeaponMatchup.Favored,
  );
  const risky = bugEntries.filter(([, entry]) => {
    const state = entry.weaponMatchups[weaponId].state;
    return state === WeaponMatchup.Immune || state === WeaponMatchup.Risky;
  });

  return { favored, risky };
}

function getBugWeaponMatchupBuckets(entry: BugType) {
  const favored: Array<[BugWeaponId, BugWeaponMatchup]> = [];
  const risky: Array<[BugWeaponId, BugWeaponMatchup]> = [];

  for (const [weaponId, matchup] of Object.entries(
    entry.weaponMatchups,
  ) as Array<[BugWeaponId, BugWeaponMatchup]>) {
    if (matchup.state === WeaponMatchup.Favored) {
      favored.push([weaponId, matchup]);
      continue;
    }

    if (
      matchup.state === WeaponMatchup.Immune ||
      matchup.state === WeaponMatchup.Risky
    ) {
      risky.push([weaponId, matchup]);
    }
  }

  return { favored, risky };
}

function MatchupBugStrip({
  bugEntries,
  emptyLabel,
  onSelectBug,
  toneClassName,
  title,
}: {
  bugEntries: Array<[string, BugType]>;
  emptyLabel: string;
  onSelectBug?: (id: string) => void;
  title: string;
  toneClassName: string;
}) {
  const preview = bugEntries.slice(0, 4);
  const overflowCount = Math.max(0, bugEntries.length - preview.length);

  return (
    <div className="rounded-[16px] border border-white/8 bg-black/18 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-[0.65rem] font-semibold uppercase tracking-[0.18em]",
            toneClassName,
          )}
        >
          {title}
        </p>
        <span className="text-[0.68rem] text-stone-500">
          {bugEntries.length}
        </span>
      </div>

      {preview.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5">
          {preview.map(([id, entry]) => (
            <button
              key={`${title}-${id}`}
              data-hud-cursor="pointer"
              data-testid="codex-matchup-bug"
              className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
              title={entry.name}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectBug?.(id);
              }}
            >
              <img
                alt={entry.name}
                className="h-5 w-5 object-contain"
                src={getTabIconSrc(entry, id)}
              />
            </button>
          ))}
          {overflowCount > 0 ? (
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] px-2 text-[0.68rem] font-semibold text-stone-200">
              +{overflowCount}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-stone-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function MatchupWeaponStrip({
  emptyLabel,
  onSelectWeapon,
  title,
  toneClassName,
  weaponEntries,
}: {
  emptyLabel: string;
  onSelectWeapon?: (id: SiegeWeaponId) => void;
  title: string;
  toneClassName: string;
  weaponEntries: Array<[BugWeaponId, BugWeaponMatchup]>;
}) {
  const preview = weaponEntries.slice(0, 4);
  const overflowCount = Math.max(0, weaponEntries.length - preview.length);

  return (
    <div className="rounded-[16px] border border-white/8 bg-black/18 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            "text-[0.65rem] font-semibold uppercase tracking-[0.18em]",
            toneClassName,
          )}
        >
          {title}
        </p>
        <span className="text-[0.68rem] text-stone-500">
          {weaponEntries.length}
        </span>
      </div>

      {preview.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5">
          {preview.map(([weaponId, matchup]) =>
            onSelectWeapon ? (
              <button
                key={`${title}-${weaponId}`}
                data-hud-cursor="pointer"
                data-testid="codex-matchup-weapon"
                className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] text-stone-100 shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
                title={`${weaponId}: ${matchup.note}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectWeapon(weaponId as SiegeWeaponId);
                }}
              >
                <WeaponGlyph
                  className="h-5 w-5"
                  id={weaponId as SiegeWeaponId}
                />
              </button>
            ) : (
              <div
                key={`${title}-${weaponId}`}
                className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] text-stone-100 shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
                title={`${weaponId}: ${matchup.note}`}
              >
                <WeaponGlyph
                  className="h-5 w-5"
                  id={weaponId as SiegeWeaponId}
                />
              </div>
            ),
          )}
          {overflowCount > 0 ? (
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.05] px-2 text-[0.68rem] font-semibold text-stone-200">
              +{overflowCount}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-stone-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function getTabIconSrc(entry: BugType, id: string) {
  if (entry.iconUrl) return entry.iconUrl;
  const variant = (entry.iconVariant ?? id) as BugVariant;
  const baseColor = entry.color ?? getBugVariantColor(variant);
  if (BUILTIN_ICON_VARIANTS.includes(variant)) {
    return getColoredSvgUrl(variant, baseColor);
  }
  return getColoredSvgUrl("low", baseColor);
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
      <h4 className="mt-1 text-[0.98rem] font-semibold tracking-[-0.03em] text-stone-50">
        {title}
      </h4>
      {subtitle ? (
        <p className="mt-1 text-[0.82rem] leading-5 text-stone-400">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function CodexSummaryCard({
  description,
  footer,
  icon,
  iconShellClassName,
  onActivate,
  overlay,
  rightSlot,
  style,
  subtitle,
  testId,
  title,
}: {
  description: string;
  footer?: ReactNode;
  icon: ReactNode;
  iconShellClassName?: string;
  onActivate?: () => void;
  overlay?: ReactNode;
  rightSlot?: ReactNode;
  style: CSSProperties;
  subtitle?: string;
  testId: string;
  title: string;
}) {
  const interactive = !!onActivate;
  return (
    <div
      data-hud-cursor={interactive ? "pointer" : undefined}
      data-testid={testId}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "group relative overflow-hidden rounded-[20px] border border-white/10 p-3 text-left transition duration-200",
        interactive && "hover:border-white/18 hover:bg-white/[0.05]",
      )}
      style={style}
    >
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 opacity-80">
          {overlay}
        </div>
      ) : null}

      <div className="relative flex h-full flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/24 bg-gradient-to-br p-2.5 shadow-[0_0_20px_rgba(0,0,0,0.16)] ring-1 ring-white/12",
                iconShellClassName,
              )}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[1.12rem] font-semibold tracking-[-0.03em] text-stone-50">
                {title}
              </h3>
              {subtitle ? (
                <p className="text-xs uppercase tracking-[0.18em] text-stone-300/80">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {rightSlot ? (
            <div className="flex items-center gap-2">{rightSlot}</div>
          ) : null}
        </div>

        <p className="text-[0.82rem] leading-5 text-stone-200">{description}</p>

        {footer}
      </div>
    </div>
  );
}

function WeaponSummaryCard({
  bugEntries,
  onJumpToBug,
  onSelect,
  weapon,
}: {
  bugEntries: Array<[string, BugType]>;
  onJumpToBug: (id: string) => void;
  onSelect: (id: SiegeWeaponId) => void;
  weapon: WeaponDef;
}) {
  const { favored, risky } = getWeaponMatchupBuckets(bugEntries, weapon.id);

  return (
    <CodexSummaryCard
      description={weapon.detail}
      footer={
        <div className="grid gap-2.5 sm:grid-cols-2">
          <MatchupBugStrip
            bugEntries={favored}
            emptyLabel="No favored bugs mapped yet."
            onSelectBug={onJumpToBug}
            title="Effective Against"
            toneClassName="text-emerald-200"
          />
          <MatchupBugStrip
            bugEntries={risky}
            emptyLabel="No risk pockets mapped yet."
            onSelectBug={onJumpToBug}
            title="Ineffective Against"
            toneClassName="text-rose-200"
          />
        </div>
      }
      icon={<WeaponGlyph className="h-7 w-7" id={weapon.id} />}
      iconShellClassName="border-white/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] text-stone-50 shadow-[0_12px_22px_rgba(0,0,0,0.22)] ring-white/10"
      onActivate={() => onSelect(weapon.id)}
      overlay={
        <>
          <div
            className="absolute left-2 top-2 h-20 w-20 rounded-full blur-3xl"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <WeaponMotif weapon={weapon} />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.7)_1px,transparent_0)] [background-size:18px_18px]" />
        </>
      }
      rightSlot={
        <Badge className="border-white/16 bg-black/18 text-stone-100">
          {getHitPatternLabel(weapon.hitPattern)}
        </Badge>
      }
      style={buildNeutralWeaponBackground()}
      subtitle={weapon.typeLabel}
      testId={`codex-weapon-card-${weapon.id}`}
      title={weapon.title}
    />
  );
}

function getCodexTierTextClassName(tier: WeaponTierDefinition): string {
  const isMax = tier.evolution == null;
  if (isMax) return "text-orange-300";
  switch (tier.tier) {
    case WeaponTier.TIER_FOUR:
      return "text-red-400";
    case WeaponTier.TIER_THREE:
      return "text-orange-400";
    case WeaponTier.TIER_TWO:
      return "text-amber-400";
    default:
      return "text-slate-300";
  }
}

function WeaponTierPill({
  tier,
  unlocksAt,
}: {
  tier: WeaponTierDefinition;
  unlocksAt: number | null;
}) {
  const isMax = tier.evolution == null;
  const borderClass = isMax
    ? "border-orange-100/40"
    : tier.tier === WeaponTier.TIER_FOUR
      ? "border-red-400/30"
      : tier.tier === WeaponTier.TIER_THREE
        ? "border-orange-400/30"
        : tier.tier === WeaponTier.TIER_TWO
          ? "border-amber-400/30"
          : "border-slate-400/20";

  const bgClass = isMax
    ? "bg-[linear-gradient(180deg,rgba(255,247,237,0.10),rgba(153,27,27,0.28))]"
    : tier.tier === WeaponTier.TIER_FOUR
      ? "bg-[linear-gradient(180deg,rgba(254,200,140,0.08),rgba(139,27,27,0.22))]"
      : tier.tier === WeaponTier.TIER_THREE
        ? "bg-[linear-gradient(180deg,rgba(253,186,116,0.08),rgba(160,50,10,0.22))]"
        : tier.tier === WeaponTier.TIER_TWO
          ? "bg-[linear-gradient(180deg,rgba(253,186,116,0.06),rgba(120,53,15,0.22))]"
          : "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(30,41,59,0.28))]";

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span
        className={cn(
          "text-[0.58rem] font-bold uppercase tracking-[0.18em]",
          getCodexTierTextClassName(tier),
        )}
      >
        {WEAPON_STAGE_LABELS[tier.tier]}
      </span>
      <div
        className={cn(
          "w-full rounded-[10px] border px-2 py-1.5 text-center",
          borderClass,
          bgClass,
        )}
      >
        <p className="text-[0.72rem] font-bold tabular-nums text-stone-100">
          {unlocksAt == null ? "Start" : `${unlocksAt}`}
        </p>
        <p
          className={cn(
            "text-[0.56rem] uppercase tracking-[0.12em] text-stone-500",
            unlocksAt == null && "opacity-0",
          )}
        >
          kills
        </p>
      </div>
      <p className="w-full truncate text-center text-[0.68rem] font-semibold text-stone-300">
        {tier.title}
      </p>
    </div>
  );
}

function WeaponDetailView({
  bugEntries,
  onJumpToBug,
  weapon,
}: {
  bugEntries: Array<[string, BugType]>;
  onJumpToBug: (id: string) => void;
  weapon: WeaponDef;
}) {
  const tiers = getWeaponTiers(weapon);
  const { favored, risky } = getWeaponMatchupBuckets(bugEntries, weapon.id);

  return (
    <div
      className="mx-auto flex w-full max-w-[50rem] flex-col gap-2"
      data-testid="codex-weapon-detail-view"
    >
      <section
        className="rounded-[20px] border border-white/10 p-2.5"
        style={buildNeutralWeaponBackground()}
      >
        <div className="space-y-1.5">
          <SectionEyebrow>Mechanics</SectionEyebrow>
          <div className="grid grid-cols-4 gap-1.5">
            <div className="rounded-[12px] border border-white/8 bg-black/16 px-2 py-1.5">
              <SectionEyebrow>Pattern</SectionEyebrow>
              <p className="mt-1 text-xs font-semibold text-stone-100">
                {getHitPatternLabel(weapon.hitPattern)}
              </p>
            </div>
            <div className="rounded-[12px] border border-white/8 bg-black/16 px-2 py-1.5">
              <SectionEyebrow>Input</SectionEyebrow>
              <p className="mt-1 text-xs font-semibold text-stone-100">
                {getInputModeLabel(weapon.inputMode)}
              </p>
            </div>
            <div className="rounded-[12px] border border-white/8 bg-black/16 px-2 py-1.5">
              <SectionEyebrow>Cooldown</SectionEyebrow>
              <p className="mt-1 text-xs font-semibold text-stone-100">
                {formatDurationMs(weapon.cooldownMs)}
              </p>
            </div>
            <div className="rounded-[12px] border border-white/8 bg-black/16 px-2 py-1.5">
              <SectionEyebrow>Unlock</SectionEyebrow>
              <p className="mt-1 text-xs font-semibold text-stone-100">
                {weapon.unlockKills === 0
                  ? "Run start"
                  : `${weapon.unlockKills} kills`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <MatchupBugStrip
            bugEntries={favored}
            emptyLabel="No favored bugs are mapped for this weapon."
            onSelectBug={onJumpToBug}
            title="Effective Against"
            toneClassName="text-emerald-200"
          />
          <MatchupBugStrip
            bugEntries={risky}
            emptyLabel="No weak pockets are mapped for this weapon."
            onSelectBug={onJumpToBug}
            title="Ineffective Against"
            toneClassName="text-rose-200"
          />
        </div>
      </section>

      <section className="rounded-[20px] border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <SectionEyebrow>Progression</SectionEyebrow>
        <div className="mt-2 flex gap-2">
          {tiers.map((tier, i) => (
            <WeaponTierPill
              key={tier.tier}
              tier={tier}
              unlocksAt={i === 0 ? null : (tiers[i - 1]?.evolveAtKills ?? null)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  id,
  entry,
  onSelect,
  onSelectWeapon,
}: {
  id: string;
  entry: BugType;
  onSelect: (id: string) => void;
  onSelectWeapon?: (id: SiegeWeaponId) => void;
}) {
  const variant = (entry.iconVariant ?? id) as BugVariant;
  const accent = getVariantAccent(variant);
  const { favored, risky } = getBugWeaponMatchupBuckets(entry);

  return (
    <CodexSummaryCard
      description={entry.description}
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <MatchupWeaponStrip
            emptyLabel="No mapped weak spots yet."
            onSelectWeapon={onSelectWeapon}
            title="Weaknesses"
            toneClassName="text-emerald-200"
            weaponEntries={favored}
          />
          <MatchupWeaponStrip
            emptyLabel="No mapped resistances yet."
            onSelectWeapon={onSelectWeapon}
            title="Strengths"
            toneClassName="text-rose-200"
            weaponEntries={risky}
          />
        </div>
      }
      icon={
        <img
          alt=""
          className="h-7 w-7 object-contain transition duration-200 group-hover:scale-110"
          src={getTabIconSrc(entry, id)}
        />
      }
      iconShellClassName={cn(
        "border-white/24 bg-gradient-to-br shadow-[0_0_20px_rgba(0,0,0,0.16)] ring-white/12",
        accent.iconPanel,
      )}
      onActivate={undefined}
      overlay={
        <>
          <div
            className="absolute left-2 top-2 h-20 w-20 rounded-full blur-3xl"
            style={{ background: accent.washA }}
          />
          <div
            className="absolute right-2 bottom-2 h-16 w-16 rounded-full blur-3xl"
            style={{ background: accent.washB }}
          />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.7)_1px,transparent_0)] [background-size:18px_18px]" />
        </>
      }
      rightSlot={
        <Badge className={accent.behaviorClass}>
          {getBehaviorLabel(entry.profile.behavior)}
        </Badge>
      }
      style={getBugCardStyle(entry, id)}
      subtitle={getThreatLabel(variant)}
      testId="codex-summary-card"
      title={entry.name}
    />
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
                  <div className="relative flex items-start justify-between gap-4 border-b border-white/8 px-4 py-3.5">
                    <div className="min-w-0 flex-1 pr-28">
                      {bugEntry && selectedVariant ? (
                        <>
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
                                  src={getTabIconSrc(
                                    bugEntry,
                                    selectedEntry?.id ?? fallbackId,
                                  )}
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
                        </>
                      ) : selectedWeapon ? (
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/28 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05))] text-stone-50 shadow-[0_0_20px_rgba(0,0,0,0.16)] ring-1 ring-white/10">
                            <WeaponGlyph
                              className="h-7 w-7"
                              id={selectedWeapon.id}
                            />
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
                          {/* eyebrow intentionally hidden on list view */}
                          <h2 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.04em] text-stone-50">
                            {activeView === "weapons"
                              ? "Weapon Codex"
                              : "Bug Codex"}
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
                      {selectedEntry ? (
                        <button
                          data-hud-cursor="pointer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-300 transition hover:border-white/20 hover:text-stone-100"
                          onClick={handleBackToGrid}
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
                        onClick={onMenuToggle}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {!(activeView === "weapons" && selectedWeapon) ? (
                    <div
                      className="relative border-b border-white/8 px-4 py-2.5"
                      data-testid="codex-tabs"
                    >
                      <Tabs
                        activeTab={activeView as any}
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
