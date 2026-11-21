/** Length units offered in the UI. The model always stores centimetres. */
export type LengthUnit = 'cm' | 'm';

export const LENGTH_UNITS: readonly LengthUnit[] = ['cm', 'm'];

const CENTIMETRES_PER_UNIT: Record<LengthUnit, number> = { cm: 1, m: 100 };
const DISPLAY_DECIMALS: Record<LengthUnit, number> = { cm: 1, m: 3 };

export function toDisplayUnit(centimetres: number, unit: LengthUnit): number {
  const factor = 10 ** DISPLAY_DECIMALS[unit];
  return Math.round((centimetres / CENTIMETRES_PER_UNIT[unit]) * factor) / factor;
}

export function fromDisplayUnit(value: number, unit: LengthUnit): number {
  return value * CENTIMETRES_PER_UNIT[unit];
}

/** Step size of number inputs for the given unit (1 cm in both cases). */
export function inputStep(unit: LengthUnit): number {
  return 1 / CENTIMETRES_PER_UNIT[unit];
}

export function formatLength(centimetres: number, unit: LengthUnit, locale = 'de-DE'): string {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: unit === 'm' ? 2 : 0,
  }).format(toDisplayUnit(centimetres, unit));
  return `${formatted} ${unit}`;
}

export function isLengthUnit(value: unknown): value is LengthUnit {
  return value === 'cm' || value === 'm';
}
