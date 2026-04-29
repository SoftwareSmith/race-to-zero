import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WaveProgressPill from "./WaveProgressPill";

function renderPill(
  overrides: Partial<Parameters<typeof WaveProgressPill>[0]> = {},
) {
  return render(
    <WaveProgressPill
      activeBugLimit={42}
      focusLabel="Bug rush"
      progressPercent={37}
      remainingSpawnBudget={18}
      secondsUntilNextWave={12}
      spawnRatePerSecond={2.4}
      tacticLabel="Opening wave"
      wave={3}
      {...overrides}
    />,
  );
}

describe("WaveProgressPill", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders wave timing, spawn rate, and fill width", () => {
    renderPill();

    expect(screen.getByTestId("siege-wave-loader-pill")).toHaveTextContent("3");
    expect(screen.getByTestId("siege-wave-loader-pill")).toHaveTextContent(
      "12s",
    );
    expect(screen.getByTestId("siege-wave-loader-pill")).toHaveTextContent(
      "2.4/s",
    );
    expect(screen.getByTestId("siege-wave-loader-fill")).toHaveStyle({
      width: "37%",
    });
  });

  it("clamps fill width and handles missing countdowns", () => {
    renderPill({ progressPercent: 140, secondsUntilNextWave: null });

    expect(screen.getByTestId("siege-wave-loader-pill")).toHaveTextContent(
      "--",
    );
    expect(screen.getByTestId("siege-wave-loader-fill")).toHaveStyle({
      width: "100%",
    });
  });
});
