import Tooltip from "@shared/components/Tooltip";
import WeaponGlyph from "@shared/components/icons/WeaponGlyph";
import { STRUCTURE_DEFS } from "@config/structureConfig";
import { cn } from "@shared/utils/cn";
import type {
  SiegeWeaponId,
  StructureId,
  WeaponProgressSnapshot,
} from "@game/types";

const INPUT_MODE_LABEL: Record<string, string> = {
  click: "Click",
  directional: "Directional",
  seeking: "Auto-seek",
  hold: "Hold",
};

function weaponTooltip(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
): string {
  if (snapshot.locked) {
    return `${snapshot.progressText} — unlocks at ${snapshot.unlockKills} fixes`;
  }

  const mode = INPUT_MODE_LABEL[snapshot.inputMode] ?? snapshot.inputMode;
  const selected = isSelected ? " ✓" : "";
  const progress =
    snapshot.killsToNextTier != null
      ? ` · ${snapshot.killsToNextTier} kills → T${snapshot.tier + 1}`
      : " · MAX TIER";
  return `${snapshot.title} [${mode}]${selected}${progress} — ${snapshot.hint}`;
}

interface SiegeHudProps {
  className?: string;
  debugMode?: boolean;
  interactiveKills: number;
  interactivePoints: number;
  interactiveRemainingBugs: number;
  justEvolvedWeaponId?: SiegeWeaponId | null;
  lastFireTimes?: Partial<Record<SiegeWeaponId, number>>;
  onArmStructure?: (id: StructureId) => void;
  onExit: () => void;
  onSelectWeapon: (id: SiegeWeaponId) => void;
  onToggleDebugMode?: () => void;
  placedCountByType?: Partial<Record<StructureId, number>>;
  placingStructureId?: StructureId | null;
  selectedWeaponId: SiegeWeaponId;
  unlockedStructures?: StructureId[];
  weaponSnapshots: WeaponProgressSnapshot[];
}

function getSlotClassName(snapshot: WeaponProgressSnapshot) {
  return cn(
    "relative rounded-[14px] border p-1.5 text-sm text-stone-200",
    snapshot.locked
      ? "border-white/8 bg-black/18 opacity-80"
      : "border-white/10 bg-zinc-900/88",
  );
}

function getWeaponButtonClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  if (isSelected) {
    return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/45 bg-sky-400/14 text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.14)]";
  }

  if (snapshot.locked) {
    return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/6 bg-white/4 text-stone-500 opacity-65";
  }

  return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-100 transition-colors duration-150 hover:border-sky-400/24 hover:bg-sky-500/8 hover:text-sky-100";
}

export default function SiegeHud({
  className,
  debugMode = false,
  interactiveKills,
  interactivePoints,
  interactiveRemainingBugs,
  justEvolvedWeaponId,
  lastFireTimes,
  onArmStructure,
  onExit,
  onSelectWeapon,
  onToggleDebugMode,
  placedCountByType,
  placingStructureId,
  selectedWeaponId,
  unlockedStructures,
  weaponSnapshots,
}: SiegeHudProps) {
  const selectedSnapshot =
    weaponSnapshots.find((snapshot) => snapshot.id === selectedWeaponId) ??
    weaponSnapshots[0];

  return (
    <div data-no-hammer data-testid="siege-hud" className={className}>
      <div className="grid gap-2 rounded-[20px] border border-white/12 bg-zinc-950/92 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-[16px] border border-red-300/14 bg-[linear-gradient(135deg,rgba(127,29,29,0.26),rgba(24,24,27,0.92))] px-3 py-2.5">
            <div className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-red-200/75">
              Bugs
            </div>
            <strong className="mt-1 block text-lg font-semibold leading-none text-stone-50">
              {interactiveRemainingBugs.toLocaleString()}
            </strong>
          </div>

          <div className="rounded-[16px] border border-white/8 bg-black/28 px-3 py-2.5">
            <div className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Kills
            </div>
            <strong className="mt-1 block text-lg font-semibold leading-none text-stone-50">
              {interactiveKills.toLocaleString()}
            </strong>
          </div>

          <div className="rounded-[16px] border border-amber-300/14 bg-[linear-gradient(135deg,rgba(120,80,0,0.22),rgba(24,24,27,0.92))] px-3 py-2.5">
            <div className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-amber-200/75">
              Pts
            </div>
            <strong className="mt-1 block text-lg font-semibold leading-none text-stone-50">
              {interactivePoints.toLocaleString()}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            data-no-hammer
            aria-label="Back to dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-900/90 px-3 text-sm font-medium text-stone-200 transition duration-200 hover:bg-zinc-800 hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
            onClick={onExit}
            type="button"
          >
            Back
          </button>
          <button
            data-no-hammer
            aria-label={
              debugMode ? "Disable siege debug mode" : "Enable siege debug mode"
            }
            aria-pressed={debugMode}
            className={
              debugMode
                ? "inline-flex min-h-11 items-center justify-center rounded-[16px] border border-cyan-300/35 bg-cyan-400/20 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100 transition duration-200 hover:bg-cyan-400/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
                : "inline-flex min-h-11 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-900/90 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-stone-400 transition duration-200 hover:bg-zinc-800 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
            }
            onClick={onToggleDebugMode}
            type="button"
          >
            DBG
          </button>
        </div>

        <div className="rounded-[16px] border border-white/8 bg-black/20 px-2.5 py-2.5">
          <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
            <div className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Loadout
            </div>
            <div className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-stone-600">
              Focused
            </div>
          </div>

          {selectedSnapshot ? (
            <div className="mb-3 rounded-[16px] border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-black/20 text-stone-50">
                  <WeaponGlyph className="h-5 w-5" id={selectedSnapshot.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="truncate text-sm font-semibold text-stone-100">
                        {selectedSnapshot.title}
                      </div>
                      <div className="text-[0.6rem] uppercase tracking-[0.18em] text-stone-500">
                        {selectedSnapshot.typeLabel} ·{" "}
                        {INPUT_MODE_LABEL[selectedSnapshot.inputMode] ??
                          selectedSnapshot.inputMode}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-stone-300">
                      {`T${selectedSnapshot.tier}`}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.72rem] leading-5 text-stone-400">
                    {selectedSnapshot.hint}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-white/6 bg-black/18 px-2.5 py-2">
                <div>
                  <div className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Tier Progress
                  </div>
                  <div className="mt-1 text-[0.72rem] text-stone-300">
                    {selectedSnapshot.killsToNextTier != null
                      ? `${selectedSnapshot.weaponKills} kills · ${selectedSnapshot.killsToNextTier} to next tier`
                      : `${selectedSnapshot.weaponKills} kills · max tier`}
                  </div>
                </div>
                <div className="text-right text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  {selectedSnapshot.locked
                    ? `Unlock @ ${selectedSnapshot.unlockKills}`
                    : `${selectedSnapshot.cooldownMs}ms cd`}
                </div>
              </div>
            </div>
          ) : null}

          <div
            data-no-hammer
            className="grid grid-cols-5 gap-2"
            role="radiogroup"
            aria-label="Select weapon"
          >
            {weaponSnapshots.map((snapshot) => {
              const isSelected = snapshot.id === selectedWeaponId;
              const isEvolving = justEvolvedWeaponId === snapshot.id;

              return (
                <Tooltip
                  key={snapshot.id}
                  content={weaponTooltip(snapshot, isSelected)}
                >
                  <div
                    className={getSlotClassName(snapshot)}
                    data-current={isSelected ? "true" : "false"}
                    data-locked={snapshot.locked ? "true" : "false"}
                    data-testid={`weapon-${snapshot.id}`}
                    style={
                      isEvolving
                        ? {
                            animation:
                              "weapon-evolve 720ms cubic-bezier(0.34,1.56,0.64,1) forwards",
                          }
                        : undefined
                    }
                  >
                    {isEvolving ? (
                      <div className="pointer-events-none absolute inset-[-3px] z-20 rounded-[17px] border-2 border-sky-300/80 [animation:weapon-evolve-ring_650ms_ease-out_forwards]" />
                    ) : null}

                    {snapshot.locked ? (
                      <div
                        aria-label={`${snapshot.title} weapon (locked)`}
                        aria-checked={false}
                        role="radio"
                        className={getWeaponButtonClassName(snapshot, false)}
                      >
                        <WeaponGlyph className="h-5 w-5" id={snapshot.id} />
                      </div>
                    ) : (
                      <button
                        aria-label={`Select ${snapshot.title} weapon`}
                        aria-checked={isSelected}
                        role="radio"
                        type="button"
                        className={getWeaponButtonClassName(
                          snapshot,
                          isSelected,
                        )}
                        onClick={() => onSelectWeapon(snapshot.id)}
                      >
                        <WeaponGlyph className="h-5 w-5" id={snapshot.id} />
                      </button>
                    )}

                    <div className="mt-1 text-center text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {snapshot.locked
                        ? `@${snapshot.unlockKills}`
                        : `T${snapshot.tier}`}
                    </div>

                    {!snapshot.locked &&
                    snapshot.cooldownMs > 0 &&
                    lastFireTimes?.[snapshot.id] != null ? (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-[14px]">
                        <div
                          key={lastFireTimes[snapshot.id]}
                          className="h-full bg-sky-300/80"
                          style={{
                            animation: `reload-drain ${snapshot.cooldownMs}ms linear forwards`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {unlockedStructures && unlockedStructures.length > 0 ? (
          <div className="rounded-[16px] border border-amber-400/14 bg-black/20 px-2.5 py-2.5">
            <div className="mb-2 px-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-amber-400/70">
              Structures
            </div>
            <div data-no-hammer className="flex flex-wrap items-center gap-2">
              {STRUCTURE_DEFS.filter((s) =>
                unlockedStructures.includes(s.id),
              ).map((structure) => {
                const isArming = placingStructureId === structure.id;
                const placedCount = placedCountByType?.[structure.id] ?? 0;
                const tooltipText = `${structure.title} — ${structure.hint} (${placedCount}/${structure.maxPlaced} placed)`;

                return (
                  <Tooltip key={structure.id} content={tooltipText}>
                    <div className="relative rounded-[14px] border border-white/8 bg-black/18 p-1.5">
                      <button
                        aria-label={`${isArming ? "Cancel" : "Arm"} ${structure.title}`}
                        aria-pressed={isArming}
                        type="button"
                        className={
                          isArming
                            ? "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/50 bg-amber-400/20 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.3)]"
                            : "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/8 text-amber-100 transition-colors duration-150 hover:border-amber-400/40 hover:bg-amber-500/16"
                        }
                        onClick={() => onArmStructure?.(structure.id)}
                      >
                        <span className="text-base leading-none">
                          {structure.id === "lantern"
                            ? "🔦"
                            : structure.id === "turret"
                              ? "🎯"
                              : "🤖"}
                        </span>
                      </button>
                      {placedCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[0.5rem] font-bold text-zinc-900">
                          {placedCount}
                        </span>
                      ) : null}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
