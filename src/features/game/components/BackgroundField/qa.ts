import type {
  BugHitPayload,
  QaBugTelemetryItem,
  QaDurationMetric,
  QaDurationMetricKey,
  QaPerformanceMetrics,
  QaWindowState,
  RenderedBugPosition,
} from "./types";

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: number;
  };
};

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

function recordDurationMetric(
  metrics: QaPerformanceMetrics,
  key: QaDurationMetricKey,
  durationMs: number,
): void {
  const sampleLimit = metrics.sampleLimit ?? 180;
  const breakdown = metrics.breakdown ?? (metrics.breakdown = {});
  const metric = (breakdown[key] ??= {}) as QaDurationMetric;
  const samplesMs = metric.samplesMs ?? (metric.samplesMs = []);

  if (samplesMs.length < sampleLimit) {
    samplesMs.push(durationMs);
  }

  metric.lastMs = durationMs;
  metric.maxMs = Math.max(metric.maxMs ?? 0, durationMs);
  metric.sampleCount = (metric.sampleCount ?? 0) + 1;
  metric.totalMs = (metric.totalMs ?? 0) + durationMs;
}

function updateQaHeapUsage(metrics: QaPerformanceMetrics): void {
  const heapUsedBytes = (performance as PerformanceWithMemory).memory
    ?.usedJSHeapSize;

  if (typeof heapUsedBytes !== "number" || Number.isNaN(heapUsedBytes)) {
    return;
  }

  metrics.heapUsedBytes = heapUsedBytes;
  metrics.heapPeakBytes = Math.max(metrics.heapPeakBytes ?? 0, heapUsedBytes);
}

export function recordQaDurationSample(
  key: QaDurationMetricKey,
  durationMs: number,
): void {
  const qaState = getQaState();
  const metrics = getQaPerformanceMetrics();
  if (!qaState?.enabled || !metrics) {
    return;
  }

  recordDurationMetric(metrics, key, durationMs);
}

export function recordQaLongTask(durationMs: number): void {
  const qaState = getQaState();
  const metrics = getQaPerformanceMetrics();
  if (!qaState?.enabled || !metrics) {
    return;
  }

  const sampleLimit = metrics.sampleLimit ?? 180;
  const longTaskDurationsMs =
    metrics.longTaskDurationsMs ?? (metrics.longTaskDurationsMs = []);

  if (longTaskDurationsMs.length < sampleLimit) {
    longTaskDurationsMs.push(durationMs);
  }

  metrics.longTaskCount = (metrics.longTaskCount ?? 0) + 1;
  metrics.longTaskTotalMs = (metrics.longTaskTotalMs ?? 0) + durationMs;
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
  updateQaHeapUsage(metrics);
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

  const qaBugPositions = qaState.bugPositions ?? (qaState.bugPositions = []);
  let qaBugPositionIndex = 0;

  for (let index = 0; index < bugPositions.length; index += 1) {
    const position = bugPositions[index];
    const renderedCopies =
      position.renderedCopies && position.renderedCopies.length > 0
        ? position.renderedCopies
        : [{ copyIndex: 0, isWrappedCopy: false, x: position.x, y: position.y }];

    for (let copyIndex = 0; copyIndex < renderedCopies.length; copyIndex += 1) {
      const renderedCopy = renderedCopies[copyIndex];
      const qaPosition = qaBugPositions[qaBugPositionIndex] ?? {
        canonicalX: 0,
        canonicalY: 0,
        copyIndex: 0,
        index: 0,
        isWrappedCopy: false,
        radius: 0,
        x: 0,
        y: 0,
      };

      qaPosition.canonicalX = position.x + bounds.left;
      qaPosition.canonicalY = position.y + bounds.top;
      qaPosition.copyIndex = renderedCopy.copyIndex;
      qaPosition.index = position.index;
      qaPosition.isWrappedCopy = renderedCopy.isWrappedCopy;
      qaPosition.radius = position.radius;
      qaPosition.x = renderedCopy.x + bounds.left;
      qaPosition.y = renderedCopy.y + bounds.top;
      qaBugPositions[qaBugPositionIndex] = qaPosition;
      qaBugPositionIndex += 1;
    }
  }

  qaBugPositions.length = qaBugPositionIndex;
}

export function updateQaBugTelemetry(
  bugTelemetry: QaBugTelemetryItem[],
  bounds: { left: number; top: number },
): void {
  const qaState = getQaState();
  if (!qaState?.enabled) return;

  const qaBugTelemetry = qaState.bugTelemetry ?? (qaState.bugTelemetry = []);

  for (let index = 0; index < bugTelemetry.length; index += 1) {
    const telemetry = bugTelemetry[index];
    const qaTelemetry = qaBugTelemetry[index] ?? {
      crowdCount: 0,
      crowdScore: 0,
      heading: 0,
      index: 0,
      movementMood: null,
      neighborCount: 0,
      radius: 0,
      separationScale: 1,
      targetX: null,
      targetY: null,
      variant: "low",
      vx: 0,
      vy: 0,
      x: 0,
      y: 0,
    };

    qaTelemetry.crowdCount = telemetry.crowdCount;
    qaTelemetry.crowdScore = telemetry.crowdScore;
    qaTelemetry.heading = telemetry.heading;
    qaTelemetry.index = telemetry.index;
    qaTelemetry.movementMood = telemetry.movementMood;
    qaTelemetry.neighborCount = telemetry.neighborCount;
    qaTelemetry.radius = telemetry.radius;
    qaTelemetry.separationScale = telemetry.separationScale;
    qaTelemetry.targetX =
      telemetry.targetX == null ? null : telemetry.targetX + bounds.left;
    qaTelemetry.targetY =
      telemetry.targetY == null ? null : telemetry.targetY + bounds.top;
    qaTelemetry.variant = telemetry.variant;
    qaTelemetry.vx = telemetry.vx;
    qaTelemetry.vy = telemetry.vy;
    qaTelemetry.x = telemetry.x + bounds.left;
    qaTelemetry.y = telemetry.y + bounds.top;
    qaBugTelemetry[index] = qaTelemetry;
  }

  qaBugTelemetry.length = bugTelemetry.length;
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

export function syncQaBugTelemetryFromEngine(
  engine: { getBugTelemetrySnapshot: () => QaBugTelemetryItem[] } | null,
  bounds: { left: number; top: number },
): void {
  if (!engine) return;

  updateQaBugTelemetry(engine.getBugTelemetrySnapshot(), bounds);
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
