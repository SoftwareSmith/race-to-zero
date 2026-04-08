import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/bugSprite", () => ({
  drawBugSprite: vi.fn(),
}));

import { drawBugSprite } from "../utils/bugSprite";
import { BugEntity } from "./BugEntity";
import BUG_CODEX, {
  getCodex,
  loadCodexFromStorage,
  setCodex,
  type BugType,
} from "./bugCodex";
import { DEFAULT_GAME_CONFIG } from "./types";

function cloneCodex(source: Record<string, BugType>) {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      {
        ...value,
        profile: {
          ...value.profile,
          anchorDriftInterval: [...value.profile.anchorDriftInterval] as [number, number],
          regionWeights: { ...value.profile.regionWeights },
        },
      },
    ]),
  ) as Record<string, BugType>;
}

describe("bug codex", () => {
  beforeEach(() => {
    let storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => {
          storage = new Map<string, string>();
        },
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      } satisfies Pick<Storage, "clear" | "getItem" | "removeItem" | "setItem">,
    });
    window.localStorage.clear();
    setCodex(cloneCodex(BUG_CODEX));
    vi.clearAllMocks();
  });

  it("persists saved codex changes to local storage", () => {
    const nextCodex = cloneCodex(getCodex());
    nextCodex.low.color = "#12abef";
    nextCodex.low.size = 1.6;

    setCodex(nextCodex);
    loadCodexFromStorage();

    expect(getCodex().low.color).toBe("#12abef");
    expect(getCodex().low.size).toBe(1.6);
    expect(
      JSON.parse(window.localStorage.getItem("race-to-zero:bug-codex") ?? "{}")
        .low.color,
    ).toBe("#12abef");
  });

  it("applies saved codex updates to existing bug entities", () => {
    const bug = new BugEntity({ size: 10, variant: "low", x: 32, y: 48 });
    bug.revive(180, 120);

    const nextCodex = cloneCodex(getCodex());
    nextCodex.low.color = "#ff5500";
    nextCodex.low.size = 1.8;
    nextCodex.low.socialAffinity = -0.4;
    setCodex(nextCodex);

    bug.update(1 / 60, {
      bounds: { width: 180, height: 120 },
      config: DEFAULT_GAME_CONFIG,
      getNeighbors: () => [],
    });
    bug.render({} as CanvasRenderingContext2D, 1);

    expect(drawBugSprite).toHaveBeenCalled();
    const [, payload] = vi.mocked(drawBugSprite).mock.calls.at(-1) ?? [];
    expect(payload?.color).toBe("#ff5500");
    expect(payload?.size).toBeCloseTo(18);
  });
});
