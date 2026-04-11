/**
 * Plasma Bomb — behavior plugin (PersistentFireSession)
 *
 * Two-phase detonation:
 *   Phase 1 (begin): 400ms implosion — pulls all bugs inward, area damage
 *   Phase 2 (after 400ms): explosion — fountain + crater VFX (purely visual)
 *
 * Active = false immediately since gameplay damage is applied on begin().
 * The 400ms timer is purely visual; a second bomb can be fired after one
 * (no active-gate needed like void pulse).
 */

import type {
  WeaponContext,
  PersistentFireSession,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { canvasToViewport } from "@game/weapons/runtime/targetingHelpers";

const DAMAGE = 2;
const HIT_RADIUS = 170;
const INSTAKILL_HP_THRESHOLD = 1;
const APPLYS_KNOCKBACK = true;
const KNOCKBACK_FORCE = 180;
const IMPLOSION_DELAY_MS = 400;

function buildBeginCommands(ctx: WeaponContext): WeaponCommand[] {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const commands: WeaponCommand[] = [];

  const hitIndexes = engine.radiusHitTest(targetX, targetY, HIT_RADIUS);
  const bugs = engine.getAllBugs();

  for (const idx of hitIndexes) {
    const bug = bugs[idx];
    let damage = DAMAGE;

    // Instakill 1-HP bugs for satisfying pop
    if (bug) {
      const bugHp: number = (bug as any).hp ?? 1;
      if (bugHp <= INSTAKILL_HP_THRESHOLD) damage = 999;
    }

    commands.push({
      kind: "damage",
      targetIndex: idx,
      amount: damage,
      creditOnDeath: true,
    });

    // Knockback surviving bugs outward from blast center
    if (APPLYS_KNOCKBACK && bug) {
      const dx = bug.x - targetX || 1;
      const dy = bug.y - targetY || 1;
      const dist = Math.hypot(dx, dy) || 1;
      commands.push({
        kind: "knockback",
        targetIndex: idx,
        dx: (dx / dist) * KNOCKBACK_FORCE,
        dy: (dy / dist) * KNOCKBACK_FORCE,
      });
    }
  }

  // Phase 1 VFX: implosion pull ring (immediate)
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "plasmaImplosion",
      x: targetX,
      y: targetY,
      radius: HIT_RADIUS,
    },
  });

  // Phase 2 VFX: plasma fountain + crater (after implosion delay)
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "plasmaExplosion",
      x: targetX,
      y: targetY,
      delayMs: IMPLOSION_DELAY_MS,
    },
  });

  // Cursor reload time update
  commands.push({
    kind: "spawnEffect",
    descriptor: {
      type: "overlayEffect",
      weaponId: "plasma",
      viewportX,
      viewportY,
    },
  });

  void bounds;
  void canvasToViewport;

  return commands;
}

export function createSession(_ctx?: WeaponContext): PersistentFireSession {
  // Plasma bomb's "active" window is very short (the implosion animation).
  // We set active = false immediately after begin() so a second bomb can be
  // fired without waiting. The visual plays out via the delayed setTimeout in
  // the plasmaExplosion effect adapter.
  let _active = false;
  let _timer: ReturnType<typeof setTimeout> | null = null;

  return {
    mode: "persistent",
    begin(ctx: WeaponContext): WeaponCommand[] {
      _active = true;
      _timer = setTimeout(() => {
        _active = false;
        _timer = null;
      }, IMPLOSION_DELAY_MS + 200);
      return buildBeginCommands(ctx);
    },
    abort(): void {
      if (_timer !== null) {
        clearTimeout(_timer);
        _timer = null;
      }
      _active = false;
    },
    get active(): boolean {
      return _active;
    },
  };
}
