import type { ChangeEventHandler, KeyboardEvent } from "react";
import { useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formattedValue = useMemo(() => {
    if (!value) {
      return "";
    }

    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return format(parsed, "dd/MM/yyyy");
  }, [value]);

  const openPicker = () => {
    if (disabled) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  const handleContainerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openPicker();
  };

  return (
    <button
      aria-label={`${label} date`}
      className={cn(
        "inline-flex h-8 min-w-[102px] select-none items-center rounded-full border border-white/6 bg-white/[0.03] px-3 text-sm shadow-[0_8px_18px_rgba(0,0,0,0.1)] transition duration-200 backdrop-blur-xl",
        disabled
          ? "cursor-default opacity-38"
          : "cursor-pointer hover:border-white/10 hover:bg-white/[0.04]",
      )}
      disabled={disabled}
      onClick={openPicker}
      onKeyDown={handleContainerKeyDown}
      type="button"
    >
      <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <span className="ml-2 whitespace-nowrap text-[0.76rem] font-medium text-stone-100">
        {formattedValue}
      </span>
      <svg
        aria-hidden="true"
        className="ml-1 h-3.5 w-3.5 shrink-0 text-stone-500"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <rect x="3" y="4" width="18" height="18" rx="3" ry="3" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <input
        ref={inputRef}
        className="compact-date-field__input sr-only"
        disabled={disabled}
        max={bounds.max}
        min={bounds.min}
        onChange={onChange}
        type="date"
        value={value}
      />
    </button>
  );
}
