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
