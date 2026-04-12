import type { WeaponDef } from "./types";

/** Fork Bomb — clustered duplicate detonations around the click point. */
const forkBomb: WeaponDef = {
  id: "plasma",
  title: "Fork Bomb",
  typeLabel: "Plasma",
  typeHint: "Breaks dense bug packs with overlapping explosive bursts.",
  weaponType: "plasma",
  unlockKills: 110,
  detail:
    "Duplicates the payload on impact: one central blast and 4 satellite bursts detonate around the click point, shredding packed bug clusters without radial beam lines.",
  hitPattern: "area",
  hitRadius: 48,
  damage: 2,
  effectColor: "#60a5fa",
  cooldownMs: 1100,
  inputMode: "click",
  hint: "Click into a dense pocket of bugs — the blast forks into 5 clustered detonations",
  tierTitles: ["Fork Bomb", "Process Storm", "Recursive Crash"],
  tierDetails: [
    "One central blast and 4 satellite bursts detonate around the click point, shredding packed clusters.",
    "Each detonation spawns a child process — secondary mini-bursts erupt from each hit bug.",
    "Recursive cascade — explosions keep spawning more explosions in expanding rings until the screen is cleared.",
  ],
  tierHints: [
    "Click into a dense pocket — blast forks into 5 detonations",
    "T2: Each detonation spawns child explosions from hit bugs",
    "T3: Recursive cascade — expanding rings of AoE explosions",
  ],
};

export default forkBomb;
