import { useEffect } from "react";

interface UseSiegeGameLifecycleOptions {
  interactiveMode: boolean;
  onEscape: () => void;
  onSelectSlot: (slotIndex: number) => void;
}

export function useSiegeGameLifecycle({
  interactiveMode,
  onEscape,
  onSelectSlot,
}: UseSiegeGameLifecycleOptions) {
  useEffect(() => {
    document.body.classList.toggle("interactive-mode", interactiveMode);

    if (interactiveMode) {
      const previousTabIndex = document.body.getAttribute("tabindex");
      document.body.tabIndex = -1;
      document.body.focus({ preventScroll: true });

      return () => {
        document.body.classList.remove("interactive-mode");
        if (previousTabIndex == null) {
          document.body.removeAttribute("tabindex");
        } else {
          document.body.setAttribute("tabindex", previousTabIndex);
        }
      };
    }

    return () => {
      document.body.classList.remove("interactive-mode");
    };
  }, [interactiveMode]);

  useEffect(() => {
    if (!interactiveMode) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }

      const digit = event.key.match(/^[0-9]$/)?.[0];
      if (!digit) {
        return;
      }

      const slotIndex = digit === "0" ? 9 : parseInt(digit, 10) - 1;
      onSelectSlot(slotIndex);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [interactiveMode, onEscape, onSelectSlot]);
}