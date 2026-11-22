import { polygonArea } from '../../../core/domain/geometry';
import { floor, furniture, room } from '../../../testing/fixtures';
import { describeScene, sharedSpans, wallPieces } from './scene-description';

const along = (piece: { footprint: readonly { x: number; y: number }[] }): number =>
  Math.abs(piece.footprint[1].x - piece.footprint[0].x) + Math.abs(piece.footprint[1].y - piece.footprint[0].y);

describe('3D scene description', () => {
  it('creates one mitered prism for a wall without openings', () => {
    const pieces = wallPieces(room({ width: 400, wallThickness: 10 }), 0);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ elevation: 0, height: 250, kind: 'wall' });
    expect(polygonArea(pieces[0].footprint)).toBeCloseTo(4100);
  });

  it('splits walls around a window into solid, sill, lintel and glass', () => {
    const r = room({
      width: 400,
      height: 250,
      wallThickness: 10,
      openings: [{ id: 'w', kind: 'window', wall: 0, offset: 100, width: 100, height: 120, sillHeight: 90 }],
    });
    const pieces = wallPieces(r, 0);
    expect(pieces.filter((p) => p.kind === 'glass')).toHaveLength(1);
    const inOpening = pieces.filter((p) => p.kind === 'wall' && p.height < 250);
    expect(inOpening.map((p) => [p.elevation, p.height])).toEqual([
      [0, 90],
      [210, 40],
    ]);
  });

  it('leaves a full-height gap for doors that reach the ceiling', () => {
    const r = room({
      depth: 300,
      height: 200,
      openings: [{ id: 'd', kind: 'door', wall: 3, offset: 50, width: 90, height: 200, sillHeight: 0 }],
    });
    const pieces = wallPieces(r, 3);
    expect(pieces).toHaveLength(2);
    expect(pieces.reduce((sum, p) => sum + along(p), 0)).toBe(210);
  });

  it('detects shared walls and builds only half of their thickness per room', () => {
    const a = room({ id: 'a', x: 0, y: 0, width: 400, depth: 300, wallThickness: 12 });
    const b = room({ id: 'b', x: 412, y: 0, width: 300, depth: 300, wallThickness: 12 });
    const spans = sharedSpans(a, 1, [a, b]);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ from: 0, to: 300, gap: 12 });
    const piece = wallPieces(a, 1, [a, b])[0];
    const xs = piece.footprint.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(406);
  });

  it('cuts doors of the neighbour through the shared wall', () => {
    const a = room({ id: 'a', x: 0, y: 0, width: 400, depth: 300, wallThickness: 12 });
    const b = room({
      id: 'b',
      x: 412,
      y: 0,
      width: 300,
      depth: 300,
      wallThickness: 12,
      // Wall 3 of b (west) runs bottom → top; offset 100 → y from 200 down to 110.
      openings: [{ id: 'd', kind: 'door', wall: 3, offset: 100, width: 90, height: 250, sillHeight: 0 }],
    });
    const pieces = wallPieces(a, 1, [a, b]);
    const covered = pieces.reduce((sum, p) => sum + along(p), 0);
    expect(covered).toBeCloseTo(300 - 90);
  });

  it('describes furniture models, floors and ceilings', () => {
    const scene = describeScene(
      floor({ rooms: [room()], furniture: [furniture({ id: 'f', elevation: 20, catalogId: 'bed-double' })] }),
    );
    const bed = scene.furniture.find((item) => item.id === 'f');
    expect(bed?.elevation).toBe(20);
    expect(bed?.parts.length).toBeGreaterThan(8);
    expect(scene.surfaces.map((surface) => surface.kind)).toEqual(['floor', 'ceiling']);
  });
});
