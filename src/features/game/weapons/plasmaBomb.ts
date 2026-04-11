import type { WeaponDef } from "./types";

/** Plasma Bomb — two-phase: implosion pull (400 ms) then explosion. */
const plasmaBomb: WeaponDef = {
  id: "plasma",
  title: "Plasma Bomb",
  unlockKills: 110,
  detail:
    "Two-phase detonation: 400 ms implosion pulls all bugs within 240px inward, then a 170px explosion deals 2 dmg. Pack tightly before the blast. Blue plasma orb fragments scatter after.",
  hitPattern: "area",
  hitRadius: 170,
  damage: 2,
  implosionRadius: 240,
  implosionDurationMs: 400,
  effectColor: "#38bdf8",
  cooldownMs: 1500,
  inputMode: "click",
  hint: "Click to charge — implosion pulls bugs in, then plasma detonation",
};

export default plasmaBomb;
