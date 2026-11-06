import { describe, expect, it } from 'vitest';
import { contrastRatio, formatRatio, hexToRgb, luminance, rgbToHex, rgbToLab, wcagLevel } from '../src/color';

describe('hex conversion', () => {
  it('round-trips', () => {
    expect(rgbToHex(hexToRgb('#1a2b3c'))).toBe('#1a2b3c');
  });

  it('pads single digit channels', () => {
    expect(rgbToHex([0, 5, 255])).toBe('#0005ff');
  });

  it('rejects invalid input', () => {
    expect(() => hexToRgb('#xyz')).toThrow();
  });
});

describe('WCAG contrast', () => {
  it('gives the known extremes', () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5);
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([120, 40, 200], [120, 40, 200])).toBe(1);
  });

  it('does not depend on the order of the colours', () => {
    const a = hexToRgb('#123456');
    const b = hexToRgb('#fedcba');
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });

  it('matches published reference values', () => {
    // #767676 is the well-known lightest grey that passes AA on white, #777777 just fails.
    expect(contrastRatio(hexToRgb('#767676'), [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(contrastRatio(hexToRgb('#777777'), [255, 255, 255])).toBeCloseTo(4.48, 2);
    expect(contrastRatio(hexToRgb('#ff0000'), [255, 255, 255])).toBeCloseTo(4.0, 2);
  });

  it('assigns levels at the exact thresholds', () => {
    expect(wcagLevel(7)).toBe('AAA');
    expect(wcagLevel(6.99)).toBe('AA');
    expect(wcagLevel(4.5)).toBe('AA');
    expect(wcagLevel(4.499)).toBe('AA Large');
    expect(wcagLevel(3)).toBe('AA Large');
    expect(wcagLevel(2.99)).toBe('Fail');
  });

  it('never displays a failing ratio as a passing one', () => {
    expect(formatRatio(4.499)).toBe('4.49:1');
    expect(formatRatio(21)).toBe('21.00:1');
  });
});

describe('Lab conversion', () => {
  it('matches reference values', () => {
    const [l, a, b] = rgbToLab([255, 0, 0]);
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('maps white to L 100 with no colour', () => {
    const [l, a, b] = rgbToLab([255, 255, 255]);
    expect(l).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 1);
    expect(b).toBeCloseTo(0, 1);
  });
});
