import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@shared/utils/cn";
import { PANEL_TONE_CLASSES } from "@shared/styles/toneClasses";

const SURFACE_BASE_STYLES = {
  default:
    "border-white/10 bg-zinc-950/74 text-stone-100 shadow-[0_22px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl",
  subtle:
    "border-white/8 bg-zinc-950/52 text-stone-100 shadow-[0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl",
  strong:
    "border-white/12 bg-zinc-950/94 text-stone-50 shadow-[0_28px_70px_rgba(0,0,0,0.42)]",
};

const TONE_STYLES = {
  ...SURFACE_BASE_STYLES,
  ...PANEL_TONE_CLASSES,
} as const;

type SurfaceTone = keyof typeof TONE_STYLES;

interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: keyof HTMLElementTagNameMap;
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
}

function Surface({
  as: Component = "section",
  children,
  className = "",
  tone = "default",
  ...rest
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        "rounded-[28px] border",
        TONE_STYLES[tone] ?? TONE_STYLES.default,
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export default Surface;
