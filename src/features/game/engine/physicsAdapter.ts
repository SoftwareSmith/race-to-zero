export interface PhysicsAdapter {
  dispose?: () => void;
  id: string;
}

export async function createPreferredPhysicsAdapter(
  interactiveMode: boolean,
): Promise<PhysicsAdapter> {
  return {
    id: interactiveMode ? "fallback-interactive" : "fallback-ambient",
  };
}