import { Vec2 } from '../../../core/domain/geometry';
import { EntityId } from '../../../core/domain/id';
import { LengthUnit } from '../../../core/domain/units';

export const CURRENT_SCHEMA_VERSION = 2;

/** Index of a wall: wall i runs from `points[i]` to `points[i + 1]` of its room. */
export type WallIndex = number;

export type OpeningKind = 'door' | 'window';

export type FurnitureCategory =
  'seating' | 'bed' | 'storage' | 'table' | 'kitchen' | 'bathroom' | 'office' | 'decor' | 'other';

export const FURNITURE_CATEGORIES: readonly FurnitureCategory[] = [
  'seating',
  'bed',
  'storage',
  'table',
  'kitchen',
  'bathroom',
  'office',
  'decor',
  'other',
];

export interface Opening {
  readonly id: EntityId;
  readonly kind: OpeningKind;
  readonly wall: WallIndex;
  /** Distance from the start point of the wall along its inner face. */
  readonly offset: number;
  readonly width: number;
  readonly height: number;
  /** Height above the floor where the opening starts (0 for doors). */
  readonly sillHeight: number;
}

export interface Room {
  readonly id: EntityId;
  readonly name: string;
  /**
   * Inner outline (floor polygon) on the floor plan, at least three points, clockwise on screen.
   * Walls are derived from the edges and extend outwards by `wallThickness`.
   */
  readonly points: readonly Vec2[];
  readonly height: number;
  readonly wallThickness: number;
  readonly floorColor: string;
  readonly wallColor: string;
  readonly openings: readonly Opening[];
}

/** Dimensions and appearance shared by catalog entries and placed furniture. */
export interface FurnitureSpec {
  readonly name: string;
  readonly category: FurnitureCategory;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly color: string;
  readonly material: string | null;
  readonly weight: number | null;
}

export interface CustomFurnitureDefinition extends FurnitureSpec {
  readonly id: EntityId;
}

export interface FurnitureItem extends FurnitureSpec {
  readonly id: EntityId;
  readonly catalogId: string | null;
  /** Centre point on the floor plan. */
  readonly x: number;
  readonly y: number;
  /** Clockwise rotation in degrees, 0 ≤ rotation < 360. */
  readonly rotation: number;
  /** Height of the bottom face above the floor. */
  readonly elevation: number;
  /** Drawing order: higher layers are drawn on top. */
  readonly layer: number;
}

export interface Floor {
  readonly id: EntityId;
  readonly name: string;
  readonly level: number;
  readonly rooms: readonly Room[];
  readonly furniture: readonly FurnitureItem[];
}

export interface ProjectSettings {
  readonly unit: LengthUnit;
  readonly gridSize: number;
  readonly snapEnabled: boolean;
  readonly showDimensions: boolean;
}

export interface Project {
  readonly id: EntityId;
  readonly name: string;
  readonly schemaVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settings: ProjectSettings;
  readonly floors: readonly Floor[];
  readonly customCatalog: readonly CustomFurnitureDefinition[];
}

export interface ProjectSummary {
  readonly id: EntityId;
  readonly name: string;
  readonly updatedAt: string;
  readonly roomCount: number;
  readonly furnitureCount: number;
}
