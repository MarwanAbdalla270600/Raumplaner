import { floor, furniture, room } from '../../../testing/fixtures';
import { describeScene, wallPieces } from './scene-description';

describe('3D scene description', () => {
  it('creates one solid piece for a wall without openings', () => {
    const pieces = wallPieces(room({ width: 400, wallThickness: 10 }), 'north');
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({ width: 420, depth: 10, height: 250, elevation: 0 });
  });

  it('splits walls around a window into solid, sill, lintel and glass', () => {
    const r = room({
      width: 400,
      height: 250,
      wallThickness: 10,
      openings: [{ id: 'w', kind: 'window', wall: 'north', offset: 100, width: 100, height: 120, sillHeight: 90 }],
    });
    const pieces = wallPieces(r, 'north');
    const byId = Object.fromEntries(pieces.map((p) => [p.id, p]));
    expect(pieces.map((p) => p.kind).sort()).toEqual(['glass', 'wall', 'wall', 'wall', 'wall']);
    expect(byId['w-sill']).toMatchObject({ elevation: 0, height: 90, width: 100 });
    expect(byId['w-lintel']).toMatchObject({ elevation: 210, height: 40 });
    // Solid pieces cover everything except the opening: 420 - 100 = 320
    const solidLength = pieces.filter((p) => p.id.includes('solid')).reduce((sum, p) => sum + p.width, 0);
    expect(solidLength).toBe(320);
  });

  it('leaves a full-height gap for doors without lintel when the door reaches the ceiling', () => {
    const r = room({
      depth: 300,
      height: 200,
      openings: [{ id: 'd', kind: 'door', wall: 'west', offset: 50, width: 90, height: 200, sillHeight: 0 }],
    });
    const pieces = wallPieces(r, 'west');
    expect(pieces.some((p) => p.id.startsWith('d-'))).toBe(false);
    expect(pieces.reduce((sum, p) => sum + p.depth, 0)).toBe(210);
  });

  it('describes furniture, floors and ceilings', () => {
    const scene = describeScene(floor({ rooms: [room()], furniture: [furniture({ id: 'f', elevation: 20 })] }));
    expect(scene.boxes.find((box) => box.id === 'f')).toMatchObject({ kind: 'furniture', elevation: 20 });
    expect(scene.surfaces.map((surface) => surface.kind)).toEqual(['floor', 'ceiling']);
  });
});
