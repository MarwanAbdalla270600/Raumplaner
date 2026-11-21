import { Aabb, Vec2, vec } from '../../../core/domain/geometry';

/** Snap distance in screen pixels; converted to cm using the current zoom. */
export const SNAP_THRESHOLD_PX = 8;

export function snapToGrid(value: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(value / gridSize) * gridSize : value;
}

export interface SnapTargets {
  /** Candidate x coordinates (vertical lines) items may align to. */
  readonly xs: readonly number[];
  /** Candidate y coordinates (horizontal lines). */
  readonly ys: readonly number[];
}

export interface SnapResult {
  readonly delta: Vec2;
  /** Lines that caused snapping (for visual guides). */
  readonly guideX: number | null;
  readonly guideY: number | null;
}

interface AxisSnap {
  readonly correction: number;
  readonly target: number | null;
}

/** Finds the smallest correction that aligns one of `edges` with one of `targets`. */
export function snapAxis(edges: readonly number[], targets: readonly number[], threshold: number): AxisSnap {
  let best: AxisSnap = { correction: 0, target: null };
  let bestDistance = threshold;
  for (const edge of edges) {
    for (const target of targets) {
      const distance = Math.abs(target - edge);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { correction: target - edge, target };
      }
    }
  }
  return best;
}

/**
 * Snaps a moving bounding box: first to object edges (walls, other furniture) and, if no
 * object is close enough, its minimum corner to the grid.
 */
export function snapBounds(bounds: Aabb, targets: SnapTargets, threshold: number, gridSize: number | null): SnapResult {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const x = snapAxis([bounds.minX, centerX, bounds.maxX], targets.xs, threshold);
  const y = snapAxis([bounds.minY, centerY, bounds.maxY], targets.ys, threshold);
  const gridX = gridSize && x.target === null ? snapToGrid(bounds.minX, gridSize) - bounds.minX : x.correction;
  const gridY = gridSize && y.target === null ? snapToGrid(bounds.minY, gridSize) - bounds.minY : y.correction;
  return { delta: vec(gridX, gridY), guideX: x.target, guideY: y.target };
}

export function snapTargetsFromBounds(boxes: readonly Aabb[]): SnapTargets {
  return {
    xs: boxes.flatMap((box) => [box.minX, box.maxX]),
    ys: boxes.flatMap((box) => [box.minY, box.maxY]),
  };
}

export function mergeSnapTargets(...targets: SnapTargets[]): SnapTargets {
  return { xs: targets.flatMap((t) => t.xs), ys: targets.flatMap((t) => t.ys) };
}

/** Snaps an angle to the nearest multiple of `step` degrees. */
export function snapAngle(degrees: number, step: number): number {
  return Math.round(degrees / step) * step;
}
