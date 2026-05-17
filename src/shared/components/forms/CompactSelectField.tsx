import type { ChangeEventHandler } from "react";
import { cn } from "@shared/utils/cn";

interface CompactSelectOption {
  label: string;
  value: string;
}

interface CompactSelectFieldProps {
  label: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  options: CompactSelectOption[];
  size?: "default" | "compact";
  value: string;
}

export default function CompactSelectField({
  label,
  onChange,
  options,
  size = "default",
  value,
}: CompactSelectFieldProps) {
  return (
    <label
      className={cn(
        size === "compact"
          ? "inline-flex h-7 min-w-[112px] cursor-pointer select-none items-center rounded-full border border-white/6 bg-white/[0.03] px-2.5 text-[0.78rem] shadow-[0_6px_14px_rgba(0,0,0,0.1)] transition duration-200 backdrop-blur-xl hover:border-white/10 hover:bg-white/[0.04]"
          : "inline-flex h-8 min-w-[124px] cursor-pointer select-none items-center rounded-full border border-white/6 bg-white/[0.03] px-3 text-sm shadow-[0_8px_18px_rgba(0,0,0,0.1)] transition duration-200 backdrop-blur-xl hover:border-white/10 hover:bg-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "shrink-0 font-semibold uppercase text-stone-500",
          size === "compact"
            ? "text-[0.54rem] tracking-[0.14em]"
            : "text-[0.62rem] tracking-[0.16em]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "ml-2 min-w-0 whitespace-nowrap font-medium text-stone-100",
          size === "compact" ? "text-[0.68rem]" : "text-[0.76rem]",
        )}
      >
        <select
          aria-label={`${label} filter`}
          className={cn(
            "max-w-[7rem] appearance-none bg-transparent focus:outline-none",
            size === "compact" ? "text-[0.68rem]" : "text-[0.76rem]",
          )}
          onChange={onChange}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      <svg
        aria-hidden="true"
        className={cn(
          "ml-1 shrink-0 text-stone-500",
          size === "compact" ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}