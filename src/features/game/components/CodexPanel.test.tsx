import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CodexPanel from "./CodexPanel";

describe("CodexPanel", () => {
  it("switches to weapon view, opens a weapon detail, and closes", () => {
    const onMenuToggle = vi.fn();
    const containerRef = { current: null };

    render(
      <CodexPanel
        containerRef={containerRef}
        onMenuToggle={onMenuToggle}
        open
      />,
    );

    expect(screen.getByTestId("codex-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Weapons" }));
    expect(screen.getByTestId("codex-weapon-card-hammer")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("codex-weapon-card-hammer"));
    expect(screen.getByTestId("codex-weapon-detail-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("codex-weapon-card-hammer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });
});
