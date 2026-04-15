import type {
  BugHitPayload,
  QaPerformanceMetrics,
  QaWindowState,
  RenderedBugPosition,
} from "./types";

function getQaState(): QaWindowState | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { __RTZ_QA__?: QaWindowState }).__RTZ_QA__;
}

function getQaPerformanceMetrics(): QaPerformanceMetrics | undefined {
  return getQaState()?.performanceMetrics;
}

export function isQaEnabled(): boolean {
  return Boolean(getQaState()?.enabled);
}

export function recordQaFrameTiming(
  frameDurationMs: number,
  renderedBugCount: number,
): void {
  const qaState = getQaState();
  const metrics = getQaPerformanceMetrics();
  if (!qaState?.enabled || !metrics) {
    return;
  }

  const now = performance.now();
  if (
    metrics.measurementStartAtMs != null &&
    metrics.firstFrameAtMs == null
  ) {
    metrics.firstFrameAtMs = now;
  }

  const sampleLimit = metrics.sampleLimit ?? 180;
  const frameDurationsMs = metrics.frameDurationsMs ?? (metrics.frameDurationsMs = []);
  if (frameDurationsMs.length < sampleLimit) {
    frameDurationsMs.push(frameDurationMs);
  }

  metrics.lastFrameDurationMs = frameDurationMs;
  metrics.lastRenderedBugCount = renderedBugCount;
  metrics.maxFrameDurationMs = Math.max(metrics.maxFrameDurationMs ?? 0, frameDurationMs);
  metrics.maxRenderedBugCount = Math.max(
    metrics.maxRenderedBugCount ?? 0,
    renderedBugCount,
  );
}

export function updateQaBugPositions(
  bugPositions: RenderedBugPosition[],
  bounds: { left: number; top: number },
): void {
  const qaState = getQaState();
  if (!qaState?.enabled) return;

  const metrics = getQaPerformanceMetrics();
  if (
    metrics &&
    bugPositions.length > 0 &&
    metrics.measurementStartAtMs != null &&
    metrics.firstBugPositionsAtMs == null
  ) {
    metrics.firstBugPositionsAtMs = performance.now();
  }

  qaState.bugPositions = bugPositions.map((position) => ({
    index: position.index,
    radius: position.radius,
    x: position.x + bounds.left,
    y: position.y + bounds.top,
  }));
}

export function syncQaBugPositionsFromEngine(
  engine: { getAllBugs: () => Array<any> } | null,
  bounds: { left: number; top: number },
): void {
  if (!engine) return;

  updateQaBugPositions(
    engine.getAllBugs().map((bug, index) => ({
      index,
      radius: Math.max((bug.size ?? 12) * 0.7, 12),
      x: bug.x,
      y: bug.y,
    })),
    bounds,
  );
}

export function updateQaLastHit(payload: BugHitPayload): void {
  const qaState = getQaState();
  if (!qaState?.enabled) return;
  qaState.lastHit = payload;
}

export function stabilizeQaEngine(
  engine: { getAllBugs: () => Array<any> } | null,
  width: number,
  height: number,
): void {
  if (typeof window === "undefined" || !engine) return;
  const qaState = getQaState();
  if (!qaState?.enabled) return;
  if (qaState.stabilizeEngine === false) return;

  const bugs = engine.getAllBugs();
  for (const bug of bugs) {
    bug.x = width * 0.5;
    bug.y = height * 0.5;
    bug.vx = 0;
    bug.vy = 0;
  }
}
