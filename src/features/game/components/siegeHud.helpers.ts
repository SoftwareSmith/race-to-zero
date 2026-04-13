import { cn } from "@shared/utils/cn";
import type { StructureId, WeaponProgressSnapshot } from "@game/types";

export const INPUT_MODE_LABEL: Record<string, string> = {
  click: "Click",
  directional: "Directional",
  seeking: "Auto-seek",
  hold: "Hold",
};

export function weaponTooltip(
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
      ? ` · ${snapshot.killsToNextTier} kills → level ${snapshot.tier + 1}`
      : " · MAX LEVEL";

  return `${snapshot.title} [${mode}]${selected}${progress} — ${snapshot.hint}`;
}

export function getSlotClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  return cn(
    "relative h-10 min-w-[2.35rem] overflow-hidden rounded-[10px] border px-0.5 py-1 text-sm text-stone-200 transition duration-200",
    isSelected
      ? "border-sky-300/40 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(5,10,14,0.92))] shadow-[0_0_18px_rgba(56,189,248,0.16)]"
      : "",
    snapshot.locked
      ? "border-white/8 bg-black/18 opacity-80"
      : "border-white/10 bg-zinc-900/88 hover:border-white/16 hover:bg-zinc-900/96",
  );
}

export function getWeaponButtonClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  if (isSelected) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-sky-300/45 bg-sky-400/14 text-sky-50 !cursor-pointer shadow-[0_0_14px_rgba(56,189,248,0.14)]";
  }

  if (snapshot.locked) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/6 bg-white/4 text-stone-500 opacity-65 !cursor-pointer";
  }

  return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/10 bg-white/5 text-stone-100 !cursor-pointer transition duration-150 hover:border-sky-400/24 hover:bg-sky-500/8 hover:text-sky-100";
}

export function getTierAccentClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "from-white/14 via-white/6 to-transparent";
  }

  if (snapshot.tier === 3) {
    return "from-amber-300/60 via-amber-200/18 to-transparent";
  }

  if (snapshot.tier === 2) {
    return "from-cyan-200/55 via-sky-300/16 to-transparent";
  }

  return "from-sky-300/50 via-sky-300/14 to-transparent";
}

export function getTierProgress(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return 0;
  }

  if (snapshot.killsToNextTier == null) {
    return 100;
  }

  const progressWindow = snapshot.weaponKills + snapshot.killsToNextTier;
  if (progressWindow <= 0) {
    return 0;
  }

  return Math.min(100, (snapshot.weaponKills / progressWindow) * 100);
}

export function getTierCopy(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `Unlocks at ${snapshot.unlockKills} fixes`;
  }

  if (snapshot.killsToNextTier == null) {
    return `${snapshot.weaponKills} kills logged · max level online`;
  }

  return `${snapshot.weaponKills} kills logged · ${snapshot.killsToNextTier} to level ${snapshot.tier + 1}`;
}

export function getTierProgressCompact(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `0/${snapshot.unlockKills}`;
  }

  if (snapshot.killsToNextTier == null) {
    return "MAX";
  }

  const tierGoal = snapshot.weaponKills + snapshot.killsToNextTier;
  return `${snapshot.weaponKills}/${tierGoal}`;
}

export function getStructureGlyph(structureId: StructureId) {
  if (structureId === "lantern") {
    return "🔦";
  }

  if (structureId === "turret") {
    return "🎯";
  }

  return "🤖";
}