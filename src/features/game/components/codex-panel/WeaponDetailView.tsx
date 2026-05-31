import { WeaponTier, type SiegeWeaponId } from "@game/types";
import { getWeaponTiers } from "@game/weapons/progression";
import type { WeaponDef, WeaponTierDefinition } from "@game/weapons/types";
import type { BugType } from "@game/engine/bugCodex";
import {
  MatchupBugStrip,
  SectionEyebrow,
  buildNeutralWeaponBackground,
  formatDurationMs,
  getHitPatternLabel,
  getInputModeLabel,
  getWeaponMatchupBuckets,
} from "./shared";

const WEAPON_STAGE_LABELS: Record<WeaponTier, string> = {
  [WeaponTier.TIER_ONE]: "Tier 1",
  [WeaponTier.TIER_TWO]: "Tier 2",
  [WeaponTier.TIER_THREE]: "Tier 3",
  [WeaponTier.TIER_FOUR]: "Tier 4",
  [WeaponTier.TIER_FIVE]: "Overdrive",
};

function getCodexTierTextClassName(tier: WeaponTierDefinition): string {
  const isMax = tier.evolution == null;

  if (isMax) {
    return "text-orange-300";
  }

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
        className={
          getCodexTierTextClassName(tier) +
          " text-[0.58rem] font-bold uppercase tracking-[0.18em]"
        }
      >
        {WEAPON_STAGE_LABELS[tier.tier]}
      </span>
      <div
        className={`w-full rounded-[10px] border px-2 py-1.5 text-center ${borderClass} ${bgClass}`}
      >
        <p className="text-[0.72rem] font-bold tabular-nums text-stone-100">
          {unlocksAt == null ? "Start" : `${unlocksAt}`}
        </p>
        <p
          className={
            "text-[0.56rem] uppercase tracking-[0.12em] text-stone-500" +
            (unlocksAt == null ? " opacity-0" : "")
          }
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

export function WeaponDetailView({
  bugEntries,
  onJumpToBug,
  weapon,
}: {
  bugEntries: Array<[string, BugType]>;
  onJumpToBug: (id: string) => void;
  weapon: WeaponDef;
}) {
  const tiers = getWeaponTiers(weapon);
  const { favored, risky } = getWeaponMatchupBuckets(
    bugEntries,
    weapon.id as SiegeWeaponId,
  );

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
          {tiers.map((tier, index) => (
            <WeaponTierPill
              key={tier.tier}
              tier={tier}
              unlocksAt={
                index === 0 ? null : (tiers[index - 1]?.evolveAtKills ?? null)
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
