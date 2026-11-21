import { Vec2, vec } from '../../../core/domain/geometry';
import { Opening, Room, WallSide } from '../../project/domain/model';

interface WallFrame {
  /** Start of the wall's inner face. */
  readonly origin: Vec2;
  /** Unit vector along the wall. */
  readonly along: Vec2;
  /** Unit vector pointing into the room. */
  readonly inward: Vec2;
}

export function wallFrame(room: Room, side: WallSide): WallFrame {
  switch (side) {
    case 'north':
      return { origin: vec(room.x, room.y), along: vec(1, 0), inward: vec(0, 1) };
    case 'south':
      return { origin: vec(room.x, room.y + room.depth), along: vec(1, 0), inward: vec(0, -1) };
    case 'west':
      return { origin: vec(room.x, room.y), along: vec(0, 1), inward: vec(1, 0) };
    case 'east':
      return { origin: vec(room.x + room.width, room.y), along: vec(0, 1), inward: vec(-1, 0) };
  }
}

const add = (a: Vec2, b: Vec2, factor = 1): Vec2 => vec(a.x + b.x * factor, a.y + b.y * factor);
const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
const point = (p: Vec2): string => `${p.x} ${p.y}`;

/** Plan symbol of a door: leaf plus quarter-circle swing into the room (SVG path data). */
export function doorSymbolPath(room: Room, opening: Opening): string {
  const frame = wallFrame(room, opening.wall);
  const hinge = add(frame.origin, frame.along, opening.offset);
  const leafEnd = add(hinge, frame.inward, opening.width);
  const swingEnd = add(hinge, frame.along, opening.width);
  const sweep = cross(frame.inward, frame.along) > 0 ? 1 : 0;
  return `M ${point(hinge)} L ${point(leafEnd)} A ${opening.width} ${opening.width} 0 0 ${sweep} ${point(swingEnd)}`;
}

/** Plan symbol of a window: a line along the wall centre (SVG path data). */
export function windowSymbolPath(room: Room, opening: Opening): string {
  const frame = wallFrame(room, opening.wall);
  const outward = -room.wallThickness / 2;
  const start = add(add(frame.origin, frame.along, opening.offset), frame.inward, outward);
  const end = add(start, frame.along, opening.width);
  return `M ${point(start)} L ${point(end)}`;
}
