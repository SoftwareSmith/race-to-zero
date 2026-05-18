let vfxEngineModulePromise: Promise<
  typeof import("../engine/VfxEngine")
> | null = null;

export function preloadVfxEngine() {
  vfxEngineModulePromise ??= import("../engine/VfxEngine");
  return vfxEngineModulePromise;
}