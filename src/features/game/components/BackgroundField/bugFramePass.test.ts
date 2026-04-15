import { describe, expect, it, vi } from "vitest";

import { drawBugFramePass } from "./bugFramePass";

vi.mock("@game/utils/bugSprite", () => ({
  drawBugSprite: vi.fn(),
}));

vi.mock("@game/utils/healthbar", () => ({
  HEALTHBAR_SHOW_DURATION: 1200,
  drawHealthBar: vi.fn(),
}));

function createContext() {
  return {
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("drawBugFramePass", () => {
  it("skips terminal bugs so only live bugs remain visible and targetable", () => {
    const positions = drawBugFramePass({
      chartFocus: null,
      context: createContext(),
      frameNow: 0,
      height: 600,
      interactiveMode: true,
      motionProfile: { opacityMultiplier: 1, scale: 1 },
      particles: [
        {
          opacity: 1,
          size: 12,
          state: "alive",
          variant: "low",
          vx: 0,
          vy: 0,
          x: 100,
          y: 100,
        },
        {
          opacity: 0.6,
          size: 10,
          state: "dying",
          variant: "high",
          vx: 0,
          vy: 0,
          x: 140,
          y: 140,
        },
      ],
      qaEnabled: false,
      sizeMultiplier: 1,
      width: 800,
    });

    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ x: 100, y: 100 });
  });
});