import type { ChangeEventHandler } from "react";
import { cn } from "@shared/utils/cn";
import { getDateInputBounds } from "@dashboard/utils/dashboard";

interface CompactDateFieldProps {
  disabled?: boolean;
  label: string;
  max?: string;
  min?: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  value: string;
}

export default function CompactDateField({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
}: CompactDateFieldProps) {
  const bounds = getDateInputBounds(min, max);

  return (
    <label
      className={cn(
        "flex h-9 min-w-[128px] items-center gap-2 rounded-full border border-white/6 bg-white/[0.02] px-3 text-sm shadow-[0_8px_18px_rgba(0,0,0,0.1)] transition duration-200 backdrop-blur-xl",
        disabled
          ? "cursor-default opacity-38"
          : "hover:border-white/10 hover:bg-white/[0.04]",
      )}
    >
      <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <input
        className="min-w-0 flex-1 bg-transparent text-[0.82rem] font-medium text-stone-100 outline-none disabled:cursor-default"
        disabled={disabled}
        max={bounds.max}
        min={bounds.min}
        onChange={onChange}
        type="date"
        value={value}
      />
    </label>
  );
}
