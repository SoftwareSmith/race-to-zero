import { useCallback, useEffect, useRef, useState } from "react";
import { WeaponTier } from "@game/types";
import { triggerNamedShake } from "@game/utils/screenShake";

export function useWeaponCursorState(interactiveMode: boolean) {
  const hammerPositionRef = useRef({ x: 0, y: 0 });
  const [hammerSwing, setHammerSwing] = useState(false);

  const setCursorPosition = useCallback((x: number, y: number) => {
    hammerPositionRef.current = { x, y };
  }, []);

  const triggerHammerSwing = useCallback((tier?: WeaponTier) => {
    setHammerSwing(true);

    if (tier === WeaponTier.TIER_THREE) {
      const root = document.querySelector<HTMLElement>("[data-background-field-root='true']");
      if (root) {
        triggerNamedShake(root, "hammer-overdrive");
      }
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cursor-none", interactiveMode);

    return () => {
      document.body.classList.remove("cursor-none");
    };
  }, [interactiveMode, setCursorPosition]);

  useEffect(() => {
    if (!interactiveMode) {
      hammerPositionRef.current = { x: 0, y: 0 };
      return undefined;
    }

    const handlePointerMove = (event: globalThis.MouseEvent) => {
      setCursorPosition(event.clientX, event.clientY);
    };

    window.addEventListener("mousemove", handlePointerMove);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, [interactiveMode, setCursorPosition]);

  useEffect(() => {
    if (!hammerSwing) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setHammerSwing(false);
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hammerSwing]);

  return {
    hammerPositionRef,
    hammerSwing,
    setCursorPosition,
    triggerHammerSwing,
  };
}