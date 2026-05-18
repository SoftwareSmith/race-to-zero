import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SiegeHudControls from "./SiegeHudControls";

function renderControls(
  overrides: Partial<Parameters<typeof SiegeHudControls>[0]> = {},
) {
  const onEndSurvival = vi.fn();

  render(
    <SiegeHudControls
      codexOpen={false}
      debugMode={false}
      gameMode="outbreak"
      onEndSurvival={onEndSurvival}
      onExit={vi.fn()}
      onPointerEnterHud={vi.fn()}
      onPointerLeaveHud={vi.fn()}
      {...overrides}
    />,
  );

  return { onEndSurvival };
}

describe("SiegeHudControls", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the codex control when a codex toggle is available", () => {
    renderControls({ onToggleCodex: vi.fn() });

    expect(
      screen.getByRole("button", { name: "Open codex" }),
    ).toBeInTheDocument();
  });

  it("does not render the removed pause button in Survival", () => {
    renderControls();

    expect(
      screen.queryByRole("button", { name: /pause survival|resume survival/i }),
    ).toBeNull();
  });

  it("renders the survival overrun control in outbreak debug mode", () => {
    const { onEndSurvival } = renderControls({
      debugMode: true,
      onToggleDebugMode: vi.fn(),
    });

    const overrunButton = screen.getByRole("button", {
      name: "Force survival overrun",
    });

    expect(overrunButton).toBeInTheDocument();

    fireEvent.click(overrunButton);

    expect(onEndSurvival).toHaveBeenCalledTimes(1);
  });
});
