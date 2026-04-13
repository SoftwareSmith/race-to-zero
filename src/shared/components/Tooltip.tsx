import type { ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOOLTIP_WIDTH = 288;
const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 12;

interface TooltipPosition {
  left: number;
  placement: "bottom" | "top";
  top: number;
}

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  triggerClassName?: string;
}

function Tooltip({
  content,
  children,
  triggerClassName = "inline-flex !cursor-pointer",
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
    placement: "top",
  });

  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current) {
      return undefined;
    }

    function updatePosition() {
      if (!triggerRef.current) {
        return;
      }

      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 56;
      const centeredLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      const clampedLeft = Math.min(
        Math.max(centeredLeft, VIEWPORT_PADDING),
        window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING,
      );
      const topPlacement = rect.top - tooltipHeight - TOOLTIP_GAP;
      const shouldPlaceBelow = topPlacement < VIEWPORT_PADDING;
      const top = shouldPlaceBelow ? rect.bottom + TOOLTIP_GAP : topPlacement;

      setPosition({
        left: clampedLeft,
        placement: shouldPlaceBelow ? "bottom" : "top",
        top,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsVisible(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        aria-describedby={isVisible ? tooltipId : undefined}
        className={triggerClassName}
        onBlur={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </span>

      {isVisible
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              className="pointer-events-none fixed z-[240] w-72 rounded-2xl border border-stone-800 bg-stone-950/98 px-4 py-3 text-left text-sm leading-6 text-stone-100 shadow-[0_20px_45px_rgba(28,25,23,0.3)]"
              role="tooltip"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                transform:
                  position.placement === "top"
                    ? "translateY(-4px)"
                    : "translateY(4px)",
              }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

export default Tooltip;
