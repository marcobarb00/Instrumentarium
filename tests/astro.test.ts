import { describe, expect, it } from 'vitest';
import {
  angularSeparation, directionFromHorizontal, gmstDeg, horizontalFromDirection, horizontalFromEquatorial,
  horizontalFromHourAngle, hourAngleFromHorizontal, julianDate, lstDeg, precessFromJ2000, wrap180,
} from '../src/core/astro';
import { apparentPlace, NAMED_BRIGHT, STARS, starByName } from '../src/core/catalogue';
import { Observer, PLACES } from '../src/core/observer';
import { zonedToUtc } from '../src/core/time';

describe('time scales', () => {
  it('Julian Date of J2000.0', () => {
    expect(julianDate(new Date(Date.UTC(2000, 0, 1, 12)))).toBeCloseTo(2451545.0, 9);
  });
  it('GMST matches Meeus example 12.a (1987 Apr 10, 0h UT → 13h10m46.3668s)', () => {
    const expected = (13 + 10 / 60 + 46.3668 / 3600) * 15;
    expect(gmstDeg(new Date(Date.UTC(1987, 3, 10, 0, 0, 0)))).toBeCloseTo(expected, 3);
  });
  it('local sidereal time adds east longitude', () => {
    const d = new Date(Date.UTC(2026, 10, 7, 21));
    expect(wrap180(lstDeg(d, 12.5) - gmstDeg(d) - 12.5)).toBeCloseTo(0, 9);
  });
});

describe('precession', () => {
  it('matches Meeus example 21.b (θ Persei, J2000 → 2028 Nov 13.19)', () => {
    // Meeus gets α = 2h46m11.331s, δ = +49°20′54.54″ including 28.86 years of proper
    // motion (+0.988s, −2.58″). Precession alone therefore gives 2h46m10.343s, +49°20′57.12″.
    const ra0 = (2 + 44 / 60 + 11.986 / 3600) * 15;
    const dec0 = 49 + 13 / 60 + 42.48 / 3600;
    const p = precessFromJ2000(ra0, dec0, new Date(Date.UTC(2028, 10, 13, 4, 33, 36)));
    expect(Math.abs(p.ra - (2 + 46 / 60 + 10.343 / 3600) * 15)).toBeLessThan(0.001);
    expect(Math.abs(p.dec - (49 + 20 / 60 + 57.12 / 3600))).toBeLessThan(0.001);
  });
});

describe('horizontal coordinates', () => {
  const lat = 41.9, lon = 12.5;

  it('Polaris altitude ≈ observer latitude (±1°) at any time and place', () => {
    const polaris = starByName('Polaris')!;
    for (const L of [10, 31.2, 41.9, 51.5, 65]) {
      for (let h = 0; h < 24; h += 1.5) {
        const d = new Date(Date.UTC(2026, 10, 7, 0) + h * 3600e3);
        const p = apparentPlace(polaris, d, lstDeg(d, lon), L);
        expect(Math.abs(p.alt - L)).toBeLessThan(1);
      }
    }
  });

  it('a star on the meridian has altitude 90° − φ + δ (±0.1°)', () => {
    const d = new Date(Date.UTC(2026, 10, 7, 21));
    const lst = lstDeg(d, lon);
    // Put each star on the meridian by choosing its RA = LST.
    for (const dec of [-30, -10, 0, 20, 38.8, 41]) {
      const h = horizontalFromEquatorial(lst, dec, lst, lat);
      expect(Math.abs(h.alt - (90 - lat + dec))).toBeLessThan(0.1);
      expect(h.az).toBeCloseTo(180, 6); // culminates due south of a northern observer
    }
  });

  it('real catalogue stars at upper culmination obey 90° − φ + δ (±0.1°)', () => {
    // Search the night for the moment each star's hour angle is zero.
    const vega = starByName('Vega')!, altair = starByName('Altair')!, fomalhaut = starByName('Fomalhaut')!;
    for (const s of [vega, altair, fomalhaut]) {
      const t0 = Date.UTC(2026, 10, 7, 0);
      let best = { t: t0, ha: 999 };
      for (let m = 0; m < 24 * 60 * 1.01; m += 0.25) {
        const d = new Date(t0 + m * 60e3);
        const p = apparentPlace(s, d, lstDeg(d, lon), lat);
        const ha = Math.abs(wrap180(lstDeg(d, lon) - p.ra));
        if (ha < best.ha) best = { t: d.getTime(), ha };
      }
      const d = new Date(best.t);
      const p = apparentPlace(s, d, lstDeg(d, lon), lat);
      expect(Math.abs(p.alt - (90 - lat + p.dec))).toBeLessThan(0.1);
    }
  });

  it('azimuth is measured from north toward east', () => {
    expect(horizontalFromHourAngle(-90, 0, lat).az).toBeCloseTo(90, 6);  // rising due east
    expect(horizontalFromHourAngle(90, 0, lat).az).toBeCloseTo(270, 6);  // setting due west
    expect(horizontalFromHourAngle(0, 0, lat).az).toBeCloseTo(180, 6);   // south on the meridian
    expect(horizontalFromHourAngle(180, 60, lat).az).toBeCloseTo(0, 6);  // circumpolar star below the pole
    // A star east of the meridian has an azimuth between 0° and 180°.
    expect(horizontalFromHourAngle(-30, 20, lat).az).toBeGreaterThan(90);
    expect(horizontalFromHourAngle(-30, 20, lat).az).toBeLessThan(180);
  });

  it('horizontal → equatorial inverts equatorial → horizontal', () => {
    for (const [ha, dec] of [[-100, 10], [30, -20], [170, 70], [-5, 50]]) {
      const h = horizontalFromHourAngle(ha, dec, lat);
      const back = hourAngleFromHorizontal(h.alt, h.az, lat);
      expect(back.ha).toBeCloseTo(ha, 6);
      expect(back.dec).toBeCloseTo(dec, 6);
    }
  });

  it('world direction: north = +Z, east = −X, up = +Y, and round-trips', () => {
    const [nx, , nz] = directionFromHorizontal(0, 0);
    expect(nz).toBeCloseTo(1); expect(nx).toBeCloseTo(0);
    const [ex] = directionFromHorizontal(0, 90);
    expect(ex).toBeCloseTo(-1);
    expect(directionFromHorizontal(90, 0)[1]).toBeCloseTo(1);
    const h = horizontalFromDirection(...directionFromHorizontal(33.3, 123.4));
    expect(h.alt).toBeCloseTo(33.3, 9); expect(h.az).toBeCloseTo(123.4, 9);
  });

  it('angular separation', () => {
    expect(angularSeparation(0, 0, 90, 0)).toBeCloseTo(90, 9);
    expect(angularSeparation(10, 89.9, 190, 89.9)).toBeCloseTo(0.2, 6);
    expect(angularSeparation(5, 5, 5, 5)).toBeCloseTo(0, 9);
  });
});

describe('catalogue', () => {
  it('holds only stars brighter than magnitude 4.5, with the bright navigation stars named', () => {
    expect(STARS.length).toBeGreaterThan(800);
    expect(STARS.every(s => s.mag < 4.5)).toBe(true);
    for (const n of ['Vega', 'Polaris', 'Sirius', 'Arcturus', 'Capella', 'Altair', 'Deneb']) {
      expect(NAMED_BRIGHT.some(s => s.name === n)).toBe(true);
    }
  });
  it('agrees with the prototype positions (J2000, to 0.01h / 0.05°)', () => {
    const proto: [string, number, number][] = [['Vega', 18.6156, 38.78], ['Polaris', 2.5303, 89.26], ['Sirius', 6.7525, -16.72]];
    for (const [name, raH, dec] of proto) {
      const s = starByName(name)!;
      expect(Math.abs(s.ra2000 / 15 - raH)).toBeLessThan(0.01);
      expect(Math.abs(s.dec2000 - dec)).toBeLessThan(0.05);
    }
  });
});

describe('observer and local time', () => {
  it('22:00 in Rome on 7 Nov 2026 is 21:00 UTC (CET), and in July is 20:00 UTC (CEST)', () => {
    expect(zonedToUtc({ tz: 'Europe/Rome' }, 2026, 11, 7, 22 * 60).toISOString()).toBe('2026-11-07T21:00:00.000Z');
    expect(zonedToUtc({ tz: 'Europe/Rome' }, 2026, 7, 7, 22 * 60).toISOString()).toBe('2026-07-07T20:00:00.000Z');
  });
  it('defaults to Rome at 22:00, and minutes after noon roll past midnight', () => {
    const o = new Observer({ date: '2026-11-07' }, false);
    expect(o.place).toBe(PLACES[0]);
    expect(o.lat).toBeCloseTo(41.9); expect(o.lon).toBeCloseTo(12.5);
    expect(o.clockLabel).toBe('22:00');
    expect(o.utc.toISOString()).toBe('2026-11-07T21:00:00.000Z');
    o.setMinutes(780); // 01:00 next morning
    expect(o.utc.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(o.localDate).toBe('2026-11-08');
  });
});
