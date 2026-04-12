import type { WeaponDef } from "./types";

const laserCutter: WeaponDef = {
  id: "laser",
  title: "Tracer Bloom",
  typeLabel: "Precision",
  typeHint: "Picks apart priority targets and scales hardest off existing status effects.",
  weaponType: "precision",
  unlockKills: 68,
  detail:
    "Paints a route from the core to your click, detonating 4 pulse blooms along the way. Each bloom clips nearby bugs without using bounce-line logic.",
  hitPattern: "line",
  hitRadius: 42,
  effectColor: "#fb7185",
  cooldownMs: 950,
  inputMode: "click",
  hint: "Click to lay a bloom route — 4 bursts detonate between the core and target",
};

export default laserCutter;
