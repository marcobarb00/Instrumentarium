// The cross-staff's scales. Each face of the staff carries the scale of one
// transom: the mark for an angle θ stands where the transom's eye-side face
// must be for its two ends to look θ apart from the eye at the end of the staff,
// d = h / tan(θ/2), h being half the transom's length.
//
// Each face is a strip: canvas x runs along the staff from the eye end
// (x = d / L · W), canvas y across it, the top of the canvas being the edge the
// ticks start from.
import { D2R, R2D } from '../../core/astro';
import { brushMarks, engraveText, ENGRAVE, ENGRAVE_FONT, seededRandom, strokeLine } from '../../three/engrave';

/** Length of the staff, from the eye end, m. */
export const STAFF_L = 0.9;
/** Side of the staff's square section, m. */
export const STAFF_A = 0.02;
/** Strip size: 8192 px along the staff (about 0.11 mm a pixel), its width in proportion. */
export const STRIP_W = 8192;
export const STRIP_H = Math.round((STRIP_W * STAFF_A) / STAFF_L);

export interface Transom {
  /** Engraved name. */
  name: string;
  /** Half the transom's length, m. */
  half: number;
  /** Nearest and farthest the transom may stand from the eye, m. */
  dMin: number;
  dMax: number;
}

/** Three transoms, short to long: each covers a range of angles on its own face of the staff. */
export const TRANSOMS: Transom[] = [
  { name: 'I', half: 0.03, dMin: 0.1, dMax: STAFF_L - 0.012 },
  { name: 'II', half: 0.09, dMin: 0.1, dMax: STAFF_L - 0.012 },
  { name: 'III', half: 0.25, dMin: 0.25, dMax: STAFF_L - 0.012 },
];

/** Angle between the transom's two ends seen from the eye, degrees. */
export const angleAt = (t: Transom, d: number): number => 2 * Math.atan(t.half / d) * R2D;
/** Where the transom must stand for its ends to be `deg` apart, m. */
export const distanceFor = (t: Transom, deg: number): number => t.half / Math.tan((deg / 2) * D2R);
export const angleRange = (t: Transom): [number, number] => [angleAt(t, t.dMax), angleAt(t, t.dMin)];

export const stripX = (d: number): number => (d / STAFF_L) * STRIP_W;
export const distanceAtX = (px: number): number => (px / STRIP_W) * STAFF_L;

export function drawScale(g: CanvasRenderingContext2D, W: number, H: number, t: Transom, seed: number): void {
  // Pale boxwood, like many surviving staffs.
  g.fillStyle = '#d9c08f'; g.fillRect(0, 0, W, H);
  brushMarks(g, W, H, seededRandom(seed), 3000);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
  strokeLine(g, [0, 2], [W, 2], 3);
  const [lo, hi] = angleRange(t);
  const mm = (a: number, b: number) => Math.abs(distanceFor(t, a) - distanceFor(t, b)) * 1000;
  // Within each degree, the finest division (in minutes) whose marks stand at least 1.2 mm apart.
  const STEPS = [1, 2, 5, 10, 30, 60];
  const stepIn = (deg: number) => STEPS.find(m => mm(deg + 1 - m / 60, deg + 1) >= 1.2) ?? 60;
  const small = `600 ${Math.round(H * 0.2)}px ${ENGRAVE_FONT}`;
  for (let deg = Math.floor(lo); deg <= Math.ceil(hi); deg++) {
    const step = stepIn(deg);
    for (let m = 0; m < 60; m += step) {
      const a = deg + m / 60;
      if (a < lo - 1e-9 || a > hi + 1e-9) continue;
      const x = stripX(distanceFor(t, a));
      const len = m === 0 ? (deg % 5 === 0 ? 0.62 : 0.46) : m === 30 ? 0.36 : m % 10 === 0 ? 0.3 : m % 5 === 0 ? 0.24 : 0.16;
      strokeLine(g, [x, 2], [x, len * H], m === 0 ? (deg % 5 === 0 ? 3 : 2.4) : m % 10 === 0 ? 1.9 : 1.4);
      // Minutes are numbered where ten of them take a centimetre or more, with the degree where there is room.
      const room = mm(a, a + 10 / 60);
      if (m % 10 === 0 && m > 0 && room >= 10) engraveText(g, room >= 18 ? `${deg}°${m}′` : `${m}′`, x, H * 0.72, 0, small);
    }
  }
  // Degrees: every one where they have room, else every five.
  const font = `600 ${Math.round(H * 0.3)}px ${ENGRAVE_FONT}`;
  for (let a = Math.ceil(lo); a <= Math.floor(hi); a++) {
    if (a % 5 !== 0 && (mm(a, a + 1) < 6 || mm(a - 1, a) < 6)) continue;
    engraveText(g, `${a}°`, stripX(distanceFor(t, a)), H * 0.8, 0, font);
  }
  // The transom's name at the eye end, so each face says which transom it serves.
  engraveText(g, t.name, stripX(0.05), H * 0.5, 0, `600 ${Math.round(H * 0.5)}px ${ENGRAVE_FONT}`);
}
