import { describe, expect, it } from "vitest";

import BUG_CODEX from "./bugCodex";
import { getBugSwarmProfile } from "./swarmProfile";

describe("swarm profile", () => {
  it("classifies low-tier skitter bugs as screen swarms", () => {
    const profile = getBugSwarmProfile(BUG_CODEX.low);

    expect(profile.role).toBe("screen-swarm");
    expect(profile.label).toBe("Screen swarm");
    expect(profile.pressure).toBeGreaterThan(50);
  });

  it("classifies stalk behaviors as hunter packs", () => {
    const profile = getBugSwarmProfile(BUG_CODEX.high);

    expect(profile.role).toBe("hunter-pack");
    expect(profile.coordination).toContain("space");
  });
});