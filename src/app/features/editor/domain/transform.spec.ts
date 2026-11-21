import { vec } from '../../../core/domain/geometry';
import { furniture } from '../../../testing/fixtures';
import { resizeFromCorner, rotateFurniture, rotationTowards } from './transform';

describe('furniture transforms', () => {
  it('rotates and normalizes', () => {
    expect(rotateFurniture(furniture({ rotation: 270 }), 180).rotation).toBe(90);
  });

  it('keeps the top-left corner fixed when resizing', () => {
    const item = furniture({ x: 50, y: 25, width: 100, depth: 50 });
    const resized = resizeFromCorner(item, vec(20, 10), null);
    expect(resized.width).toBe(120);
    expect(resized.depth).toBe(60);
    expect(resized.x - resized.width / 2).toBe(0);
    expect(resized.y - resized.depth / 2).toBe(0);
  });

  it('resizes in the local frame of rotated furniture', () => {
    const item = furniture({ rotation: 90, width: 100, depth: 50 });
    // Moving the pointer down in world space = along local +x for a 90° rotation.
    expect(resizeFromCorner(item, vec(0, 30), null).width).toBe(130);
  });

  it('derives rotation from the handle position', () => {
    const item = furniture({ x: 0, y: 0 });
    expect(rotationTowards(item, vec(0, -100), null)).toBe(0);
    expect(rotationTowards(item, vec(100, 0), null)).toBe(90);
    expect(rotationTowards(item, vec(100, -95), 15)).toBe(45);
  });
});
