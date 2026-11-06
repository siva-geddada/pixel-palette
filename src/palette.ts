import { distanceSq, rgbToHex, rgbToLab, type Rgb } from './color';
import { kmeans } from './kmeans';

export interface Swatch {
  hex: string;
  rgb: Rgb;
  /** Fraction of the visible image this colour covers, from 0 to 1. */
  share: number;
}

interface Bucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

const MIN_ALPHA = 128; // mostly transparent pixels aren't part of the visible image
const MERGE_DISTANCE_SQ = 10 ** 2; // closer than this in Lab, two colours look like one

/** Groups pixels into 32,768 colour buckets, so k-means runs on buckets rather than pixels. */
function bucketPixels(data: Uint8ClampedArray) {
  const buckets = new Map<number, Bucket>();

  for (let i = 0; i + 3 < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < MIN_ALPHA) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }
  return [...buckets.values()];
}

const meanColour = ({ r, g, b, count }: Bucket): Rgb => [r / count, g / count, b / count];

/** Combines the two most similar clusters until every pair looks distinct. */
function mergeSimilar(clusters: Bucket[]) {
  const merged = [...clusters];

  for (;;) {
    let pair: [number, number] | undefined;
    let closest = MERGE_DISTANCE_SQ;

    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i];
        const b = merged[j];
        if (!a || !b) continue;
        const distance = distanceSq(rgbToLab(meanColour(a)), rgbToLab(meanColour(b)));
        if (distance < closest) {
          closest = distance;
          pair = [i, j];
        }
      }
    }
    if (!pair) return merged;

    const [i, j] = pair;
    const a = merged[i];
    const b = merged[j];
    if (!a || !b) return merged;
    merged[i] = { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b, count: a.count + b.count };
    merged.splice(j, 1);
  }
}

/** Finds the dominant colours in RGBA pixel data, most common first. */
export function extractPalette(data: Uint8ClampedArray, size = 6): Swatch[] {
  const buckets = bucketPixels(data);
  if (buckets.length === 0) return [];

  const points = buckets.map((bucket) => ({
    lab: rgbToLab(meanColour(bucket)),
    weight: bucket.count,
  }));
  const assignments = kmeans(points, size);

  const clusters = new Map<number, Bucket>();
  buckets.forEach((bucket, i) => {
    const id = assignments[i] ?? 0;
    const cluster = clusters.get(id);
    if (cluster) {
      cluster.r += bucket.r;
      cluster.g += bucket.g;
      cluster.b += bucket.b;
      cluster.count += bucket.count;
    } else {
      clusters.set(id, { ...bucket });
    }
  });

  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return mergeSimilar([...clusters.values()])
    .sort((a, b) => b.count - a.count)
    .map((cluster) => {
      const hex = rgbToHex(meanColour(cluster));
      const rgb = meanColour(cluster).map(Math.round) as unknown as Rgb;
      return { hex, rgb, share: cluster.count / total };
    });
}

/** The palette as CSS custom properties, ready to paste into a stylesheet. */
export const toCssVariables = (palette: Swatch[]) =>
  `:root {\n${palette.map((s, i) => `  --palette-${i + 1}: ${s.hex};`).join('\n')}\n}`;
