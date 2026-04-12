import type { WeaponDef } from "./types";

/** Fork Bomb — clustered duplicate detonations around the click point. */
const forkBomb: WeaponDef = {
  id: "plasma",
  title: "Fork Bomb",
  unlockKills: 110,
  detail:
    "Duplicates the payload on impact: one central blast and 4 satellite bursts detonate around the click point, shredding packed bug clusters without radial beam lines.",
  hitPattern: "area",
  hitRadius: 54,
  damage: 2,
  effectColor: "#60a5fa",
  cooldownMs: 1000,
  inputMode: "click",
  hint: "Click into a dense pocket of bugs — the blast forks into 5 clustered detonations",
};

export default forkBomb;
