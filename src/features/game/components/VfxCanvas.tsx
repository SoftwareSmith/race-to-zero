/**
 * VfxCanvas — mounts the Pixi.js WebGL canvas as a transparent overlay.
 *
 * Usage in a parent component:
 *   const vfxRef = useRef<VfxEngine | null>(null);
 *   <VfxCanvas ref={vfxRef} className="..." />
 *
 * The engine is available synchronously after init (the async init is hidden
 * behind an IIFE in the effect). Callers should guard with `vfxRef.current?.`.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { VfxEngine } from "../engine/VfxEngine";

interface Props {
  className?: string;
}

const VfxCanvas = forwardRef<VfxEngine | null, Props>(function VfxCanvas(
  { className },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VfxEngine | null>(null);
  const rafRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);

  // Expose engine instance via ref

  useImperativeHandle(ref, () => engineRef.current as any);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let destroyed = false;

    (async () => {
      const w = wrapper.clientWidth || window.innerWidth;
      const h = wrapper.clientHeight || window.innerHeight;

      const engine = new VfxEngine();
      await engine.init(w, h);

      if (destroyed) {
        engine.destroy();
        return;
      }

      engineRef.current = engine;

      // Mount canvas
      engine.canvas.style.position = "absolute";
      engine.canvas.style.inset = "0";
      engine.canvas.style.pointerEvents = "none";
      wrapper.appendChild(engine.canvas);

      // RAF loop
      const loop = (now: number) => {
        const dt = Math.min(now - prevTimeRef.current, 50); // cap at 50ms
        prevTimeRef.current = now;
        engine.tick(dt);
        rafRef.current = requestAnimationFrame(loop);
      };
      prevTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(loop);

      // Resize observer
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        engine.resize(Math.floor(width), Math.floor(height));
      });
      ro.observe(wrapper);

      // Cleanup stored reference so teardown can stop it
      const cleanup = () => {
        ro.disconnect();
        cancelAnimationFrame(rafRef.current);
        engine.destroy();
        engineRef.current = null;
      };
      (wrapper as HTMLDivElement & { __vfxCleanup?: () => void }).__vfxCleanup =
        cleanup;
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      const cleanup = (
        wrapper as HTMLDivElement & { __vfxCleanup?: () => void }
      ).__vfxCleanup;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 65,
        overflow: "hidden",
        contain: "layout paint",
        isolation: "isolate",
        transform: "translateZ(0)",
      }}
    />
  );
});

export default VfxCanvas;
