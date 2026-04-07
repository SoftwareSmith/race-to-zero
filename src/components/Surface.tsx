import type { ElementType, ReactNode } from "react";
import { cn } from "../utils/cn";

const TONE_STYLES = {
  default:
    "border-white/10 bg-zinc-950/74 text-stone-100 shadow-[0_22px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl",
  subtle:
    "border-white/8 bg-zinc-950/52 text-stone-100 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl",
  strong:
    "border-white/12 bg-zinc-950/94 text-stone-50 shadow-[0_28px_70px_rgba(0,0,0,0.42)]",
  positive:
    "border-emerald-500/30 bg-emerald-950/22 text-emerald-50 shadow-[0_18px_48px_rgba(16,185,129,0.14)]",
  negative:
    "border-red-500/30 bg-red-950/22 text-red-50 shadow-[0_18px_48px_rgba(239,68,68,0.14)]",
  neutral:
    "border-sky-500/28 bg-sky-950/16 text-sky-50 shadow-[0_18px_48px_rgba(56,189,248,0.12)]",
};

type SurfaceTone = keyof typeof TONE_STYLES;

interface SurfaceProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
}

function Surface({
  as: Component = "section",
  children,
  className = "",
  tone = "default",
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        "rounded-[28px] border",
        TONE_STYLES[tone] ?? TONE_STYLES.default,
        className,
      )}
    >
      {children}
    </Component>
  );
}

export default Surface;
