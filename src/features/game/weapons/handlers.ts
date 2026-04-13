/**
 * Weapon handlers — aggregates per-weapon configs into lookup maps.
 *
 * Each handler map is keyed by WeaponId so call sites never switch on
 * a string or magic number:
 *
 *   const theme = cursorHandlers[weaponId];
 *   const [t2, t3] = evolveThresholds[weaponId];
 *
 * To add a new weapon: create its folder, add its constants.ts,
 * then add one entry here. Everything else picks it up automatically.
 */

import type { WeaponId } from "@game/types";

import * as hammer      from "./hammer/constants";
import * as bugSpray    from "./bug-spray/constants";
import * as freeze      from "./freeze-cone/constants";
import * as chain       from "./chain-zap/constants";
import * as flame       from "./flame/constants";
import * as tracer      from "./tracer-bloom/constants";
import * as staticNet   from "./static-net/constants";
import * as nullPtr     from "./null-pointer/constants";
import * as forkBomb    from "./fork-bomb/constants";
import * as voidPulse   from "./void-pulse/constants";

// ─── Cursor config ────────────────────────────────────────────────────────────

export interface CursorConfig {
  accent: string;
  aura: string;
  size: number;
  /** Render crosshair lines on the reticle (laser / nullpointer). */
  showCrosshair: boolean;
  /** Optional CSS animation class for the outer cursor ring. */
  ringClassName?: string;
}

export const cursorHandlers: Record<WeaponId, CursorConfig> = {
  [hammer.ID]:    hammer.CURSOR,
  [bugSpray.ID]:  bugSpray.CURSOR,
  [freeze.ID]:    freeze.CURSOR,
  [chain.ID]:     chain.CURSOR,
  [flame.ID]:     flame.CURSOR,
  [tracer.ID]:    tracer.CURSOR,
  [staticNet.ID]: staticNet.CURSOR,
  [nullPtr.ID]:   nullPtr.CURSOR,
  [forkBomb.ID]:  forkBomb.CURSOR,
  [voidPulse.ID]: voidPulse.CURSOR,
};

// ─── Evolve thresholds ───────────────────────────────────────────────────────

/** Per-weapon [killsToT2, killsToT3] thresholds. */
export const evolveThresholds: Record<WeaponId, [number, number]> = {
  [hammer.ID]:    hammer.EVOLVE_THRESHOLDS,
  [bugSpray.ID]:  bugSpray.EVOLVE_THRESHOLDS,
  [freeze.ID]:    freeze.EVOLVE_THRESHOLDS,
  [chain.ID]:     chain.EVOLVE_THRESHOLDS,
  [flame.ID]:     flame.EVOLVE_THRESHOLDS,
  [tracer.ID]:    tracer.EVOLVE_THRESHOLDS,
  [staticNet.ID]: staticNet.EVOLVE_THRESHOLDS,
  [nullPtr.ID]:   nullPtr.EVOLVE_THRESHOLDS,
  [forkBomb.ID]:  forkBomb.EVOLVE_THRESHOLDS,
  [voidPulse.ID]: voidPulse.EVOLVE_THRESHOLDS,
};
