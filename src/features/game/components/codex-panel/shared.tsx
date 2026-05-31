import type { CSSProperties } from "react";
import { WeaponMatchup, type SiegeWeaponId } from "@game/types";
import { getColoredSvgUrl } from "@game/utils/bugSprite";
import type {
  BugType,
  BugWeaponId,
  BugWeaponMatchup,
} from "@game/engine/bugCodex";
import { getBugVariantColor } from "../../../../constants/bugs";
import type { BugVariant } from "../../../../types/dashboard";
import { cn } from "@shared/utils/cn";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";

const BUILTIN_ICON_VARIANTS: BugVariant[] = ["low", "medium", "high", "urgent"];

function buildCardBackground(primary: string, secondary?: string) {
  return {
    background: `radial-gradient(circle at 18% 18%, color-mix(in srgb, ${primary} 28%, transparent), transparent 26%), radial-gradient(circle at 82% 24%, color-mix(in srgb, ${secondary ?? primary} 18%, transparent), transparent 22%), linear-gradient(145deg, color-mix(in srgb, ${primary} 18%, rgba(12,14,20,0.98)), color-mix(in srgb, ${secondary ?? primary} 14%, rgba(12,14,20,0.9)))`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px color-mix(in srgb, ${primary} 12%, rgba(0,0,0,0.28))`,
  } satisfies CSSProperties;
}

export function buildNeutralWeaponBackground() {
  return {
    background:
      "radial-gradient(circle at 16% 18%, rgba(255,255,255,0.08), transparent 24%), radial-gradient(circle at 84% 22%, rgba(148,163,184,0.12), transparent 22%), linear-gradient(145deg, rgba(16,19,25,0.98), rgba(22,27,36,0.94))",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 40px rgba(0,0,0,0.24)",
  } satisfies CSSProperties;
}

export function formatDurationMs(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = durationMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

export function getInputModeLabel(inputMode: string) {
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

export function getHitPatternLabel(hitPattern: string) {
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

export function getBugCardStyle(entry: BugType, id: string) {
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

export function getWeaponMatchupBuckets(
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

export function getBugWeaponMatchupBuckets(entry: BugType) {
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

export function getTabIconSrc(entry: BugType, id: string) {
  if (entry.iconUrl) {
    return entry.iconUrl;
  }

  const variant = (entry.iconVariant ?? id) as BugVariant;
  const baseColor = entry.color ?? getBugVariantColor(variant);

  if (BUILTIN_ICON_VARIANTS.includes(variant)) {
    return getColoredSvgUrl(variant, baseColor);
  }

  return getColoredSvgUrl("low", baseColor);
}

export function Badge({
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

export function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-stone-500">
      {children}
    </p>
  );
}

export function MatchupBugStrip({
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

export function MatchupWeaponStrip({
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
