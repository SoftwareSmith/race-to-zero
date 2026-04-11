import type { WeaponDef } from "./types";

/**
 * Void Pulse — black hole upgrade.
 * Creates a persistent gravity well for 2 s then collapses with a 300px shockring.
 * Only one black hole active at a time.
 */
const voidPulse: WeaponDef = {
  id: "void",
  title: "Void Pulse",
  unlockKills: 130,
  detail:
    "Creates a miniature black hole that grows for 2 s, pulling every bug within 300px inward. Bugs touching the core take 1 dmg/tick. On collapse: 300px shockring deals 2 dmg. One active at a time. 6 s cooldown.",
  hitPattern: "blackhole",
  hitRadius: 300,
  damage: 2,
  blackHoleMode: true,
  blackHoleDurationMs: 2000,
  blackHoleRadius: 300,
  blackHoleCoreRadius: 80,
  instakillLowHp: false,
  appliesKnockback: true,
  effectColor: "#c084fc",
  cooldownMs: 6000,
  inputMode: "click",
  hint: "Click to spawn a black hole — gravity pull 2 s then 300px collapse ring",
};

export default voidPulse;
