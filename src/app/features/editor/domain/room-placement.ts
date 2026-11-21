import { Aabb, unionAabb } from '../../../core/domain/geometry';
import { Room } from '../../project/domain/model';
import { roomOuterBounds } from '../../project/domain/room-geometry';

/** Proposes a position for a new room: to the right of the existing rooms, aligned at the top. */
export function nextRoomPosition(rooms: readonly Room[], wallThickness: number, gap = 0): { x: number; y: number } {
  const bounds: Aabb | null = unionAabb(rooms.map(roomOuterBounds));
  if (!bounds) {
    return { x: 0, y: 0 };
  }
  // Rooms share their walls: the new inner area starts one wall thickness after the outer edge.
  return { x: bounds.maxX + gap, y: bounds.minY + wallThickness };
}
