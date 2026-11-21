import { Aabb, aabbIntersects } from '../../../core/domain/geometry';
import { EntityId } from '../../../core/domain/id';
import { furnitureBounds } from '../../project/domain/furniture-geometry';
import { FurnitureItem } from '../../project/domain/model';

/** Ids of all furniture whose bounding box intersects the marquee rectangle. */
export function furnitureInMarquee(items: readonly FurnitureItem[], marquee: Aabb): EntityId[] {
  return items.filter((item) => aabbIntersects(furnitureBounds(item), marquee)).map((item) => item.id);
}

/** Shift-click semantics: toggles membership when additive, otherwise replaces the selection. */
export function toggleSelection(
  current: ReadonlySet<EntityId>,
  id: EntityId,
  additive: boolean,
): ReadonlySet<EntityId> {
  if (!additive) {
    return new Set([id]);
  }
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}
