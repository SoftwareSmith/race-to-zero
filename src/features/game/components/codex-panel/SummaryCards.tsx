import type { CSSProperties, ReactNode } from "react";
import type { BugType } from "@game/engine/bugCodex";
import { type SiegeWeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { cn } from "@shared/utils/cn";
import type { BugVariant } from "../../../../types/dashboard";
import {
  getBehaviorLabel,
  getThreatLabel,
  getVariantAccent,
} from "../codexPanel.helpers";
import {
  Badge,
  MatchupBugStrip,
  MatchupWeaponStrip,
  buildNeutralWeaponBackground,
  getBugCardStyle,
  getBugWeaponMatchupBuckets,
  getHitPatternLabel,
  getTabIconSrc,
  getWeaponMatchupBuckets,
} from "./shared";

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

export function WeaponSummaryCard({
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

export function SummaryCard({
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
      onActivate={() => onSelect(id)}
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
