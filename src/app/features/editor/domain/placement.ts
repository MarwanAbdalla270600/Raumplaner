import { Vec2, vec } from '../../../core/domain/geometry';
import { Floor, FurnitureItem } from '../../project/domain/model';
import { wallRects } from '../../project/domain/room-geometry';
import { collidesWithWalls, furnitureCollide } from './collision';

/** Distance between candidate positions when searching for free space (cm). */
export const PLACEMENT_STEP_CM = 20;
/** Number of rings searched around the preferred position. */
export const PLACEMENT_MAX_RINGS = 30;

/** Candidate offsets ordered by distance: ring 0 is the centre, then growing square rings. */
function* ringOffsets(maxRings: number): Generator<Vec2> {
  yield vec(0, 0);
  for (let ring = 1; ring <= maxRings; ring++) {
    const candidates: Vec2[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) candidates.push(vec(dx, dy));
      }
    }
    candidates.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    yield* candidates;
  }
}

/**
 * Finds the position closest to `preferred` where `item` collides neither with existing
 * furniture nor with walls. Falls back to `preferred` when no free spot is found.
 */
export function findFreePosition(floor: Floor, item: FurnitureItem, preferred: Vec2, step = PLACEMENT_STEP_CM): Vec2 {
  const walls = floor.rooms.flatMap(wallRects);
  for (const offset of ringOffsets(PLACEMENT_MAX_RINGS)) {
    const candidate = vec(preferred.x + offset.x * step, preferred.y + offset.y * step);
    const moved = { ...item, x: candidate.x, y: candidate.y };
    if (!collidesWithWalls(moved, walls) && !floor.furniture.some((other) => furnitureCollide(moved, other))) {
      return candidate;
    }
  }
  return preferred;
}
