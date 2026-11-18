import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal, horizontalFromEquatorial, wrap180 } from '../src/core/astro';
import { apparentPlace, starByName } from '../src/core/catalogue';
import { eclipticFromEquatorial } from '../src/core/ecliptic';
import { moonTopocentric } from '../src/core/moon';
import { Observer } from '../src/core/observer';
import { meanObliquity } from '../src/core/sun';
import { PtolemyArmillary } from '../src/instruments/armillary/model';

const R2D = 180 / Math.PI;
const dirOf = (alt: number, az: number) => new THREE.Vector3(...directionFromHorizontal(alt, az));
const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const lonErr = (a: number, b: number) => Math.abs(wrap180(a - b));

describe("Ptolemy's armillary", () => {
  const eps = 23.44;
  const m = new PtolemyArmillary(eps);

  it('the meridian, read at the index on the stand, gives the elevation of the pole', () => {
    for (const lat of [0.5, 12.25, 31.2, 41.9, 51.5, 55.91, 78, -33.87, -12.5, -60]) {
      m.setPole(lat); m.pose();
      for (const side of [1, -1] as const) expect(Math.abs(m.readPole(side) - Math.abs(lat))).toBeLessThan(0.01);
    }
  });

  it('each pointer reads its ring\'s longitude on both faces of the ecliptic ring, and the index reads the latitude', () => {
    for (let i = 0; i < 60; i++) {
      const o = 360 * rnd(), n = 360 * rnd(), b = -80 + 160 * rnd();
      m.setPole(-60 + 120 * rnd()); m.setTurn(360 * rnd()); m.setOuter(o); m.setInner(n); m.setSight(b); m.pose();
      for (const face of [1, -1] as const) {
        expect(lonErr(m.readOuter(face), o)).toBeLessThan(0.01);
        expect(lonErr(m.readInnerLon(face), n)).toBeLessThan(0.01);
      }
      for (const side of [1, -1] as const) expect(Math.abs(m.readLat(side) - b)).toBeLessThan(0.01);
    }
  });

  it('turned to the sky (turn = −LST), the sights set to a longitude and latitude look at that point of the sky', () => {
    for (let i = 0; i < 100; i++) {
      const lat = -70 + 140 * rnd(), lst = 360 * rnd(), lon = 360 * rnd(), b = -70 + 140 * rnd();
      m.setPole(lat); m.setTurn(-lst); m.setInner(lon); m.setSight(b); m.pose();
      const q = (() => {
        // Point at λ, β → RA, Dec → altitude and azimuth.
        const l = lon / R2D, bb = b / R2D, e = eps / R2D;
        const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(bb) * Math.sin(e), Math.cos(l)) * R2D;
        const dec = Math.asin(Math.sin(bb) * Math.cos(e) + Math.cos(bb) * Math.sin(e) * Math.sin(l)) * R2D;
        return horizontalFromEquatorial(ra, dec, lst, lat);
      })();
      expect(m.sightAim().angleTo(dirOf(q.alt, q.az)) * R2D).toBeLessThan(1e-4);
    }
  });

  it('pointing the sights at a direction and reading the rings gives back its ecliptic coordinates', () => {
    const obs = new Observer({ date: '2026-11-15', minutes: 600 }, false);
    const e = meanObliquity(obs.utc), mm = new PtolemyArmillary(e);
    mm.setPole(obs.lat); mm.setTurn(-obs.lst);
    for (const name of ['Aldebaran', 'Capella', 'Vega', 'Altair', 'Deneb', 'Betelgeuse', 'Rigel', 'Fomalhaut']) {
      const s = starByName(name)!;
      const p = apparentPlace(s, obs.utc, obs.lst, obs.lat), truth = eclipticFromEquatorial(p.ra, p.dec, e);
      mm.pointSightsAt(dirOf(p.alt, p.az));
      expect(lonErr(mm.readInnerLon(), truth.lon)).toBeLessThan(0.01);
      expect(Math.abs(mm.readLat() - truth.lat)).toBeLessThan(0.01);
    }
  });

  it('set from the moon: outer ring at its longitude, rings turned until it lies on the ring, the instrument matches the sky', () => {
    for (const [date, minutes, lat, lon] of [['2026-11-20', 480, 41.9, 12.5], ['2026-11-25', 600, 51.5, -0.1], ['2026-12-03', 900, -33.87, 151.2]] as const) {
      const obs = new Observer({ date, minutes, place: { id: 'custom', name: 'test', lat, lon } }, false);
      const e = meanObliquity(obs.utc), mm = new PtolemyArmillary(e);
      const moon = moonTopocentric(obs.utc, obs.lat, obs.lst), h = horizontalFromEquatorial(moon.ra, moon.dec, obs.lst, obs.lat);
      mm.setPole(obs.lat); mm.setOuter(moon.lon);
      // Start near the right turn, as an observer who knows roughly where the ecliptic lies.
      mm.setTurn(-obs.lst + 25); mm.pose();
      expect(mm.turnToBringOuterTo(dirOf(h.alt, h.az))).toBe(true);
      expect(Math.abs(wrap180(mm.turn + obs.lst))).toBeLessThan(1e-6);
      expect(mm.offOuterPlane(dirOf(h.alt, h.az))).toBeLessThan(1e-6);
      expect(lonErr(mm.readOuter(), moon.lon)).toBeLessThan(0.01);
    }
  });

  it('set from a reference star, the sights then measure another star as the catalogue gives it', () => {
    const obs = new Observer({ date: '2026-11-15', minutes: 660 }, false);
    const e = meanObliquity(obs.utc), mm = new PtolemyArmillary(e);
    const ref = starByName('Aldebaran')!, rp = apparentPlace(ref, obs.utc, obs.lst, obs.lat);
    mm.setPole(obs.lat); mm.setOuter(eclipticFromEquatorial(rp.ra, rp.dec, e).lon);
    mm.setTurn(-obs.lst - 30); mm.pose();
    expect(mm.turnToBringOuterTo(dirOf(rp.alt, rp.az))).toBe(true);
    const s = starByName('Capella')!, p = apparentPlace(s, obs.utc, obs.lst, obs.lat), truth = eclipticFromEquatorial(p.ra, p.dec, e);
    mm.pointSightsAt(dirOf(p.alt, p.az));
    expect(lonErr(mm.readInnerLon(), truth.lon)).toBeLessThan(0.01);
    expect(Math.abs(mm.readLat() - truth.lat)).toBeLessThan(0.01);
  });

  it('the line through the sights is open: nothing of the sighting or inner ring is in the way', () => {
    for (let i = 0; i < 40; i++) {
      m.setPole(41.9); m.setTurn(360 * rnd()); m.setOuter(360 * rnd()); m.setInner(360 * rnd()); m.setSight(-70 + 140 * rnd()); m.pose();
      const eye = m.sightEye(), aim = m.sightAim(), far = m.farSight();
      const ray = new THREE.Raycaster(eye.clone().addScaledVector(aim, 0.003), aim, 0, eye.distanceTo(far) + 0.004);
      // Between the sights the line runs beside the rings' faces.
      const hits = ray.intersectObjects([m.inner, m.sighting], true).filter(h => !(h.object instanceof THREE.Object3D && h.object.type === 'Object3D'));
      const blocking = hits.filter(h => Math.abs(h.distance - eye.distanceTo(far)) > 0.003);
      expect(blocking.length).toBe(0);
    }
  });

  it('the eye along the outer ring is exactly level with its face, and the sight views can show parts alone', () => {
    m.setPole(41.9); m.setTurn(40); m.setOuter(120); m.pose();
    for (const psi of [-50, 0, 30]) expect(Math.abs(m.outerNormal().dot(m.outerEye(psi).sub(m.centre())) - 0.004)).toBeLessThan(1e-9);
    const meshes = (o: THREE.Object3D) => { const l: THREE.Mesh[] = []; o.traverse(n => { if ((n as THREE.Mesh).isMesh) l.push(n as THREE.Mesh); }); return l; };
    m.isolate([m.outer]);
    expect(meshes(m.outer).every(x => x.visible)).toBe(true);
    expect(meshes(m.root).filter(x => x.visible).length).toBe(meshes(m.outer).length);
    m.isolate(null);
    expect(meshes(m.root).every(x => x.visible)).toBe(true);
  });

  it('seen along the outer ring, the line of sight lies in its plane and clears the rings inside it', () => {
    for (let i = 0; i < 40; i++) {
      m.setPole(41.9); m.setTurn(360 * rnd()); m.setOuter(360 * rnd()); m.setInner(360 * rnd()); m.setSight(-60 + 120 * rnd()); m.pose();
      const psi = -60 + 120 * rnd(), eye = m.outerEye(psi), aim = m.outerAim(psi);
      expect(Math.abs(m.outerNormal().dot(aim))).toBeLessThan(1e-9);
      expect(m.outerPsiToward(aim)).toBeCloseTo(psi, 9);
      const hits = new THREE.Raycaster(eye, aim, 0, 1).intersectObjects([m.inner, m.sighting, ...m.solids.slice(1, 3)], true);
      expect(hits.length).toBe(0);
    }
  });
});
