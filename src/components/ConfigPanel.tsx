import { useCallback, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useStoredState } from "../hooks/useStoredState";
import { parseStoredString, serializeStoredValue } from "../utils/storage";
import type { GameConfig } from "../engine/types";
import { DEFAULT_GAME_CONFIG } from "../engine/types";

interface ConfigPanelProps {
  onChange?: (cfg: GameConfig) => void;
}

export default function ConfigPanel({ onChange }: ConfigPanelProps) {
  const [stored, setStored] = useStoredState<GameConfig>(
    STORAGE_KEYS.gameConfig as any,
    DEFAULT_GAME_CONFIG,
    {
      parse: (raw: string) => {
        try {
          return JSON.parse(raw) as GameConfig;
        } catch {
          return null;
        }
      },
      serialize: (v: GameConfig) => JSON.stringify(v),
    } as any,
  );

  const [open, setOpen] = useState(false);

  const cfg = stored;

  const setField = useCallback(
    <K extends keyof GameConfig>(key: K, value: GameConfig[K]) => {
      setStored((prev) => {
        const next = { ...prev, [key]: value } as GameConfig;
        onChange?.(next);
        return next;
      });
    },
    [onChange, setStored],
  );

  const items = useMemo(
    () => [
      { key: "baseSpeed", min: 8, max: 160, step: 1 },
      { key: "wallAvoidDistance", min: 6, max: 120, step: 1 },
      { key: "wallAvoidStrength", min: 0, max: 2, step: 0.02 },
      { key: "crowdAvoidRadius", min: 8, max: 240, step: 2 },
      { key: "crowdTargetPenalty", min: 0, max: 240, step: 1 },
    ],
    [],
  ) as Array<{ key: keyof GameConfig; min: number; max: number; step: number }>;

  const descriptions: Record<string, string> = {
    baseSpeed:
      "Global movement speed for bugs. Increase to make all bugs move faster.",
    wallAvoidDistance:
      "How far from canvas edges bugs start steering away. Smaller allows closer hugging of walls.",
    wallAvoidStrength:
      "How strongly bugs steer away from walls when within the avoid distance. Higher values repel more quickly.",
    crowdAvoidRadius:
      "Radius used to sample local crowding; larger values make bugs avoid larger groups.",
    crowdTargetPenalty:
      "Penalty applied when scoring potential roam targets in crowded areas. Increase to avoid clusters more aggressively.",
  };

  return (
    <div className="pointer-events-auto fixed right-4 top-16 z-[200]">
      <div className="rounded-xl bg-black/60 p-2 backdrop-blur-md">
        <button
          className="mb-2 inline-flex w-64 items-center justify-between rounded px-3 py-2 text-sm font-medium text-stone-200"
          onClick={() => setOpen((s) => !s)}
          aria-expanded={open}
        >
          <span>Engine config</span>
          <span className="opacity-80 text-xs">{open ? "close" : "edit"}</span>
        </button>
        {open ? (
          <div className="flex w-80 flex-col gap-3">
            {items.map((it) => (
              <div
                key={String(it.key)}
                className="flex flex-col text-xs text-stone-300"
              >
                <div className="mb-1 flex items-center justify-between">
                  <strong className="text-sm text-stone-100">{it.key}</strong>
                  <span className="text-stone-400">
                    {String(cfg[it.key as keyof GameConfig])}
                  </span>
                </div>
                <input
                  aria-label={String(it.key)}
                  type="range"
                  min={it.min}
                  max={it.max}
                  step={it.step}
                  value={Number(cfg[it.key as keyof GameConfig] as any)}
                  onChange={(e) =>
                    setField(it.key, Number(e.target.value) as any)
                  }
                />
                <div className="mt-1 text-[11px] text-stone-400">
                  {descriptions[it.key]}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded bg-white/6 px-3 py-1 text-sm text-stone-100"
                onClick={() => {
                  setStored(DEFAULT_GAME_CONFIG);
                  onChange?.(DEFAULT_GAME_CONFIG);
                }}
              >
                Reset
              </button>
              <button
                className="flex-1 rounded bg-white/8 px-3 py-1 text-sm text-stone-100"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
