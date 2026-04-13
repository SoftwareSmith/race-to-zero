/**
 * Freeze Cone — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.Freeze;

export const EVOLVE_THRESHOLDS: [number, number] = [20, 60];

export const CURSOR = {
  accent: "#bfdbfe",
  aura: "0 0 22px rgba(191,219,254,0.32)",
  size: 50,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Freeze Blast",
  typeLabel: "Cryo",
  typeHint: "Controls space by slowing or pinning fast threats in place.",
  weaponType: "cryo",
  unlockKills: 25,
  detail:
    "Radial ice burst centred on click. Slows all bugs in a 180 px radius by 65% for 3.5 s. Snowflakes linger at the blast site. A second hit on a frozen bug extends the duration.",
  hitPattern: "area",
  hitRadius: 180,
  appliesSlow: true,
  effectColor: CURSOR.accent,
  cooldownMs: 820,
  inputMode: "click",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Click to freeze — radial blast slows all nearby bugs; snowflakes linger",
  tierTitles: ["Deadlock", "System Fault", "Segment Fault"],
  tierDetails: [
    "Radial ice burst centred on click. Slows all bugs in 180px radius by 65% for 3.5s.",
    "System hangs — ice blast fully ensnares bugs instead of slowing; next click on any ensnared bug = instakill.",
    "Critical failure: a global Segment Fault freezes every bug on screen simultaneously.",
  ],
  tierHints: [
    "Click to freeze — radial blast slows all nearby bugs; snowflakes linger",
    "T2: Full ensnare instead of slow — click ensnared bugs to instakill",
    "T3: Global freeze — slows every active bug on the entire field",
  ],
};
