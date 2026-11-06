import { describe, expect, it } from 'vitest';
import { extractPalette, toCssVariables } from '../src/palette';

/** Builds RGBA pixel data from [r, g, b, a, count] runs. */
function image(...runs: [number, number, number, number, number][]) {
  const pixels: number[] = [];
  for (const [r, g, b, a, count] of runs) {
    for (let i = 0; i < count; i++) pixels.push(r, g, b, a);
  }
  return new Uint8ClampedArray(pixels);
}

describe('extractPalette', () => {
  it('finds the exact colours of a flat image, most common first', () => {
    const palette = extractPalette(image([255, 0, 0, 255, 300], [0, 0, 255, 255, 100]), 6);

    expect(palette.map((s) => s.hex)).toEqual(['#ff0000', '#0000ff']);
    expect(palette[0]?.share).toBeCloseTo(0.75);
    expect(palette[1]?.share).toBeCloseTo(0.25);
  });

  it('ignores transparent pixels', () => {
    const palette = extractPalette(image([0, 255, 0, 255, 10], [255, 0, 0, 0, 1000]));

    expect(palette.map((s) => s.hex)).toEqual(['#00ff00']);
    expect(palette[0]?.share).toBe(1);
  });

  it('handles empty and fully transparent images', () => {
    expect(extractPalette(new Uint8ClampedArray(0))).toEqual([]);
    expect(extractPalette(image([1, 2, 3, 0, 50]))).toEqual([]);
  });

  it('merges shades that look the same', () => {
    const palette = extractPalette(image([200, 30, 30, 255, 100], [203, 32, 31, 255, 100]), 6);
    expect(palette).toHaveLength(1);
  });

  it('never returns more colours than requested', () => {
    const runs: [number, number, number, number, number][] = [];
    for (let i = 0; i < 40; i++) runs.push([(i * 37) % 256, (i * 91) % 256, (i * 151) % 256, 255, 5]);

    expect(extractPalette(image(...runs), 5).length).toBeLessThanOrEqual(5);
  });

  it('keeps a small but distinct colour', () => {
    const palette = extractPalette(image([240, 240, 240, 255, 5000], [220, 20, 60, 255, 40]), 4);
    expect(palette.some((s) => s.rgb[0] > 180 && s.rgb[1] < 60)).toBe(true);
  });

  it('gives the same result every time', () => {
    const runs: [number, number, number, number, number][] = [];
    for (let i = 0; i < 200; i++) runs.push([(i * 13) % 256, (i * 29) % 256, (i * 53) % 256, 255, 1 + (i % 7)]);
    const data = image(...runs);

    expect(extractPalette(data, 6)).toEqual(extractPalette(data, 6));
  });

  it('adds up to the whole image', () => {
    const palette = extractPalette(image([10, 20, 30, 255, 7], [200, 100, 50, 255, 13], [90, 200, 90, 255, 5]));
    expect(palette.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });
});

describe('toCssVariables', () => {
  it('numbers each colour', () => {
    const css = toCssVariables(extractPalette(image([255, 0, 0, 255, 2], [0, 0, 255, 255, 1])));
    expect(css).toBe(':root {\n  --palette-1: #ff0000;\n  --palette-2: #0000ff;\n}');
  });
});
