import Tooltip from "@shared/components/Tooltip";
import { cn } from "@shared/utils/cn";
import {
  CARD_TONE_STYLES,
  CARD_GLOW_CLASSES,
} from "@shared/styles/toneClasses";
import type { Tone } from "../../../types/dashboard";

interface MetricCardProps {
  className?: string;
  hint?: string;
  label: string;
  siegeMode?: boolean;
  tone?: Tone;
  value: string;
}

function getGlowClassName(tone: Tone) {
  return CARD_GLOW_CLASSES[tone] ?? CARD_GLOW_CLASSES.neutral;
}

function MetricCard({
  className = "",
  hint,
  label,
  siegeMode = false,
  tone = "neutral",
  value,
}: MetricCardProps) {
  void siegeMode;
  const styles = CARD_TONE_STYLES[tone] ?? CARD_TONE_STYLES.neutral;
  const card = (
    <article
      data-siege-panel={label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
      className={cn(
        "group relative flex h-full min-h-[68px] flex-col overflow-hidden rounded-[16px] border px-2.5 py-[0.4375rem] shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.2)] sm:min-h-[76px] sm:rounded-[18px] sm:py-2",
        styles.card,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px] opacity-0 transition duration-200 group-hover:opacity-100">
        <div className="absolute inset-x-4 top-3 h-12 rounded-full bg-white/8 blur-2xl" />
        <div
          className={cn(
            "absolute inset-x-6 bottom-1 h-10 rounded-full blur-2xl",
            getGlowClassName(tone),
          )}
        />
      </div>
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition duration-200 group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            "text-[0.48rem] font-semibold uppercase tracking-[0.16em] sm:text-[0.52rem]",
            styles.eyebrow,
          )}
        >
          {label}
        </span>
      </div>
      <strong
        className={cn(
          "relative mt-1.5 flex-1 font-display text-[1.22rem] leading-none tracking-[-0.045em] sm:mt-2 sm:text-[1.62rem]",
          styles.value,
        )}
      >
        {value}
      </strong>
    </article>
  );

  if (!hint) {
    return card;
  }

  return (
    <Tooltip content={hint} triggerClassName="block h-full">
      {card}
    </Tooltip>
  );
}

export default MetricCard;
