import {
  Aabb,
  aabbFromPoints,
  aabbIntersects,
  convexPolygonsIntersect,
  intervalsOverlap,
  Polygon,
  polygonArea,
} from '../../../core/domain/geometry';
import { EntityId } from '../../../core/domain/id';
import { furnitureBounds, furnitureFootprint, furnitureTop } from '../../project/domain/furniture-geometry';
import { Floor, FurnitureItem } from '../../project/domain/model';
import { wallPolygons } from '../../project/domain/room-geometry';

/** Items flatter than this (rugs, mats) never collide. */
export const FLAT_ITEM_MAX_HEIGHT = 2;

export interface CollisionReport {
  /** Furniture overlapping other furniture or a wall. */
  readonly colliding: ReadonlySet<EntityId>;
  readonly pairs: readonly (readonly [EntityId, EntityId])[];
  readonly wallHits: ReadonlySet<EntityId>;
}

const isSolid = (item: FurnitureItem): boolean => item.height > FLAT_ITEM_MAX_HEIGHT;

export function verticallyOverlap(a: FurnitureItem, b: FurnitureItem): boolean {
  return intervalsOverlap(a.elevation, furnitureTop(a), b.elevation, furnitureTop(b));
}

export function furnitureCollide(a: FurnitureItem, b: FurnitureItem): boolean {
  return (
    isSolid(a) &&
    isSolid(b) &&
    verticallyOverlap(a, b) &&
    aabbIntersects(furnitureBounds(a), furnitureBounds(b)) &&
    convexPolygonsIntersect(furnitureFootprint(a), furnitureFootprint(b))
  );
}

/** A wall section as convex polygon together with its bounding box (pre-filter). */
export interface WallShape {
  readonly polygon: Polygon;
  readonly bounds: Aabb;
}

export function floorWallShapes(floor: Floor): WallShape[] {
  return floor.rooms.flatMap(wallPolygons).map((polygon) => ({ polygon, bounds: aabbFromPoints(polygon) }));
}

/**
 * Bounding boxes of the axis-aligned walls (used for snapping and clearance lines, where a box
 * is a good approximation; diagonal walls would produce misleading boxes and are skipped).
 */
export function axisAlignedWallBounds(floor: Floor): Aabb[] {
  const ratio = 0.95;
  return floorWallShapes(floor)
    .filter(({ polygon, bounds }) => {
      const boxArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
      // Walls without thickness are lines; horizontal/vertical ones have an empty box area.
      const isLine = bounds.maxX === bounds.minX || bounds.maxY === bounds.minY;
      return isLine || (boxArea > 0 && polygonArea(polygon) >= boxArea * ratio);
    })
    .map(({ bounds }) => bounds);
}

/** Does the item overlap one of the given walls? */
export function collidesWithWalls(item: FurnitureItem, walls: readonly WallShape[]): boolean {
  if (!isSolid(item)) {
    return false;
  }
  const box = furnitureBounds(item);
  const footprint = furnitureFootprint(item);
  return walls.some((wall) => aabbIntersects(box, wall.bounds) && convexPolygonsIntersect(footprint, wall.polygon));
}

interface SolidShape {
  readonly item: FurnitureItem;
  readonly bounds: Aabb;
  readonly footprint: Polygon;
}

/** Detects furniture/furniture and furniture/wall overlaps. O(n²) with an AABB pre-filter. */
export function detectCollisions(floor: Floor): CollisionReport {
  // Geometry is computed once per item instead of once per pair.
  const shapes: SolidShape[] = floor.furniture
    .filter(isSolid)
    .map((item) => ({ item, bounds: furnitureBounds(item), footprint: furnitureFootprint(item) }));
  const colliding = new Set<EntityId>();
  const pairs: [EntityId, EntityId][] = [];

  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (
        aabbIntersects(a.bounds, b.bounds) &&
        verticallyOverlap(a.item, b.item) &&
        convexPolygonsIntersect(a.footprint, b.footprint)
      ) {
        colliding.add(a.item.id).add(b.item.id);
        pairs.push([a.item.id, b.item.id]);
      }
    }
  }

  const walls = floorWallShapes(floor);
  const wallHits = new Set<EntityId>();
  for (const shape of shapes) {
    const hitsWall = walls.some(
      (wall) => aabbIntersects(shape.bounds, wall.bounds) && convexPolygonsIntersect(shape.footprint, wall.polygon),
    );
    if (hitsWall) {
      wallHits.add(shape.item.id);
      colliding.add(shape.item.id);
    }
  }
  return { colliding, pairs, wallHits };
}
