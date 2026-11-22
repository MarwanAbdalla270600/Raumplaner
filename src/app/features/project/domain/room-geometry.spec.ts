import { polygonSignedArea, vec } from '../../../core/domain/geometry';
import { room } from '../../../testing/fixtures';
import { Opening } from './model';
import {
  clampOpening,
  insertVertex,
  openingPolygon,
  pointsAttachedToWall,
  removeVertex,
  resizeRoom,
  roomArea,
  roomCenter,
  roomContainsPoint,
  roomOuterBounds,
  roomOuterPolygon,
  wallEdge,
  wallPolygon,
  withClampedOpenings,
  withPoints,
} from './room-geometry';

const door = (overrides: Partial<Opening> = {}): Opening => ({
  id: 'd',
  kind: 'door',
  wall: 2,
  offset: 50,
  width: 90,
  height: 200,
  sillHeight: 0,
  ...overrides,
});

const lShape = [vec(0, 0), vec(200, 0), vec(200, 150), vec(400, 150), vec(400, 300), vec(0, 300)];

describe('room geometry', () => {
  it('derives walls from the outline with outward normals', () => {
    const r = room({ x: 0, y: 0, width: 400, depth: 300, wallThickness: 10 });
    expect(wallEdge(r, 0).length).toBe(400);
    expect(wallEdge(r, 0).normal.y).toBe(-1);
    expect(wallEdge(r, 1).length).toBe(300);
    expect(wallEdge(r, 1).normal.x).toBe(1);
    expect(wallPolygon(r, 0)).toEqual([vec(0, 0), vec(400, 0), vec(410, -10), vec(-10, -10)]);
    expect(roomOuterBounds(r)).toEqual({ minX: -10, minY: -10, maxX: 410, maxY: 310 });
  });

  it('miters the outer outline of concave rooms', () => {
    const r = room({ points: lShape, wallThickness: 10 });
    const outer = roomOuterPolygon(r);
    // Reflex corner (200,150) moves diagonally into the cut-out.
    expect(outer[2].x).toBeCloseTo(210);
    expect(outer[2].y).toBeCloseTo(140);
    expect(roomArea(r)).toBe(400 * 300 - 200 * 150);
  });

  it('places labels and point tests inside concave rooms', () => {
    const r = room({ points: lShape });
    expect(roomContainsPoint(r, roomCenter(r))).toBe(true);
    expect(roomContainsPoint(r, vec(300, 50))).toBe(false);
  });

  it('positions openings along their wall', () => {
    const r = room({ x: 100, y: 0 });
    // Wall 2 (south) runs from right to left.
    expect(openingPolygon(r, door({ offset: 50 }))[0]).toEqual({ x: 450, y: 300 });
  });

  it('keeps openings inside the wall', () => {
    const r = room({ width: 100 });
    expect(clampOpening(r, door({ offset: 80, width: 90 })).offset).toBe(10);
    expect(clampOpening(r, door({ width: 500 })).width).toBe(100);
    expect(clampOpening(r, door({ wall: 9 })).wall).toBe(3);
  });

  it('clamps openings after the room shrinks', () => {
    const shrunk = withClampedOpenings(room({ width: 120, openings: [door({ offset: 100 })] }));
    expect(shrunk.openings[0].offset).toBe(30);
  });

  it('normalises counter-clockwise outlines and keeps openings in place', () => {
    // Counter-clockwise input: wall 0 is the bottom wall, running from x = 0 to 400.
    const r = room({ openings: [door({ wall: 0, offset: 10 })] });
    const reversed = withPoints(r, [...r.points].reverse());
    expect(polygonSignedArea(reversed.points)).toBeGreaterThan(0);
    const edge = wallEdge(reversed, reversed.openings[0].wall);
    const opening = openingPolygon(reversed, reversed.openings[0]);
    expect(edge.normal.y).toBe(1);
    expect(Math.min(opening[0].x, opening[1].x)).toBeCloseTo(10);
    expect(opening[0].y).toBe(300);
  });

  it('inserts and removes corners', () => {
    const r = room({ openings: [door({ wall: 2, offset: 300 })] });
    const inserted = insertVertex(r, 0, vec(200, -50));
    expect(inserted.points).toHaveLength(5);
    expect(inserted.openings[0].wall).toBe(3);
    const removed = removeVertex(inserted, 1);
    expect(removed.points).toEqual(r.points);
    expect(removed.openings[0].wall).toBe(2);
    expect(removeVertex(room({ points: [vec(0, 0), vec(100, 0), vec(0, 100)] }), 0).points).toHaveLength(3);
  });

  it('scales the outline to a new bounding box', () => {
    const resized = resizeRoom(room({ x: 100, y: 50, points: lShape.map((p) => vec(p.x + 100, p.y + 50)) }), 800, 300);
    expect(resized.points[3]).toEqual({ x: 900, y: 200 });
  });

  it('creates a glued neighbour that shares the wall', () => {
    const r = room({ wallThickness: 12 });
    const points = pointsAttachedToWall(r, 1, 250);
    expect(points).toEqual(expect.arrayContaining([vec(412, 0), vec(662, 0), vec(662, 300), vec(412, 300)]));
  });
});
