// Engraved scales of the armillary sphere, and their inverses (canvas pixel →
// value), so readings are taken from the textures the visitor sees.
//
// Flat rings (horizon, meridian, hour circle) use RingGeometry's planar UVs: the
// canvas is the square that holds the ring, its centre the ring's centre.
// Bands on the sphere (equator, zodiac) are long strips: canvas x runs along the
// circle (0–360°), canvas top is the band's northern edge.
import { D2R, R2D, wrap360 } from '../../core/astro';
import { SIGNS } from '../../core/sun';
import { brassGradient, brushMarks, engraveText, ENGRAVE, ENGRAVE_FONT, seededRandom, strokeCircle, strokeLine } from '../../three/engrave';
import { roman } from '../astrolabe/drawings';

type XY = [number, number];

export const HORIZON_TEX = 2048;
export const MERIDIAN_TEX = 2048;
export const DIAL_TEX = 1024;
export const EQUATOR_TEX: [number, number] = [4096, 48];
export const ZODIAC_TEX: [number, number] = [4096, 112];

/** Brass annulus filling a square canvas between `inner` and the edge (fractions of the half-size). */
function ringGround(g: CanvasRenderingContext2D, S: number, inner: number, seed: number): void {
  const c = S / 2;
  const grad = g.createRadialGradient(c, c, c * inner, c, c, c);
  grad.addColorStop(0, '#b88a3c'); grad.addColorStop(0.5, '#dcb36a'); grad.addColorStop(1, '#a87b31');
  g.fillStyle = grad;
  g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.moveTo(c + c * inner, c); g.arc(c, c, c * inner, 0, Math.PI * 2, true); g.fill();
  g.save(); g.clip(); brushMarks(g, S, S, seededRandom(seed), 3000); g.restore();
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
}

// ---- horizon: degrees counted from the east and west points to north and south ----

/** Where azimuth A (from north through east) lies on the horizon canvas, at radius fraction f. */
export function horizonPoint(A: number, f: number, S = HORIZON_TEX): XY {
  const c = S / 2;
  return [c - f * c * Math.sin(A * D2R), c + f * c * Math.cos(A * D2R)];
}
/** Azimuth under a horizon canvas pixel. */
export function horizonAzimuthAt(px: number, py: number, S = HORIZON_TEX): number {
  const c = S / 2;
  return wrap360(Math.atan2(-(px - c), py - c) * R2D);
}
/** Degrees north (+) or south (−) of the east or west point, as engraved on the horizon. */
export function amplitudeOf(az: number): { deg: number; ns: 'N' | 'S'; ew: 'E' | 'W'; signed: number } {
  const a = wrap360(az);
  const signed = a <= 180 ? 90 - a : a - 270;
  return { deg: Math.abs(signed), ns: signed >= 0 ? 'N' : 'S', ew: a <= 180 ? 'E' : 'W', signed };
}

export const HORIZON_INNER = 0.83;
export const HORIZON_SCALE: { tick0: number; tick1: number; tick5: number; tick10: number; numbers: number; names: number } =
  { tick0: 0.838, tick1: 0.856, tick5: 0.866, tick10: 0.878, numbers: 0.9, names: 0.955 };

export function drawHorizon(g: CanvasRenderingContext2D, S: number): void {
  const c = S / 2, k = HORIZON_SCALE;
  ringGround(g, S, HORIZON_INNER, 41);
  strokeCircle(g, c, c, k.tick0 * c, 2.5); strokeCircle(g, c, c, k.tick10 * c, 2); strokeCircle(g, c, c, 0.922 * c, 2);
  strokeCircle(g, c, c, 0.985 * c, 3);
  for (let A = 0; A < 360; A++) {
    const ten = A % 10 === 0, five = A % 5 === 0;
    strokeLine(g, horizonPoint(A, k.tick0, S), horizonPoint(A, ten ? k.tick10 : five ? k.tick5 : k.tick1, S), ten ? 3.2 : five ? 2.4 : 1.6);
  }
  // Numbers read from outside the ring: their tops face the centre.
  const rot = (A: number) => Math.atan2(Math.cos(A * D2R), -Math.sin(A * D2R)) - Math.PI / 2;
  for (let A = 0; A < 360; A += 10) {
    engraveText(g, String(amplitudeOf(A).deg), ...horizonPoint(A, k.numbers, S), rot(A), `600 30px ${ENGRAVE_FONT}`);
  }
  const names: [number, string][] = [[0, 'SEPTENTRIO'], [90, 'ORIENS'], [180, 'MERIDIES'], [270, 'OCCIDENS']];
  for (const [A, name] of names) {
    // Letter by letter along the arc; read from outside, the text runs toward lower azimuths.
    const step = 2.1;
    [...name].forEach((ch, i) => {
      const a = A + ((name.length - 1) / 2 - i) * step;
      engraveText(g, ch, ...horizonPoint(a, k.names, S), rot(a), `600 34px ${ENGRAVE_FONT}`);
    });
  }
  // Small stars between the names: the half-winds.
  for (let A = 45; A < 360; A += 90) {
    const [x, y] = horizonPoint(A, k.names, S);
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
  }
}

// ---- meridian: the upper half counted from the equator to the poles, the lower half from the poles ----

/**
 * Point on a meridian face for angle α (degrees from the north pole, through the
 * equator above the horizon, to the south pole and round). `m` = +1 for the
 * west face, −1 for the east face (each seen from its own side).
 */
export function meridianPoint(alpha: number, f: number, m: 1 | -1, S = MERIDIAN_TEX): XY {
  const c = S / 2;
  return [c + m * f * c * Math.sin(alpha * D2R), c - f * c * Math.cos(alpha * D2R)];
}
export function meridianAlphaAt(px: number, py: number, m: 1 | -1, S = MERIDIAN_TEX): number {
  const c = S / 2;
  return wrap360(Math.atan2(m * (px - c), c - py) * R2D);
}
/** The number engraved at α: declination on the upper half, distance from the pole on the lower half. */
export function meridianValue(alpha: number): number {
  const a = wrap360(alpha);
  return a <= 180 ? Math.abs(90 - a) : 90 - Math.abs(a - 270);
}

export const MERIDIAN_INNER = 0.926;

export function drawMeridian(g: CanvasRenderingContext2D, S: number, m: 1 | -1): void {
  const c = S / 2, t0 = 0.932, t1 = 0.947, t5 = 0.954, t10 = 0.962, num = 0.977;
  ringGround(g, S, MERIDIAN_INNER, m > 0 ? 7 : 8);
  strokeCircle(g, c, c, t0 * c, 2); strokeCircle(g, c, c, 0.993 * c, 2);
  for (let a = 0; a < 360; a++) {
    const ten = a % 10 === 0, five = a % 5 === 0;
    strokeLine(g, meridianPoint(a, t0, m, S), meridianPoint(a, ten ? t10 : five ? t5 : t1, m, S), ten ? 2.8 : five ? 2.2 : 1.5);
  }
  // Numbers with their tops facing outward.
  for (let a = 0; a < 360; a += 10) {
    const [x, y] = meridianPoint(a, num, m, S);
    engraveText(g, String(meridianValue(a)), x, y, m * a * D2R, `600 24px ${ENGRAVE_FONT}`);
  }
}

// ---- hour circle at the north pole: twice twelve hours, noon at the top ----

/** Point on the hour circle for an hour angle of the sun H (degrees west of the meridian). */
export function dialPoint(H: number, f: number, S = DIAL_TEX): XY {
  const c = S / 2;
  return [c + f * c * Math.sin(H * D2R), c - f * c * Math.cos(H * D2R)];
}
/** Hours (0–24) under a dial canvas pixel: XII at noon, the sun's hour angle 0. */
export function dialHoursAt(px: number, py: number, S = DIAL_TEX): number {
  const c = S / 2;
  return wrap360(Math.atan2(px - c, c - py) * R2D + 180) / 15;
}

export const DIAL_INNER = 0.286;
export const DIAL_TIP = 0.93;

export function drawDial(g: CanvasRenderingContext2D, S: number): void {
  const c = S / 2, rO = 0.97, rQ = 0.9, rH2 = 0.87, rH = 0.81;
  ringGround(g, S, DIAL_INNER, 19);
  strokeCircle(g, c, c, rO * c, 3); strokeCircle(g, c, c, rH * c, 2); strokeCircle(g, c, c, 0.33 * c, 2);
  // Hours, half hours and quarters.
  for (let q = 0; q < 96; q++) {
    const H = q * 3.75, hour = q % 4 === 0, half = q % 2 === 0;
    strokeLine(g, dialPoint(H, rO, S), dialPoint(H, hour ? rH : half ? rH2 : rQ, S), hour ? 4 : half ? 3 : 2);
  }
  for (let k = 0; k < 24; k++) {
    engraveText(g, roman(((k + 11) % 12) + 1), ...dialPoint(k * 15, 0.66, S), k * 15 * D2R, `600 46px ${ENGRAVE_FONT}`);
  }
}

// ---- bands on the sphere ----

function bandGround(g: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
  g.fillStyle = brassGradient(g, 0, 0, 0, H); g.fillRect(0, 0, W, H);
  brushMarks(g, W, H, seededRandom(seed), 6000);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
}

/** The equator, in degrees of right ascension from the first point of Aries. */
export function drawEquator(g: CanvasRenderingContext2D, W: number, H: number): void {
  bandGround(g, W, H, 3);
  const x = (d: number) => (d / 360) * W;
  strokeLine(g, [0, 2], [W, 2], 2); strokeLine(g, [0, H - 2], [W, H - 2], 2);
  for (let d = 0; d < 360; d++) {
    const ten = d % 10 === 0, five = d % 5 === 0;
    strokeLine(g, [x(d), 2], [x(d), ten ? 20 : five ? 15 : 10], ten ? 2.4 : 1.6);
  }
  for (let d = 0; d < 360; d += 30) engraveText(g, String(d), x(d) + (d ? 0 : 12), 34, 0, `600 20px ${ENGRAVE_FONT}`);
}

/** The zodiac: twelve signs of 30°, graduated in degrees along its northern edge. */
export function drawZodiac(g: CanvasRenderingContext2D, W: number, H: number): void {
  bandGround(g, W, H, 5);
  const x = (d: number) => (d / 360) * W;
  strokeLine(g, [0, 2], [W, 2], 2.5); strokeLine(g, [0, 30], [W, 30], 2); strokeLine(g, [0, H - 3], [W, H - 3], 2.5);
  for (let d = 0; d < 360; d++) {
    const sign = d % 30 === 0, ten = d % 10 === 0, five = d % 5 === 0;
    strokeLine(g, [x(d), 2], [x(d), sign ? H - 3 : ten ? 30 : five ? 22 : 14], sign ? 3 : ten ? 2.2 : 1.5);
  }
  for (let s = 0; s < 12; s++) {
    engraveText(g, SIGNS[s].toUpperCase(), x(s * 30 + 15), (30 + H) / 2, 0, `600 30px ${ENGRAVE_FONT}`);
    for (const d of [10, 20]) engraveText(g, String(d), x(s * 30 + d), 44, 0, `600 15px ${ENGRAVE_FONT}`);
  }
}
