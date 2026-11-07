import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal, lstDeg, wrap180 } from '../src/core/astro';
import { apparentPlace, NAMED_BRIGHT } from '../src/core/catalogue';
import { QuadrantModel } from '../src/instruments/quadrant/model';

const R2D = 180 / Math.PI;

describe('quadrant', () => {
  const q = new QuadrantModel();

  it('reads 0° when level and 45° when tilted 45° (plumb crosses the arc at the right mark)', () => {
    q.setAim(0, 0); q.update(0);
    expect(q.readPlumb()).toBeCloseTo(0, 6);
    q.setAim(0, 45); q.update(0);
    expect(q.readPlumb()).toBeCloseTo(45, 6);
  });

  it('aimed exactly at each visible bright star, the sights point at it and the scales read its altitude and azimuth', () => {
    const d = new Date(Date.UTC(2026, 10, 7, 21)); // 22:00 in Rome
    const lst = lstDeg(d, 12.5);
    const stars = NAMED_BRIGHT.map(s => ({ s, p: apparentPlace(s, d, lst, 41.9) })).filter(x => x.p.alt > 1 && x.p.alt < 89);
    expect(stars.length).toBeGreaterThan(15);
    for (const { p } of stars) {
      q.setAim(p.az, p.alt); q.update(0);
      const want = new THREE.Vector3(...directionFromHorizontal(p.alt, p.az));
      expect(q.sightDirection().angleTo(want) * R2D).toBeLessThan(1e-4);
      expect(Math.abs(q.readPlumb() - p.alt)).toBeLessThan(0.01);
      expect(Math.abs(wrap180(q.readPointer() - p.az))).toBeLessThan(0.01);
    }
  });
});
