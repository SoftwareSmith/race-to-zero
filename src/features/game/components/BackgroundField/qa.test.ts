import { afterEach, describe, expect, it } from "vitest";

import { updateQaBugPositions } from "./qa";
import type { QaWindowState, RenderedBugPosition } from "./types";

declare global {
  interface Window {
    __RTZ_QA__?: QaWindowState & { __bugCanvasBindingOwner?: object };
  }
}

describe("qa bug positions", () => {
  afterEach(() => {
    delete window.__RTZ_QA__;
  });

  it("flattens rendered seam copies into QA-visible bug positions", () => {
    window.__RTZ_QA__ = { enabled: true };

    const bugPositions: RenderedBugPosition[] = [
      {
        index: 7,
        radius: 12,
        renderedCopies: [
          { copyIndex: 0, isWrappedCopy: false, x: 6, y: 80 },
          { copyIndex: 1, isWrappedCopy: true, x: 226, y: 80 },
        ],
        x: 6,
        y: 80,
      },
    ];

    updateQaBugPositions(bugPositions, { left: 10, top: 20 });

    expect(window.__RTZ_QA__?.bugPositions).toEqual([
      expect.objectContaining({
        canonicalX: 16,
        canonicalY: 100,
        copyIndex: 0,
        index: 7,
        isWrappedCopy: false,
        radius: 12,
        x: 16,
        y: 100,
      }),
      expect.objectContaining({
        canonicalX: 16,
        canonicalY: 100,
        copyIndex: 1,
        index: 7,
        isWrappedCopy: true,
        radius: 12,
        x: 236,
        y: 100,
      }),
    ]);
  });
});