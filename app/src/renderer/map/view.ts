export interface Transform {
  k: number;
  x: number;
  y: number;
}
export const sx = (t: Transform, x: number) => x * t.k + t.x;
export const sy = (t: Transform, y: number) => y * t.k + t.y;
