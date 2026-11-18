import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { angularSeparation, directionFromHorizontal } from '../src/core/astro';
import { apparentPlace, starByName } from '../src/core/catalogue';
import { Observer } from '../src/core/observer';
import { angleAt, angleRange, distanceFor, TRANSOMS } from '../src/instruments/cross-staff/drawings';
import { CrossStaff } from '../src/instruments/cross-staff/model';

const R2D = 180 / Math.PI;
const rnd = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const randomDir = () => {
  const z = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
};

describe('cross-staff', () => {
  it('the scale and the geometry agree: the mark for θ is where the ends span θ', () => {
    for (const t of TRANSOMS) for (const a of [5, 12.5, 30, 45, 60, 89]) {
      const [lo, hi] = angleRange(t);
      if (a < lo || a > hi) continue;
      expect(angleAt(t, distanceFor(t, a))).toBeCloseTo(a, 9);
    }
  });

  it('the three transoms together cover about 4° to 90°', () => {
    const [lo] = angleRange(TRANSOMS[0]), [, hi] = angleRange(TRANSOMS[2]);
    expect(lo).toBeLessThan(4); expect(hi).toBeGreaterThan(89.99);
    for (let i = 0; i < 2; i++) expect(angleRange(TRANSOMS[i])[1]).toBeGreaterThan(angleRange(TRANSOMS[i + 1])[0]);
  });

  it('roll 0 holds the transom level, and its +X end is on the observer’s right', () => {
    const c = new CrossStaff();
    c.setAim(new THREE.Vector3(0, 0.3, 1)); c.setRoll(0); c.pose();
    const right = c.endPoint(1).sub(c.endPoint(-1));
    expect(Math.abs(right.y)).toBeLessThan(1e-9);
    expect(right.x).toBeLessThan(0); // looking north, the right hand is east (−X)
    c.setRoll(90); c.pose();
    expect(c.endPoint(1).y).toBeGreaterThan(c.endPoint(-1).y); // counter-clockwise: the right end comes up
  });

  it('framed on two directions, the ends touch them and the staff reads their angle through its scale', () => {
    const c = new CrossStaff();
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const a = randomDir(), b = randomDir(), sep = a.angleTo(b) * R2D;
      const k = TRANSOMS.findIndex(t => { const [lo, hi] = angleRange(t); return sep > lo && sep < hi; });
      if (k < 0) continue;
      c.setTransom(k);
      expect(c.frame(a, b)).toBe(true);
      expect(c.endDirection(1).angleTo(a) * R2D).toBeLessThan(1e-5);
      expect(c.endDirection(-1).angleTo(b) * R2D).toBeLessThan(1e-5);
      expect(Math.abs(c.readAngle() - sep)).toBeLessThan(0.01);
      n++;
    }
    expect(n).toBeGreaterThan(60);
  });

  it('real stars: the staff gives the catalogue separation', () => {
    const obs = new Observer({ date: '2027-01-20', minutes: 600 }, false);
    const c = new CrossStaff();
    for (const [p, q] of [['Castor', 'Pollux'], ['Betelgeuse', 'Rigel'], ['Aldebaran', 'Betelgeuse'], ['Capella', 'Castor'], ['Sirius', 'Procyon']]) {
      const s1 = apparentPlace(starByName(p)!, obs.utc, obs.lst, obs.lat), s2 = apparentPlace(starByName(q)!, obs.utc, obs.lst, obs.lat);
      const truth = angularSeparation(s1.ra, s1.dec, s2.ra, s2.dec);
      const k = TRANSOMS.findIndex(t => { const [lo, hi] = angleRange(t); return truth > lo && truth < hi; });
      c.setTransom(k);
      c.frame(new THREE.Vector3(...directionFromHorizontal(s1.alt, s1.az)), new THREE.Vector3(...directionFromHorizontal(s2.alt, s2.az)));
      expect(Math.abs(c.readAngle() - truth)).toBeLessThan(0.01);
    }
  });

  it('the transom stays on the staff: it cannot be slid past the ends of its range', () => {
    const c = new CrossStaff();
    c.setTransom(2); c.setDistance(0.01);
    expect(c.distance).toBe(TRANSOMS[2].dMin);
    c.setDistance(5);
    expect(c.distance).toBe(TRANSOMS[2].dMax);
  });
});
