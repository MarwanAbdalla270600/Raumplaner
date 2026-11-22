import { isHexColor } from '../../../core/domain/color';
import { isLengthUnit } from '../../../core/domain/units';
import { FURNITURE_CATEGORIES } from './model';

/**
 * Structural validation of untrusted project data (e.g. an imported JSON file).
 * Returns a list of human readable error paths; an empty list means "valid".
 */
export type ValidationErrors = string[];

type Check = (value: unknown, path: string, errors: ValidationErrors) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (errors: ValidationErrors, path: string, expected: string): void => {
  errors.push(`${path}: ${expected}`);
};

const string: Check = (value, path, errors) => {
  if (typeof value !== 'string') fail(errors, path, 'string expected');
};

const finiteNumber: Check = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(errors, path, 'number expected');
};

const positiveNumber: Check = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    fail(errors, path, 'positive number expected');
};

const nonNegativeNumber: Check = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    fail(errors, path, 'non-negative number expected');
};

const boolean: Check = (value, path, errors) => {
  if (typeof value !== 'boolean') fail(errors, path, 'boolean expected');
};

const color: Check = (value, path, errors) => {
  if (!isHexColor(value)) fail(errors, path, 'hex colour (#rrggbb) expected');
};

const oneOf =
  (allowed: readonly unknown[]): Check =>
  (value, path, errors) => {
    if (!allowed.includes(value)) fail(errors, path, `one of ${allowed.join(', ')} expected`);
  };

const nullable =
  (check: Check): Check =>
  (value, path, errors) => {
    if (value !== null) check(value, path, errors);
  };

const object =
  (shape: Record<string, Check>): Check =>
  (value, path, errors) => {
    if (!isRecord(value)) {
      fail(errors, path, 'object expected');
      return;
    }
    Object.entries(shape).forEach(([key, check]) => check(value[key], `${path}.${key}`, errors));
  };

const array =
  (item: Check): Check =>
  (value, path, errors) => {
    if (!Array.isArray(value)) {
      fail(errors, path, 'array expected');
      return;
    }
    value.forEach((entry, index) => item(entry, `${path}[${index}]`, errors));
  };

const furnitureSpecShape = {
  name: string,
  category: oneOf(FURNITURE_CATEGORIES),
  width: positiveNumber,
  depth: positiveNumber,
  height: positiveNumber,
  color,
  material: nullable(string),
  weight: nullable(nonNegativeNumber),
};

const wallIndex: Check = (value, path, errors) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail(errors, path, 'wall index expected');
};

const pointCheck = object({ x: finiteNumber, y: finiteNumber });

const outline: Check = (value, path, errors) => {
  array(pointCheck)(value, path, errors);
  if (Array.isArray(value) && value.length < 3) fail(errors, path, 'at least three points expected');
};

const openingCheck = object({
  id: string,
  kind: oneOf(['door', 'window', 'passage']),
  wall: wallIndex,
  offset: nonNegativeNumber,
  width: positiveNumber,
  height: positiveNumber,
  sillHeight: nonNegativeNumber,
});

const roomCheck = object({
  id: string,
  name: string,
  points: outline,
  height: positiveNumber,
  wallThickness: nonNegativeNumber,
  floorColor: color,
  wallColor: color,
  openings: array(openingCheck),
});

const furnitureCheck = object({
  ...furnitureSpecShape,
  id: string,
  catalogId: nullable(string),
  x: finiteNumber,
  y: finiteNumber,
  rotation: finiteNumber,
  elevation: nonNegativeNumber,
  layer: finiteNumber,
});

const floorCheck = object({
  id: string,
  name: string,
  level: finiteNumber,
  rooms: array(roomCheck),
  furniture: array(furnitureCheck),
});

export const projectCheck = object({
  id: string,
  name: string,
  schemaVersion: positiveNumber,
  createdAt: string,
  updatedAt: string,
  settings: object({
    unit: (value, path, errors) => {
      if (!isLengthUnit(value)) fail(errors, path, 'cm or m expected');
    },
    gridSize: positiveNumber,
    snapEnabled: boolean,
    showDimensions: boolean,
  }),
  floors: array(floorCheck),
  customCatalog: array(object({ ...furnitureSpecShape, id: string })),
});

export function validateProject(value: unknown): ValidationErrors {
  const errors: ValidationErrors = [];
  projectCheck(value, 'project', errors);
  if (errors.length === 0 && isRecord(value) && Array.isArray(value['floors']) && value['floors'].length === 0) {
    errors.push('project.floors: at least one floor expected');
  }
  return errors;
}
