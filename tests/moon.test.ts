import { describe, expect, it } from 'vitest';
import { horizontalFromEquatorial, lstDeg, wrap180 } from '../src/core/astro';
import { eclipticFromEquatorial, equatorialFromEcliptic } from '../src/core/ecliptic';
import { moonGeocentric, moonSemidiameter, moonTopocentric } from '../src/core/moon';

describe('ecliptic coordinates', () => {
  it('Meeus example 13.a: Pollux', () => {
    // α = 116.328942°, δ = +28.026183°, ε = 23.4392911° → λ = 113.215630°, β = +6.684170°
    const e = eclipticFromEquatorial(116.328942, 28.026183, 23.4392911);
    expect(e.lon).toBeCloseTo(113.21563, 5);
    expect(e.lat).toBeCloseTo(6.68417, 5);
  });
  it('round trip', () => {
    for (const [lon, lat] of [[0, 0], [45, 10], [200, -60], [359, 80], [90, -5]]) {
      const q = equatorialFromEcliptic(lon, lat, 23.44), e = eclipticFromEquatorial(q.ra, q.dec, 23.44);
      expect(Math.abs(wrap180(e.lon - lon))).toBeLessThan(1e-9);
      expect(Math.abs(e.lat - lat)).toBeLessThan(1e-9);
    }
  });
});

describe('the moon', () => {
  it('Meeus example 47.a: 1992 April 12, 0h TD', () => {
    const m = moonGeocentric(new Date(Date.UTC(1992, 3, 12)));
    expect(m.lon).toBeCloseTo(133.162655, 5);
    expect(m.lat).toBeCloseTo(-3.229126, 5);
    expect(m.dist).toBeCloseTo(368409.7, 0);
  });

  it('seen from the surface, it is lowered by the parallax: about 0.95° at the horizon, nothing overhead', () => {
    const date = new Date(Date.UTC(2026, 10, 20, 18));
    for (const lat of [41.9, -33.9, 0]) {
      for (let lst = 0; lst < 360; lst += 15) {
        const g = moonGeocentric(date);
        const eps = 23.436;
        const gq = equatorialFromEcliptic(g.lon, g.lat, eps);
        const t = moonTopocentric(date, lat, lst);
        const hg = horizontalFromEquatorial(gq.ra, gq.dec, lst, lat), ht = horizontalFromEquatorial(t.ra, t.dec, lst, lat);
        const horizontalParallax = Math.asin(6378.14 / g.dist) * 180 / Math.PI;
        // Lowered (never raised), by the horizontal parallax times cos(altitude), to a few hundredths.
        expect(hg.alt - ht.alt).toBeGreaterThan(-1e-6);
        expect(Math.abs((hg.alt - ht.alt) - horizontalParallax * Math.cos(ht.alt * Math.PI / 180))).toBeLessThan(0.03);
      }
    }
  });

  it('its disc is about half a degree across', () => {
    const t = moonTopocentric(new Date(), 41.9, lstDeg(new Date(), 12.5));
    expect(2 * moonSemidiameter(t.dist)).toBeGreaterThan(0.48);
    expect(2 * moonSemidiameter(t.dist)).toBeLessThan(0.58);
  });
});
