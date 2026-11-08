import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal, lstDeg, wrap180 } from '../src/core/astro';
import { apparentPlace, STARS } from '../src/core/catalogue';
import { Observer, PLACES } from '../src/core/observer';
import { apparentSolarTime, eclipticToEquatorial, equationOfTime, meanObliquity, sunLongitude, zodiacPlace } from '../src/core/sun';
import { horizontalToPlate, limbHours, plateGeometry, plateToHorizontal } from '../src/instruments/astrolabe/geometry';
import { AstrolabeModel } from '../src/instruments/astrolabe/model';

const R2D = 180 / Math.PI;
const hoursDiffMin = (a: number, b: number) => wrap180((a - b) * 15) * 4; // minutes, across midnight

describe('the sun', () => {
  // Meeus, Astronomical Algorithms, example 25.a: 1992 October 13.0 TD.
  const d = new Date(Date.UTC(1992, 9, 13));
  it('longitude, right ascension and declination match Meeus example 25.a', () => {
    expect(Math.abs(sunLongitude(d) - 199.909)).toBeLessThan(0.002);
    const e = eclipticToEquatorial(sunLongitude(d), meanObliquity(d));
    expect(Math.abs(e.ra - (13 + 13 / 60 + 31.4 / 3600) * 15)).toBeLessThan(0.003);
    expect(Math.abs(e.dec - -(7 + 47 / 60 + 6 / 3600))).toBeLessThan(0.003);
  });
  it('equation of time matches Meeus example 28.a (+13m42.6s) and peaks near +16.4 min in early November', () => {
    expect(Math.abs(equationOfTime(d) - (13 + 42.6 / 60))).toBeLessThan(0.1);
    expect(equationOfTime(new Date(Date.UTC(2026, 10, 3, 12)))).toBeGreaterThan(16.2);
    expect(equationOfTime(new Date(Date.UTC(2026, 10, 3, 12)))).toBeLessThan(16.6);
  });
  it('names the place in the zodiac', () => {
    expect(zodiacPlace(225.4)).toBe('15°24′ of Scorpio');
    expect(zodiacPlace(29.9999)).toBe('0°00′ of Taurus');
  });
});

describe('astrolabe plate (stereographic projection)', () => {
  it('maps altitude and azimuth to the plate and back, north and south', () => {
    for (const lat of [41.9, 51.5, 10, -33.87]) {
      const g = plateGeometry(lat, 23.44);
      for (const [alt, az] of [[0, 90], [20, 300], [45, 10], [70, 200], [-10, 0], [5, 175]]) {
        const back = plateToHorizontal(...horizontalToPlate(alt, az, g), g);
        expect(back.alt).toBeCloseTo(alt, 8);
        expect(Math.abs(wrap180(back.az - az))).toBeLessThan(1e-7);
      }
    }
  });
  it('puts the east point on the equator circle at the left, and the rim at the Tropic of Capricorn', () => {
    const g = plateGeometry(41.9, 23.44);
    const [x, y] = horizontalToPlate(0, 90, g);
    expect(x).toBeCloseTo(-g.req, 9); expect(y).toBeCloseTo(0, 9);
    expect(g.req * Math.tan((90 + 23.44) / 2 * Math.PI / 180)).toBeCloseTo(1, 9);
  });
  it('limb: 12 at the top, 18 to the right (west), midnight at the bottom', () => {
    expect(limbHours(0)).toBe(12); expect(limbHours(90)).toBe(18); expect(limbHours(180)).toBe(0); expect(limbHours(-90)).toBe(6);
  });
});

/** Turn the rete, reading only the plate under the pointer, until the star sits on `alt` on the given side. */
function setReteByAltitude(m: AstrolabeModel, id: number, alt: number, east: boolean): boolean {
  const tip = new THREE.Vector3();
  const f = (psi: number) => {
    m.setRete(psi); m.pose();
    const r = m.plateReadingAt(m.pointerTip(id, tip)!)!;
    return { d: r.alt - alt, east: r.az < 180 };
  };
  for (let psi = 0; psi < 360; psi += 1) {
    const a = f(psi), b = f(psi + 1);
    if (a.east !== east || b.east !== east || Math.sign(a.d) === Math.sign(b.d)) continue;
    let lo = psi, hi = psi + 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(f(mid).d) === Math.sign(a.d)) lo = mid; else hi = mid;
    }
    f((lo + hi) / 2);
    return true;
  }
  return false;
}

function checkPlace(placeIdx: number, date: string): void {
  const obs = new Observer({ place: PLACES[placeIdx], date }, false);
  const m = new AstrolabeModel();
  m.configure(obs.lat, obs.utc);
  const ids = m.reteStarIds();
  const stars = [...ids].map(id => ({ s: STARS[id], p: apparentPlace(STARS[id], obs.utc, obs.lst, obs.lat) }))
    .filter(x => x.p.alt > 3 && x.p.alt < 85);
  expect(stars.length).toBeGreaterThan(6);
  const solar = apparentSolarTime(obs.utc, obs.lon);
  let timed = 0;
  for (const { s, p } of stars) {
    // Back: aimed exactly at the star, the sights point at it and the alidade reads its altitude.
    m.setAim(p.az, p.alt); m.pose();
    const want = new THREE.Vector3(...directionFromHorizontal(p.alt, p.az));
    expect(m.sightDirection().angleTo(want) * R2D).toBeLessThan(1e-4);
    expect(Math.abs(m.readAlidade() - p.alt)).toBeLessThan(0.01);

    // Front: set the rete from that altitude alone, then lay the rule over the sun. Near the
    // meridian a star's altitude hardly changes with time, so (as astrolabists did) only
    // stars at least 25° of hour angle from it are used to find the time.
    const ha = Math.abs(wrap180(obs.lst - p.ra));
    if (ha < 25 || ha > 155) continue;
    timed++;
    expect(setReteByAltitude(m, s.id, m.readAlidade(), p.az < 180)).toBe(true);
    expect(Math.abs(wrap180(m.reteAngle - obs.lst))).toBeLessThan(0.1);    // the rete shows the sidereal time
    m.setRule(m.frontAngleOf(m.sunPoint())); m.pose();
    expect(Math.abs(hoursDiffMin(m.readRule(m.ruleEndOverSun()), solar))).toBeLessThan(0.5);
  }
  expect(timed).toBeGreaterThan(5);
}

describe('astrolabe model', () => {
  it('Rome, 22:00 on 7 Nov 2026: alidade reads each star’s altitude; rete + rule give the sundial time', () => checkPlace(0, '2026-11-07'));
  it('Sydney (southern plate): the same holds', () => checkPlace(5, '2026-11-07'));
  it('reads the rule at both ends 12 hours apart', () => {
    const m = new AstrolabeModel();
    m.configure(41.9, new Date(Date.UTC(2026, 10, 7, 21)));
    for (const psi of [0, 37.5, 150, 271.25]) {
      m.setRule(psi); m.pose();
      expect(Math.abs(hoursDiffMin(m.readRule(1), limbHours(psi)))).toBeLessThan(0.1);
      expect(Math.abs(hoursDiffMin(m.readRule(-1), limbHours(psi + 180)))).toBeLessThan(0.1);
    }
  });
  it('the rete’s sidereal angle matches LST (sanity of Observer)', () => {
    const obs = new Observer({ date: '2026-11-07' }, false);
    expect(obs.lst).toBeCloseTo(lstDeg(obs.utc, obs.lon), 9);
  });
});
