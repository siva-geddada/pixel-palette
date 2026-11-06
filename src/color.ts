export type Rgb = readonly [r: number, g: number, b: number];
export type Lab = readonly [l: number, a: number, b: number];
export type WcagLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

const toHexPair = (n: number) => Math.round(n).toString(16).padStart(2, '0');

export const rgbToHex = ([r, g, b]: Rgb) => `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`;

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB channel (0-255) to linear light (0-1). */
const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance: 0 is black, 1 is white. */
export function luminance([r, g, b]: Rgb) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Thresholds use the exact ratio, so 4.499 fails even though it rounds to 4.5. */
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/** Truncates, not rounds, so a failing 4.499 can never be displayed as a passing 4.50. */
export const formatRatio = (ratio: number) => `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;

/** CIE Lab (D65). Distances here match perceived difference far better than RGB does. */
export function rgbToLab([r, g, b]: Rgb): Lab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;

  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Squared distance, which is enough for comparing and avoids a square root per pixel. */
export const distanceSq = (a: Lab, b: Lab) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
