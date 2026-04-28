import type { ReactNode } from "react";
import { cn } from "@shared/utils/cn";
import { TAG_TONE_CLASSES } from "@shared/styles/toneClasses";

type StatusTone = "positive" | "negative" | "neutral";

interface StatusTagProps {
  children: ReactNode;
  size?: "default" | "compact";
  tone: StatusTone;
}

function StatusTag({ tone, children, size = "default" }: StatusTagProps) {
  return (
    <span
      className={cn(
        size === "compact"
          ? "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em]"
          : "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]",
        TAG_TONE_CLASSES[tone] ?? TAG_TONE_CLASSES.neutral,
      )}
    >
      {children}
    </span>
  );
}

export default StatusTag;
