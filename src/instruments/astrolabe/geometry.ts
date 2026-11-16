// The mathematics of the astrolabe's front: stereographic projection of the
// sky onto the plane of the equator, from the south celestial pole.
//
// Plate coordinates (x, y) are in units of the plate radius, which is the
// Tropic of Capricorn. The north celestial pole is at the centre, y points up
// the meridian toward the south (and the zenith), x points west. A star with
// hour angle H and declination δ lies at distance req·tan((90° − δ)/2) from the
// centre, in direction H measured clockwise from up. So the sky turns
// clockwise: stars rise on the left (east), culminate at the top, set on the
// right (west).
//
// Southern latitudes use the mirror image (projection from the north pole,
// declinations negated), as southern astrolabes did; the "M" suffix marks
// values in that mirrored frame. For the north, they are the true values.
import { D2R, horizontalFromHourAngle, hourAngleFromHorizontal, R2D, wrap180, wrap360 } from '../../core/astro';

export interface PlateGeometry {
  lat: number;
  /** Obliquity of the ecliptic used for the tropics and the rete's ecliptic. */
  eps: number;
  /** +1 for a northern plate, −1 for a southern (mirrored) one. */
  s: 1 | -1;
  /** |latitude|: the latitude in the mirrored frame. */
  latM: number;
  /** Radius of the equator, in plate radii. */
  req: number;
}

export function plateGeometry(lat: number, eps: number): PlateGeometry {
  return { lat, eps, s: lat >= 0 ? 1 : -1, latM: Math.abs(lat), req: 1 / Math.tan((90 + eps) / 2 * D2R) };
}

export type XY = [number, number];

/** Distance from the centre of the circle of declination δ (mirrored frame). */
export function radiusOfDec(decM: number, g: PlateGeometry): number {
  return g.req * Math.tan((90 - decM) / 2 * D2R);
}

/** Point at angle ψ (degrees, clockwise from up) and radius r. */
export function polar(r: number, psi: number): XY {
  return [r * Math.sin(psi * D2R), r * Math.cos(psi * D2R)];
}

export function project(ha: number, decM: number, g: PlateGeometry): XY {
  return polar(radiusOfDec(decM, g), ha);
}

export function unproject(x: number, y: number, g: PlateGeometry): { ha: number; decM: number } {
  return { ha: wrap180(Math.atan2(x, y) * R2D), decM: 90 - 2 * Math.atan(Math.hypot(x, y) / g.req) * R2D };
}

/** True azimuth ↔ mirrored azimuth (the same map both ways). */
export function mirrorAz(az: number, g: PlateGeometry): number {
  return g.s > 0 ? az : wrap360(180 - az);
}

/** Where a point of the local sky (altitude, true azimuth) falls on the plate. */
export function horizontalToPlate(alt: number, az: number, g: PlateGeometry): XY {
  const e = hourAngleFromHorizontal(alt, mirrorAz(az, g), g.latM);
  return project(e.ha, e.dec, g);
}

/** The altitude and true azimuth of the plate's lines through a point. */
export function plateToHorizontal(x: number, y: number, g: PlateGeometry): { alt: number; az: number } {
  const e = unproject(x, y, g);
  const h = horizontalFromHourAngle(e.ha, e.decM, g.latM);
  return { alt: h.alt, az: mirrorAz(h.az, g) };
}

/**
 * A star's place on the rete (in the rete's own frame): where it would be with
 * the rete turned to 0°, i.e. at local sidereal time 0.
 */
export function retePoint(ra: number, dec: number, g: PlateGeometry): XY {
  return polar(radiusOfDec(g.s * dec, g), -ra);
}

/** Turn a point clockwise by ψ degrees about the centre. */
export function turn([x, y]: XY, psi: number): XY {
  const c = Math.cos(psi * D2R), s = Math.sin(psi * D2R);
  return [x * c + y * s, -x * s + y * c];
}

/** The rete turned by ψ puts a star at hour angle ψ − RA, so ψ is the local sidereal time. */
export const reteAngleForLst = (lst: number): number => wrap360(lst);

/** The hour the rule shows on the limb when its edge points at angle ψ (12 at the top). */
export function limbHours(psi: number): number {
  return ((12 + psi / 15) % 24 + 24) % 24;
}

// ---- lines engraved on the plate ------------------------------------------

/** An almucantar (circle of equal altitude), as a closed polyline. */
export function almucantar(alt: number, g: PlateGeometry, n = 360): XY[] {
  const pts: XY[] = [];
  for (let i = 0; i <= n; i++) pts.push(horizontalToPlate(alt, (i / n) * 360, g));
  return pts;
}

/** A line of equal azimuth from the horizon up to the zenith. */
export function azimuthLine(az: number, g: PlateGeometry, n = 90): XY[] {
  const pts: XY[] = [];
  for (let i = 0; i <= n; i++) pts.push(horizontalToPlate((i / n) * 90, az, g));
  return pts;
}

/**
 * The k-th line of unequal (seasonal) hours of the night, k = 1…11: each day's
 * night, from sunset to sunrise, divided into twelve equal parts. Drawn from
 * the Tropic of Capricorn to the Tropic of Cancer; null where the sun never
 * sets or never rises.
 */
export function unequalHourLine(k: number, g: PlateGeometry, n = 40): (XY | null)[] {
  const pts: (XY | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const decM = -g.eps + (2 * g.eps * i) / n;
    const t = Math.tan(g.latM * D2R) * Math.tan(decM * D2R);
    if (Math.abs(t) >= 1) { pts.push(null); continue; }
    const h0 = Math.acos(-t) * R2D;           // hour angle of sunset
    pts.push(project(h0 + (k * (360 - 2 * h0)) / 12, decM, g));
  }
  return pts;
}

/** Circle through the projected ecliptic: tangent to both tropics. */
export function eclipticCircle(g: PlateGeometry, eclipticRa: (lon: number) => { ra: number; dec: number }): { cx: number; cy: number; r: number } {
  const a = eclipticRa(90), b = eclipticRa(270);
  const p = retePoint(a.ra, a.dec, g), q = retePoint(b.ra, b.dec, g);
  return { cx: (p[0] + q[0]) / 2, cy: (p[1] + q[1]) / 2, r: Math.hypot(p[0] - q[0], p[1] - q[1]) / 2 };
}
