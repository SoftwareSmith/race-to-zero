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
    "relative h-10 min-w-[2.35rem] overflow-hidden rounded-[12px] border px-0.5 py-1 text-sm text-stone-200 transition duration-200",
    isSelected
      ? "border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(25,26,30,0.94))] shadow-[0_0_18px_rgba(255,255,255,0.08)]"
      : "",
    snapshot.locked
      ? "border-white/6 bg-black/16 opacity-70"
      : isSelected
        ? ""
        : "border-white/8 bg-white/[0.045] hover:border-white/12 hover:bg-white/[0.075]",
  );
}

export function getWeaponButtonClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  if (isSelected) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-white/30 bg-white/12 text-stone-50 !cursor-pointer shadow-[0_0_14px_rgba(255,255,255,0.08)]";
  }

  if (snapshot.locked) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/6 bg-white/4 text-stone-500 opacity-65 !cursor-pointer";
  }

  return "inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-white/10 bg-black/20 text-stone-200 !cursor-pointer transition duration-150 hover:border-white/16 hover:bg-white/[0.08] hover:text-stone-50";
}

export function getTierBarClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "bg-white/16";
  }

  if (snapshot.tier >= 3 || snapshot.killsToNextTier == null) {
    return "bg-[linear-gradient(90deg,rgba(245,158,11,0.78),rgba(251,191,36,0.96),rgba(253,224,71,0.88))]";
  }

  if (snapshot.tier === 2) {
    return "bg-[linear-gradient(90deg,rgba(148,163,184,0.72),rgba(226,232,240,0.94),rgba(203,213,225,0.82))]";
  }

  return "bg-[linear-gradient(90deg,rgba(180,83,9,0.78),rgba(217,119,6,0.95),rgba(251,191,36,0.72))]";
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