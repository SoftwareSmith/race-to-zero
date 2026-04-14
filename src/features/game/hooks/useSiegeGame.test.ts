import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSiegeGame } from "./useSiegeGame";

describe("useSiegeGame", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => "0"),
        setItem: vi.fn(),
      },
    });
  });

  it("does not auto-switch to a newly unlocked weapon", () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
    });

    expect(result.current.gameMode).toBe("purge");
    expect(result.current.selectedWeaponId).toBe("hammer");

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
      }
    });

    expect(result.current.combatStats.unlockedWeapons).toContain("zapper");
    expect(result.current.selectedWeaponId).toBe("hammer");
  });

  it("starts the selected game mode", () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode("outbreak");
    });

    expect(result.current.gameMode).toBe("outbreak");
  });
});