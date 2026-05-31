import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearBugCanvasQaBindings,
  ensureBugCanvasQaBindings,
} from "./bugCanvasEngineSetup";
import type { QaWindowState, RenderedBugPosition } from "./types";

declare global {
  interface Window {
    __RTZ_QA__?: QaWindowState & { __bugCanvasBindingOwner?: object };
  }
}

function createEngineStub() {
  return {
    clearAllBugs: vi.fn(() => 0),
    getAllBugs: vi.fn(() => []),
  } as any;
}

describe("ensureBugCanvasQaBindings", () => {
  afterEach(() => {
    clearBugCanvasQaBindings();
    delete window.__RTZ_QA__;
  });

  it("installs bindings for enabled QA sessions", () => {
    window.__RTZ_QA__ = { enabled: true };

    const qaBindingOwnerRef = { current: null as object | null };
    const latestBugPositionsRef = { current: [] as RenderedBugPosition[] };
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 320 });
    Object.defineProperty(canvas, "clientHeight", { value: 180 });

    ensureBugCanvasQaBindings({
      bounds: { height: 180, left: 0, top: 0, width: 320 },
      canvas,
      engine: createEngineStub(),
      latestBugPositionsRef,
      qaBindingOwnerRef,
    });

    expect(qaBindingOwnerRef.current).not.toBeNull();
    expect(window.__RTZ_QA__?.getLiveBugCount).toBeTypeOf("function");
    expect(window.__RTZ_QA__?.clearLiveBugs).toBeTypeOf("function");
    expect(window.__RTZ_QA__?.repositionLiveBug).toBeTypeOf("function");
  });

  it("does not replace existing QA bindings", () => {
    const existingClear = vi.fn(() => 0);
    const existingCount = vi.fn(() => 2);
    const existingReposition = vi.fn(() => true);
    window.__RTZ_QA__ = {
      clearLiveBugs: existingClear,
      enabled: true,
      getLiveBugCount: existingCount,
      repositionLiveBug: existingReposition,
    };

    const qaBindingOwnerRef = { current: null as object | null };

    ensureBugCanvasQaBindings({
      bounds: { height: 180, left: 0, top: 0, width: 320 },
      canvas: null,
      engine: createEngineStub(),
      latestBugPositionsRef: { current: [] },
      qaBindingOwnerRef,
    });

    expect(qaBindingOwnerRef.current).toBeNull();
    expect(window.__RTZ_QA__?.clearLiveBugs).toBe(existingClear);
    expect(window.__RTZ_QA__?.getLiveBugCount).toBe(existingCount);
    expect(window.__RTZ_QA__?.repositionLiveBug).toBe(existingReposition);
  });
});