import { Aabb, intervalsOverlap } from '../../../core/domain/geometry';

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Free distance from a box edge to the nearest obstacle in one direction. */
export interface Clearance {
  readonly direction: Direction;
  readonly distance: number;
  /** Start and end of the dimension line in world coordinates. */
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
}

/** Obstacles further away than this are ignored (cm). */
export const MAX_CLEARANCE_DISTANCE = 2000;

function gapsTo(box: Aabb, obstacle: Aabb): Partial<Record<Direction, number>> {
  const overlapsVertically = intervalsOverlap(box.minY, box.maxY, obstacle.minY, obstacle.maxY);
  const overlapsHorizontally = intervalsOverlap(box.minX, box.maxX, obstacle.minX, obstacle.maxX);
  const gaps: Partial<Record<Direction, number>> = {};
  if (overlapsVertically && obstacle.maxX <= box.minX) gaps.left = box.minX - obstacle.maxX;
  if (overlapsVertically && obstacle.minX >= box.maxX) gaps.right = obstacle.minX - box.maxX;
  if (overlapsHorizontally && obstacle.maxY <= box.minY) gaps.up = box.minY - obstacle.maxY;
  if (overlapsHorizontally && obstacle.minY >= box.maxY) gaps.down = obstacle.minY - box.maxY;
  return gaps;
}

function dimensionLine(box: Aabb, direction: Direction, distance: number): Clearance {
  const midX = (box.minX + box.maxX) / 2;
  const midY = (box.minY + box.maxY) / 2;
  switch (direction) {
    case 'left':
      return { direction, distance, from: { x: box.minX - distance, y: midY }, to: { x: box.minX, y: midY } };
    case 'right':
      return { direction, distance, from: { x: box.maxX, y: midY }, to: { x: box.maxX + distance, y: midY } };
    case 'up':
      return { direction, distance, from: { x: midX, y: box.minY - distance }, to: { x: midX, y: box.minY } };
    case 'down':
      return { direction, distance, from: { x: midX, y: box.maxY }, to: { x: midX, y: box.maxY + distance } };
  }
}

/** Distances from `box` to the closest obstacle (walls, furniture) in each of the four directions. */
export function computeClearances(box: Aabb, obstacles: readonly Aabb[]): Clearance[] {
  const nearest: Partial<Record<Direction, number>> = {};
  for (const obstacle of obstacles) {
    const gaps = gapsTo(box, obstacle);
    (Object.entries(gaps) as [Direction, number][]).forEach(([direction, gap]) => {
      if (gap <= MAX_CLEARANCE_DISTANCE && gap < (nearest[direction] ?? Infinity)) {
        nearest[direction] = gap;
      }
    });
  }
  return (Object.entries(nearest) as [Direction, number][]).map(([direction, distance]) =>
    dimensionLine(box, direction, distance),
  );
}
