import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal, horizontalFromDirection, wrap180 } from '../src/core/astro';
import { apparentPlace, NAMED_BRIGHT } from '../src/core/catalogue';
import { degMin, dipMinutes } from '../src/core/nav';
import { Observer } from '../src/core/observer';
import { DIP, EYE_Y, SEA_RADIUS, SEA_Y, SextantModel } from '../src/instruments/sextant/model';

const R2D = 180 / Math.PI;

describe('sea horizon', () => {
  it('dip is 1.76′√h, and the sea’s edge is drawn exactly that far below the eye', () => {
    expect(dipMinutes(4)).toBeCloseTo(3.52, 6);
    expect(Math.atan2(EYE_Y - SEA_Y, SEA_RADIUS) * R2D).toBeCloseTo(DIP, 9);
  });
  it('formats degrees and minutes', () => {
    expect(degMin(34.6)).toBe('34°36.0′');
    expect(degMin(12.9999)).toBe('13°00.0′');
  });
});

describe('sextant', () => {
  const s = new SextantModel();

  it('the reflected line of sight, traced off the modelled mirrors, is the direct one turned up by the reading', () => {
    for (const az of [0, 123, 301]) {
      for (const r of [0, 12.345, 45.5, 89.99, 119.2]) {
        s.setAim(az); s.setReading(r); s.pose();
        const traced = s.traceReflected(), rotated = s.reflectedDirection(), direct = s.telescopeAxis();
        expect(traced.angleTo(rotated) * R2D).toBeLessThan(1e-5);
        expect(traced.angleTo(direct) * R2D).toBeCloseTo(r, 6);
        expect(horizontalFromDirection(direct.x, direct.y, direct.z).alt).toBeCloseTo(-DIP, 9); // looking at the sea horizon
      }
    }
  });

  it('arc and drum read the setting (whole degrees on the arc, minutes on the drum)', () => {
    for (const r of [0.5, 7.25, 21.99, 34.6, 60.0166, 88.5, 119.75]) {
      s.setReading(r); s.pose();
      expect(Math.abs(s.readArc() - r)).toBeLessThan(0.01);
      expect(Math.abs(s.readSextant() - r) * 60).toBeLessThan(0.05);
    }
  });

  it('with the star brought down to the horizon, the silvered half looks at the star and the sextant reads altitude + dip', () => {
    const obs = new Observer({ date: '2026-11-07' }, false);
    const stars = NAMED_BRIGHT.map(st => apparentPlace(st, obs.utc, obs.lst, obs.lat)).filter(p => p.alt > 10 && p.alt < 80);
    expect(stars.length).toBeGreaterThan(10);
    for (const p of stars) {
      s.setAim(p.az); s.setReading(p.alt + DIP); s.pose();
      const want = new THREE.Vector3(...directionFromHorizontal(p.alt, p.az));
      expect(s.traceReflected().angleTo(want) * R2D).toBeLessThan(1e-4);
      expect(Math.abs(s.readSextant() - (p.alt + DIP)) * 60).toBeLessThan(0.05);
      const h = horizontalFromDirection(...s.reflectedDirection().toArray() as [number, number, number]);
      expect(Math.abs(wrap180(h.az - p.az))).toBeLessThan(1e-6);
    }
  });
});
