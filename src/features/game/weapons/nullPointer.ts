import type { WeaponDef } from "./types";

const nullPointer: WeaponDef = {
  id: "nullpointer",
  title: "Null Pointer",
  typeLabel: "Precision",
  typeHint: "Tracks the highest-value bug and converts setup into clean executions.",
  weaponType: "precision",
  unlockKills: 95,
  detail:
    "Homing missile that locks onto the highest-HP bug on screen. Curves to target over 0.6 s. Deals 3 dmg + 60px splash. Leaves a binary data burst (1s and 0s fly outward) and a tracer trail.",
  hitPattern: "seeking",
  hitRadius: 500,
  damage: 3,
  seekRadius: 500,
  splashRadius: 60,
  effectColor: "#fb7185",
  cooldownMs: 3000,
  inputMode: "seeking",
  hint: "Click anywhere — missile curves to highest-HP bug, binary burst on impact",
  tierTitles: ["Garbage Collector", "Mark & Sweep", "Auto-Scaler"],
  tierDetails: [
    "Homing missile locks onto the highest-HP bug. Deals 3 dmg + 60px splash. Executes bugs below 33% HP.",
    "Mark & Sweep — applies Marked status to the target and nearby bugs. Increases execution threshold to 50% HP.",
    "Auto-Scaler — periodic global pulse instantly executes all Marked bugs below the HP threshold.",
  ],
  tierHints: [
    "Click anywhere — missile curves to highest-HP bug, binary burst on impact",
    "T2: Marks the target + nearby bugs; executes at 50% HP",
    "T3: Auto-Scaler pulse kills all Marked bugs below threshold globally",
  ],
};

export default nullPointer;
