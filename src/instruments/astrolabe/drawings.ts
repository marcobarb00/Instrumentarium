// The astrolabe's engraved faces, drawn on canvases that become brass
// textures, and the inverse maps used to read them (canvas pixel → value).
//
// Every canvas is square and drawn as the face is seen, so a pixel's offset
// from the centre maps straight onto the face.
import { D2R, R2D, wrap360 } from '../../core/astro';
import { brassGradient, brushMarks, engraveText, ENGRAVE, ENGRAVE_FONT, seededRandom, strokeCircle, strokeLine } from '../../three/engrave';
import {
  almucantar, azimuthLine, horizontalToPlate, limbHours, polar, project, radiusOfDec, retePoint, unequalHourLine,
  type PlateGeometry, type XY,
} from './geometry';

export const TEX = 2048;

// ---- shared helpers ---------------------------------------------------------

/** Plate units (radius 1, y up) → canvas pixels. */
const unitToPx = (S: number) => ([x, y]: XY): XY => [S / 2 + (x * S) / 2, S / 2 - (y * S) / 2];
/** Canvas pixel → plate units. */
export const pxToUnit = (px: number, py: number, S = TEX): XY => [(px - S / 2) / (S / 2), (S / 2 - py) / (S / 2)];

function polyline(g: CanvasRenderingContext2D, pts: (XY | null)[], P: (p: XY) => XY, width: number, maxR = 1.6): void {
  g.lineWidth = width;
  g.beginPath();
  let pen = false;
  for (const p of pts) {
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.hypot(p[0], p[1]) > maxR) { pen = false; continue; }
    const [X, Y] = P(p);
    if (pen) g.lineTo(X, Y); else { g.moveTo(X, Y); pen = true; }
  }
  g.stroke();
}

/** Text rotation that runs along a canvas direction and is never upside down. */
function along(dx: number, dy: number): number {
  let a = Math.atan2(dy, dx);
  if (Math.cos(a) < 0) a += Math.PI;
  return a;
}

const LATIN_MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IVN', 'IVL', 'AVG', 'SEP', 'OCT', 'NOV', 'DEC'];
const LATIN_SIGNS = ['ARIES', 'TAVRVS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIVS', 'CAPRICORNVS', 'AQVARIVS', 'PISCES'];

export function roman(n: number): string {
  const v: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [k, r] of v) while (n >= k) { s += r; n -= k; }
  return s;
}

// ---- the plate (tympan) ------------------------------------------------------

export function drawPlate(g: CanvasRenderingContext2D, S: number, geo: PlateGeometry): void {
  const c = S / 2, P = unitToPx(S);
  g.save();
  g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.clip();
  g.fillStyle = brassGradient(g, 0, 0, S, S); g.fillRect(0, 0, S, S);
  brushMarks(g, S, S, seededRandom(11), 4000);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'round';

  // Tropics and equator, meridian and east–west line.
  strokeCircle(g, c, c, radiusOfDec(geo.eps, geo) * c, 3);
  strokeCircle(g, c, c, geo.req * c, 3);
  strokeCircle(g, c, c, c - 4, 6);
  strokeLine(g, [c, 0], [c, S], 2.6);
  strokeLine(g, [0, c], [S, c], 1.6);

  // Under the horizon: the twelve unequal hours of the night, and twilight.
  for (let k = 1; k <= 11; k++) polyline(g, unequalHourLine(k, geo), P, 1.6);
  const decN = -geo.eps + 4, tN = Math.tan(geo.latM * D2R) * Math.tan(decN * D2R);
  if (Math.abs(tN) < 1) {
    const h0 = Math.acos(-tN) * R2D;
    for (let k = 1; k <= 12; k++) {
      const p = project(h0 + ((k - 0.5) * (360 - 2 * h0)) / 12, decN, geo);
      engraveText(g, String(k), ...P(p), 0, `600 26px ${ENGRAVE_FONT}`);
    }
  }
  g.setLineDash([16, 12]);
  polyline(g, almucantar(-18, geo), P, 1.8);
  g.setLineDash([]);

  // Above it: azimuth lines every 10° and almucantars every 2°.
  for (let az = 10; az < 360; az += 10) if (az !== 180) polyline(g, azimuthLine(az, geo), P, az % 90 === 0 ? 2.2 : 1.1);
  for (let a = 2; a < 90; a += 2) polyline(g, almucantar(a, geo), P, a % 10 === 0 ? 2.6 : 1.1);
  polyline(g, almucantar(0, geo), P, 5);

  // Numbers: altitudes down the meridian, azimuths just above the horizon.
  const equatorSide = geo.s > 0 ? 180 : 0;
  for (let a = 10; a <= 80; a += 10) {
    const p = horizontalToPlate(a, equatorSide, geo);
    if (Math.hypot(...p) < 0.97) engraveText(g, String(a), P(p)[0] - 26, P(p)[1] - 14, 0, `600 26px ${ENGRAVE_FONT}`);
  }
  for (let az = 30; az < 360; az += 30) {
    if (az === 180) continue;
    const p = horizontalToPlate(4, az, geo);
    if (Math.hypot(...p) < 0.95) engraveText(g, String(az), ...P(p), 0, `22px ${ENGRAVE_FONT}`);
  }
  const east = horizontalToPlate(0, 90, geo), west = horizontalToPlate(0, 270, geo);
  engraveText(g, 'ORIENS', P(east)[0] - 4, P(east)[1] + 34, 0, `italic 600 34px ${ENGRAVE_FONT}`);
  engraveText(g, 'OCCIDENS', P(west)[0] + 4, P(west)[1] + 34, 0, `italic 600 34px ${ENGRAVE_FONT}`);
  engraveText(g, geo.s > 0 ? 'MERIDIES' : 'SEPTENTRIO', ...P(polar(0.925, -8)), -8 * D2R, `italic 600 30px ${ENGRAVE_FONT}`);
  const lat = Math.abs(geo.lat), d = Math.floor(lat), m = Math.round((lat - d) * 60);
  engraveText(g, `LATITVDO ${d}°${String(m).padStart(2, '0')}′ ${geo.s > 0 ? 'SEPT.' : 'MERID.'}`, c, c + 0.78 * c, 0, `italic 600 32px ${ENGRAVE_FONT}`);
  g.restore();
}

// ---- the rete ---------------------------------------------------------------

export interface ReteStarInput { id: number; name: string; ra: number; dec: number; mag: number }
export interface RetePointer extends ReteStarInput { tip: XY; anchor: XY }
export interface ReteLayout {
  geo: PlateGeometry;
  pointers: RetePointer[];
  ecliptic: { cx: number; cy: number; r: number };
  /** Ecliptic longitude → place on the rete (rete frame). */
  eclipticPoint: (lon: number) => XY;
}

const RIM_IN = 0.955, HUB = 0.07, BAR_W = 0.022, ECL_BW = 0.075, STEM_W = 0.032;
const BARS: XY[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Choose where each star's pointer joins the rete's frame: the nearest of rim, hub, bars and ecliptic band. */
export function layoutRete(geo: PlateGeometry, stars: ReteStarInput[], eclipticRaDec: (lon: number) => { ra: number; dec: number }): ReteLayout {
  const eclipticPoint = (lon: number): XY => { const e = eclipticRaDec(lon); return retePoint(e.ra, e.dec, geo); };
  const p90 = eclipticPoint(90), p270 = eclipticPoint(270);
  const ecl = { cx: (p90[0] + p270[0]) / 2, cy: (p90[1] + p270[1]) / 2, r: Math.hypot(p90[0] - p270[0], p90[1] - p270[1]) / 2 };

  // Brightest first; skip a star whose tip would crowd a brighter one.
  const placed: RetePointer[] = [];
  for (const s of [...stars].sort((a, b) => a.mag - b.mag)) {
    const tip = retePoint(s.ra, s.dec, geo);
    if (placed.some(p => Math.hypot(p.tip[0] - tip[0], p.tip[1] - tip[1]) < 0.08)) continue;
    const r = Math.hypot(...tip), u: XY = [tip[0] / r, tip[1] / r];
    const cands: { a: XY; d: number; w?: number }[] = [
      { a: [u[0] * (RIM_IN + 0.01), u[1] * (RIM_IN + 0.01)], d: RIM_IN - r },
      { a: [u[0] * (HUB - 0.01), u[1] * (HUB - 0.01)], d: r - HUB },
    ];
    const v: XY = [tip[0] - ecl.cx, tip[1] - ecl.cy], dv = Math.hypot(...v);
    if (dv > ecl.r) cands.push({ a: [ecl.cx + (v[0] / dv) * (ecl.r - 0.01), ecl.cy + (v[1] / dv) * (ecl.r - 0.01)], d: dv - ecl.r });
    else if (dv < ecl.r - ECL_BW) cands.push({ a: [ecl.cx + (v[0] / dv) * (ecl.r - ECL_BW + 0.01), ecl.cy + (v[1] / dv) * (ecl.r - ECL_BW + 0.01)], d: ecl.r - ECL_BW - dv });
    for (const b of BARS) {
      const t = tip[0] * b[0] + tip[1] * b[1];
      if (t < HUB || t > RIM_IN) continue;
      const perp = Math.hypot(tip[0] - b[0] * t, tip[1] - b[1] * t);
      // Bars are a last resort: pointers growing from the rim and the ecliptic ring look like real retes.
      cands.push({ a: [b[0] * t, b[1] * t], d: perp - BAR_W / 2, w: 0.12 });
    }
    const score = (c: { d: number; w?: number }) => c.d + (c.w ?? 0);
    const ok = cands.filter(c => c.d >= 0.06).sort((a, b) => score(a) - score(b));
    const best = ok[0] ?? cands.filter(c => c.d > 0).sort((a, b) => score(a) - score(b))[0] ?? cands[0];
    placed.push({ ...s, tip, anchor: best.a });
  }
  return { geo, pointers: placed, ecliptic: ecl, eclipticPoint };
}

export function drawRete(g: CanvasRenderingContext2D, S: number, L: ReteLayout): void {
  const c = S / 2, P = unitToPx(S), U = c;
  const metal = brassGradient(g, 0, 0, S, S);
  const edge = 'rgba(60,36,10,0.85)';
  g.lineJoin = 'round';

  // Openwork frame: rim, hub, cross bars and the ecliptic band.
  const ring = (cx: number, cy: number, rO: number, rI: number) => {
    g.beginPath();
    g.arc(cx, cy, rO, 0, Math.PI * 2);
    g.moveTo(cx + rI, cy); g.arc(cx, cy, rI, 0, Math.PI * 2, true);
  };
  const [ex, ey] = P([L.ecliptic.cx, L.ecliptic.cy]), eR = L.ecliptic.r * U;
  g.fillStyle = metal; g.strokeStyle = metal; g.lineCap = 'butt';
  g.lineWidth = BAR_W * U;
  for (const b of BARS) { g.beginPath(); g.moveTo(...P([b[0] * HUB, b[1] * HUB])); g.lineTo(...P([b[0] * (RIM_IN + 0.01), b[1] * (RIM_IN + 0.01)])); g.stroke(); }
  ring(c, c, U - 1, RIM_IN * U); g.fill();
  ring(ex, ey, eR, eR - ECL_BW * U); g.fill();
  g.beginPath(); g.arc(c, c, HUB * U, 0, Math.PI * 2); g.fill();

  // Star pointers: a tapering flame from the frame to the star, with a name tab.
  for (const p of L.pointers) {
    const [ax, ay] = p.anchor, [tx, ty] = p.tip;
    const len = Math.hypot(tx - ax, ty - ay), dx = (tx - ax) / len, dy = (ty - ay) / len, nx = -dy, ny = dx, w = STEM_W;
    g.beginPath();
    g.moveTo(...P([ax + (nx * w) / 2, ay + (ny * w) / 2]));
    g.quadraticCurveTo(...P([ax + dx * len * 0.5 + nx * w * 0.7, ay + dy * len * 0.5 + ny * w * 0.7]), ...P([tx, ty]));
    g.quadraticCurveTo(...P([ax + dx * len * 0.55 - nx * w * 0.2, ay + dy * len * 0.55 - ny * w * 0.2]), ...P([ax - (nx * w) / 2, ay - (ny * w) / 2]));
    g.closePath();
    g.fillStyle = metal; g.fill();
    g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
  }

  // Edges of the frame.
  g.strokeStyle = edge; g.lineWidth = 2.5;
  strokeCircle(g, c, c, U - 2, 2.5); strokeCircle(g, c, c, RIM_IN * U, 2.5);
  strokeCircle(g, ex, ey, eR, 2.5); strokeCircle(g, ex, ey, eR - ECL_BW * U, 2.5);
  strokeCircle(g, c, c, HUB * U, 2.5);

  // The ecliptic: a tick for every degree of longitude at its projected place.
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'round';
  for (let lon = 0; lon < 360; lon++) {
    const p = L.eclipticPoint(lon);
    const vx = L.ecliptic.cx - p[0], vy = L.ecliptic.cy - p[1], vl = Math.hypot(vx, vy);
    const t = lon % 30 === 0 ? ECL_BW : lon % 10 === 0 ? 0.036 : lon % 5 === 0 ? 0.026 : 0.014;
    strokeLine(g, P(p), P([p[0] + (vx / vl) * t, p[1] + (vy / vl) * t]), lon % 30 === 0 ? 3 : lon % 5 === 0 ? 2.2 : 1.4);
  }
  for (let k = 0; k < 12; k++) {
    const p = L.eclipticPoint(k * 30 + 15);
    const vx = L.ecliptic.cx - p[0], vy = L.ecliptic.cy - p[1], vl = Math.hypot(vx, vy);
    const q = P([p[0] + (vx / vl) * 0.057, p[1] + (vy / vl) * 0.057]);
    // Tangent to the band, in canvas coordinates (y down).
    engraveText(g, LATIN_SIGNS[k], q[0], q[1], along(-vy, -vx), `600 21px ${ENGRAVE_FONT}`);
  }

  // Name tabs.
  for (const p of L.pointers) {
    const [ax, ay] = p.anchor, [tx, ty] = p.tip;
    const len = Math.hypot(tx - ax, ty - ay), dx = (tx - ax) / len, dy = (ty - ay) / len;
    const m = P([ax + dx * len * 0.42, ay + dy * len * 0.42]);
    const rot = along(dx, -dy);
    g.save();
    g.translate(m[0], m[1]); g.rotate(rot);
    g.font = `italic 600 22px ${ENGRAVE_FONT}`;
    const tw = g.measureText(p.name).width + 16, th = 30;
    g.beginPath(); g.roundRect(-tw / 2, -th / 2, tw, th, 8);
    g.fillStyle = metal; g.fill();
    g.strokeStyle = edge; g.lineWidth = 2; g.stroke();
    g.fillStyle = ENGRAVE; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.name, 0, 1);
    g.restore();
  }
}

// ---- the limb (hour scale round the front) ------------------------------------

/** Inner edge of the limb, as a fraction of its outer radius (the plate fits inside). */
export function drawLimb(g: CanvasRenderingContext2D, S: number, innerFrac: number): void {
  const c = S / 2, rO = c - 2, rI = c * innerFrac;
  const grad = g.createRadialGradient(c, c, rI, c, c, rO);
  grad.addColorStop(0, '#b88a3c'); grad.addColorStop(0.5, '#dcb36a'); grad.addColorStop(1, '#a87b31');
  g.fillStyle = grad; g.beginPath();
  g.arc(c, c, rO, 0, Math.PI * 2);
  g.moveTo(c + rI, c); g.arc(c, c, rI, 0, Math.PI * 2, true);
  g.fill();
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
  const band = rO - rI, r1 = rO - 10, rT = r1 - band * 0.42;
  strokeCircle(g, c, c, r1, 3); strokeCircle(g, c, c, rT, 2); strokeCircle(g, c, c, rI + 6, 3);
  const pt = (r: number, psi: number): XY => [c + r * Math.sin(psi * D2R), c - r * Math.cos(psi * D2R)];
  // A tick every degree (4 minutes of time), longer every 5° (20 minutes) and every hour.
  for (let psi = 0; psi < 360; psi++) {
    const hour = psi % 15 === 0, five = psi % 5 === 0;
    strokeLine(g, pt(r1, psi), pt(hour ? rT - 4 : five ? rT : r1 - (r1 - rT) * 0.5, psi), hour ? 4.5 : five ? 2.6 : 1.8);
  }
  // Hour numerals under each hour line: XII at the top (noon) and bottom (midnight).
  for (let k = 0; k < 24; k++) {
    engraveText(g, roman(((k + 11) % 12) + 1), ...pt((rT + rI + 6) / 2, k * 15), k * 15 * D2R, `600 34px ${ENGRAVE_FONT}`);
  }
}

/** Hours on the limb under a canvas pixel. */
export function limbHoursAt(px: number, py: number, S = TEX): number {
  return limbHours(Math.atan2(px - S / 2, S / 2 - py) * R2D);
}

// ---- the back: altitude scale, zodiac, calendar, shadow square ---------------

/** Where the alidade crosses a ring for ecliptic longitude λ: angle on the back, counter-clockwise from the right. */
export const backAngleOfLongitude = (lon: number): number => wrap360(180 - lon);

export function drawBack(g: CanvasRenderingContext2D, S: number, year: number, sunLon: (d: Date) => number): void {
  const c = S / 2;
  g.save();
  g.beginPath(); g.arc(c, c, c - 1, 0, Math.PI * 2); g.clip();
  g.fillStyle = brassGradient(g, S, 0, 0, S); g.fillRect(0, 0, S, S);
  brushMarks(g, S, S, seededRandom(23), 4000);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
  const pt = (f: number, th: number): XY => [c + f * c * Math.cos(th * D2R), c - f * c * Math.sin(th * D2R)];
  const radial = (th: number) => (90 - th) * D2R;

  // Degree scale, numbered 0–90 in each quadrant from the horizontal.
  [0.985, 0.875, 0.8, 0.68, 0.56].forEach(f => strokeCircle(g, c, c, f * c, 3));
  for (let a = 0; a < 360; a++) {
    const L = a % 10 === 0 ? 0.875 : a % 5 === 0 ? 0.905 : 0.935;
    strokeLine(g, pt(0.985, a), pt(L, a), a % 5 === 0 ? 2.8 : 1.8);
  }
  for (let q = 0; q < 4; q++) {
    for (let v = 10; v <= 90; v += 10) {
      const th = q === 0 ? v : q === 1 ? 180 - v : q === 2 ? 180 + v : 360 - v;
      if (v === 90 && (q === 1 || q === 3)) continue; // 90 is shared by two quadrants
      engraveText(g, String(v), ...pt(0.838, th), radial(th), `600 30px ${ENGRAVE_FONT}`);
    }
  }

  // Zodiac: the sun's longitude.
  for (let l = 0; l < 360; l++) {
    const th = backAngleOfLongitude(l);
    const L = l % 30 === 0 ? 0.68 : l % 10 === 0 ? 0.755 : l % 5 === 0 ? 0.77 : 0.785;
    strokeLine(g, pt(0.8, th), pt(L, th), l % 30 === 0 ? 3 : 1.6);
  }
  for (let k = 0; k < 12; k++) {
    const th = backAngleOfLongitude(k * 30 + 15);
    engraveText(g, LATIN_SIGNS[k], ...pt(0.715, th), radial(th), `600 26px ${ENGRAVE_FONT}`);
  }

  // Calendar for the year: each day's mark sits at the sun's longitude that noon.
  for (let m = 0; m < 12; m++) {
    const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    for (let d = 1; d <= days; d++) {
      const th = backAngleOfLongitude(sunLon(new Date(Date.UTC(year, m, d, 12))));
      const L = d === 1 ? 0.56 : d % 5 === 0 ? 0.635 : 0.655;
      strokeLine(g, pt(0.68, th), pt(L, th), d === 1 ? 3 : d % 5 === 0 ? 2.2 : 1.4);
      if (d === 10 || d === 20) engraveText(g, String(d), ...pt(0.613, th), radial(th), `18px ${ENGRAVE_FONT}`);
    }
    const th = backAngleOfLongitude(sunLon(new Date(Date.UTC(year, m, 15, 12))));
    engraveText(g, LATIN_MONTHS[m], ...pt(0.585, th), radial(th), `italic 600 26px ${ENGRAVE_FONT}`);
  }

  // Shadow square in the lower half: each side divided into twelve.
  const s = 0.42 * c;
  g.lineWidth = 2.6;
  g.strokeRect(c - s, c, 2 * s, s);
  strokeLine(g, [c, c], [c, c + s], 2.6);
  for (let i = 1; i < 12; i++) {
    const f = (i / 12) * s, L = i % 4 === 0 ? 26 : 14;
    strokeLine(g, [c - s + f, c + s], [c - s + f, c + s - L], 1.8);
    strokeLine(g, [c + s - f, c + s], [c + s - f, c + s - L], 1.8);
    strokeLine(g, [c - s, c + f], [c - s + L, c + f], 1.8);
    strokeLine(g, [c + s, c + f], [c + s - L, c + f], 1.8);
  }
  for (const i of [4, 8]) {
    const f = (i / 12) * s;
    engraveText(g, String(i), c - s + f, c + s - 42, 0, `22px ${ENGRAVE_FONT}`);
    engraveText(g, String(i), c + s - f, c + s - 42, 0, `22px ${ENGRAVE_FONT}`);
  }

  // Inscription.
  engraveText(g, 'ASTROLABIVM', c, c - 0.3 * c, 0, `italic 600 64px ${ENGRAVE_FONT}`);
  engraveText(g, `ANNO ${roman(year)}`, c, c - 0.19 * c, 0, `italic 34px ${ENGRAVE_FONT}`);
  g.restore();
}

/** Angle on the back (counter-clockwise from the right, as seen) under a canvas pixel. */
export function backAngleAt(px: number, py: number, S = TEX): number {
  return Math.atan2(S / 2 - py, px - S / 2) * R2D;
}
