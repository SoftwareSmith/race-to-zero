import type { ReactNode, CSSProperties } from "react";
import { cn } from "@shared/utils/cn";

function MetricInfoCard({
  icon,
  label,
  subLabel,
  value,
  progressClassName,
  progressGlow,
  progressStyle,
  iconClassName,
  iconStyle,
  isHighlighted = false,
  valueClassName,
  valueAccentClass,
  className,
}: {
  icon?: ReactNode;
  label: string;
  subLabel?: string;
  value: number;
  progressClassName: string;
  progressGlow?: string;
  progressStyle?: CSSProperties;
  iconClassName?: string;
  iconStyle?: CSSProperties;
  isHighlighted?: boolean;
  valueClassName?: string;
  valueAccentClass?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-white/10 bg-black/20 px-4 py-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.22)] backdrop-blur-[1px]",
        isHighlighted
          ? "border-emerald-400/20 ring-1 ring-emerald-400/18 shadow-[0_14px_34px_rgba(0,0,0,0.22),0_0_26px_rgba(16,185,129,0.1)]"
          : "",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {icon ? (
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.03] shadow-[0_6px_14px_rgba(0,0,0,0.18)]",
                    iconClassName,
                  )}
                  style={iconStyle}
                >
                  {icon}
                </div>
              ) : null}

              <span className="min-w-0 truncate text-[0.92rem] font-semibold tracking-[-0.02em] text-white">
                {label}
              </span>
            </div>

            <span
              className={cn(
                // base pill layout & shadow
                "inline-flex items-center rounded-full px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] shadow-[0_6px_18px_rgba(0,0,0,0.18)]",
                // if no explicit variant/value class provided, fall back to subtle white pill
                valueClassName
                  ? valueClassName
                  : valueAccentClass
                    ? undefined
                    : "border border-white/10 bg-white/[0.06] text-white",
                // allow variant accent to fully tint the pill
                valueAccentClass,
              )}
            >
              {Math.round(value)}%
            </span>
          </div>

          <div
            aria-hidden={!subLabel}
            className={cn(
              "mb-2 text-[0.68rem] font-semibold capitalize tracking-[0.16em]",
              subLabel ? "text-stone-400" : "text-transparent",
            )}
          >
            {subLabel ?? "\u00A0"}
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-black/30 shadow-[inset_0_1px_0_rgba(0,0,0,0.6)]">
            <div
              className={cn(
                "relative h-full rounded-full transition-all duration-300 ease-out overflow-hidden",
                progressClassName,
              )}
              style={{
                width: `${value}%`,
                willChange: "width, boxShadow",
                ...(progressStyle ?? {}),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetricInfoCard;
