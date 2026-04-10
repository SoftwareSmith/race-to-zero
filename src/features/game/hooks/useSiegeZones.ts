import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { SiegeZoneRect } from "./types";

interface UseSiegeZonesOptions {
  active: boolean;
  deps?: Array<unknown>;
  rootRef: RefObject<HTMLElement | null>;
}

function readZones(root: HTMLElement): SiegeZoneRect[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-siege-panel]")).map(
    (element, index) => {
      const rect = element.getBoundingClientRect();
      return {
        height: rect.height,
        id: element.dataset.siegePanel || `panel-${index}`,
        left: rect.left,
        top: rect.top,
        width: rect.width,
      };
    },
  );
}

export function useSiegeZones({
  active,
  deps = [],
  rootRef,
}: UseSiegeZonesOptions) {
  const [zones, setZones] = useState<SiegeZoneRect[]>([]);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!active || !rootRef.current) {
      return undefined;
    }

    const root = rootRef.current;

    const measure = () => {
      setZones(readZones(root));
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(root);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, depsKey, rootRef]);

  return active ? zones : [];
}