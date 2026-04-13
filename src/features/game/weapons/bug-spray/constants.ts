/**
 * Bug Spray — single source of truth.
 */

import { WeaponId } from "@game/types";
import type { WeaponDef } from "@game/weapons/types";

export const ID = WeaponId.BugSpray;

export const EVOLVE_THRESHOLDS: [number, number] = [25, 70];

export const CURSOR = {
  accent: "#fde047",
  aura: "0 0 22px rgba(253,224,71,0.3)",
  size: 48,
  showCrosshair: false,
} as const;

export const def: WeaponDef = {
  id: ID,
  title: "Bug Spray",
  typeLabel: "Toxin",
  typeHint: "Poisons swarms and rewards area denial over burst damage.",
  weaponType: "toxin",
  unlockKills: 12,
  detail:
    "Aerosol cone sprays 50° of noxious mist. Bugs hit are Poisoned — 0.5 dmg/s for 4 s. Leaves a glowing Toxic Cloud on impact that poisons bugs passing through it for 3 s.",
  hitPattern: "cone",
  hitRadius: 120,
  coneArcDeg: 80,
  damage: 0,
  applyPoison: true,
  poisonDps: 0.5,
  poisonDurationMs: 4000,
  effectColor: CURSOR.accent,
  cooldownMs: 150,
  inputMode: "hold",
  evolveThresholds: EVOLVE_THRESHOLDS,
  hint: "Hold to spray a cone — bugs are Poisoned; toxic cloud lingers 3 s",
  tierTitles: ["Patch Deployment", "Hotfix", "Rolling Deployment"],
  tierDetails: [
    "Aerosol cone sprays 50° of noxious mist. Bugs hit are Poisoned — 0.5 dmg/s for 4 s. Toxic Cloud lingers.",
    "Hotfix rush — after the initial cone, secondary poison clouds erupt around each poisoned bug.",
    "Rolling deployment — cone expands into a growing circular ring that spreads poison across the entire field.",
  ],
  tierHints: [
    "Hold to spray a cone — bugs are Poisoned; toxic cloud lingers 3 s",
    "T2: Secondary poison clouds erupt around each freshly poisoned bug",
    "T3: Expanding ring — poison spreads across the whole field",
  ],
};
