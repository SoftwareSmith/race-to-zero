/**
 * Null Pointer — behavior plugin (ClickFireResult)
 *
 * Auto-seeks the highest-HP bug on screen within 500px.
 * Deals 3 direct + 1 splash in 60px radius.
 * VFX fires at the bug's position, not the cursor.
 * SVG overlay traces a line from cursor to target (rocket arc).
 */

import type {
  WeaponContext,
  ClickFireResult,
  WeaponCommand,
} from "@game/weapons/runtime/types";
import { WeaponTier } from "@game/types";
import { canvasToViewport } from "@game/weapons/runtime/targetingHelpers";
import { BASE_TOGGLES } from "./constants";
import {
  canSpreadMarks,
  canTriggerAutoScaler,
  getPriorityTargets,
} from "./helpers";
import {
  createBinaryBurst,
  createImpactExplosion,
  createTargetingOverlay,
} from "./vfx";

export function createSession(ctx: WeaponContext): ClickFireResult {
  const { engine, targetX, targetY, viewportX, viewportY, bounds } = ctx;
  const tier = ctx.tier ?? WeaponTier.TIER_ONE;
  const damage = ctx.config?.damage ?? BASE_TOGGLES.damage;
  const targetCount = ctx.config?.targetCount ?? BASE_TOGGLES.targetCount;
  const splashDamage = ctx.config?.splashDamage ?? BASE_TOGGLES.splashDamage;
  const seekRadius = ctx.config?.seekRadius ?? BASE_TOGGLES.seekRadius;
  const splashRadius = ctx.config?.splashRadius ?? BASE_TOGGLES.splashRadius;
  const markRadius = ctx.config?.markRadius ?? BASE_TOGGLES.markRadius;
  const markDurationMs = ctx.config?.markDurationMs ?? BASE_TOGGLES.markDurationMs;
  const impactRadius = ctx.config?.impactRadius ?? BASE_TOGGLES.impactRadius;
  const reticleRadius = ctx.config?.reticleRadius ?? BASE_TOGGLES.reticleRadius;
  const shockwaveRadius = ctx.config?.shockwaveRadius ?? BASE_TOGGLES.shockwaveRadius;
  const beamWidth = ctx.config?.beamWidth ?? BASE_TOGGLES.beamWidth;
  const beamGlowWidth = ctx.config?.beamGlowWidth ?? BASE_TOGGLES.beamGlowWidth;
  const binaryBurstCount = ctx.config?.binaryBurstCount ?? BASE_TOGGLES.binaryBurstCount;
  const chaosScale = ctx.config?.chaosScale ?? BASE_TOGGLES.chaosScale;
  const executeHpLimit =
    ctx.config?.executeHpLimit ?? BASE_TOGGLES.executeHpLimit;
  const commands: WeaponCommand[] = [];

  const targets = getPriorityTargets(engine, targetX, targetY, seekRadius, targetCount);
  const targetPoints = targets.map(({ bug }) =>
    canvasToViewport(bug.x, bug.y, bounds),
  );

  // Always emit overlay — null pointer is in OVERLAY_EFFECT_WEAPONS
  commands.push(
    createTargetingOverlay(viewportX, viewportY, targetPoints, {
      beamGlowWidth,
      beamWidth,
      chaosScale,
      reticleRadius,
      shockwaveRadius,
    }),
  );

  if (targets.length === 0) {
    return { mode: "once", commands };
  }

  // T3: emit auto-scaler pulse (kills all marked bugs below threshold globally)
  if (canTriggerAutoScaler(tier)) {
    commands.push({ kind: "autoScalerPulse", hpThreshold: executeHpLimit });
  }

  for (const { bug: targetBug, index: targetIdx } of targets) {
    if (canSpreadMarks(tier)) {
      commands.push({ kind: "applyMarked", targetIndex: targetIdx, durationMs: markDurationMs });
      commands.push({
        kind: "markedRadius",
        cx: targetBug.x,
        cy: targetBug.y,
        radius: markRadius,
        durationMs: markDurationMs,
      });
    } else {
      commands.push({ kind: "applyMarked", targetIndex: targetIdx, durationMs: markDurationMs });
    }

    commands.push(createImpactExplosion(targetBug.x, targetBug.y, impactRadius));
    commands.push(createBinaryBurst(targetBug.x, targetBug.y));

    for (let burstIndex = 1; burstIndex < binaryBurstCount; burstIndex += 1) {
      const angle = ((Math.PI * 2) / binaryBurstCount) * burstIndex;
      const offsetDistance = 10 * chaosScale;
      commands.push(
        createBinaryBurst(
          targetBug.x + Math.cos(angle) * offsetDistance,
          targetBug.y + Math.sin(angle) * offsetDistance,
        ),
      );
    }

    commands.push({
      kind: "damage",
      targetIndex: targetIdx,
      amount: damage,
      creditOnDeath: true,
    });

    if ((targetBug.hp ?? 1) <= executeHpLimit) {
      commands.push({
        kind: "damage",
        targetIndex: targetIdx,
        amount: 99,
        creditOnDeath: true,
      });

      if (tier >= WeaponTier.TIER_FIVE) {
        commands.push({
          kind: "triggerKernelPanic",
          targetIndex: targetIdx,
          splashRadius: Math.max(splashRadius, markRadius * 0.8),
          damage: Math.max(2, splashDamage + 1),
        });
      }
    }

    if (tier >= WeaponTier.TIER_FOUR) {
      commands.push({
        kind: "unstableRadius",
        cx: targetBug.x,
        cy: targetBug.y,
        radius: Math.max(splashRadius, markRadius * 0.78),
        durationMs: 2600,
      });
    }

    const splashIndexes = engine
      .radiusHitTest(targetBug.x, targetBug.y, splashRadius)
      .filter((i) => i !== targetIdx);

    for (const idx of splashIndexes) {
      commands.push({
        kind: "damage",
        targetIndex: idx,
        amount: splashDamage,
        creditOnDeath: true,
      });

      if (tier >= WeaponTier.TIER_FIVE) {
        commands.push({
          kind: "applyMarked",
          targetIndex: idx,
          durationMs: Math.max(2400, Math.round(markDurationMs * 0.6)),
        });
      }
    }
  }

  return { mode: "once", commands };
}
