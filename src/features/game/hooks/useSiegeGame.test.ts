import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  afterEach(() => {
    vi.useRealTimers();
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
    expect(result.current.survivalStatus.waveDurationMs).toBe(30_000);
    expect(result.current.survivalStatus.waveProgressPercent).toBe(0);
    expect(result.current.survivalStatus.remainingSpawnBudget).toBeGreaterThanOrEqual(0);
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
      result.current.syncRemainingBugs(0);
    });

    await waitFor(() => {
      expect(result.current.completionSummary).not.toBeNull();
    });

    expect(result.current.interactiveRemainingBugs).toBe(0);
    expect(result.current.leaderboard).toHaveLength(1);
    expect(result.current.completionSummary?.topWeaponLabel).toBe("Hammer");
    expect(result.current.completionSummary?.outcome).toBe("timeAttackCleared");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.siegeRunLeaderboardsV2,
      expect.any(String),
    );
  });

  it("finalizes after kill-all is triggered before the run reaches active phase", async () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 5,
        currentBugCounts: { high: 0, low: 5, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode();
    });

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("entering");
    });

    act(() => {
      result.current.killAllBugs();
    });

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("active");
    });

    await waitFor(() => {
      expect(result.current.completionSummary?.outcome).toBe("timeAttackCleared");
    });

    expect(result.current.interactiveRemainingBugs).toBe(0);
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
    expect(result.current.interactiveRemainingBugs).toBe(3);

    act(() => {
      result.current.syncRemainingBugs(2);
    });

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

  it("does not transiently clear the run before the live engine reports zero bugs", async () => {
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
    });

    expect(result.current.interactiveKills).toBe(3);
    expect(result.current.interactiveRemainingBugs).toBe(3);
    expect(result.current.completionSummary).toBeNull();

    act(() => {
      result.current.syncRemainingBugs(1);
    });

    expect(result.current.interactiveRemainingBugs).toBe(1);
    expect(result.current.completionSummary).toBeNull();

    act(() => {
      result.current.syncRemainingBugs(0);
    });

    await waitFor(() => {
      expect(result.current.completionSummary?.outcome).toBe("timeAttackCleared");
    });
  });

  it("rolls survival waves forward when the timer expires", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode("outbreak");
      vi.advanceTimersByTime(520);
    });

    expect(result.current.siegePhase).toBe("active");

    act(() => {
      vi.advanceTimersByTime(30_500);
    });

    expect(result.current.survivalStatus.wave).toBe(2);

    expect(result.current.survivalStatus.secondsUntilNextWave).toBeGreaterThan(0);
  });

  it("updates survival wave loader progress while spawning from the wave budget", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode("outbreak");
      vi.advanceTimersByTime(520);
    });

    const initialBudget = result.current.survivalStatus.remainingSpawnBudget;

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(result.current.survivalStatus.waveProgressPercent).toBeGreaterThan(0);
    expect(result.current.survivalStatus.remainingSpawnBudget).toBeLessThanOrEqual(initialBudget);
  });

  it("keeps the survival wave loader advancing after a wave transition", async () => {
    vi.useFakeTimers();
    const qaWindow = window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        setSurvivalState?: (state: { completeWave?: boolean }) => void;
      };
    };
    qaWindow.__RTZ_QA__ = { enabled: true };

    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode("outbreak");
      vi.advanceTimersByTime(520);
    });

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(qaWindow.__RTZ_QA__?.setSurvivalState).toEqual(expect.any(Function));

    act(() => {
      qaWindow.__RTZ_QA__?.setSurvivalState?.({ completeWave: true });
    });

    expect(result.current.survivalStatus.wave).toBe(2);

    const progressAtWaveStart = result.current.survivalStatus.waveProgressPercent;

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(result.current.survivalStatus.waveProgressPercent).toBeGreaterThan(
      progressAtWaveStart,
    );

    delete qaWindow.__RTZ_QA__;
  });

  it("chips survival integrity down under sustained heavy pressure before overload", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 20,
        currentBugCounts: { high: 0, low: 20, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    act(() => {
      result.current.enterInteractiveMode("outbreak");
      vi.advanceTimersByTime(520);
      result.current.syncRemainingBugs(280);
    });

    const startingIntegrity = result.current.survivalStatus.siteIntegrity;

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(result.current.survivalStatus.siteIntegrity).toBeLessThan(startingIntegrity);
    expect(result.current.survivalStatus.secondsUntilOffline).toBeGreaterThan(0);
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

  it("finalizes Time Attack on the last credited hit when one live bug remains", async () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 1,
        currentBugCounts: { high: 0, low: 1, medium: 0, urgent: 0 },
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
    });

    await waitFor(() => {
      expect(result.current.completionSummary?.outcome).toBe("timeAttackCleared");
    });

    expect(result.current.interactiveRemainingBugs).toBe(0);
  });

  it("trusts active zero-bug sync even before the first kill", async () => {
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
      result.current.syncRemainingBugs(0);
    });

    await waitFor(() => {
      expect(result.current.completionSummary).not.toBeNull();
    });

    expect(result.current.interactiveRemainingBugs).toBe(0);
  });

  it("finalizes Time Attack even if the zero-bug callback comes from a stale pre-active closure", async () => {
    const { result } = renderHook(() =>
      useSiegeGame({
        currentBugCount: 3,
        currentBugCounts: { high: 0, low: 3, medium: 0, urgent: 0 },
        evolutionStates: {},
      }),
    );

    const staleSyncRemainingBugs = result.current.syncRemainingBugs;

    act(() => {
      result.current.enterInteractiveMode();
    });

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("active");
    });

    act(() => {
      staleSyncRemainingBugs(0);
    });

    await waitFor(() => {
      expect(result.current.completionSummary?.outcome).toBe("timeAttackCleared");
    });
  });

  it("creates a survival overrun completion summary when the site goes offline", async () => {
    const qaWindow = window as Window & {
      __RTZ_QA__?: {
        enabled?: boolean;
        setSurvivalState?: (state: { siteIntegrity?: number }) => void;
      };
    };
    qaWindow.__RTZ_QA__ = { enabled: true };

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

    await waitFor(() => {
      expect(result.current.siegePhase).toBe("active");
    });

    await waitFor(() => {
      expect(qaWindow.__RTZ_QA__?.setSurvivalState).toEqual(expect.any(Function));
    });

    act(() => {
      qaWindow.__RTZ_QA__?.setSurvivalState?.({ siteIntegrity: 0 });
    });

    await waitFor(() => {
      expect(result.current.completionSummary?.outcome).toBe("survivalOverrun");
    });

    delete qaWindow.__RTZ_QA__;
  });
});