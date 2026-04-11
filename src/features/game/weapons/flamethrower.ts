import type { WeaponDef } from "./types";

const flamethrower: WeaponDef = {
  id: "flame",
  title: "Flamethrower",
  unlockKills: 52,
  detail:
    "Spray napalm in a 70° cone. Rapid-fire stacks a hellfire inferno. A ground fire patch lingers at the cone tip for 1.5 s, burning any bug that walks through it. Char marks persist.",
  hitPattern: "cone",
  hitRadius: 150,
  damage: 0,
  coneArcDeg: 70,
  applyBurn: true,
  burnDps: 6,
  burnDurationMs: 1200,
  burnDecayPerSecond: 3.2,
  effectColor: "#f97316",
  cooldownMs: 200,
  inputMode: "hold",
  hint: "Hold to spray — move to paint a flamethrower trail; ground patch burns trespassers",
};

export default flamethrower;
