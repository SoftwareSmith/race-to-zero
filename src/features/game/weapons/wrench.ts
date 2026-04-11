import type { WeaponDef } from "./types";

const wrench: WeaponDef = {
  id: "wrench",
  title: "Hammer",
  unlockKills: 0,
  detail:
    "Heavy impact strike. Deals 2 damage — one-shots Glitchlings on contact and leaves a persistent crack at the hit point.",
  hitPattern: "point",
  hitRadius: 48,
  damage: 2,
  effectColor: "#fbbf24",
  cooldownMs: 300,
  inputMode: "click",
  hint: "Click directly on a bug to smash it",
};

export default wrench;
