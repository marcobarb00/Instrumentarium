import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal, horizontalFromEquatorial, horizontalFromHourAngle, lstDeg, wrap180 } from '../src/core/astro';
import { apparentPlace, NAMED_BRIGHT } from '../src/core/catalogue';
import { Observer } from '../src/core/observer';
import { riseTime } from '../src/core/rising';
import { apparentSolarTime, eclipticToEquatorial, meanObliquity, sunEquatorial, sunLongitude } from '../src/core/sun';
import { amplitudeOf } from '../src/instruments/armillary/drawings';
import { ArmillaryModel } from '../src/instruments/armillary/model';

const R2D = 180 / Math.PI;
const dirOf = (alt: number, az: number) => new THREE.Vector3(...directionFromHorizontal(alt, az));
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

describe('armillary sphere', () => {
  const m = new ArmillaryModel(23.44);

  it('a point set by right ascension and declination lies, seen from the Earth, where that star is in the sky', () => {
    for (let i = 0; i < 200; i++) {
      const lat = -80 + 160 * rnd(), lst = 360 * rnd(), ra = 360 * rnd(), dec = -85 + 170 * rnd();
      m.setPole(lat); m.setSky(lst, 0); m.setStar({ ra, dec }); m.pose();
      const h = horizontalFromEquatorial(ra, dec, lst, lat);
      expect(m.starDirection().angleTo(dirOf(h.alt, h.az)) * R2D).toBeLessThan(1e-5);
    }
  });

  it('the sun on the zodiac lies where the sun is in the sky', () => {
    const obs = new Observer({ date: '2026-11-07' }, false);
    for (const minutes of [0, 300, 600, 900]) {
      obs.minutes = minutes;
      const eps = meanObliquity(obs.utc);
      const mm = new ArmillaryModel(eps);
      mm.setPole(obs.lat); mm.setSky(obs.lst, sunLongitude(obs.utc)); mm.pose();
      const s = sunEquatorial(obs.utc), h = horizontalFromEquatorial(s.ra, s.dec, obs.lst, obs.lat);
      expect(mm.sunDirection().angleTo(dirOf(h.alt, h.az)) * R2D).toBeLessThan(1e-4);
    }
  });

  it('the meridian, read where the horizon cuts it, gives the elevation of the raised pole', () => {
    for (const lat of [0.5, 12.25, 31.2, 41.9, 51.5, 55.91, 78, -33.87, -12.5, -60]) {
      m.setPole(lat); m.pose();
      for (const face of [1, -1] as const) expect(Math.abs(m.readLatitude(face) - Math.abs(lat))).toBeLessThan(0.01);
    }
  });

  it('the hour circle shows sundial time: XII with the sun on the meridian', () => {
    for (let i = 0; i < 50; i++) {
      const lst = 360 * rnd(), sunLon = 360 * rnd(), lat = -60 + 120 * rnd();
      m.setPole(lat); m.setSky(lst, sunLon); m.pose();
      const want = (((lst - eclipticToEquatorial(sunLon, 23.44).ra + 180) % 360) + 360) % 360 / 15;
      const got = m.readHour();
      expect(Math.abs(wrap180((got - want) * 15)) * 4).toBeLessThan(0.1); // minutes of time
    }
  });

  it('with the star on the horizon, the horizon ring reads the azimuth where it rises', () => {
    for (const [lat, dec, ra] of [[41.9, 38.8, 279.4], [41.9, -8.2, 78.6], [51.5, 28.0, 79.2], [-33.87, -40, 219.9], [10, 5, 30], [-33.87, 7.4, 88.8]]) {
      const H0 = Math.acos(-Math.tan(lat / R2D) * Math.tan(dec / R2D)) * R2D;
      m.setPole(lat); m.setSky(ra - H0, 0); m.setStar({ ra, dec }); m.pose();
      const d = m.starDirection();
      expect(Math.abs(Math.asin(d.y) * R2D)).toBeLessThan(1e-6);
      const truth = horizontalFromHourAngle(-H0, dec, lat).az;
      expect(Math.abs(wrap180(m.readHorizon(d) - truth))).toBeLessThan(0.02);
      expect(Math.abs(m.readAmplitude(d).signed - amplitudeOf(truth).signed)).toBeLessThan(0.02);
    }
  });

  it('amplitude: degrees north or south of the east and west points', () => {
    expect(amplitudeOf(90)).toMatchObject({ deg: 0, ew: 'E' });
    expect(amplitudeOf(60)).toMatchObject({ deg: 30, ns: 'N', ew: 'E' });
    expect(amplitudeOf(120)).toMatchObject({ deg: 30, ns: 'S', ew: 'E' });
    expect(amplitudeOf(300)).toMatchObject({ deg: 30, ns: 'N', ew: 'W' });
    expect(amplitudeOf(250)).toMatchObject({ deg: 20, ns: 'S', ew: 'W' });
  });

  it('a real star: set to its rising, the sphere reads the hour and the place the sky gives', () => {
    const obs = new Observer({ date: '2026-11-07', minutes: 0 }, false);
    const t0 = obs.utc, t1 = new Date(t0.getTime() + 86400e3);
    const stars = NAMED_BRIGHT.filter(s => Math.abs(apparentPlace(s, t0, 0, obs.lat).dec) < 89 - obs.lat);
    expect(stars.length).toBeGreaterThan(20);
    for (const s of stars) {
      const p = apparentPlace(s, t0, 0, obs.lat);
      const rise = riseTime(p.ra, p.dec, obs.lat, obs.lon, t0, t1)!;
      expect(rise).not.toBeNull();
      const lst = lstDeg(rise, obs.lon), h = horizontalFromEquatorial(p.ra, p.dec, lst, obs.lat);
      expect(Math.abs(h.alt)).toBeLessThan(1e-4);
      expect(horizontalFromEquatorial(p.ra, p.dec, lst + 1, obs.lat).alt).toBeGreaterThan(0); // rising, not setting
      const mm = new ArmillaryModel(meanObliquity(rise));
      mm.setPole(obs.lat); mm.setSky(lst, sunLongitude(rise)); mm.setStar({ ra: p.ra, dec: p.dec }); mm.pose();
      const d = mm.starDirection();
      expect(Math.abs(wrap180(mm.readHorizon(d) - h.az))).toBeLessThan(0.02);
      expect(Math.abs(wrap180((mm.readHour() - apparentSolarTime(rise, obs.lon)) * 15)) * 4).toBeLessThan(0.2);
    }
  });
});
