import { useCallback, useEffect, useState } from "react";
import type { SiegeWeaponId } from "@game/types";

export function useWeaponFireTimes(
  gameSessionKey: string,
  interactiveMode: boolean,
) {
  const [cursorLastFireTimes, setCursorLastFireTimes] = useState<
    Partial<Record<SiegeWeaponId, number>>
  >({});
  const [turretLastFireTimes, setTurretLastFireTimes] = useState<
    Record<string, number>
  >({});
  const [teslaLastFireTimes, setTeslaLastFireTimes] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCursorLastFireTimes({});
      setTurretLastFireTimes({});
      setTeslaLastFireTimes({});
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

  const recordTurretFire = useCallback((structureId: string) => {
    setTurretLastFireTimes((previous) => ({
      ...previous,
      [structureId]: performance.now(),
    }));
  }, []);

  const recordTeslaFire = useCallback((structureId: string) => {
    setTeslaLastFireTimes((previous) => ({
      ...previous,
      [structureId]: performance.now(),
    }));
  }, []);

  return {
    cursorLastFireTimes,
    recordCursorFire,
    recordTeslaFire,
    recordTurretFire,
    teslaLastFireTimes,
    turretLastFireTimes,
  };
}