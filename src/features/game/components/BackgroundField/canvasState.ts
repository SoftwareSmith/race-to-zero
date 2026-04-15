import { DEFAULT_GAME_CONFIG } from "@game/engine/types";

export interface CanvasBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface ReseedInfo {
  ts: number;
  clustered: number;
  total: number;
}

export function measureCanvasBounds(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (!width || !height) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();

  return {
    bounds: {
      height,
      left: rect.left,
      top: rect.top,
      width,
    },
    devicePixelRatio: window.devicePixelRatio || 1,
    height,
    width,
  };
}

export function updateLiveCanvasBounds(
  canvas: HTMLCanvasElement,
  fallbackBounds: CanvasBounds,
): CanvasBounds {
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return fallbackBounds;
  }

  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

export function reseedClusteredBugs(
  bugs: Array<any>,
  width: number,
  height: number,
  speedMultiplier: number,
  options?: {
    baseSpeed?: number;
    thresholdRatio?: number;
  },
): ReseedInfo | null {
  const thresholdRatio = options?.thresholdRatio ?? 0.2;
  const clustered = bugs.filter((bug) => bug.x <= 1 && bug.y <= 1).length;
  if (!(clustered > 0 && clustered / Math.max(1, bugs.length) > thresholdRatio)) {
    return null;
  }

  const baseSpeed = options?.baseSpeed ?? DEFAULT_GAME_CONFIG.baseSpeed;

  for (const bug of bugs) {
    bug.x = Math.random() * width;
    bug.y = Math.random() * height;
    const speed =
      baseSpeed * speedMultiplier * (0.75 + Math.random() * 0.35);
    const angle = Math.random() * Math.PI * 2;
    bug.vx = Math.cos(angle) * speed;
    bug.vy = Math.sin(angle) * speed;
    bug.heading = angle;
  }

  return {
    ts: Date.now(),
    clustered,
    total: bugs.length,
  };
}