import { useCallback, useEffect, useRef, useState } from "react";

export function useWeaponCursorState(interactiveMode: boolean) {
  const hammerPositionRef = useRef({ x: 0, y: 0 });
  const [hammerSwing, setHammerSwing] = useState(false);

  const triggerHammerSwing = useCallback(() => {
    setHammerSwing(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cursor-none", interactiveMode);

    return () => {
      document.body.classList.remove("cursor-none");
    };
  }, [interactiveMode]);

  useEffect(() => {
    if (!interactiveMode) {
      hammerPositionRef.current = { x: 0, y: 0 };
      return undefined;
    }

    const handlePointerMove = (event: globalThis.MouseEvent) => {
      hammerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    };

    window.addEventListener("mousemove", handlePointerMove);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
    };
  }, [interactiveMode]);

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
    triggerHammerSwing,
  };
}