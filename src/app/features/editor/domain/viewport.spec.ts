import { aabb, vec } from '../../../core/domain/geometry';
import { fitToBounds, screenToWorld, worldToScreen, zoomAt } from './viewport';

describe('viewport', () => {
  const viewport = { offsetX: 50, offsetY: 20, scale: 2 };

  it('converts between screen and world coordinates', () => {
    const world = screenToWorld(viewport, vec(150, 120));
    expect(world).toEqual({ x: 50, y: 50 });
    expect(worldToScreen(viewport, world)).toEqual({ x: 150, y: 120 });
  });

  it('keeps the anchor point fixed while zooming', () => {
    const anchor = vec(300, 200);
    const before = screenToWorld(viewport, anchor);
    const zoomed = zoomAt(viewport, 1.5, anchor);
    const after = screenToWorld(zoomed, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomed.scale).toBe(3);
  });

  it('clamps the zoom level', () => {
    expect(zoomAt(viewport, 100, vec(0, 0)).scale).toBe(8);
  });

  it('fits bounds into the screen', () => {
    const fitted = fitToBounds(aabb(0, 0, 100, 100), 296, 296);
    expect(fitted.scale).toBe(2);
    expect(worldToScreen(fitted, vec(50, 50))).toEqual({ x: 148, y: 148 });
  });
});
