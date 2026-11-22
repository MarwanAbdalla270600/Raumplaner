/** Default dimensions (cm) used when creating new entities. */
export const ROOM_DEFAULTS = {
  width: 400,
  depth: 350,
  height: 250,
  wallThickness: 12,
  floorColor: '#d9c4a5',
  wallColor: '#f2efe9',
} as const;

export const DOOR_DEFAULTS = { width: 90, height: 205, sillHeight: 0 } as const;
export const WINDOW_DEFAULTS = { width: 120, height: 130, sillHeight: 90 } as const;

export const SETTINGS_DEFAULTS = {
  unit: 'cm',
  gridSize: 10,
  snapEnabled: true,
  showDimensions: true,
} as const;

export const DIMENSION_LIMITS = {
  minLength: 1,
  maxLength: 5000,
  minRoomLength: 50,
  maxWallThickness: 100,
} as const;

/** Gap between a newly added room and the existing rooms. */
export const NEW_ROOM_GAP = 0;

/** Walls thinner than this count as "without thickness": drawn as a line in 2D and as a thin wall centred on the outline in 3D. */
export const THIN_WALL_CM = 4;
export const THIN_WALL_VISUAL_CM = 4;
