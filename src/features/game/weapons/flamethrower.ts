import type { WeaponDef } from "./types";

const flamethrower: WeaponDef = {
  id: "flame",
  title: "Flamethrower",
  unlockKills: 52,
  detail:
    "Spray napalm in a 70° cone. Rapid-fire stacks a hellfire inferno. A ground fire patch lingers at the cone tip for 1.5 s, burning any bug that walks through it. Char marks persist.",
  hitPattern: "cone",
  hitRadius: 150,
  damage: 1,
  coneArcDeg: 70,
  effectColor: "#f97316",
  cooldownMs: 200,
  inputMode: "click",
  hint: "Click to spray — rapid-fire stacks fire; ground patch burns trespassers",
};

export default flamethrower;
