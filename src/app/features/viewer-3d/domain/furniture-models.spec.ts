import { furniture } from '../../../testing/fixtures';
import { furnitureModel, modelKindFor } from './furniture-models';

describe('procedural furniture models', () => {
  it('picks models by catalog id, name and category', () => {
    expect(modelKindFor(furniture({ catalogId: 'wardrobe' }))).toBe('wardrobe');
    expect(modelKindFor(furniture({ name: 'Mein Bücherregal' }))).toBe('shelf');
    expect(modelKindFor(furniture({ name: 'Ding', category: 'seating', width: 200 }))).toBe('sofa');
    expect(modelKindFor(furniture({ name: 'Ding', category: 'other' }))).toBe('generic');
  });

  it('builds beds with pillows depending on the width', () => {
    const pillows = (width: number): number =>
      furnitureModel(furniture({ catalogId: 'bed-double', width, depth: 210, height: 50, color: '#c9b79c' })).filter(
        (part) => part.color === '#ffffff' && part.shape === 'rounded',
      ).length;
    expect(pillows(180)).toBe(2);
    expect(pillows(90)).toBe(1);
  });

  it('gives wardrobes one door per ~50 cm with handles', () => {
    const parts = furnitureModel(furniture({ catalogId: 'wardrobe', width: 200, depth: 60, height: 220 }));
    expect(parts.filter((part) => part.finish === 'metal')).toHaveLength(4);
  });

  it('keeps every model inside a sensible envelope around its footprint', () => {
    for (const id of ['sofa-3', 'sofa-corner', 'chair', 'desk', 'kitchen-row', 'toilet', 'plant', 'tv', 'shower']) {
      const item = furniture({ catalogId: id, width: 120, depth: 80, height: 100 });
      const parts = furnitureModel(item);
      expect(parts.length).toBeGreaterThan(2);
      for (const part of parts) {
        expect(Math.abs(part.x)).toBeLessThanOrEqual(item.width / 2 + 5);
        expect(Math.abs(part.z)).toBeLessThanOrEqual(item.depth / 2 + 5);
        expect(part.y).toBeGreaterThanOrEqual(0);
        [part.w, part.h, part.d].forEach((size) => expect(size).toBeGreaterThan(0));
      }
    }
  });
});
