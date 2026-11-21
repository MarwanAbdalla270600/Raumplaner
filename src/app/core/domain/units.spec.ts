import { formatLength, fromDisplayUnit, toDisplayUnit } from './units';

describe('units', () => {
  it('converts between cm and m', () => {
    expect(toDisplayUnit(250, 'm')).toBe(2.5);
    expect(fromDisplayUnit(2.5, 'm')).toBe(250);
    expect(toDisplayUnit(250, 'cm')).toBe(250);
  });

  it('formats lengths', () => {
    expect(formatLength(250, 'cm', 'de-DE')).toBe('250 cm');
    expect(formatLength(255, 'm', 'de-DE')).toBe('2,55 m');
  });
});
