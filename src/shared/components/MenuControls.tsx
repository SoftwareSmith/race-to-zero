import type { ReactNode } from "react";
import Tooltip from "@shared/components/Tooltip";

interface MenuIconButtonProps {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
  open?: boolean;
  size?: "default" | "compact";
  tooltip: string;
}

export function MenuIconButton({
  ariaLabel,
  children,
  onClick,
  open = false,
  size = "default",
  tooltip,
}: MenuIconButtonProps) {
  const button = (
    <button
      aria-label={ariaLabel}
      className={
        size === "compact"
          ? "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[14px] border border-white/10 bg-zinc-950/86 px-2.5 text-stone-300 shadow-[0_8px_18px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
          : "inline-flex min-h-12 min-w-12 items-center justify-center rounded-[16px] border border-white/10 bg-zinc-950/86 px-3 text-stone-300 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-900 hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );

  if (open) {
    return button;
  }

  return <Tooltip content={tooltip}>{button}</Tooltip>;
}

interface MenuPanelProps {
  children: ReactNode;
  size?: "default" | "compact";
  title: string;
}

export function MenuPanel({ children, title, size = "default" }: MenuPanelProps) {
  return (
    <div
      className={
        size === "compact"
          ? "absolute right-0 top-[calc(100%+8px)] z-[260] grid w-[288px] gap-2.5 rounded-[18px] border border-white/10 bg-zinc-950/96 p-3.5 text-[0.82rem] text-stone-200 shadow-[0_20px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl"
          : "absolute right-0 top-[calc(100%+10px)] z-[260] grid w-[320px] gap-3 rounded-[20px] border border-white/10 bg-zinc-950/96 p-4 text-sm text-stone-200 shadow-[0_24px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl"
      }
    >
      <span
        className={
          size === "compact"
            ? "text-[0.82rem] font-medium text-stone-300"
            : "text-sm font-medium text-stone-300"
        }
      >
        {title}
      </span>
      {children}
    </div>
  );
}

interface ToggleFieldProps {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
  size?: "default" | "compact";
}

export function ToggleField({
  checked,
  description,
  label,
  onChange,
  size = "default",
}: ToggleFieldProps) {
  return (
    <label
      className={
        size === "compact"
          ? "flex cursor-pointer items-start justify-between gap-3 rounded-[14px] border border-white/6 bg-white/[0.03] px-2.5 py-2.5"
          : "flex cursor-pointer items-start justify-between gap-4 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3"
      }
    >
      <span className="min-w-0">
        <span
          className={
            size === "compact"
              ? "block text-[0.82rem] font-semibold text-stone-100"
              : "block text-sm font-semibold text-stone-100"
          }
        >
          {label}
        </span>
        <span
          className={
            size === "compact"
              ? "mt-[0.1875rem] block text-[0.68rem] leading-[1rem] text-stone-400"
              : "mt-1 block text-xs leading-5 text-stone-400"
          }
        >
          {description}
        </span>
      </span>
      <span
        className={
          size === "compact"
            ? "relative mt-0.5 inline-flex h-[1.375rem] w-10 shrink-0 items-center"
            : "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center"
        }
      >
        <input
          checked={checked}
          className="peer sr-only"
          onChange={onChange}
          type="checkbox"
        />
        <span className="absolute inset-0 rounded-full border border-white/10 bg-zinc-900 transition peer-checked:border-sky-400/30 peer-checked:bg-sky-400/18" />
        <span
          className={
            size === "compact"
              ? "absolute left-1 h-3.5 w-3.5 rounded-full bg-stone-300 transition peer-checked:translate-x-[1.125rem] peer-checked:bg-sky-100"
              : "absolute left-1 h-4 w-4 rounded-full bg-stone-300 transition peer-checked:translate-x-5 peer-checked:bg-sky-100"
          }
        />
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
