import type { BugVariant } from "../../../../types/dashboard";

export interface BugHitPayload {
  defeated: boolean;
  remainingHp: number;
  variant: BugVariant;
  x: number;
  y: number;
  pointValue?: number;
  frozen?: boolean;
  comboEvents?: Array<"detonate" | "quench">;
}

export interface RenderedBugPosition {
  index: number;
  radius: number;
  x: number;
  y: number;
}

export interface GameState {
  remainingTargets: number;
  sessionKey: string;
  splats: Array<{ id: string; variant: BugVariant; x: number; y: number }>;
}

export interface QaWindowState {
  enabled?: boolean;
  bugPositions?: Array<{ index: number; x: number; y: number; radius: number }>;
  lastHit?: {
    defeated: boolean;
    remainingHp: number;
    variant: BugVariant;
    x: number;
    y: number;
  };
}
