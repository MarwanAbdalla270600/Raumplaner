import { Aabb, aabbHeight, aabbWidth, clamp, Vec2, vec } from '../../../core/domain/geometry';

/** Maps world coordinates (cm) to screen pixels: screen = world * scale + offset. */
export interface Viewport {
  readonly offsetX: number;
  readonly offsetY: number;
  /** Pixels per centimetre. */
  readonly scale: number;
}

export const VIEWPORT_LIMITS = { minScale: 0.1, maxScale: 8 } as const;
export const ZOOM_STEP_FACTOR = 1.2;
export const FIT_PADDING_PX = 48;
export const DEFAULT_VIEWPORT: Viewport = { offsetX: 40, offsetY: 40, scale: 1 };

export function screenToWorld(viewport: Viewport, point: Vec2): Vec2 {
  return vec((point.x - viewport.offsetX) / viewport.scale, (point.y - viewport.offsetY) / viewport.scale);
}

export function worldToScreen(viewport: Viewport, point: Vec2): Vec2 {
  return vec(point.x * viewport.scale + viewport.offsetX, point.y * viewport.scale + viewport.offsetY);
}

/** Zooms by `factor` while keeping the world point under `anchor` (screen px) fixed. */
export function zoomAt(viewport: Viewport, factor: number, anchor: Vec2): Viewport {
  const scale = clamp(viewport.scale * factor, VIEWPORT_LIMITS.minScale, VIEWPORT_LIMITS.maxScale);
  const world = screenToWorld(viewport, anchor);
  return { scale, offsetX: anchor.x - world.x * scale, offsetY: anchor.y - world.y * scale };
}

export function panBy(viewport: Viewport, delta: Vec2): Viewport {
  return { ...viewport, offsetX: viewport.offsetX + delta.x, offsetY: viewport.offsetY + delta.y };
}

/** Viewport that shows `bounds` centred inside a screen of the given size. */
export function fitToBounds(bounds: Aabb, screenWidth: number, screenHeight: number): Viewport {
  const availableWidth = Math.max(1, screenWidth - 2 * FIT_PADDING_PX);
  const availableHeight = Math.max(1, screenHeight - 2 * FIT_PADDING_PX);
  const scale = clamp(
    Math.min(availableWidth / Math.max(1, aabbWidth(bounds)), availableHeight / Math.max(1, aabbHeight(bounds))),
    VIEWPORT_LIMITS.minScale,
    VIEWPORT_LIMITS.maxScale,
  );
  return {
    scale,
    offsetX: (screenWidth - aabbWidth(bounds) * scale) / 2 - bounds.minX * scale,
    offsetY: (screenHeight - aabbHeight(bounds) * scale) / 2 - bounds.minY * scale,
  };
}
