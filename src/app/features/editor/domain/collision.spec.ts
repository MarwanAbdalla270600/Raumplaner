import { floor, furniture, room } from '../../../testing/fixtures';
import { detectCollisions, furnitureCollide } from './collision';

describe('collision detection', () => {
  it('reports overlapping furniture', () => {
    const a = furniture({ id: 'a', x: 100, y: 100 });
    const b = furniture({ id: 'b', x: 150, y: 110 });
    const report = detectCollisions(floor({ furniture: [a, b] }));
    expect([...report.colliding].sort()).toEqual(['a', 'b']);
    expect(report.pairs).toEqual([['a', 'b']]);
  });

  it('does not report furniture that only touches', () => {
    const a = furniture({ id: 'a', x: 100, y: 100 });
    const b = furniture({ id: 'b', x: 200, y: 100 });
    expect(furnitureCollide(a, b)).toBe(false);
  });

  it('allows stacking when height intervals do not overlap', () => {
    const table = furniture({ id: 'table', height: 75 });
    const lamp = furniture({ id: 'lamp', width: 20, depth: 20, height: 40, elevation: 75 });
    expect(furnitureCollide(table, lamp)).toBe(false);
    expect(furnitureCollide(table, { ...lamp, elevation: 60 })).toBe(true);
  });

  it('ignores flat items such as rugs', () => {
    const rug = furniture({ id: 'rug', width: 200, depth: 200, height: 1 });
    const sofa = furniture({ id: 'sofa' });
    expect(furnitureCollide(rug, sofa)).toBe(false);
  });

  it('respects rotation', () => {
    const a = furniture({ id: 'a', x: 0, y: 0, width: 200, depth: 20 });
    const b = furniture({ id: 'b', x: 0, y: 60, width: 200, depth: 20 });
    expect(furnitureCollide(a, b)).toBe(false);
    expect(furnitureCollide(a, { ...b, rotation: 90 })).toBe(true);
  });

  it('reports furniture intersecting walls', () => {
    const r = room({ x: 0, y: 0, width: 400, depth: 300, wallThickness: 10 });
    const inside = furniture({ id: 'inside', x: 200, y: 150 });
    const inWall = furniture({ id: 'wall', x: 30, y: 150 });
    const report = detectCollisions(floor({ rooms: [r], furniture: [inside, inWall] }));
    expect([...report.wallHits]).toEqual(['wall']);
  });
});
