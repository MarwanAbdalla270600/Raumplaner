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
