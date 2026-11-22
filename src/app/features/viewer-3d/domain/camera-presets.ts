import { Aabb, aabbCenter, aabbHeight, aabbWidth } from '../../../core/domain/geometry';
import { Room } from '../../project/domain/model';
import { roomInnerBounds } from '../../project/domain/room-geometry';

export type CameraPresetId = 'top' | 'perspective' | 'room';
export const CAMERA_PRESETS: readonly CameraPresetId[] = ['top', 'perspective', 'room'];

/** 3D point in plan units: x/z on the floor plane (z = plan y), y is up. */
export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CameraPose {
  readonly position: Point3;
  readonly target: Point3;
}

const EYE_HEIGHT_CM = 160;
const TOP_VIEW_DISTANCE_FACTOR = 1.25;
const PERSPECTIVE_HEIGHT_FACTOR = 1.3;
const PERSPECTIVE_SIDE_FACTOR = 0.35;
const PERSPECTIVE_FRONT_FACTOR = 0.7;
/** Tiny offset avoids a degenerate look-at for a perfectly vertical camera. */
const TOP_VIEW_EPSILON = 0.01;
const ROOM_VIEW_INSET_RATIO = 0.1;

export function cameraPose(preset: CameraPresetId, bounds: Aabb, room: Room | null): CameraPose {
  const center = aabbCenter(bounds);
  const extent = Math.max(aabbWidth(bounds), aabbHeight(bounds));
  switch (preset) {
    case 'top':
      return {
        position: { x: center.x, y: extent * TOP_VIEW_DISTANCE_FACTOR, z: center.y + TOP_VIEW_EPSILON },
        target: { x: center.x, y: 0, z: center.y },
      };
    case 'perspective':
      return {
        position: {
          x: bounds.maxX + extent * PERSPECTIVE_SIDE_FACTOR,
          y: extent * PERSPECTIVE_HEIGHT_FACTOR,
          z: bounds.maxY + extent * PERSPECTIVE_FRONT_FACTOR,
        },
        target: { x: center.x, y: 0, z: center.y },
      };
    case 'room': {
      const box = room ? roomInnerBounds(room) : bounds;
      const r = { x: box.minX, y: box.minY, width: aabbWidth(box), depth: aabbHeight(box) };
      return {
        position: { x: r.x + r.width / 2, y: EYE_HEIGHT_CM, z: r.y + r.depth * (1 - ROOM_VIEW_INSET_RATIO) },
        target: { x: r.x + r.width / 2, y: EYE_HEIGHT_CM * 0.75, z: r.y },
      };
    }
  }
}
