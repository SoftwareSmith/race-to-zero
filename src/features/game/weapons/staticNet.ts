import type { WeaponDef } from "./types";

/** Static Net — replaces Shockwave. Ensnares bugs; click ensnared bugs to instakill. */
const staticNet: WeaponDef = {
  id: "shockwave",
  title: "Static Net",
  unlockKills: 82,
  detail:
    "Expands a wire-mesh net to 200px over 0.4 s. All bugs inside are Ensnared — completely immobilised for 3 s. Click any ensnared bug for an instant kill. Net dissolves with a scatter burst. 4 s cooldown.",
  hitPattern: "area",
  hitRadius: 200,
  damage: 0,
  applyEnsnare: true,
  ensnareDurationMs: 3000,
  effectColor: "#e2e8f0",
  cooldownMs: 4000,
  inputMode: "click",
  hint: "Click to cast a net — ensnared bugs are frozen; click them to instakill",
};

export default staticNet;
