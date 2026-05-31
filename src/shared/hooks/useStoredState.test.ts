import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { STORAGE_KEYS } from "../../constants/storageKeys";
import { parseStoredString } from "@shared/utils/storage";
import { installMockLocalStorage } from "../../test/localStorage";
import { useStoredState } from "./useStoredState";

describe("useStoredState", () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  it("falls back when storage has no value", () => {
    const { result } = renderHook(() =>
      useStoredState(STORAGE_KEYS.deadlineDate, "2026-12-31", {
        parse: parseStoredString,
      }),
    );

    expect(result.current[0]).toBe("2026-12-31");
  });

  it("writes updates to state and storage", () => {
    const localStorageMock = installMockLocalStorage({
      [STORAGE_KEYS.deadlineDate]: "2026-05-01",
    });
    const { result } = renderHook(() =>
      useStoredState(STORAGE_KEYS.deadlineDate, "2026-12-31", {
        parse: parseStoredString,
      }),
    );

    act(() => {
      result.current[1]("2026-06-15");
    });

    expect(result.current[0]).toBe("2026-06-15");
    expect(localStorageMock.storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.deadlineDate,
      "2026-06-15",
    );
    expect(localStorageMock.read(STORAGE_KEYS.deadlineDate)).toBe("2026-06-15");
  });
});