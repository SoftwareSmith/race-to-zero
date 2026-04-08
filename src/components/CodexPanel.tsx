import type { RefObject } from "react";
import { useCallback, useMemo, useState } from "react";
import { MenuIconButton } from "./MenuControls";
import {
  cloneCodex,
  getCodex,
  loadCodexFromStorage,
  resetCodexToDefaults,
  setCodex,
} from "../engine/bugCodex";
import type { BugType } from "../engine/bugCodex";
import { getColoredSvgUrl } from "../utils/bugSprite";
import { getBugVariantColor } from "../constants/bugs";
import type { BugVariant } from "../types/dashboard";
import { cn } from "../utils/cn";

interface CodexPanelProps {
  containerRef: RefObject<HTMLDivElement | null>;
  onMenuToggle: () => void;
  open: boolean;
}

const BUILTIN_ICON_VARIANTS: BugVariant[] = ["low", "medium", "high", "urgent"];

function getTabIconSrc(entry: BugType, id: string) {
  if (entry.iconUrl) {
    return entry.iconUrl;
  }
  const variant = (entry.iconVariant ?? id) as BugVariant;
  const baseColor = entry.color ?? getBugVariantColor(variant);
  if (BUILTIN_ICON_VARIANTS.includes(variant)) {
    return getColoredSvgUrl(variant, baseColor);
  }

  return getColoredSvgUrl("low", baseColor);
}

export default function CodexPanel({
  containerRef,
  onMenuToggle,
  open,
}: CodexPanelProps) {
  const initial = useMemo(() => {
    loadCodexFromStorage();
    return cloneCodex(getCodex());
  }, []);
  const [codex, setLocalCodex] = useState<Record<string, BugType>>(initial);
  const [activeId, setActiveId] = useState<string>(
    () => Object.keys(initial)[0] ?? "low",
  );

  const entries = useMemo(() => Object.entries(codex), [codex]);
  const activeEntry = activeId ? codex[activeId] : undefined;

  const save = useCallback(() => {
    const nextCodex = cloneCodex(codex);
    setCodex(nextCodex);
    setLocalCodex(nextCodex);
  }, [codex]);

  const reset = useCallback(() => {
    const nextCodex = resetCodexToDefaults();
    setLocalCodex(nextCodex);
    setActiveId((currentValue) => {
      if (currentValue && nextCodex[currentValue]) {
        return currentValue;
      }

      return Object.keys(nextCodex)[0] ?? currentValue;
    });
  }, []);

  const setField = useCallback(
    (id: string, key: keyof BugType, value: unknown) => {
      setLocalCodex((prev) => ({
        ...prev,
        [id]: { ...prev[id], [key]: value },
      }));
    },
    [],
  );

  const updateProfile = useCallback(
    (id: string, patch: Partial<BugType["profile"]>) => {
      setLocalCodex((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          profile: { ...prev[id].profile, ...patch },
        },
      }));
    },
    [],
  );

  // addType removed per QA; creation of new types is disabled for now

  const handleMenuButtonClick = useCallback(() => {
    if (!open) {
      const nextCodex = cloneCodex(getCodex());
      setLocalCodex(nextCodex);
      setActiveId((currentValue) => {
        if (currentValue && nextCodex[currentValue]) {
          return currentValue;
        }

        return Object.keys(nextCodex)[0] ?? currentValue;
      });
    }

    onMenuToggle();
  }, [onMenuToggle, open]);

  return (
    <div className="relative" ref={containerRef}>
      <MenuIconButton
        ariaLabel="Open bug codex"
        onClick={handleMenuButtonClick}
        tooltip="Open the bug codex and tune each bug type."
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
          viewBox="0 0 24 24"
        >
          <path d="M5.5 5.5A2.5 2.5 0 0 1 8 3h10.5v15.5A2.5 2.5 0 0 0 16 16H5.5Z" />
          <path d="M8 3.5v12.3A2.2 2.2 0 0 0 10.2 18H18" />
          <path d="M10.1 7.2h5.8M10.1 10.4h5.8" />
          <path d="M11 14.6 9 13.5m4.9 1.1 2 1.1M10.4 17.1H8.4m6.2 0h2" />
          <circle
            cx="12.5"
            cy="13.4"
            r="1.2"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </MenuIconButton>

      {open ? (
        <div className="fixed inset-y-6 right-6 z-40 flex w-[min(42rem,calc(100vw-1.5rem))] max-w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex-row">
          <div className="flex max-h-[13rem] w-full shrink-0 flex-col border-b border-white/8 bg-white/[0.03] p-3 sm:max-h-none sm:w-44 sm:border-b-0 sm:border-r">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-stone-500">
                  Bug Codex
                </p>
                <p className="mt-1 text-sm text-stone-300">Type profiles</p>
              </div>
              {/* add disabled */}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {entries.map(([id, entry]) => {
                const isActive = id === activeId;
                return (
                  <button
                    key={id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[18px] border px-3 py-2.5 text-left transition duration-200",
                      isActive
                        ? "border-sky-400/24 bg-sky-400/10 text-sky-50 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.14)]"
                        : "border-white/6 bg-white/[0.03] text-stone-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-stone-100",
                    )}
                    onClick={() => setActiveId(id)}
                    type="button"
                  >
                    <img
                      alt=""
                      className="h-5 w-5 shrink-0 object-contain"
                      src={getTabIconSrc(entry, id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {entry.name}
                      </span>
                      <span className="block truncate text-[0.68rem] uppercase tracking-[0.16em] text-stone-500">
                        {id}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-500">
                  Species Editor
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold text-stone-100">
                  {activeEntry?.name ?? "Bug type"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-white/20 hover:text-stone-100"
                  onClick={onMenuToggle}
                  type="button"
                >
                  Close
                </button>
                <button
                  className="rounded-full border border-red-300/18 bg-red-400/8 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:border-red-300/28 hover:bg-red-400/14"
                  onClick={reset}
                  type="button"
                >
                  Reset
                </button>
                <button
                  className="rounded-full bg-sky-400/14 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
                  onClick={save}
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>

            {activeEntry ? (
              <div className="grid flex-1 gap-5 overflow-y-auto p-5">
                <section className="grid gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] border border-white/10 bg-zinc-900/70">
                      <img
                        alt=""
                        className="h-10 w-10 object-contain"
                        src={getTabIconSrc(activeEntry, activeId)}
                      />
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3">
                      <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Name
                        <input
                          className="w-full min-w-0 rounded-[16px] border border-white/8 bg-zinc-950/70 px-3 py-2 text-sm font-medium normal-case tracking-normal text-stone-100 outline-none transition focus:border-sky-300/40"
                          onChange={(event) =>
                            setField(activeId, "name", event.target.value)
                          }
                          value={activeEntry.name}
                        />
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Description
                        <textarea
                          className="min-h-24 w-full min-w-0 rounded-[16px] border border-white/8 bg-zinc-950/70 px-3 py-2 text-sm normal-case tracking-normal text-stone-200 outline-none transition focus:border-sky-300/40"
                          onChange={(event) =>
                            setField(
                              activeId,
                              "description",
                              event.target.value,
                            )
                          }
                          value={activeEntry.description}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Built-in icon
                      <select
                        className="w-full min-w-0 rounded-[16px] border border-white/8 bg-zinc-950/70 px-3 py-2 text-sm normal-case tracking-normal text-stone-100 outline-none transition focus:border-sky-300/40"
                        onChange={(event) =>
                          setField(
                            activeId,
                            "iconVariant",
                            event.target.value || undefined,
                          )
                        }
                        value={activeEntry.iconVariant ?? ""}
                      >
                        <option value="">Auto</option>
                        {BUILTIN_ICON_VARIANTS.map((variant) => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Custom icon URL
                      <input
                        className="w-full min-w-0 rounded-[16px] border border-white/8 bg-zinc-950/70 px-3 py-2 text-sm normal-case tracking-normal text-stone-100 outline-none transition focus:border-sky-300/40"
                        onChange={(event) =>
                          setField(
                            activeId,
                            "iconUrl",
                            event.target.value || undefined,
                          )
                        }
                        placeholder="https://...svg"
                        value={activeEntry.iconUrl ?? ""}
                      />
                    </label>
                    <div className="mt-2 grid gap-3 sm:col-span-2 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Color
                        <input
                          type="color"
                          value={
                            activeEntry.color ??
                            getBugVariantColor(activeId as BugVariant)
                          }
                          onChange={(ev) =>
                            setField(activeId, "color", ev.target.value)
                          }
                          className="h-10 w-14 rounded"
                        />
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Size
                        <input
                          type="range"
                          min={0.5}
                          max={2}
                          step={0.05}
                          value={activeEntry.size ?? 1}
                          onChange={(ev) =>
                            setField(activeId, "size", Number(ev.target.value))
                          }
                          style={{
                            accentColor:
                              activeEntry.color ??
                              getBugVariantColor(activeId as BugVariant),
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-stone-100">
                      Behavior
                    </h3>
                    <p className="text-[0.68rem] uppercase tracking-[0.16em] text-stone-500">
                      High-level only
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Social affinity
                      <input
                        className="accent-sky-300"
                        max={1}
                        min={-1}
                        onChange={(event) =>
                          setField(
                            activeId,
                            "socialAffinity",
                            Number(event.target.value),
                          )
                        }
                        step={0.05}
                        type="range"
                        value={activeEntry.socialAffinity ?? 0}
                      />
                    </label>
                    <div className="rounded-full border border-white/8 px-3 py-1 text-xs font-semibold text-stone-200">
                      {(activeEntry.socialAffinity ?? 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Habitat
                      <select
                        className="w-full min-w-0 rounded-[16px] border border-white/8 bg-zinc-950/70 px-3 py-2 text-sm normal-case tracking-normal text-stone-100 outline-none transition focus:border-sky-300/40"
                        onChange={(event) =>
                          setField(
                            activeId,
                            "preferredRegion",
                            event.target.value,
                          )
                        }
                        value={activeEntry.preferredRegion}
                      >
                        <option value="edge">near the outer lanes</option>
                        <option value="middle">balanced field</option>
                        <option value="interior">closer to center</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Pace
                      <input
                        type="range"
                        min={0.6}
                        max={1.4}
                        step={0.01}
                        value={activeEntry.profile.speedMultiplier}
                        onChange={(event) =>
                          updateProfile(activeId, {
                            speedMultiplier: Number(event.target.value),
                          })
                        }
                        style={{
                          accentColor:
                            activeEntry.color ??
                            getBugVariantColor(activeId as BugVariant),
                        }}
                      />
                    </label>
                  </div>

                  <p className="text-sm leading-6 text-stone-400">
                    Advanced crawl tuning is hidden for now. The runtime is
                    using a smaller steering model so only the controls that
                    stay stable in-game remain exposed.
                  </p>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
