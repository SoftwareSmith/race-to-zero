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
import { applyEffectDescriptor, triggerNamedScreenShake, triggerShakeForWeapon } from "@game/weapons/effects/adapter";
import { getBugWeaponMatchup, getMatchupFeedbackTone } from "@game/combat/weaponMatchups";
import { WeaponMatchup } from "@game/types";
import type { BugVariant } from "../../../../types/dashboard";

function getVisibleSupportStatus(statuses: string[] | undefined) {
  return statuses?.find((status) => status !== "marked") ?? null;
}

function maybeSpawnImmuneFeedback(ctx: ExecutionContext, targetIndex: number) {
  const bug = ctx.engine.getAllBugs()[targetIndex];
  if (!bug) return true;
  const matchup = getBugWeaponMatchup(bug.variant as BugVariant, ctx.weaponId);
  if (matchup !== WeaponMatchup.Immune) return false;
  (ctx.vfx as any)?.spawnImmune?.(
    Math.round(bug.x + ctx.bounds.left),
    Math.round(bug.y + ctx.bounds.top),
  );
  return true;
}

/** Execute a list of weapon commands against the provided context. */
export function executeCommands(
  commands: WeaponCommand[],
  ctx: ExecutionContext,
): void {
  if (commands.length === 0) return;

  let shouldShake = false;
  let weakShake = false;

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
          const credited = cmd.creditOnDeath ?? true;
          ctx.onHit({
            credited,
            defeated: result.defeated,
            remainingHp: result.remainingHp,
            variant: result.variant,
            x: vx,
            y: vy,
            pointValue: result.pointValue,
            frozen: result.frozen,
          });
          if (result.matchup === WeaponMatchup.Immune) {
            (ctx.vfx as any)?.spawnImmune?.(vx, vy);
          } else if (cmd.amount > 0) {
            shouldShake = true;
            weakShake = weakShake || result.matchup === WeaponMatchup.Risky;
            (ctx.vfx as any)?.spawnHitNumber?.(
              vx,
              vy,
              Math.max(0, cmd.amount),
              getMatchupFeedbackTone(result.matchup),
            );
            for (const comboEvent of result.comboEvents ?? []) {
              (ctx.vfx as any)?.spawnComboBurst?.(vx, vy, comboEvent);
            }
            if (result.defeated && result.finisherStatus) {
              (ctx.vfx as any)?.spawnStatusResolution?.(
                vx,
                vy,
                result.finisherStatus,
                "finisher",
              );
            } else if (result.defeated) {
              const supportStatus = getVisibleSupportStatus(result.supportStatuses);
              if (supportStatus) {
                (ctx.vfx as any)?.spawnStatusResolution?.(
                  vx,
                  vy,
                  supportStatus,
                  "support",
                );
              }
            }
          }
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
        if (maybeSpawnImmuneFeedback(ctx, cmd.targetIndex)) {
          break;
        }
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyPoison === "function") {
          bug.applyPoison(cmd.dps, cmd.durationMs, ctx.weaponId);
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "poison",
          );
          (ctx.vfx as any)?.spawnPoisonBurst?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            22,
          );
        }
        break;
      }

      case "applyBurn": {
        if (maybeSpawnImmuneFeedback(ctx, cmd.targetIndex)) {
          break;
        }
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyBurn === "function") {
          bug.applyBurn(cmd.dps, cmd.durationMs, cmd.decayPerSecond, ctx.weaponId);
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "burn",
          );
        }
        break;
      }

      case "applyFreeze": {
        if (maybeSpawnImmuneFeedback(ctx, cmd.targetIndex)) {
          break;
        }
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyFreeze === "function") {
          bug.applyFreeze(cmd.intensity, cmd.durationMs);
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "freeze",
          );
        }
        break;
      }

      case "applyEnsnare": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyEnsnare === "function") {
          bug.applyEnsnare(cmd.durationMs);
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "ensnare",
          );
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
          ctx.weaponId,
        );
        (ctx.vfx as any)?.spawnPoisonBurst?.(
          Math.round(cmd.cx + ctx.bounds.left),
          Math.round(cmd.cy + ctx.bounds.top),
          Math.max(28, cmd.radius * 0.4),
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
          ctx.weaponId,
        );
        break;

      case "ensnareRadius":
        ctx.engine.applyEnsnareInRadius(
          cmd.cx,
          cmd.cy,
          cmd.radius,
          cmd.durationMs,
          ctx.weaponId,
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
          ctx.weaponId,
        );
        (ctx.vfx as any)?.spawnPoisonBurst?.(
          Math.round(cmd.cx + ctx.bounds.left),
          Math.round(cmd.cy + ctx.bounds.top),
          Math.max(30, cmd.radius * 0.42),
        );
        const engine = ctx.engine;
        const vfx = ctx.vfx as any;
        const viewportCx = Math.round(cmd.cx + ctx.bounds.left);
        const viewportCy = Math.round(cmd.cy + ctx.bounds.top);
        const intId = window.setInterval(() => {
          engine.applyPoisonInRadius(cmd.cx, cmd.cy, cmd.radius, cmd.dps, cmd.durationMs, ctx.weaponId);
          vfx?.spawnPoisonBurst?.(
            viewportCx,
            viewportCy,
            Math.max(26, cmd.radius * 0.34),
          );
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
          ctx.weaponId,
          cmd.eventHorizonRadius,
          cmd.eventHorizonDurationMs,
        );
        if (started) {
          void started;
        }
        break;
      }

      // ── evolution-era status singles ────────────────────────────────────
      case "applyCharged": {
        if (maybeSpawnImmuneFeedback(ctx, cmd.targetIndex)) {
          break;
        }
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyCharged === "function") {
          bug.applyCharged(cmd.durationMs);
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "charged",
          );
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
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "unstable",
          );
        }
        break;
      }

      case "applyLooped": {
        const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
        if (bug && typeof bug.applyLooped === "function") {
          bug.applyLooped(cmd.dps, cmd.durationMs, ctx.weaponId);
          (ctx.vfx as any)?.spawnStatusApply?.(
            Math.round(bug.x + ctx.bounds.left),
            Math.round(bug.y + ctx.bounds.top),
            "looped",
          );
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
        ctx.engine.propagateChargedNetwork(
          cmd.sourceIndex,
          cmd.damage,
          cmd.falloff,
          ctx.weaponId,
        );
        break;

      case "splitBug":
        ctx.engine.splitBug(cmd.targetIndex);
        {
          const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
          if (bug) {
            (ctx.vfx as any)?.spawnSplitCallout?.(
              Math.round(bug.x + ctx.bounds.left),
              Math.round(bug.y + ctx.bounds.top),
            );
          }
        }
        break;

      case "allyBug":
        ctx.engine.allyBug(cmd.targetIndex, cmd.config);
        {
          const bug = ctx.engine.getAllBugs()[cmd.targetIndex] as any;
          if (bug) {
            (ctx.vfx as any)?.spawnStatusApply?.(
              Math.round(bug.x + ctx.bounds.left),
              Math.round(bug.y + ctx.bounds.top),
              "ally",
            );
          }
        }
        break;

      case "startEventHorizon":
        ctx.engine.startEventHorizon(
          cmd.x,
          cmd.y,
          cmd.radius,
          cmd.durationMs,
          ctx.weaponId,
        );
        break;

      case "triggerKernelPanic":
        ctx.engine.triggerKernelPanicExplosion(
          cmd.targetIndex,
          cmd.splashRadius,
          cmd.damage,
          ctx.weaponId,
        );
        break;

      case "autoScalerPulse":
        ctx.engine.triggerAutoScalerPulse(cmd.hpThreshold, ctx.weaponId);
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

  if (shouldShake && weakShake) {
    triggerNamedScreenShake(ctx.canvas, "weak");
  } else if (shouldShake) {
    triggerShakeForWeapon(ctx.canvas, ctx.weaponId);
  }
}
