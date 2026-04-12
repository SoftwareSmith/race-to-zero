/**
 * runtime/executor.ts — applies WeaponCommand arrays against a live
 * ExecutionContext (real engine, vfx, and callbacks).
 *
 * Command execution order:
 *   1. damage — handleHit, report to onHit
 *   2. per-bug status effects (applyPoison, applyBurn, applyFreeze, applyEnsnare, knockback)
 *   3. area status effects (poisonRadius, burnRadius, ensnareRadius, repeatPoisonRadius)
 *   4. world state (startBlackHole)
 *   5. effects (spawnEffect → adapter)
 */

import type { WeaponCommand, ExecutionContext } from "@game/weapons/runtime/types";
import { applyEffectDescriptor, triggerShakeForWeapon } from "@game/weapons/effects/adapter";

/** Execute a list of weapon commands against the provided context. */
export function executeCommands(
  commands: WeaponCommand[],
  ctx: ExecutionContext,
): void {
  if (commands.length === 0) return;

  for (const cmd of commands) {
    switch (cmd.kind) {
      // ── damage ─────────────────────────────────────────────────────────────
      case "damage": {
        const result = ctx.engine.handleHit(
          cmd.targetIndex,
          cmd.amount,
          cmd.creditOnDeath ?? true,
          ctx.weaponId,
        );
        if (result) {
          const bug = ctx.engine.getAllBugs()[cmd.targetIndex];
          const vx = bug
            ? Math.round(bug.x + ctx.bounds.left)
            : ctx.viewportX;
          const vy = bug
            ? Math.round(bug.y + ctx.bounds.top)
            : ctx.viewportY;
          ctx.onHit({
            defeated: result.defeated,
            remainingHp: result.remainingHp,
            variant: result.variant,
            x: vx,
            y: vy,
            pointValue: result.pointValue,
            frozen: result.frozen,
          });
          ctx.updateQaLastHit({
            defeated: result.defeated,
            remainingHp: result.remainingHp,
            variant: result.variant,
            x: vx,
            y: vy,
          });
        }
        break;
      }

      // ── per-bug status effects ────────────────────────────────────────────
      case "applyPoison": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyPoison === "function") {
          bug.applyPoison(cmd.dps, cmd.durationMs);
        }
        break;
      }

      case "applyBurn": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyBurn === "function") {
          bug.applyBurn(cmd.dps, cmd.durationMs, cmd.decayPerSecond);
        }
        break;
      }

      case "applyFreeze": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyFreeze === "function") {
          bug.applyFreeze(cmd.intensity, cmd.durationMs);
        }
        break;
      }

      case "applyEnsnare": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyEnsnare === "function") {
          bug.applyEnsnare(cmd.durationMs);
        }
        break;
      }

      case "knockback": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.knockback === "function") {
          bug.knockback(cmd.dx, cmd.dy);
        }
        break;
      }

      // ── area status effects ───────────────────────────────────────────────
      case "poisonRadius":
        ctx.engine.applyPoisonInRadius(
          cmd.cx,
          cmd.cy,
          cmd.radius,
          cmd.dps,
          cmd.durationMs,
        );
        break;

      case "burnRadius":
        ctx.engine.applyBurnInRadius(
          cmd.cx,
          cmd.cy,
          cmd.radius,
          cmd.peakDps,
          cmd.durationMs,
          cmd.decayPerSecond,
        );
        break;

      case "ensnareRadius":
        ctx.engine.applyEnsnareInRadius(
          cmd.cx,
          cmd.cy,
          cmd.radius,
          cmd.durationMs,
        );
        break;

      case "repeatPoisonRadius": {
        // Immediate first application, then periodic ticks while cloud exists
        ctx.engine.applyPoisonInRadius(
          cmd.cx,
          cmd.cy,
          cmd.radius,
          cmd.dps,
          cmd.durationMs,
        );
        const engine = ctx.engine;
        const intId = window.setInterval(() => {
          engine.applyPoisonInRadius(cmd.cx, cmd.cy, cmd.radius, cmd.dps, cmd.durationMs);
        }, cmd.intervalMs);
        window.setTimeout(() => window.clearInterval(intId), cmd.totalMs + 50);
        break;
      }

      // ── world state ───────────────────────────────────────────────────────
      case "startBlackHole": {
        const started = ctx.engine.startBlackHole(
          cmd.x,
          cmd.y,
          cmd.radius,
          cmd.coreRadius,
          cmd.durationMs,
          cmd.collapseDamage,
        );
        if (started) {
          void started;
        }
        break;
      }

      // ── evolution-era status singles ────────────────────────────────────
      case "applyCharged": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyCharged === "function") {
          bug.applyCharged(cmd.durationMs);
        }
        break;
      }

      case "applyMarked": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyMarked === "function") {
          bug.applyMarked(cmd.durationMs);
        }
        break;
      }

      case "applyUnstable": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyUnstable === "function") {
          bug.applyUnstable(cmd.durationMs);
        }
        break;
      }

      case "applyLooped": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyLooped === "function") {
          bug.applyLooped(cmd.dps, cmd.durationMs);
        }
        break;
      }

      // ── evolution-era radius effects ────────────────────────────────────
      case "chargedRadius":
        ctx.engine.applyChargedInRadius(cmd.cx, cmd.cy, cmd.radius, cmd.durationMs);
        break;

      case "markedRadius":
        ctx.engine.applyMarkedInRadius(cmd.cx, cmd.cy, cmd.radius, cmd.durationMs);
        break;

      case "unstableRadius":
        ctx.engine.applyUnstableInRadius(cmd.cx, cmd.cy, cmd.radius, cmd.durationMs);
        break;

      // ── evolution-era world-state commands ──────────────────────────────
      case "propagateChargedNetwork":
        ctx.engine.propagateChargedNetwork(cmd.sourceIndex, cmd.damage, cmd.falloff);
        break;

      case "applyGlobalSlow":
        ctx.engine.applyGlobalSlow(cmd.multiplier, cmd.durationMs);
        break;

      case "startDeadlockCluster":
        ctx.engine.startDeadlockCluster(cmd.cx, cmd.cy, cmd.radius, cmd.pullDurationMs);
        break;

      case "splitBug":
        ctx.engine.splitBug(cmd.targetIndex);
        break;

      case "allyBug":
        ctx.engine.allyBug(cmd.targetIndex, cmd.durationMs);
        break;

      case "startEventHorizon":
        ctx.engine.startEventHorizon(cmd.x, cmd.y, cmd.radius, cmd.durationMs);
        break;

      case "triggerKernelPanic":
        ctx.engine.triggerKernelPanicExplosion(cmd.targetIndex, cmd.splashRadius, cmd.damage);
        break;

      case "autoScalerPulse":
        ctx.engine.triggerAutoScalerPulse(cmd.hpThreshold);
        break;

      // ── visual effects ────────────────────────────────────────────────────
      case "spawnEffect":
        applyEffectDescriptor(cmd.descriptor, ctx);
        break;

      default: {
        // Exhaustive check
        const _exhaustive: never = cmd;
        void _exhaustive;
      }
    }
  }

  // Auto screen-shake after any non-empty command batch
  triggerShakeForWeapon(ctx.canvas, ctx.weaponId);
}
