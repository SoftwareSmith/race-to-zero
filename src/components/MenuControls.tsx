import type { ReactNode } from "react";
import Tooltip from "./Tooltip";

interface MenuIconButtonProps {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  tooltip: string;
}

export function MenuIconButton({
  ariaLabel,
  children,
  onClick,
  tooltip,
}: MenuIconButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        aria-label={ariaLabel}
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </Tooltip>
  );
}

interface MenuPanelProps {
  children: ReactNode;
  title: string;
}

export function MenuPanel({ children, title }: MenuPanelProps) {
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-30 grid w-[320px] gap-3 rounded-[20px] border border-white/10 bg-zinc-950/96 p-4 text-sm text-stone-200 shadow-[0_24px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <span className="text-sm font-medium text-stone-300">{title}</span>
      {children}
    </div>
  );
}

interface ToggleFieldProps {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}

export function ToggleField({
  checked,
  description,
  label,
  onChange,
}: ToggleFieldProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-100">
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-stone-400">
          {description}
        </span>
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          checked={checked}
          className="peer sr-only"
          onChange={onChange}
          type="checkbox"
        />
        <span className="absolute inset-0 rounded-full border border-white/10 bg-zinc-900 transition peer-checked:border-sky-400/30 peer-checked:bg-sky-400/18" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-stone-300 transition peer-checked:translate-x-5 peer-checked:bg-sky-100" />
      </span>
    </label>
  );
}

interface RangeFieldProps {
  description: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}

export function RangeField({
  description,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: RangeFieldProps) {
  return (
    <label className="grid cursor-pointer gap-2 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-stone-100">
            {label}
          </span>
          <span className="mt-1 block text-xs leading-5 text-stone-400">
            {description}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-stone-300">
          {value.toFixed(1)}x
        </span>
      </div>

      <input
        className="accent-sky-300"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}
