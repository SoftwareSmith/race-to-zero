import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WeaponProgressSnapshot } from "@game/types";
import SiegeHud from "./SiegeHud";

const weaponSnapshots: WeaponProgressSnapshot[] = [
  {
    cooldownMs: 0,
    current: true,
    currentTierStartKills: 0,
    detail: "Heavy impact",
    hint: "Primary tool",
    id: "hammer",
    inputMode: "click",
    killsToNextTier: 10,
    locked: false,
    matchupSummary: [],
    maxTier: 3,
    nextTierGoalKills: 10,
    progressText: "0 / 10",
    tier: 1,
    title: "Hammer",
    typeHint: "Click",
    typeLabel: "Impact",
    unlockKills: 0,
    weaponKills: 0,
  },
];

function renderHud(overrides: Partial<Parameters<typeof SiegeHud>[0]> = {}) {
  return render(
    <SiegeHud
      gameMode="outbreak"
      interactiveKills={0}
      interactivePoints={0}
      interactiveRemainingBugs={12}
      killStreak={0}
      onExit={vi.fn()}
      onSelectWeapon={vi.fn()}
      selectedWeaponId="hammer"
      streakMultiplier={1}
      survivalStatus={{
        activeBugLimit: 40,
        focusLabel: "Bug rush",
        pressurePercent: 0,
        remainingSpawnBudget: 12,
        runtimeSpeedMultiplier: 1,
        secondsUntilNextWave: 18,
        secondsUntilOffline: null,
        siteIntegrity: 100,
        spawnRatePerSecond: 1.2,
        tacticLabel: "Opening wave",
        wave: 1,
        waveDurationMs: 30000,
        waveEndsAt: 30000,
        waveProgressPercent: 10,
        waveStartedAt: 0,
      }}
      weaponSnapshots={weaponSnapshots}
      {...overrides}
    />,
  );
}

describe("SiegeHud", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("clears survival wave toast immediately when switching out of outbreak", () => {
    vi.useFakeTimers();
    const { rerender } = renderHud();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("siege-wave-toast")).toBeInTheDocument();

    rerender(
      <SiegeHud
        gameMode="purge"
        interactiveKills={0}
        interactivePoints={0}
        interactiveRemainingBugs={12}
        killStreak={0}
        onExit={vi.fn()}
        onSelectWeapon={vi.fn()}
        selectedWeaponId="hammer"
        streakMultiplier={1}
        weaponSnapshots={weaponSnapshots}
      />,
    );

    expect(screen.queryByTestId("siege-wave-toast")).toBeNull();
  });
});
