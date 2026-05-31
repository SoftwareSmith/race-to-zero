import { describe, expect, it } from "vitest";

import { createGameConfigKey, sanitizeGameConfig } from "./runtimeSafety";

describe("runtimeSafety", () => {
  it("stabilizes game-config keys from sanitized values", () => {
    const baselineKey = createGameConfigKey({
      baseSpeed: 1.5,
      separationRadius: 18,
    });
    const reorderedKey = createGameConfigKey({
      separationRadius: 18,
      baseSpeed: 1.5,
    });

    expect(reorderedKey).toBe(baselineKey);
  });

  it("fills missing config values from defaults", () => {
    const config = sanitizeGameConfig({ baseSpeed: 2 });

    expect(config.baseSpeed).toBe(2);
    expect(config.separationRadius).toBeGreaterThan(0);
  });
});