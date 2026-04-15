import { getCodex } from "@game/engine/bugCodex";
import { drawBugSprite } from "@game/utils/bugSprite";
import { drawHealthBar, HEALTHBAR_SHOW_DURATION } from "@game/utils/healthbar";
import type {
  BugVariant,
  ChartFocusState,
  MotionProfile,
} from "../../../../types/dashboard";
import type { RenderedBugPosition } from "./types";

const BUG_CODEX = getCodex();
const AMBIENT_STRESS_DRAW_THRESHOLD = 1500;
const AMBIENT_STRESS_TARGET_SPRITES = 1200;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface DrawBugFramePassOptions {
  chartFocus: ChartFocusState | null;
  context: CanvasRenderingContext2D;
  frameNow: number;
  height: number;
  interactiveMode: boolean;
  motionProfile: MotionProfile;
  particles: Array<any>;
  qaEnabled?: boolean;
  sizeMultiplier: number;
  width: number;
}

export function drawBugFramePass({
  chartFocus,
  context,
  frameNow,
  height: _height,
  interactiveMode,
  motionProfile,
  particles,
  qaEnabled = false,
  sizeMultiplier,
  width,
}: DrawBugFramePassOptions): RenderedBugPosition[] {
  void _height;
  const focusX = chartFocus?.relativeIndex ?? 0.5;
  const nextBugPositions: RenderedBugPosition[] = [];
  const useSparseAmbientDraw =
    !interactiveMode &&
    !qaEnabled &&
    particles.length > AMBIENT_STRESS_DRAW_THRESHOLD;
  const drawStride = useSparseAmbientDraw
    ? Math.max(1, Math.ceil(particles.length / AMBIENT_STRESS_TARGET_SPRITES))
    : 1;
  const drawOffset = useSparseAmbientDraw
    ? Math.floor(frameNow / 32) % drawStride
    : 0;

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    const bugCodex = BUG_CODEX[particle.variant as BugVariant];
    const normalizedX = particle.x / Math.max(1, width);
    const focusDistance = Math.abs(normalizedX - focusX);
    const focusFalloff = chartFocus ? Math.max(0, 1 - focusDistance * 3.1) : 0;
    const x = particle.x;
    const y = particle.y;
    const opacity = clampNumber(
      (particle.opacity ?? 1) * motionProfile.opacityMultiplier,
      0.06,
      1,
    );
    const size =
      particle.size *
      motionProfile.scale *
      sizeMultiplier *
      (bugCodex?.size ?? 1) *
      (chartFocus ? 0.92 + focusFalloff * 0.26 : 1);
    const velX = particle.vx ?? particle.driftX ?? 1;
    const velY = particle.vy ?? particle.driftY ?? 0;
    const rotation =
      typeof particle.heading === "number"
        ? particle.heading
        : Math.atan2(velY, velX);

    nextBugPositions.push({
      index,
      radius: Math.max(size * 0.7, 12),
      x,
      y,
    });

    if (useSparseAmbientDraw && index % drawStride !== drawOffset) {
      continue;
    }

    drawBugSprite(context, {
      color: bugCodex?.color,
      opacity,
      rotation,
      size,
      variant: particle.variant,
      x,
      y,
    });

    const lastHitTime: number = particle.lastHitTime ?? 0;
    const bugMaxHp: number = particle.maxHp ?? 1;
    const bugHp: number = particle.hp ?? 1;
    if (lastHitTime > 0 && bugMaxHp > 1 && bugHp < bugMaxHp) {
      const elapsed = frameNow - lastHitTime;
      if (elapsed < HEALTHBAR_SHOW_DURATION) {
        drawHealthBar(context, x, y, bugHp, bugMaxHp, size, elapsed);
      }
    }
  }

  return nextBugPositions;
}