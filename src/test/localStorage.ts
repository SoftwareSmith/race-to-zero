import { vi } from "vitest";

export function installMockLocalStorage(
  initialValues: Record<string, string> = {},
) {
  const entries = new Map(Object.entries(initialValues));
  const storage = {
    clear: vi.fn(() => {
      entries.clear();
    }),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
  } satisfies Pick<Storage, "clear" | "getItem" | "removeItem" | "setItem">;

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });

  return {
    entries,
    read: (key: string) => entries.get(key) ?? null,
    storage,
  };
}