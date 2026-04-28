import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "../../../constants/storageKeys";
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
      for (let i = 0; i < 18; i += 1) {
        result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
      }
    });

    expect(result.current.combatStats.unlockedWeapons).toContain("nullpointer");
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
    expect(result.current.maxWeaponTier).toBe(5);
    expect(result.current.survivalStatus.tacticLabel).toBe("Opening wave");
    expect(result.current.survivalStatus.focusLabel).toBeTruthy();
  });

  it("starts a clean runtime snapshot when switching modes", () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode("purge");
      for (let i = 0; i < 18; i += 1) {
        result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
      }
    });

    act(() => {
      result.current.selectWeapon("nullpointer");
    });

    expect(result.current.interactiveKills).toBe(18);
    expect(result.current.selectedWeaponId).toBe("nullpointer");

    act(() => {
      result.current.enterInteractiveMode("outbreak");
    });

    expect(result.current.gameMode).toBe("outbreak");
    expect(result.current.completionSummary).toBeNull();
    expect(result.current.interactiveKills).toBe(0);
    expect(result.current.interactivePoints).toBe(0);
    expect(result.current.interactiveRemainingBugs).toBeGreaterThan(0);
    expect(result.current.interactiveRemainingBugs).toBeLessThan(20);
    expect(result.current.killStreak).toBe(0);
    expect(result.current.selectedWeaponId).toBe("hammer");
    expect(result.current.survivalStatus.wave).toBe(1);
  });

  it("freezes the run and stores a leaderboard entry when bugs run out", async () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 1,
        currentBugCounts: { high: 0, low: 1, medium: 0, urgent: 0 },
        evolutionStates: {
          hammer: { kills: 1, tier: 1 },
        },
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
      result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
    });

    await waitFor(() => {
      expect(result.current.completionSummary).not.toBeNull();
    });

    expect(result.current.interactiveRemainingBugs).toBe(0);
    expect(result.current.leaderboard).toHaveLength(1);
    expect(result.current.completionSummary?.topWeaponLabel).toBe("Hammer");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.siegeRunLeaderboardsV2,
      expect.any(String),
    );
  });

  it("does not count uncredited immediate defeats until the actual death event is reported", () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 3,
        currentBugCounts: { high: 0, low: 3, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
      result.current.handleInteractiveHit({
        credited: false,
        defeated: true,
        pointValue: 1,
      });
    });

    expect(result.current.interactiveKills).toBe(0);
    expect(result.current.interactiveRemainingBugs).toBe(3);

    act(() => {
      result.current.handleInteractiveHit({
        credited: true,
        defeated: true,
        pointValue: 1,
      });
    });

    expect(result.current.interactiveKills).toBe(1);
    expect(result.current.interactiveRemainingBugs).toBe(2);
  });

  it("can force-clear the remaining bugs for debug completion checks", async () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 5,
        currentBugCounts: { high: 0, low: 5, medium: 0, urgent: 0 },
        evolutionStates: {
          hammer: { kills: 2, tier: 1 },
        },
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
    });

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("active");
    });

    act(() => {
      result.current.killAllBugs();
    });

    await waitFor(() => {
      expect(result.current.completionSummary).not.toBeNull();
    });

    expect(result.current.interactiveKills).toBe(5);
    expect(result.current.interactivePoints).toBe(5);
    expect(result.current.interactiveRemainingBugs).toBe(0);
    expect(result.current.completionSummary?.bugCount).toBe(5);
  });

  it("syncs the remaining bug counter from the live engine count", () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
      result.current.syncRemainingBugs(17);
    });

    expect(result.current.interactiveRemainingBugs).toBe(17);
  });

  it("advances the timer during an active run", async () => {
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

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("active");
    });

    const elapsedAtStart = result.current.interactiveElapsedMs;

    await waitFor(
      () => {
        expect(result.current.interactiveElapsedMs).toBeGreaterThan(
          elapsedAtStart,
        );
      },
      { timeout: 2000 },
    );
  });

  it("creates a completion summary when the live engine count reaches zero", async () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 3,
        currentBugCounts: { high: 0, low: 3, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
    });

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("active");
    });

    act(() => {
      result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
      result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
      result.current.handleInteractiveHit({ defeated: true, pointValue: 1 });
      result.current.syncRemainingBugs(0);
    });

    await waitFor(() => {
      expect(result.current.completionSummary).not.toBeNull();
    });

    expect(result.current.interactiveRemainingBugs).toBe(0);
  });
});