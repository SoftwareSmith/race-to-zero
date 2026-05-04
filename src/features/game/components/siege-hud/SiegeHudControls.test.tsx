import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SiegeHudControls from "./SiegeHudControls";

function renderControls(
  overrides: Partial<Parameters<typeof SiegeHudControls>[0]> = {},
) {
  const onTogglePause = vi.fn();

  render(
    <SiegeHudControls
      codexOpen={false}
      debugMode={false}
      gameMode="outbreak"
      onExit={vi.fn()}
      onPointerEnterHud={vi.fn()}
      onPointerLeaveHud={vi.fn()}
      onTogglePause={onTogglePause}
      {...overrides}
    />,
  );

  return { onTogglePause };
}

describe("SiegeHudControls", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a Survival pause button next to the codex control", () => {
    const { onTogglePause } = renderControls({ onToggleCodex: vi.fn() });

    const pauseButton = screen.getByRole("button", {
      name: "Pause survival",
    });

    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);

    expect(onTogglePause).toHaveBeenCalledTimes(1);
  });

  it("does not render the pause button outside Survival", () => {
    renderControls({ gameMode: "purge" });

    expect(
      screen.queryByRole("button", { name: /pause survival|resume survival/i }),
    ).toBeNull();
  });

  it("switches the control label to resume while paused", () => {
    renderControls({ manuallyPaused: true });

    expect(
      screen.getByRole("button", { name: "Resume survival" }),
    ).toBeInTheDocument();
  });
});
