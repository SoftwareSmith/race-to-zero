import type {
  BugHitPayload,
  QaBugTelemetryItem,
  QaDurationMetricKey,
  RenderedBugPosition,
} from "./types";

type QaRuntimeModule = typeof import("./qa");

let qaRuntimeModule: QaRuntimeModule | null = null;
let qaRuntimePromise: Promise<QaRuntimeModule> | null = null;

function loadQaRuntime() {
  qaRuntimePromise ??= import("./qa").then((module) => {
    qaRuntimeModule = module;
    return module;
  });

  return qaRuntimePromise;
}

export function isQaSessionEnabled() {
  return Boolean(
    import.meta.env.DEV ||
      (typeof window !== "undefined" &&
        (window as Window & { __RTZ_QA__?: { enabled?: boolean } }).__RTZ_QA__
          ?.enabled),
  );
}

function withQaRuntime(callback: (module: QaRuntimeModule) => void) {
  if (qaRuntimeModule) {
    callback(qaRuntimeModule);
    return;
  }

  void loadQaRuntime().then(callback);
}

export function preloadQaRuntime() {
  return loadQaRuntime();
}

export function recordQaDurationSample(
  key: QaDurationMetricKey,
  durationMs: number,
): void {
  withQaRuntime((module) => module.recordQaDurationSample(key, durationMs));
}

export function recordQaFrameTiming(
  frameDurationMs: number,
  renderedBugCount: number,
): void {
  withQaRuntime((module) =>
    module.recordQaFrameTiming(frameDurationMs, renderedBugCount),
  );
}

export function updateQaBugPositions(
  bugPositions: RenderedBugPosition[],
  bounds: { left: number; top: number },
): void {
  withQaRuntime((module) => module.updateQaBugPositions(bugPositions, bounds));
}

export function updateQaBugTelemetry(
  bugTelemetry: QaBugTelemetryItem[],
  bounds: { left: number; top: number },
): void {
  withQaRuntime((module) => module.updateQaBugTelemetry(bugTelemetry, bounds));
}

export function syncQaBugPositionsFromEngine(
  engine: { getAllBugs: () => Array<any> } | null,
  bounds: { left: number; top: number },
): void {
  withQaRuntime((module) =>
    module.syncQaBugPositionsFromEngine(engine, bounds),
  );
}

export function syncQaBugTelemetryFromEngine(
  engine: { getBugTelemetrySnapshot: () => QaBugTelemetryItem[] } | null,
  bounds: { left: number; top: number },
): void {
  withQaRuntime((module) =>
    module.syncQaBugTelemetryFromEngine(engine, bounds),
  );
}

export function updateQaLastHit(payload: BugHitPayload): void {
  withQaRuntime((module) => module.updateQaLastHit(payload));
}

export function stabilizeQaEngine(
  engine: { getAllBugs: () => Array<any> } | null,
  width: number,
  height: number,
): void {
  withQaRuntime((module) => module.stabilizeQaEngine(engine, width, height));
}