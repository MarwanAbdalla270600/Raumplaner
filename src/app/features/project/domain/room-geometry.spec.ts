import { room } from '../../../testing/fixtures';
import { clampOpening, openingRect, roomOuterBounds, wallRect, withClampedOpenings } from './room-geometry';
import { Opening } from './model';

const door = (overrides: Partial<Opening> = {}): Opening => ({
  id: 'd',
  kind: 'door',
  wall: 'south',
  offset: 50,
  width: 90,
  height: 200,
  sillHeight: 0,
  ...overrides,
});

describe('room geometry', () => {
  it('computes wall rectangles around the inner area', () => {
    const r = room({ x: 0, y: 0, width: 400, depth: 300, wallThickness: 10 });
    expect(wallRect(r, 'north')).toEqual({ minX: -10, minY: -10, maxX: 410, maxY: 0 });
    expect(wallRect(r, 'east')).toEqual({ minX: 400, minY: 0, maxX: 410, maxY: 300 });
    expect(roomOuterBounds(r)).toEqual({ minX: -10, minY: -10, maxX: 410, maxY: 310 });
  });

  it('positions openings along their wall', () => {
    const r = room({ x: 100, y: 0 });
    expect(openingRect(r, door({ wall: 'south', offset: 50 }))).toEqual({ minX: 150, minY: 300, maxX: 240, maxY: 310 });
    expect(openingRect(r, door({ wall: 'west', offset: 20 })).minY).toBe(20);
  });

  it('keeps openings inside the wall', () => {
    const r = room({ width: 100 });
    expect(clampOpening(r, door({ offset: 80, width: 90 })).offset).toBe(10);
    expect(clampOpening(r, door({ width: 500 })).width).toBe(100);
  });

  it('clamps openings after the room shrinks', () => {
    const shrunk = withClampedOpenings(room({ width: 120, openings: [door({ offset: 100 })] }));
    expect(shrunk.openings[0].offset).toBe(30);
  });
});
