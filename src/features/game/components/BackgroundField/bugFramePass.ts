import { getCodex } from "@game/engine/bugCodex";
import { isTerminalEntityState } from "@game/types";
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

function getStatusStrength(expiresAt: number | undefined, now: number, fullMs: number) {
  if (!expiresAt || now >= expiresAt) {
    return 0;
  }

  return Math.max(0.12, Math.min(1, (expiresAt - now) / fullMs));
}

function getPoisonProjectedHp(particle: any, now: number) {
  const poison = particle.poison;
  if (!poison || now >= poison.expiresAt || poison.dps <= 0) {
    return undefined;
  }

  const remainingSeconds = Math.max(0, poison.expiresAt - now) / 1000;
  const projectedDamage = poison.accumulatedDmg + poison.dps * remainingSeconds;

  return Math.max(0, particle.hp - Math.ceil(projectedDamage));
}

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
  reusablePositions?: RenderedBugPosition[];
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
  reusablePositions,
  sizeMultiplier,
  width,
}: DrawBugFramePassOptions): RenderedBugPosition[] {
  void _height;
  const focusX = chartFocus?.relativeIndex ?? 0.5;
  const nextBugPositions = reusablePositions ?? [];
  let nextBugPositionIndex = 0;
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
    if (isTerminalEntityState(particle.state)) {
      continue;
    }

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

    const nextPosition = nextBugPositions[nextBugPositionIndex] ?? {
      index: 0,
      radius: 0,
      x: 0,
      y: 0,
    };
    nextPosition.index = index;
    nextPosition.radius = Math.max(size * 0.7, 12);
    nextPosition.x = x;
    nextPosition.y = y;
    nextBugPositions[nextBugPositionIndex] = nextPosition;
    nextBugPositionIndex += 1;

    if (useSparseAmbientDraw && index % drawStride !== drawOffset) {
      continue;
    }

    drawBugSprite(context, {
      color: bugCodex?.color,
      opacity,
      rotation,
      size,
      statusFlags: {
        ally: getStatusStrength(particle.ally?.expiresAt, frameNow, 7000),
        burn: getStatusStrength(particle.burn?.expiresAt, frameNow, 2800),
        charged: getStatusStrength(particle.charged?.expiresAt, frameNow, 2400),
        ensnare: getStatusStrength(particle.ensnare?.expiresAt, frameNow, 2200),
        freeze: getStatusStrength(particle.slow?.expiresAt, frameNow, 2200),
        marked: getStatusStrength(particle.marked?.expiresAt, frameNow, 2600),
        poison: getStatusStrength(particle.poison?.expiresAt, frameNow, 3200),
        unstable: getStatusStrength(particle.unstable?.expiresAt, frameNow, 2600),
      },
      timeMs: frameNow,
      variant: particle.variant,
      x,
      y,
    });

    const lastHitTime: number = particle.lastHitTime ?? 0;
    const bugMaxHp: number = particle.maxHp ?? 1;
    const bugHp: number = particle.hp ?? 1;
    const poisonActive = Boolean(
      particle.poison && typeof particle.poison.expiresAt === "number" && frameNow < particle.poison.expiresAt,
    );
    const elapsed = lastHitTime > 0 ? frameNow - lastHitTime : Number.POSITIVE_INFINITY;
    if (
      bugMaxHp > 1 &&
      (poisonActive || (lastHitTime > 0 && bugHp < bugMaxHp && elapsed < HEALTHBAR_SHOW_DURATION))
    ) {
      drawHealthBar(
        context,
        x,
        y,
        bugHp,
        bugMaxHp,
        size,
        poisonActive ? 0 : elapsed,
        {
          persistent: poisonActive,
          projectedHp: getPoisonProjectedHp(particle, frameNow),
        },
      );
    }
  }

  nextBugPositions.length = nextBugPositionIndex;

  return nextBugPositions;
}