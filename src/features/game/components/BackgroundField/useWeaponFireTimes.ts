import { useCallback, useEffect, useState } from "react";
import type { SiegeWeaponId } from "@game/types";

export function useWeaponFireTimes(
  gameSessionKey: string,
  interactiveMode: boolean,
) {
  const [cursorLastFireTimes, setCursorLastFireTimes] = useState<
    Partial<Record<SiegeWeaponId, number>>
  >({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCursorLastFireTimes({});
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameSessionKey, interactiveMode]);

  const recordCursorFire = useCallback(
    (weaponId: SiegeWeaponId, firedAt: number) => {
      setCursorLastFireTimes((previous) => ({
        ...previous,
        [weaponId]: firedAt,
      }));
    },
    [],
  );

  return {
    cursorLastFireTimes,
    recordCursorFire,
  };
}