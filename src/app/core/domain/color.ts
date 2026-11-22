const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const RGB_MAX = 255;
const HEX_RADIX = 16;
/** Luminance threshold (WCAG relative luminance) above which dark text is used. */
const LIGHT_LUMINANCE_THRESHOLD = 0.4;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
}

function channelLuminance(channel: number): number {
  const srgb = channel / RGB_MAX;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), HEX_RADIX);
  const g = parseInt(hex.slice(3, 5), HEX_RADIX);
  const b = parseInt(hex.slice(5, 7), HEX_RADIX);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Returns a readable label colour (black or white) for text drawn on the given background. */
export function contrastingTextColor(background: string): string {
  if (!isHexColor(background)) {
    return '#000000';
  }
  return relativeLuminance(background) > LIGHT_LUMINANCE_THRESHOLD ? '#1a1a1a' : '#ffffff';
}

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), HEX_RADIX)) as [number, number, number];
}

function toHex(rgb: readonly number[]): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(RGB_MAX, Math.max(0, c)))
        .toString(HEX_RADIX)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Linear mix of two colours: t = 0 → a, t = 1 → b. Invalid input falls back to `a`. */
export function mixColors(a: string, b: string, t: number): string {
  if (!isHexColor(a) || !isHexColor(b)) {
    return isHexColor(a) ? a : '#808080';
  }
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex(ca.map((c, i) => c + (cb[i] - c) * t));
}

/** Lightens (amount > 0) or darkens (amount < 0) a colour; amount in [-1, 1]. */
export function shadeColor(color: string, amount: number): string {
  return amount >= 0 ? mixColors(color, '#ffffff', amount) : mixColors(color, '#000000', -amount);
}
