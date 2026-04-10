import Tooltip from "../../components/Tooltip";
import WeaponGlyph from "../../components/WeaponGlyph";
import type { WeaponProgressSnapshot } from "./types";

interface SiegeHudProps {
  className?: string;
  interactiveKills: number;
  interactiveRemainingBugs: number;
  onExit: () => void;
  weaponSnapshots: WeaponProgressSnapshot[];
}

function getWeaponButtonClassName(snapshot?: WeaponProgressSnapshot) {
  if (!snapshot) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-stone-200";
  }

  if (snapshot.current) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-300/40 bg-sky-400/16 text-sky-50 shadow-[0_0_20px_rgba(56,189,248,0.18)]";
  }

  if (snapshot.locked) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/6 bg-white/4 text-stone-500 opacity-65";
  }

  return "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/8 text-emerald-100";
}

export default function SiegeHud({
  className,
  interactiveKills,
  interactiveRemainingBugs,
  onExit,
  weaponSnapshots,
}: SiegeHudProps) {
  return (
    <div data-no-hammer data-testid="siege-hud" className={className}>
      <div className="grid gap-2 rounded-[20px] border border-white/12 bg-zinc-950/92 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex items-stretch gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
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

            <button
              data-no-hammer
              aria-label="Back to dashboard"
              className="inline-flex min-h-full items-center justify-center rounded-[16px] border border-white/10 bg-zinc-900/90 px-3 text-sm font-medium text-stone-200 transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-800 hover:text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
              onClick={onExit}
              type="button"
            >
              Back
            </button>
          </div>
        </div>

        <div className="rounded-[16px] border border-white/8 bg-black/20 px-2.5 py-2.5">
          <div className="mb-2 px-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Weapons
          </div>
          <div data-no-hammer className="flex flex-wrap items-center gap-2">
            {weaponSnapshots.map((snapshot) => (
              <Tooltip
                key={snapshot.id}
                content={`${snapshot.title}: ${snapshot.progressText}`}
              >
                <div
                  aria-label={`${snapshot.title} weapon status`}
                  data-current={snapshot.current ? "true" : "false"}
                  data-locked={snapshot.locked ? "true" : "false"}
                  data-testid={`weapon-${snapshot.id}`}
                  className="rounded-[14px] border border-white/8 bg-black/18 p-1.5 text-sm text-stone-200"
                >
                  <div className={getWeaponButtonClassName(snapshot)}>
                    <WeaponGlyph className="h-5 w-5" id={snapshot.id} />
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
