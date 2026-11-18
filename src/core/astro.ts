// Positional astronomy used by every instrument.
//
// Conventions
// - Angles are in degrees unless a name ends in "Rad".
// - Right ascension is in degrees (0–360), not hours.
// - Longitude is positive east of Greenwich.
// - Azimuth is measured from north toward east (N = 0°, E = 90°, S = 180°, W = 270°).
// - Altitudes are geometric (no atmospheric refraction).

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

/** Wrap an angle into [0, 360). */
export function wrap360(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Wrap an angle into [-180, 180). */
export function wrap180(a: number): number {
  return wrap360(a + 180) - 180;
}

/** Julian Date for a JS Date (which is always UTC internally). */
export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Julian centuries since J2000.0. */
export function centuriesSinceJ2000(date: Date): number {
  return (julianDate(date) - 2451545.0) / 36525;
}

/** Greenwich mean sidereal time in degrees (Meeus, Astronomical Algorithms, eq. 12.4). */
export function gmstDeg(date: Date): number {
  const jd = julianDate(date);
  const T = (jd - 2451545.0) / 36525;
  return wrap360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
}

/** Local mean sidereal time in degrees for an east-positive longitude. */
export function lstDeg(date: Date, lonDeg: number): number {
  return wrap360(gmstDeg(date) + lonDeg);
}

export interface Equatorial {
  ra: number;
  dec: number;
}

export interface Horizontal {
  alt: number;
  az: number;
}

/**
 * Precess J2000 mean coordinates to the mean equator and equinox of `date`
 * (rigorous method, Meeus eq. 21.2–21.4). Nutation and aberration are ignored;
 * they shift stars by well under 0.01°.
 */
export function precessFromJ2000(ra: number, dec: number, date: Date): Equatorial {
  const t = centuriesSinceJ2000(date);
  const as = D2R / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * as;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * as;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * as;
  const a0 = ra * D2R, d0 = dec * D2R;
  const A = Math.cos(d0) * Math.sin(a0 + zeta);
  const B = Math.cos(theta) * Math.cos(d0) * Math.cos(a0 + zeta) - Math.sin(theta) * Math.sin(d0);
  const C = Math.sin(theta) * Math.cos(d0) * Math.cos(a0 + zeta) + Math.cos(theta) * Math.sin(d0);
  return { ra: wrap360((Math.atan2(A, B) + z) * R2D), dec: Math.asin(Math.max(-1, Math.min(1, C))) * R2D };
}

/** Altitude and azimuth from hour angle, declination and latitude. */
export function horizontalFromHourAngle(haDeg: number, dec: number, lat: number): Horizontal {
  const H = haDeg * D2R, p = lat * D2R, d = dec * D2R;
  const sinAlt = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(H));
  return { alt: alt * R2D, az: wrap360(az * R2D) };
}

/** Altitude and azimuth of an object given its RA/Dec and the local sidereal time. */
export function horizontalFromEquatorial(ra: number, dec: number, lst: number, lat: number): Horizontal {
  return horizontalFromHourAngle(lst - ra, dec, lat);
}

/** Inverse of horizontalFromHourAngle: hour angle (degrees, -180..180) and declination. */
export function hourAngleFromHorizontal(alt: number, az: number, lat: number): { ha: number; dec: number } {
  const a = alt * D2R, A = az * D2R, p = lat * D2R;
  const sinDec = Math.sin(p) * Math.sin(a) + Math.cos(p) * Math.cos(a) * Math.cos(A);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const ha = Math.atan2(-Math.cos(a) * Math.sin(A), Math.cos(p) * Math.sin(a) - Math.sin(p) * Math.cos(a) * Math.cos(A));
  return { ha: wrap180(ha * R2D), dec: dec * R2D };
}

/** Great-circle angle between two points given as (longitude-like, latitude-like) pairs. */
export function angularSeparation(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
  // Vincenty form: stable for both tiny and near-180° separations.
  const y = Math.hypot(Math.cos(p2) * Math.sin(dl), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
  const x = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return Math.atan2(y, x) * R2D;
}

/** Unit vector for (alt, az) in the world frame shared by every scene: north = +Z, east = −X, up = +Y. */
export function directionFromHorizontal(alt: number, az: number): [number, number, number] {
  const a = alt * D2R, A = az * D2R;
  return [-Math.cos(a) * Math.sin(A), Math.sin(a), Math.cos(a) * Math.cos(A)];
}

/** Inverse of directionFromHorizontal (the vector need not be normalised). */
export function horizontalFromDirection(x: number, y: number, z: number): Horizontal {
  const r = Math.hypot(x, y, z);
  return { alt: Math.asin(y / r) * R2D, az: wrap360(Math.atan2(-x, z) * R2D) };
}
