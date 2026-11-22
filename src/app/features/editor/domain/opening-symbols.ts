import { addVec, cross, Vec2 } from '../../../core/domain/geometry';
import { Opening, Room } from '../../project/domain/model';
import { wallEdge } from '../../project/domain/room-geometry';

const point = (p: Vec2): string => `${p.x} ${p.y}`;

/** Plan symbol of a door: leaf plus quarter-circle swing into the room (SVG path data). */
export function doorSymbolPath(room: Room, opening: Opening): string {
  const edge = wallEdge(room, opening.wall);
  const inward = { x: -edge.normal.x, y: -edge.normal.y };
  const hinge = addVec(edge.start, edge.direction, opening.offset);
  const leafEnd = addVec(hinge, inward, opening.width);
  const swingEnd = addVec(hinge, edge.direction, opening.width);
  const sweep = cross(inward, edge.direction) > 0 ? 1 : 0;
  return `M ${point(hinge)} L ${point(leafEnd)} A ${opening.width} ${opening.width} 0 0 ${sweep} ${point(swingEnd)}`;
}

/** Plan symbol of a window: a line along the wall centre (SVG path data). */
export function windowSymbolPath(room: Room, opening: Opening): string {
  const edge = wallEdge(room, opening.wall);
  const start = addVec(addVec(edge.start, edge.direction, opening.offset), edge.normal, room.wallThickness / 2);
  const end = addVec(start, edge.direction, opening.width);
  return `M ${point(start)} L ${point(end)}`;
}

/** Plan symbol of an opening; passages have none – they are just a gap in the wall. */
export function openingSymbolPath(room: Room, opening: Opening): string {
  switch (opening.kind) {
    case 'door':
      return doorSymbolPath(room, opening);
    case 'window':
      return windowSymbolPath(room, opening);
    case 'passage':
      return '';
  }
}
