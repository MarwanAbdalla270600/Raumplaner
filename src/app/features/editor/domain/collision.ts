import {
  Aabb,
  aabbIntersects,
  aabbToPolygon,
  convexPolygonsIntersect,
  intervalsOverlap,
  Polygon,
} from '../../../core/domain/geometry';
import { EntityId } from '../../../core/domain/id';
import { furnitureBounds, furnitureFootprint, furnitureTop } from '../../project/domain/furniture-geometry';
import { Floor, FurnitureItem } from '../../project/domain/model';
import { wallRects } from '../../project/domain/room-geometry';

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

/** Does the item overlap one of the given wall rectangles? */
export function collidesWithWalls(item: FurnitureItem, walls: readonly Aabb[]): boolean {
  if (!isSolid(item)) {
    return false;
  }
  const box = furnitureBounds(item);
  const footprint = furnitureFootprint(item);
  return walls.some((wall) => aabbIntersects(box, wall) && convexPolygonsIntersect(footprint, aabbToPolygon(wall)));
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

  const walls = floor.rooms.flatMap(wallRects).map((wall) => ({ wall, polygon: aabbToPolygon(wall) }));
  const wallHits = new Set<EntityId>();
  for (const shape of shapes) {
    const hitsWall = walls.some(
      ({ wall, polygon }) => aabbIntersects(shape.bounds, wall) && convexPolygonsIntersect(shape.footprint, polygon),
    );
    if (hitsWall) {
      wallHits.add(shape.item.id);
      colliding.add(shape.item.id);
    }
  }
  return { colliding, pairs, wallHits };
}
