import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@shared/utils/cn";

const HUD_SHELL_CLASS_NAME =
  "relative overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(6,10,14,0.96),rgba(9,12,16,0.88))] backdrop-blur-2xl";

export function formatElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function HudEventPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-1 text-[0.5rem] font-semibold uppercase tracking-[0.14em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function HudActionButton({
  active = false,
  ariaLabel,
  children,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  ariaLabel?: string;
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "info";
}) {
  const toneClassName = {
    danger: active
      ? "border-red-300/34 bg-red-400/16 text-red-50"
      : "border-red-300/16 bg-black/28 text-red-100/88 hover:border-red-300/28 hover:bg-red-500/[0.12]",
    info: active
      ? "border-cyan-300/34 bg-cyan-400/16 text-cyan-50"
      : "border-cyan-300/16 bg-black/28 text-cyan-100/88 hover:border-cyan-300/28 hover:bg-cyan-500/[0.12]",
    default: active
      ? "border-sky-300/34 bg-sky-400/16 text-sky-50"
      : "border-white/10 bg-black/28 text-stone-200 hover:border-white/18 hover:bg-white/[0.08] hover:text-stone-50",
  }[tone];

  return (
    <button
      aria-label={ariaLabel}
      data-no-hammer
      data-hud-cursor="pointer"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border text-stone-200 !cursor-pointer transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40",
        toneClassName,
      )}
      onClick={onClick}
      type="button"
    >
      <span className="shrink-0">{children}</span>
    </button>
  );
}

export function HudShell({
  children,
  className,
  cursor = "default",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  cursor?: "default" | "pointer";
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-hud-cursor={cursor}
      className={cn(HUD_SHELL_CLASS_NAME, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
