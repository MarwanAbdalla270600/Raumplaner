import { Vec2, vec } from '../../../core/domain/geometry';

/** Predefined outlines for new rooms. */
export type RoomShape = 'rectangle' | 'l-shape' | 'u-shape' | 't-shape' | 'chamfer';
export const ROOM_SHAPES: readonly RoomShape[] = ['rectangle', 'l-shape', 'u-shape', 't-shape', 'chamfer'];

const round = (value: number): number => Math.round(value);

type Outline = (w: number, d: number) => [number, number][];

const OUTLINES: Readonly<Record<RoomShape, Outline>> = {
  rectangle: (w, d) => [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ],
  'l-shape': (w, d) => {
    const a = round(w * 0.5);
    const b = round(d * 0.5);
    return [
      [0, 0],
      [a, 0],
      [a, b],
      [w, b],
      [w, d],
      [0, d],
    ];
  },
  'u-shape': (w, d) => {
    const a = round(w / 3);
    const b = round(d * 0.5);
    return [
      [0, 0],
      [a, 0],
      [a, b],
      [w - a, b],
      [w - a, 0],
      [w, 0],
      [w, d],
      [0, d],
    ];
  },
  't-shape': (w, d) => {
    const a = round(w / 3);
    const b = round(d * 0.4);
    return [
      [0, 0],
      [w, 0],
      [w, b],
      [w - a, b],
      [w - a, d],
      [a, d],
      [a, b],
      [0, b],
    ];
  },
  chamfer: (w, d) => {
    const c = round(Math.min(w, d) * 0.3);
    return [
      [0, 0],
      [w - c, 0],
      [w, c],
      [w, d],
      [0, d],
    ];
  },
};

/** Outline of a shape with the given bounding box, clockwise from the top-left corner. */
export function shapePoints(shape: RoomShape, width: number, depth: number, x = 0, y = 0): Vec2[] {
  return OUTLINES[shape](width, depth).map(([px, py]) => vec(x + px, y + py));
}
