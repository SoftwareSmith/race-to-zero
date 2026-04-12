import type { WeaponDef } from "./types";

const hammer: WeaponDef = {
  id: "hammer",
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
  tierTitles: ["Hammer", "Refactor Tool", "Rewrite Engine"],
  tierDetails: [
    "Heavy impact strike. Deals 2 damage — one-shots Glitchlings on contact and leaves a crack decal.",
    "Refactor — if the target is above 50% HP, it splits into two half-HP bugs (divide and conquer).",
    "Rewrite from scratch — converts the hit bug to an ally for 8 s; it stops targeting the player base.",
  ],
  tierHints: [
    "Click directly on a bug to smash it",
    "T2: High-HP bugs split into two half-HP clones",
    "T3: Convert the hit bug to an ally for 8 seconds",
  ],
};

export default hammer;
