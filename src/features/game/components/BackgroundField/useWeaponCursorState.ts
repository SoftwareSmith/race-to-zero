import { useCallback, useEffect, useRef, useState } from "react";
import { WeaponTier } from "@game/types";
import { triggerNamedShake } from "@game/utils/screenShake";

const SHARED_POINTER_POSITION = { x: 0, y: 0 };

export function useWeaponCursorState(interactiveMode: boolean) {
  const hammerPositionRef = useRef({ ...SHARED_POINTER_POSITION });
  const [hammerSwing, setHammerSwing] = useState(false);

  const setCursorPosition = useCallback((x: number, y: number) => {
    SHARED_POINTER_POSITION.x = x;
    SHARED_POINTER_POSITION.y = y;
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
    const handlePointerMove = (event: globalThis.MouseEvent) => {
      setCursorPosition(event.clientX, event.clientY);
    };

    window.addEventListener("mousemove", handlePointerMove);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, [setCursorPosition]);

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