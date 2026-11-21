import { normalizeAngle, rotatePoint, roundTo, Vec2, vec } from '../../../core/domain/geometry';
import { FurnitureItem } from '../../project/domain/model';
import { DIMENSION_LIMITS } from '../../project/domain/defaults';
import { snapAngle, snapToGrid } from './snapping';

const RADIANS_TO_DEGREES = 180 / Math.PI;
/** The rotate handle sits "above" the item (negative local y), i.e. at -90° from +x. */
const HANDLE_ANGLE_OFFSET_DEGREES = 90;
export const FREE_ROTATION_SNAP_DEGREES = 15;
const POSITION_DECIMALS = 1;

export function translateFurniture(item: FurnitureItem, delta: Vec2): FurnitureItem {
  return { ...item, x: roundTo(item.x + delta.x, POSITION_DECIMALS), y: roundTo(item.y + delta.y, POSITION_DECIMALS) };
}

export function rotateFurniture(item: FurnitureItem, degrees: number): FurnitureItem {
  return { ...item, rotation: normalizeAngle(item.rotation + degrees) };
}

/** Rotation for the rotate handle being dragged to `pointer`. */
export function rotationTowards(item: FurnitureItem, pointer: Vec2, snapStep: number | null): number {
  const angle = Math.atan2(pointer.y - item.y, pointer.x - item.x) * RADIANS_TO_DEGREES + HANDLE_ANGLE_OFFSET_DEGREES;
  return normalizeAngle(snapStep ? snapAngle(angle, snapStep) : roundTo(angle, 0));
}

const clampLength = (value: number): number =>
  Math.min(DIMENSION_LIMITS.maxLength, Math.max(DIMENSION_LIMITS.minLength, value));

/**
 * Resizes via the bottom-right handle: the opposite (top-left) corner stays fixed in the
 * item's local, rotated frame.
 */
export function resizeFromCorner(item: FurnitureItem, worldDelta: Vec2, gridSize: number | null): FurnitureItem {
  const local = rotatePoint(worldDelta, -item.rotation);
  const rawWidth = item.width + local.x;
  const rawDepth = item.depth + local.y;
  const width = clampLength(gridSize ? snapToGrid(rawWidth, gridSize) || gridSize : rawWidth);
  const depth = clampLength(gridSize ? snapToGrid(rawDepth, gridSize) || gridSize : rawDepth);
  const shift = rotatePoint(vec((width - item.width) / 2, (depth - item.depth) / 2), item.rotation);
  return {
    ...item,
    width: roundTo(width, POSITION_DECIMALS),
    depth: roundTo(depth, POSITION_DECIMALS),
    x: roundTo(item.x + shift.x, POSITION_DECIMALS),
    y: roundTo(item.y + shift.y, POSITION_DECIMALS),
  };
}

/** Scales width, depth and height uniformly around the centre. */
export function scaleFurniture(item: FurnitureItem, factor: number): FurnitureItem {
  return {
    ...item,
    width: clampLength(roundTo(item.width * factor, POSITION_DECIMALS)),
    depth: clampLength(roundTo(item.depth * factor, POSITION_DECIMALS)),
    height: clampLength(roundTo(item.height * factor, POSITION_DECIMALS)),
  };
}
