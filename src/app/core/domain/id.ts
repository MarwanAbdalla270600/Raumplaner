export type EntityId = string;

/** Generates collision-resistant ids; uses crypto.randomUUID where available. */
export function createId(prefix: string): EntityId {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}
