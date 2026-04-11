import type { WeaponDef } from "./types";

const laserCutter: WeaponDef = {
  id: "laser",
  title: "Laser Disc",
  unlockKills: 68,
  detail:
    "Fires a bouncing laser disc that ricochets off up to 2 walls. Hits any bug in its path. Spark crowns erupt at each wall bounce point.",
  hitPattern: "line",
  hitRadius: 28,
  bouncingDisc: true,
  maxBounces: 1,
  effectColor: "#f87171",
  cooldownMs: 1100,
  inputMode: "click",
  hint: "Click to fire — disc bounces off 2 walls, hits bugs along the path",
};

export default laserCutter;
