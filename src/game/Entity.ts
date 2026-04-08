export interface IEntity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  update: (dt?: number) => void;
}

export type SpawnCounts = Record<string, number>;
