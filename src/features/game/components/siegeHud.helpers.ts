import { cn } from "@shared/utils/cn";
import type { StructureId, WeaponProgressSnapshot } from "@game/types";
import { getWeaponHeatProfile } from "@game/utils/weaponHeat";

export const WEAPON_TIER_NODE_COUNT = 2;

export function isMaxTierSnapshot(snapshot: WeaponProgressSnapshot) {
  return snapshot.killsToNextTier == null;
}

export function getTierNodeState(
  snapshot: WeaponProgressSnapshot,
  tierIndex: number,
) {
  if (snapshot.locked) {
    return "locked" as const;
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "active" as const;
  }

  const currentNodeIndex = Math.min(WEAPON_TIER_NODE_COUNT, snapshot.tier);

  if (tierIndex < currentNodeIndex) {
    return "active" as const;
  }

  if (tierIndex === currentNodeIndex) {
    return "current" as const;
  }

  return "idle" as const;
}

export function getTierNodeOffsetClassName(
  snapshot: WeaponProgressSnapshot,
  tierIndex: number,
) {
  void snapshot;
  void tierIndex;
  return "";
}

export function getTierNodeClassName(
  snapshot: WeaponProgressSnapshot,
  tierIndex: number,
  emphasis: "compact" | "panel" = "compact",
) {
  const nodeState = getTierNodeState(snapshot, tierIndex);
  const sizeClassName =
    emphasis === "panel"
      ? "h-2 w-8 rounded-full"
      : "h-1.5 w-5.5 rounded-full";

  if (nodeState === "locked") {
    return cn(sizeClassName, "relative overflow-hidden border border-white/12 bg-white/6");
  }

  if (nodeState === "active") {
    if (isMaxTierSnapshot(snapshot)) {
      return cn(
        sizeClassName,
        "relative overflow-hidden border border-orange-100/20 bg-[linear-gradient(180deg,rgba(127,29,29,0.4),rgba(69,10,10,0.72))] shadow-[0_0_14px_rgba(249,115,22,0.28)]",
      );
    }

    if (snapshot.tier === 2) {
      return cn(
        sizeClassName,
        "relative overflow-hidden border border-orange-300/18 bg-[linear-gradient(180deg,rgba(120,53,15,0.4),rgba(67,20,7,0.72))] shadow-[0_0_10px_rgba(249,115,22,0.18)]",
      );
    }

    return cn(
      sizeClassName,
      "relative overflow-hidden border border-slate-200/18 bg-[linear-gradient(180deg,rgba(51,65,85,0.58),rgba(15,23,42,0.8))] shadow-[0_0_10px_rgba(148,163,184,0.16)]",
    );
  }

  if (nodeState === "current") {
    if (snapshot.tier === 2) {
      return cn(
        sizeClassName,
        "relative overflow-hidden border border-orange-200/24 bg-[linear-gradient(180deg,rgba(120,53,15,0.42),rgba(67,20,7,0.76))] shadow-[0_0_14px_rgba(249,115,22,0.3)] [animation:hud-weapon-breathe_1800ms_ease-in-out_infinite]",
      );
    }

    return cn(
      sizeClassName,
      "relative overflow-hidden border border-slate-200/20 bg-[linear-gradient(180deg,rgba(51,65,85,0.62),rgba(15,23,42,0.84))] shadow-[0_0_14px_rgba(148,163,184,0.24)] [animation:hud-weapon-breathe_1800ms_ease-in-out_infinite]",
    );
  }

  return cn(sizeClassName, "relative overflow-hidden border border-white/12 bg-white/10");
}

export function getTierNodeFillClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "bg-white/0";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "bg-[linear-gradient(90deg,rgba(255,247,237,0.98),rgba(249,115,22,0.92)_45%,rgba(220,38,38,0.94))]";
  }

  if (snapshot.tier === 2) {
    return "bg-[linear-gradient(90deg,rgba(255,237,213,0.98),rgba(251,146,60,0.96),rgba(194,65,12,0.94))]";
  }

  return "bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(203,213,225,0.92),rgba(100,116,139,0.9))]";
}

export function getTierNodeFillWidth(
  snapshot: WeaponProgressSnapshot,
  tierIndex: number,
) {
  const nodeState = getTierNodeState(snapshot, tierIndex);

  if (nodeState === "active") {
    return "100%";
  }

  if (nodeState === "current") {
    return getTierProgressWidth(snapshot);
  }

  return "0%";
}

export function getTierBarTrackClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  if (snapshot.locked) {
    return cn(
      "border-white/8 bg-white/[0.04]",
      isSelected ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" : undefined,
    );
  }

  if (isMaxTierSnapshot(snapshot)) {
    return cn(
      "border-red-200/18 bg-[linear-gradient(90deg,rgba(127,29,29,0.34),rgba(249,115,22,0.14),rgba(127,29,29,0.34))]",
      isSelected ? "shadow-[0_0_12px_rgba(239,68,68,0.12)]" : undefined,
    );
  }

  if (snapshot.tier === 2) {
    return cn(
      "border-orange-300/18 bg-[linear-gradient(90deg,rgba(120,53,15,0.34),rgba(249,115,22,0.12),rgba(120,53,15,0.34))]",
      isSelected ? "shadow-[0_0_10px_rgba(249,115,22,0.08)]" : undefined,
    );
  }

  return cn(
    "border-slate-300/14 bg-[linear-gradient(90deg,rgba(30,41,59,0.44),rgba(148,163,184,0.08),rgba(30,41,59,0.44))]",
    isSelected ? "shadow-[0_0_10px_rgba(148,163,184,0.08)]" : undefined,
  );
}

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
      ? ` · ${snapshot.killsToNextTier} kills → tier ${snapshot.tier + 1}`
      : " · MAX TIER";

  return `${snapshot.title} [${mode}]${selected}${progress} — ${snapshot.hint}`;
}

export function getSlotClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  return cn(
    "relative h-10 min-w-[2.35rem] overflow-hidden rounded-[12px] border px-0.5 py-1 text-sm text-stone-200",
    isSelected
      ? getTierSelectedFrameClassName(snapshot)
      : "",
    snapshot.locked
      ? "border-white/6 bg-black/16 opacity-70"
      : isSelected
        ? ""
        : cn(
            "bg-white/[0.045] hover:bg-white/[0.075]",
            getTierIdleFrameClassName(snapshot),
          ),
  );
}

export function getWeaponButtonClassName(
  snapshot: WeaponProgressSnapshot,
  isSelected: boolean,
) {
  const heat = getWeaponHeatProfile(snapshot.tier, isMaxTierSnapshot(snapshot));

  if (isSelected) {
    if (heat.stage === "overdrive") {
      return "relative inline-flex h-7 w-7 items-center justify-center overflow-visible rounded-[9px] border border-orange-100/76 bg-[linear-gradient(180deg,rgba(255,247,237,0.46),rgba(253,186,116,0.24)_20%,rgba(249,115,22,0.42)_44%,rgba(153,27,27,0.84))] text-white !cursor-pointer";
    }

    if (heat.stage === "hot") {
      return "relative inline-flex h-7 w-7 items-center justify-center overflow-visible rounded-[9px] border border-orange-200/40 bg-[linear-gradient(180deg,rgba(254,215,170,0.16),rgba(249,115,22,0.2)_36%,rgba(120,53,15,0.6))] text-orange-100 !cursor-pointer";
    }

    return "relative inline-flex h-7 w-7 items-center justify-center overflow-visible rounded-[9px] border border-slate-200/42 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(148,163,184,0.12)_34%,rgba(24,28,34,0.56))] text-slate-100 !cursor-pointer";
  }

  if (snapshot.locked) {
    return "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/6 bg-white/4 text-stone-500 opacity-65 !cursor-pointer";
  }

  if (heat.stage === "overdrive") {
    return "relative inline-flex h-7 w-7 items-center justify-center overflow-visible rounded-[9px] border border-orange-100/72 bg-[linear-gradient(180deg,rgba(255,247,237,0.28),rgba(253,186,116,0.18)_24%,rgba(249,115,22,0.34)_42%,rgba(153,27,27,0.72))] text-orange-50 !cursor-pointer hover:border-white/90 hover:bg-[linear-gradient(180deg,rgba(255,247,237,0.32),rgba(253,186,116,0.22)_24%,rgba(249,115,22,0.4)_42%,rgba(127,29,29,0.78))] hover:text-white";
  }

  if (heat.stage === "hot") {
    return "relative inline-flex h-7 w-7 items-center justify-center overflow-visible rounded-[9px] border border-orange-300/36 bg-[linear-gradient(180deg,rgba(251,146,60,0.12),rgba(120,53,15,0.42))] text-orange-100 !cursor-pointer hover:border-orange-200/46 hover:bg-[linear-gradient(180deg,rgba(253,186,116,0.16),rgba(120,53,15,0.52))] hover:text-orange-50";
  }

  return "relative inline-flex h-7 w-7 items-center justify-center overflow-visible rounded-[9px] border border-slate-300/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(71,85,105,0.18)_34%,rgba(15,23,42,0.36))] text-slate-200 !cursor-pointer hover:border-slate-200/38 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(100,116,139,0.24)_34%,rgba(30,41,59,0.42))] hover:text-slate-50";
}

export function getTierBarClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "bg-white/16";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "bg-[linear-gradient(90deg,#7f1d1d_0%,#dc2626_16%,#f97316_34%,#fff7ed_50%,#fb923c_64%,#ef4444_80%,#7f1d1d_100%)] bg-[length:220%_100%] shadow-[0_0_16px_rgba(239,68,68,0.34)] [animation:heat-bar-flow_1500ms_linear_infinite,heat-tier-flicker_2000ms_ease-in-out_infinite]";
  }

  if (snapshot.tier === 2) {
    return "bg-[linear-gradient(90deg,#78350f_0%,#c2410c_26%,#f59e0b_62%,#7c2d12_100%)] bg-[length:180%_100%] shadow-[0_0_10px_rgba(249,115,22,0.16)] [animation:heat-bar-flow_2400ms_linear_infinite]";
  }

  return "bg-[linear-gradient(90deg,#7c2d12_0%,#c2410c_32%,#fb923c_70%,#fdba74_100%)] shadow-[0_0_8px_rgba(249,115,22,0.16)]";
}

export function getTierBadgeClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "border-white/10 bg-white/[0.06] text-stone-300";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "border-orange-100/50 bg-[linear-gradient(180deg,rgba(255,247,237,0.24),rgba(249,115,22,0.22)_32%,rgba(153,27,27,0.34))] text-orange-50 shadow-[0_0_20px_rgba(239,68,68,0.24)]";
  }

  if (snapshot.tier === 2) {
    return "border-orange-300/26 bg-[linear-gradient(180deg,rgba(251,146,60,0.16),rgba(120,53,15,0.3))] text-orange-100 shadow-[0_0_14px_rgba(249,115,22,0.14)]";
  }

  return "border-slate-300/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(71,85,105,0.22))] text-slate-100 shadow-[0_0_12px_rgba(148,163,184,0.1)]";
}

export function getTierLabel(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "Locked";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "Overdrive";
  }

  return `Tier ${snapshot.tier}`;
}

export function getTierIdleFrameClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "border-white/6";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "border-red-200/54 hover:border-white/78";
  }

  if (snapshot.tier === 2) {
    return "border-orange-300/30 hover:border-orange-200/42";
  }

  return "border-slate-300/22 hover:border-slate-200/34";
}

export function getTierSelectedFrameClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(25,26,30,0.94))] shadow-[0_0_18px_rgba(255,255,255,0.08)]";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "border-orange-100/56 bg-[linear-gradient(180deg,rgba(255,247,237,0.18),rgba(249,115,22,0.18)_22%,rgba(153,27,27,0.56)_58%,rgba(69,10,10,0.96))] shadow-[0_0_24px_rgba(239,68,68,0.34)]";
  }

  if (snapshot.tier === 2) {
    return "border-orange-200/44 bg-[linear-gradient(180deg,rgba(253,186,116,0.18),rgba(120,53,15,0.94))] shadow-[0_0_18px_rgba(249,115,22,0.2)]";
  }

  return "border-slate-200/34 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(30,41,59,0.94))] shadow-[0_0_16px_rgba(148,163,184,0.16)]";
}

export function getTierSheenClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "from-white/6 via-white/0 to-transparent";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "from-orange-100/52 via-orange-400/18 to-transparent";
  }

  if (snapshot.tier === 2) {
    return "from-amber-100/28 via-orange-200/12 to-transparent";
  }

  return "from-white/18 via-slate-200/10 to-transparent";
}

export function getTierAccentClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "from-white/14 via-white/6 to-transparent";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "from-orange-100/80 via-red-300/24 to-transparent";
  }

  if (snapshot.tier === 2) {
    return "from-amber-200/64 via-orange-300/18 to-transparent";
  }

  return "from-slate-100/44 via-slate-200/14 to-transparent";
}

export function getTierBarCoreClassName(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return "hidden";
  }

  if (isMaxTierSnapshot(snapshot)) {
    return "bg-[linear-gradient(90deg,rgba(255,247,237,0.0),rgba(255,247,237,0.92),rgba(255,247,237,0.0))] opacity-100 [animation:heat-core-pulse_1100ms_ease-in-out_infinite]";
  }

  if (snapshot.tier === 2) {
    return "bg-[linear-gradient(90deg,rgba(254,215,170,0.0),rgba(254,215,170,0.52),rgba(254,215,170,0.0))] opacity-78";
  }

  return "bg-[linear-gradient(90deg,rgba(254,215,170,0.0),rgba(254,215,170,0.34),rgba(254,215,170,0.0))] opacity-70";
}

export function getTierProgress(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return 0;
  }

  if (snapshot.nextTierGoalKills == null) {
    return 100;
  }

  const progressWindow = snapshot.nextTierGoalKills - snapshot.currentTierStartKills;
  if (progressWindow <= 0) {
    return 0;
  }

  const progressedKills = snapshot.weaponKills - snapshot.currentTierStartKills;
  return Math.min(100, Math.max(0, (progressedKills / progressWindow) * 100));
}

export function getTierProgressWidth(snapshot: WeaponProgressSnapshot) {
  return `${getTierProgress(snapshot)}%`;
}

export function getTierCopy(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `Unlocks at ${snapshot.unlockKills} fixes`;
  }

  if (isMaxTierSnapshot(snapshot)) {
    return snapshot.detail;
  }

  return snapshot.detail;
}

export function getTierProgressCompact(snapshot: WeaponProgressSnapshot) {
  if (snapshot.locked) {
    return `0/${snapshot.unlockKills}`;
  }

  if (isMaxTierSnapshot(snapshot)) {
    return `${snapshot.weaponKills} total`;
  }

  const tierGoal = snapshot.nextTierGoalKills ?? snapshot.weaponKills;
  const tierWindow = Math.max(1, tierGoal - snapshot.currentTierStartKills);
  const progressedKills = Math.max(0, snapshot.weaponKills - snapshot.currentTierStartKills);
  return `${progressedKills}/${tierWindow}`;
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