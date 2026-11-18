// Star catalogue: the HYG database trimmed to stars brighter than magnitude 4.5
// (see scripts/build-catalogue.mjs). Positions are J2000; use apparentPlace()
// to bring them to the date being observed.
import raw from '../data/stars.json';
import { horizontalFromEquatorial, precessFromJ2000 } from './astro';

export interface Star {
  /** Index into STARS. */
  id: number;
  hip: number;
  /** J2000 right ascension and declination, degrees. */
  ra2000: number;
  dec2000: number;
  mag: number;
  bv: number;
  /** Proper name, or '' */
  name: string;
  /** Bayer/Flamsteed designation + constellation, e.g. "Alp Lyr". */
  designation: string;
  con: string;
}

type Row = [number, number, number, number, number, string, string, string];

export const CATALOGUE_SOURCE: string = raw.source;
export const CATALOGUE_LICENSE: string = raw.license;

export const STARS: Star[] = (raw.stars as Row[]).map((r, id) => ({
  id, hip: r[0], ra2000: r[1], dec2000: r[2], mag: r[3], bv: r[4], name: r[5],
  designation: r[6] ? `${r[6]} ${r[7]}` : '', con: r[7],
}));

/** Named stars bright enough to find easily: used for target lists and sky labels. */
export const NAVIGATION_MAG = 2.5;
export const NAMED_BRIGHT: Star[] = STARS.filter(s => s.name && s.mag <= NAVIGATION_MAG);

export function starByName(name: string): Star | undefined {
  return STARS.find(s => s.name === name);
}

export function displayName(s: Star): string {
  return s.name || s.designation || `HIP ${s.hip}`;
}

/** A star's position on a given date for a given observer. */
export interface StarPlace {
  ra: number;
  dec: number;
  alt: number;
  az: number;
}

/**
 * Positions of every star for one instant. Precession is applied once per call;
 * it changes by only ~0.014° per year, so callers may reuse `equatorial` across
 * a night and only redo the cheap alt/az step.
 */
export function equatorialOfDate(date: Date): { ra: Float64Array; dec: Float64Array } {
  const ra = new Float64Array(STARS.length), dec = new Float64Array(STARS.length);
  STARS.forEach((s, i) => {
    const p = precessFromJ2000(s.ra2000, s.dec2000, date);
    ra[i] = p.ra; dec[i] = p.dec;
  });
  return { ra, dec };
}

export function apparentPlace(s: Star, date: Date, lst: number, lat: number): StarPlace {
  const p = precessFromJ2000(s.ra2000, s.dec2000, date);
  const h = horizontalFromEquatorial(p.ra, p.dec, lst, lat);
  return { ra: p.ra, dec: p.dec, alt: h.alt, az: h.az };
}

/**
 * Approximate RGB colour (0–1) of a star from its B−V index:
 * Ballesteros (2012) temperature, then a blackbody fit, gently desaturated.
 */
export function starColour(bv: number): [number, number, number] {
  const b = Math.max(-0.4, Math.min(2.0, bv));
  const T = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const t = T / 100;
  let r: number, g: number, bl: number;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) bl = 255; else if (t <= 19) bl = 0; else bl = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  const mix = 0.55; // pull toward white: naked-eye star colours are subtle
  return [c(r) * mix + (1 - mix), c(g) * mix + (1 - mix), c(bl) * mix + (1 - mix)];
}
