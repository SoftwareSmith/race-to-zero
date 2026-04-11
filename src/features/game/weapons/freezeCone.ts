import type { WeaponDef } from "./types";

const freezeCone: WeaponDef = {
  id: "freeze",
  title: "Freeze Blast",
  unlockKills: 25,
  detail:
    "Radial ice burst centred on click. Slows all bugs in a 180 px radius by 65% for 3.5 s. Snowflakes linger at the blast site. A second hit on a frozen bug extends the duration.",
  hitPattern: "area",
  hitRadius: 180,
  appliesSlow: true,
  effectColor: "#bfdbfe",
  cooldownMs: 820,
  inputMode: "click",
  hint: "Click to freeze — radial blast slows all nearby bugs; snowflakes linger",
};

export default freezeCone;
