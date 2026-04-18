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
  const splashDamage = ctx.config?.splashDamage ?? BASE_TOGGLES.splashDamage;
  const seekRadius = ctx.config?.seekRadius ?? BASE_TOGGLES.seekRadius;
  const splashRadius = ctx.config?.splashRadius ?? BASE_TOGGLES.splashRadius;
  const markRadius = ctx.config?.markRadius ?? BASE_TOGGLES.markRadius;
  const markDurationMs = ctx.config?.markDurationMs ?? BASE_TOGGLES.markDurationMs;
  const executeHpLimit =
    ctx.config?.executeHpLimit ?? BASE_TOGGLES.executeHpLimit;
  const commands: WeaponCommand[] = [];

  const targetIdx = engine.closestTargetIndex(targetX, targetY, seekRadius);
  const targetBug = targetIdx >= 0 ? engine.getAllBugs()[targetIdx] : null;

  const seekTargetVp = targetBug
    ? canvasToViewport(targetBug.x, targetBug.y, bounds)
    : { x: viewportX, y: viewportY };

  // Always emit overlay — null pointer is in OVERLAY_EFFECT_WEAPONS
  commands.push(
    createTargetingOverlay(viewportX, viewportY, seekTargetVp.x, seekTargetVp.y),
  );

  if (targetIdx < 0 || !targetBug) {
    return { mode: "once", commands };
  }

  // T3: emit auto-scaler pulse (kills all marked bugs below threshold globally)
  if (canTriggerAutoScaler(tier)) {
    commands.push({ kind: "autoScalerPulse", hpThreshold: executeHpLimit });
  }

  // T2+: apply marked to bug and nearby bugs
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
    // T1: apply mark to primary target only
    commands.push({ kind: "applyMarked", targetIndex: targetIdx, durationMs: markDurationMs });
  }

  // Pixi: explosion + binary burst at bug position
  commands.push(createImpactExplosion(targetBug.x, targetBug.y));
  commands.push(createBinaryBurst(targetBug.x, targetBug.y));

  // Primary target damage
  commands.push({
    kind: "damage",
    targetIndex: targetIdx,
    amount: damage,
    creditOnDeath: true,
  });

  // Execute if HP is low enough
  if ((targetBug.hp ?? 1) <= executeHpLimit && targetBug.marked) {
    commands.push({
      kind: "damage",
      targetIndex: targetIdx,
      amount: 99,
      creditOnDeath: true,
    });
  }

  // Splash damage on nearby bugs (excluding primary)
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
  }

  return { mode: "once", commands };
}
