/**
 * Chain Zap — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.ChainZap;

export const EVOLVE_THRESHOLDS: [number, number] = [25, 75];

export const CURSOR = {
  accent: "#6ee7b7",
  aura: "0 0 24px rgba(110,231,183,0.28)",
  size: 48,
  showCrosshair: false,
  /** Pulsing ring animation class applied to the outer cursor ring. */
  ringClassName: "[animation:laser-cursor-breathe_2s_ease-in-out_infinite]",
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Chain Zap",
  typeLabel: "Electric",
  typeHint: "Jumps between clustered targets and rewards charged setups.",
  weaponType: "electric",
  unlockKills: 38,
  detail:
    "Click near a bug to start a 3-strand plasma arc. Lightning hops up to 3 times — each node emits a spark crown. Prioritises unfrozen bugs (synergy with Freeze Cone). Final bug leaves an electric afterglow.",
  hitPattern: "chain",
  hitRadius: 90,
  damage: 2,
  chainMaxBounces: 3,
  effectColor: CURSOR.accent,
  cooldownMs: 950,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click near a bug — arc bounces 3×, targets unfrozen bugs first",
  tierTitles: ["Chain Zap", "Event Loop", "Distributed System"],
  tierDetails: [
    "Click near a bug to start a 3-strand plasma arc. Bounces up to 3 times, prefers unfrozen targets.",
    "The loop never ends — arc bounces up to 6 times and each hit applies a Charged status, amplifying further damage.",
    "Network propagation: all Charged bugs on the field are hit simultaneously with cascading reduced damage.",
  ],
  tierHints: [
    "Click near a bug — arc bounces 3×, targets unfrozen bugs first",
    "T2: 6 bounces + each hit applies Charged status",
    "T3: All Charged bugs on screen get hit in a network pulse",
  ],
};
