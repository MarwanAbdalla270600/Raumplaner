import { Aabb, aabbFromPoints, Polygon, rectCorners, vec } from '../../../core/domain/geometry';
import { FurnitureItem } from './model';

export function furnitureFootprint(item: FurnitureItem): Polygon {
  return rectCorners(vec(item.x, item.y), item.width, item.depth, item.rotation);
}

export function furnitureBounds(item: FurnitureItem): Aabb {
  return aabbFromPoints(furnitureFootprint(item));
}

export function furnitureTop(item: FurnitureItem): number {
  return item.elevation + item.height;
}

/** Sort by layer, keep insertion order for equal layers. */
export function sortByLayer(items: readonly FurnitureItem[]): FurnitureItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.layer - b.item.layer || a.index - b.index)
    .map(({ item }) => item);
}

export function maxLayer(items: readonly FurnitureItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.layer), 0);
}

export function minLayer(items: readonly FurnitureItem[]): number {
  return items.reduce((min, item) => Math.min(min, item.layer), 0);
}
