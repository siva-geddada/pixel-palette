import { distanceSq, type Lab } from './color';

export interface WeightedPoint {
  lab: Lab;
  weight: number;
}

/** Small seeded generator: the same image always gives the same palette. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nearest(point: Lab, centres: Lab[]) {
  let best = 0;
  let bestDistance = Infinity;
  centres.forEach((centre, i) => {
    const d = distanceSq(point, centre);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return { index: best, distance: bestDistance };
}

/** k-means++: each new centre is picked far from the existing ones, weighted by pixel count. */
function chooseCentres(points: WeightedPoint[], k: number, random: () => number) {
  const heaviest = points.reduce((a, b) => (b.weight > a.weight ? b : a));
  const centres: Lab[] = [heaviest.lab];

  while (centres.length < k) {
    const scores = points.map((p) => p.weight * nearest(p.lab, centres).distance);
    const total = scores.reduce((sum, s) => sum + s, 0);
    if (total === 0) break; // every remaining point duplicates a centre

    let pick = random() * total;
    let chosen = points.length - 1;
    for (let i = 0; i < scores.length; i++) {
      pick -= scores[i] ?? 0;
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    const point = points[chosen];
    if (point) centres.push(point.lab);
  }
  return centres;
}

/** Weighted k-means. Returns the cluster index of each point. */
export function kmeans(points: WeightedPoint[], k: number, maxIterations = 24, seed = 42) {
  if (points.length === 0) return [];

  const centres = chooseCentres(points, Math.min(k, points.length), mulberry32(seed));
  let assignments = new Array<number>(points.length).fill(-1);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const next = points.map((p) => nearest(p.lab, centres).index);
    const settled = next.every((cluster, i) => cluster === assignments[i]);
    assignments = next;
    if (settled) break;

    const sums = centres.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => {
      const sum = sums[next[i] ?? 0];
      if (!sum) return;
      sum[0] = (sum[0] ?? 0) + p.lab[0] * p.weight;
      sum[1] = (sum[1] ?? 0) + p.lab[1] * p.weight;
      sum[2] = (sum[2] ?? 0) + p.lab[2] * p.weight;
      sum[3] = (sum[3] ?? 0) + p.weight;
    });
    sums.forEach(([l = 0, a = 0, b = 0, weight = 0], i) => {
      if (weight > 0) centres[i] = [l / weight, a / weight, b / weight];
    });
  }
  return assignments;
}
