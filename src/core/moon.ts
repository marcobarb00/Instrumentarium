// The moon's place: Meeus, Astronomical Algorithms, ch. 47 (the main terms of
// ELP-2000/82, about 10″ in longitude), then the shift to where it is seen from
// a place on the Earth's surface (parallax, Meeus ch. 11 and 40).
//
// The periodic terms below are copied from the astronomia library's encoding
// of Meeus's Tables 47.A and 47.B (github.com/commenthol/astronomia,
// src/moonposition.js, MIT licence, © 2013 Sonia Keys, © 2016 commenthol), and
// checked against Meeus's worked example 47.a in tests/moon.test.ts.
//
// Times are taken as UTC (the ~70 s of ΔT moves the moon by 0.01°).
import { centuriesSinceJ2000, D2R, R2D, wrap360, type Equatorial } from './astro';
import { eclipticFromEquatorial, equatorialFromEcliptic, type Ecliptic } from './ecliptic';
import { meanObliquity } from './sun';

/** Mean radius of the moon and equatorial radius of the Earth, km. */
export const MOON_RADIUS_KM = 1737.4;
const EARTH_RADIUS_KM = 6378.14;

// D, M, M′, F, Σl (1e-6°), Σr (1e-3 km)
const LR: number[][] = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];

// D, M, M′, F, Σb (1e-6°)
const B: number[][] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351], [4, 0, 0, 1, 331], [2, -1, 1, 1, 315], [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132], [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107],
];

const poly = (T: number, ...c: number[]) => c.reduceRight((acc, k) => acc * T + k, 0);

export interface MoonPlace extends Ecliptic {
  /** Distance from the Earth's centre (or from the observer, for the topocentric place), km. */
  dist: number;
}

/** Geocentric ecliptic longitude and latitude (mean equinox of date) and distance. */
export function moonGeocentric(date: Date): MoonPlace {
  const T = centuriesSinceJ2000(date);
  const Lp = poly(T, 218.3164477, 481267.88123421, -0.0015786, 1 / 538841, -1 / 65194000) * D2R;
  const D = poly(T, 297.8501921, 445267.1114034, -0.0018819, 1 / 545868, -1 / 113065000) * D2R;
  const M = poly(T, 357.5291092, 35999.0502909, -0.0001536, 1 / 24490000) * D2R;
  const Mp = poly(T, 134.9633964, 477198.8675055, 0.0087414, 1 / 69699, -1 / 14712000) * D2R;
  const F = poly(T, 93.272095, 483202.0175233, -0.0036539, -1 / 3526000, 1 / 863310000) * D2R;
  const A1 = (119.75 + 131.849 * T) * D2R, A2 = (53.09 + 479264.29 * T) * D2R, A3 = (313.45 + 481266.484 * T) * D2R;
  const E = poly(T, 1, -0.002516, -0.0000074);
  const ecc = (m: number) => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E);

  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of LR) {
    const a = d * D + m * M + mp * Mp + f * F, k = ecc(m);
    sl += l * k * Math.sin(a); sr += r * k * Math.cos(a);
  }
  for (const [d, m, mp, f, b] of B) sb += b * ecc(m) * Math.sin(d * D + m * M + mp * Mp + f * F);
  sl += 3958 * Math.sin(A1) + 1962 * Math.sin(Lp - F) + 318 * Math.sin(A2);
  sb += -2235 * Math.sin(Lp) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F) + 175 * Math.sin(A1 + F)
    + 127 * Math.sin(Lp - Mp) - 115 * Math.sin(Lp + Mp);
  return { lon: wrap360(Lp * R2D + sl * 1e-6), lat: sb * 1e-6, dist: 385000.56 + sr * 1e-3 };
}

/**
 * The moon as seen from a place (latitude, east longitude) at sidereal time
 * `lst`: right ascension, declination, ecliptic longitude and latitude of date,
 * and distance from the observer. Up to a degree from the geocentric place.
 */
export function moonTopocentric(date: Date, lat: number, lst: number): MoonPlace & Equatorial {
  const g = moonGeocentric(date), eps = meanObliquity(date);
  const q = equatorialFromEcliptic(g.lon, g.lat, eps);
  const a = q.ra * D2R, d = q.dec * D2R;
  // Observer on the spheroid at sea level (Meeus 11): ρ sin φ′, ρ cos φ′ in Earth radii.
  const u = Math.atan(0.99664719 * Math.tan(lat * D2R));
  const rs = 0.99664719 * Math.sin(u) * EARTH_RADIUS_KM, rc = Math.cos(u) * EARTH_RADIUS_KM, t = lst * D2R;
  const x = g.dist * Math.cos(d) * Math.cos(a) - rc * Math.cos(t);
  const y = g.dist * Math.cos(d) * Math.sin(a) - rc * Math.sin(t);
  const z = g.dist * Math.sin(d) - rs;
  const dist = Math.hypot(x, y, z);
  const ra = wrap360(Math.atan2(y, x) * R2D), dec = Math.asin(z / dist) * R2D;
  return { ra, dec, ...eclipticFromEquatorial(ra, dec, eps), dist };
}

/** Apparent radius of the moon's disc seen from `distKm`, degrees. */
export function moonSemidiameter(distKm: number): number {
  return Math.asin(MOON_RADIUS_KM / distKm) * R2D;
}
