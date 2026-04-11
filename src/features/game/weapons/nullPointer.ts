import type { WeaponDef } from "./types";

const nullPointer: WeaponDef = {
  id: "nullpointer",
  title: "Null Pointer",
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
};

export default nullPointer;
