// Engraved scales of Ptolemy's armillary, and their inverses (canvas pixel →
// value), so readings are taken from the textures the visitor sees.
//
// Every graduated ring is a flat annulus whose face carries a long strip
// texture: canvas x runs round the ring, canvas y across it. On a face, θ is
// the angle in the face's own plane, counter-clockwise as seen from in front
// of it; x = (1 − θ/360)·W, so that text drawn upright on the strip reads the
// right way round on the ring, its top toward the ring's outer edge. v (0 at
// the inner edge, 1 at the outer) runs up the canvas: y = (1 − v)·H.
//
// - Meridian ring: declination-like degrees, 0 at the equator to 90 at the
//   poles, the same on both faces; read under the index on the stand.
// - Ecliptic ring: 360 degrees of longitude in twelve signs of 30, both faces.
// - Inner (latitude) ring: degrees from the ecliptic, 0 to 90 at its poles,
//   north half SEPTENTRIO, south half MERIDIES, the same on both faces.
import { D2R, R2D, wrap360 } from '../../core/astro';
import { brushMarks, engraveText, ENGRAVE, ENGRAVE_FONT, seededRandom, strokeLine } from '../../three/engrave';

type XY = [number, number];

/** Canvas width of every ring strip: 8192 px for 360°, about 23 px per degree. */
export const STRIP_W = 8192;

/** Strip height for a ring, so that canvas pixels are square on the ring's middle circle. */
export function stripHeight(rIn: number, rOut: number): number {
  return Math.round((STRIP_W * (rOut - rIn)) / (Math.PI * (rIn + rOut)));
}

export function stripPoint(theta: number, v: number, W: number, H: number): XY {
  return [(1 - wrap360(theta) / 360) * W, (1 - v) * H];
}
/** θ (degrees, 0–360) under a strip canvas pixel. */
export function stripThetaAt(px: number, W: number): number {
  return wrap360((1 - px / W) * 360);
}

function ground(g: CanvasRenderingContext2D, W: number, H: number, seed: number): void {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#a87b31'); grad.addColorStop(0.5, '#dcb36a'); grad.addColorStop(1, '#b88a3c');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  brushMarks(g, W, H, seededRandom(seed), Math.round(W * H / 400));
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
}

/** A border line along the ring at v. */
function rule(g: CanvasRenderingContext2D, v: number, W: number, H: number, width: number): void {
  strokeLine(g, [0, (1 - v) * H], [W, (1 - v) * H], width);
}

/**
 * Degree ticks every 10′ round the whole ring. Ticks start at `base` and run
 * toward `dir` (+1 outward, −1 inward); their lengths (in v) for 10′, 1°, 5°
 * and 10° divisions. `offset` shifts which θ counts as a multiple of 10.
 */
function ticks(g: CanvasRenderingContext2D, W: number, H: number, base: number, dir: 1 | -1, len: [number, number, number, number], offset = 0): void {
  for (let i = 0; i < 360 * 6; i++) {
    const deg = i / 6, d = wrap360(deg - offset);
    const ten = i % 60 === 0 && Math.round(d) % 10 === 0, five = i % 6 === 0 && Math.round(d) % 5 === 0, one = i % 6 === 0;
    const l = ten ? len[3] : five ? len[2] : one ? len[1] : len[0];
    strokeLine(g, stripPoint(deg, base, W, H), stripPoint(deg, base + dir * l, W, H), ten ? 3 : five ? 2.4 : one ? 1.9 : 1.3);
  }
}

/** Letters of a word set one by one along the ring, centred on θc, reading the right way. */
function arcWord(g: CanvasRenderingContext2D, word: string, thetaC: number, v: number, W: number, H: number, font: string, step: number, flip = false): void {
  const n = word.length;
  [...word].forEach((ch, i) => {
    const th = thetaC + ((n - 1) / 2 - i) * step * (flip ? -1 : 1);
    engraveText(g, ch, ...stripPoint(th, v, W, H), flip ? Math.PI : 0, font);
  });
}

// ---- meridian ring ----

/** The number engraved on the meridian ring at face angle θ: degrees from the equator. */
export function meridianValue(theta: number): number {
  return Math.abs(Math.asin(Math.sin(theta * D2R)) * R2D);
}

/** Meridian: ticks along the outer edge, read by the index on the stand; numbers with their tops toward the centre. */
export function drawMeridian(g: CanvasRenderingContext2D, W: number, H: number): void {
  ground(g, W, H, 61);
  rule(g, 0.985, W, H, 3); rule(g, 0.05, W, H, 2);
  ticks(g, W, H, 0.985, -1, [0.16, 0.24, 0.32, 0.4]);
  for (let th = 0; th < 360; th += 10) {
    engraveText(g, String(Math.round(meridianValue(th))), ...stripPoint(th, 0.32, W, H), Math.PI, `600 ${Math.round(H * 0.3)}px ${ENGRAVE_FONT}`);
  }
}

// ---- ecliptic ring ----

export const SIGN_NAMES = ['ARIES', 'TAVRVS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIVS', 'SAGITTARIVS', 'CAPRICORNVS', 'AQVARIVS', 'PISCES'];

/**
 * Where longitude λ lies on a face of the ecliptic ring: θ = λ + 90 on the
 * northern face, θ = −λ − 90 on the southern (see model.ts).
 */
export function eclipticTheta(lon: number, face: 1 | -1): number {
  return face > 0 ? lon + 90 : -lon - 90;
}
export function eclipticLonAt(theta: number, face: 1 | -1): number {
  return wrap360(face > 0 ? theta - 90 : -theta - 90);
}

/** Radial places (v) on the ecliptic ring where the inner and outer rings' pointers end. */
export const ECL_READ_INNER = 0.36, ECL_READ_OUTER = 0.64;

/** Ecliptic: a central band of ticks, sign names inside it, degrees of each sign (10, 20, 30) outside. */
export function drawEcliptic(g: CanvasRenderingContext2D, W: number, H: number, face: 1 | -1): void {
  ground(g, W, H, face > 0 ? 71 : 73);
  rule(g, 0.22, W, H, 2.5); rule(g, 0.78, W, H, 2.5); rule(g, 0.97, W, H, 2); rule(g, 0.03, W, H, 2);
  // Ticks grow out from the centre line both ways, so either pointer can read them.
  for (let i = 0; i < 360 * 6; i++) {
    const lon = i / 6, th = eclipticTheta(lon, face);
    const ten = i % 60 === 0, five = i % 30 === 0, one = i % 6 === 0, sign = i % 180 === 0;
    const half = sign ? 0.38 : ten ? 0.28 : five ? 0.22 : one ? 0.16 : 0.1;
    const v0 = sign ? 0.03 : 0.5 - half, v1 = sign ? 0.97 : 0.5 + half;
    strokeLine(g, stripPoint(th, v0, W, H), stripPoint(th, v1, W, H), sign ? 3.4 : ten ? 3 : five ? 2.4 : one ? 1.9 : 1.3);
  }
  const numFont = `600 ${Math.round(H * 0.16)}px ${ENGRAVE_FONT}`, nameFont = `600 ${Math.round(H * 0.13)}px ${ENGRAVE_FONT}`;
  for (let s = 0; s < 12; s++) {
    for (const d of [10, 20, 30]) {
      // "30" sits just before the sign's end, so it is not mistaken for the next sign's start.
      const lon = s * 30 + d - (d === 30 ? 1.2 : 0);
      engraveText(g, String(d), ...stripPoint(eclipticTheta(lon, face), 0.875, W, H), 0, numFont);
    }
    arcWord(g, SIGN_NAMES[s], eclipticTheta(s * 30 + 15, face), 0.125, W, H, nameFont, 0.95);
  }
}

// ---- inner ring: latitude ----

/** Latitude engraved on the inner ring at face angle θ: + north (SEPTENTRIO), − south. */
export function latitudeAt(theta: number): number {
  return Math.asin(Math.sin(theta * D2R)) * R2D;
}

/** Radial place (v) on the inner ring where the sighting ring's index ends. */
export const LAT_READ = 0.14;

/** Latitude ring: ticks from the inner edge, read by the sighting ring's index; numbers and the names of the halves. */
export function drawLatitude(g: CanvasRenderingContext2D, W: number, H: number): void {
  ground(g, W, H, 81);
  rule(g, 0.03, W, H, 3); rule(g, 0.97, W, H, 2);
  ticks(g, W, H, 0.03, 1, [0.17, 0.25, 0.33, 0.41]);
  for (let th = 0; th < 360; th += 10) {
    if (Math.abs(Math.round(latitudeAt(th))) === 90) continue;
    engraveText(g, String(Math.abs(Math.round(latitudeAt(th)))), ...stripPoint(th, 0.6, W, H), 0, `600 ${Math.round(H * 0.28)}px ${ENGRAVE_FONT}`);
  }
  const font = `600 ${Math.round(H * 0.2)}px ${ENGRAVE_FONT}`;
  for (const th of [90, 270]) {
    // The poles of the ecliptic: a ringed dot, and the half's name either side.
    const [x, y] = stripPoint(th, 0.6, W, H);
    g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, H * 0.1, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(x, y, H * 0.03, 0, Math.PI * 2); g.fill();
    const name = th === 90 ? 'SEPTENTRIO' : 'MERIDIES';
    for (const side of [-1, 1]) arcWord(g, name, th + side * 35, 0.86, W, H, font, 0.9);
  }
}
