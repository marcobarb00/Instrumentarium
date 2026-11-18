// "How it works" for the cross-staff: why each step does what it does.
import type { ExplainSection } from '../../ui/shell';
import { distanceFor, STAFF_L, TRANSOMS } from '../../instruments/cross-staff/drawings';
import { C, circle, dot, line, path, star, svg, t } from '../../ui/figure';

export interface CrossStaffShows {
  whole(): void;
  transom(): void;
  sight(): void;
  scale(): void;
}

const D = Math.PI / 180;
const f = (n: number) => n.toFixed(1);

function angleFigure(): string {
  const E = [36, 132], a1 = 12 * D, a2 = 40 * D, L = 236;
  const p = (a: number, r: number) => [E[0] + r * Math.cos(a), E[1] - r * Math.sin(a)];
  const [x1, y1] = p(a1, L), [x2, y2] = p(a2, 172), [u1, v1] = p(a1, 96), [u2, v2] = p(a2, 96);
  return svg(150,
    line(E[0], E[1], x1, y1, C.ink, 0.9, '3 3') + line(E[0], E[1], x2, y2, C.ink, 0.9, '3 3')
    + star(x1, y1, 6) + star(x2, y2, 6) + dot(E[0], E[1], 3.2) + t(E[0], E[1] + 15, 'eye', { size: 11 })
    + path(`M${f(u1)} ${f(v1)}A96 96 0 0 0 ${f(u2)} ${f(v2)}`, C.red, 2)
    + t(p(26 * D, 112)[0], p(26 * D, 112)[1] + 4, 'the angle', { anchor: 'start', color: C.red }));
}

function triangleFigure(): string {
  const E = [30, 92], d = 140, h = 50, k = 1.6;
  const a = Math.atan2(h, d);
  return svg(202,
    `<rect x="${E[0]}" y="${E[1] - 2}" width="252" height="4" fill="#c9ad7c"/>`
    + line(E[0] + d, E[1] - h, E[0] + d, E[1] + h, C.rubric, 4)
    + line(E[0], E[1], E[0] + d * k, E[1] - h * k, C.ink, 0.9, '3 3') + line(E[0], E[1], E[0] + d * k, E[1] + h * k, C.ink, 0.9, '3 3')
    + star(E[0] + d * k, E[1] - h * k, 6) + star(E[0] + d * k, E[1] + h * k, 6) + dot(E[0], E[1], 3.2)
    + path(`M${E[0] + 46} ${E[1]}A46 46 0 0 0 ${f(E[0] + 46 * Math.cos(a))} ${f(E[1] - 46 * Math.sin(a))}`, C.red, 1.8)
    + t(E[0] + 54, E[1] - 5, 'half the angle', { anchor: 'start', color: C.red, size: 11 })
    + t(E[0] + d + 8, E[1] - h / 2, 'h, half the transom', { anchor: 'start', size: 11, color: C.rubric })
    + t(E[0] + d - 5, E[1] + 15, 'd, eye to transom', { anchor: 'end', size: 11, color: C.blue })
    + t(150, 194, 'tan (half the angle) = h ÷ d', { color: C.ink, size: 13, italic: false }));
}

function transomsFigure(): string {
  const E = [24, 90], tn = Math.tan(18 * D), xs: [number, string][] = [[46, 'I'], [116, 'II'], [216, 'III']];
  return svg(200,
    `<rect x="${E[0]}" y="${E[1] - 2}" width="262" height="4" fill="#c9ad7c"/>`
    + line(E[0], E[1], E[0] + 262, E[1] - 262 * tn, C.ink, 0.9, '3 3') + line(E[0], E[1], E[0] + 262, E[1] + 262 * tn, C.ink, 0.9, '3 3')
    + dot(E[0], E[1], 3.2)
    + xs.map(([d, n]) => line(E[0] + d, E[1] - d * tn, E[0] + d, E[1] + d * tn, C.rubric, 4) + t(E[0] + d, E[1] - d * tn - 7, n, { italic: false, size: 11 })).join('')
    + t(150, 192, 'the same angle: a longer transom stands farther along', { size: 11 }));
}

function aimFigure(): string {
  const panel = (cx: number, reach: number, along: boolean, label: string) => {
    const cy = 52, A = [cx - 16, cy - 22], B = [cx + 18, cy + 16], M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const l = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = along ? (B[0] - A[0]) / l : 1, uy = along ? (B[1] - A[1]) / l : 0;
    return circle(cx, cy, 44, C.ink, 1, '', '#141a28')
      + line(M[0] - ux * reach, M[1] - uy * reach, M[0] + ux * reach, M[1] + uy * reach, '#d9b36a', 4)
      + dot(M[0], M[1], 4, '#8a6a34') + star(A[0], A[1], 5, '#efe6c8') + star(B[0], B[1], 5, '#efe6c8')
      + t(cx, 114, label, { size: 12 });
  };
  const half = Math.hypot(34, 38) / 2;
  return svg(122, panel(52, 13, false, '1 · aim between') + panel(150, 13, true, '2 · turn') + panel(248, half, true, '3 · slide'));
}

function scaleFigure(): string {
  const x = (d: number) => 20 + (260 * d) / STAFF_L, tr = TRANSOMS[0];
  const marks = [4, 5, 6, 8, 10, 15, 20, 30].map(a => {
    const X = x(distanceFor(tr, a));
    return line(X, 40, X, 54, C.ink, 1.3) + (a === 20 ? '' : t(X, 34, `${a}°`, { italic: false, size: 11 }));
  }).join('');
  const Tx = x(distanceFor(tr, 12));
  return svg(112,
    `<rect x="20" y="40" width="260" height="24" fill="#e8d9b5" stroke="${C.ink}" stroke-width="0.8"/>` + marks
    + `<rect x="${f(Tx)}" y="30" width="6" height="46" fill="${C.rubric}"/>`
    + dot(12, 52, 3.2) + t(12, 76, 'eye', { size: 11 })
    + line(Tx, 78, Tx, 90, C.soft, 0.8) + t(Tx, 102, 'read at the transom’s edge nearer the eye', { size: 11, anchor: 'start' }));
}

export function crossStaffExplanation(show: CrossStaffShows): ExplainSection[] {
  return [
    {
      id: 'angle', title: 'What is being measured',
      body: [
        'The cross-staff measures the angle between two stars: how far apart they look. Unlike altitude, this angle does not change as the sky turns or as you travel. Two stars keep the same distance all night, every night, seen from anywhere.',
        'Levi ben Gerson described such an instrument in the 14th century for measuring the sky. Angles between stars are what a star map is built from.',
      ],
      figure: angleFigure(),
      figureLabel: 'Two lines from the eye to two stars, and the angle between them.',
      show: { label: 'Show me the cross-staff', run: show.whole },
    },
    {
      id: 'triangle', title: 'Why the transom’s position gives the angle',
      body: [
        'With your eye at the end of the staff and one end of the transom on each star, the lines of sight form a triangle. The transom’s length is fixed, so the angle depends only on how far along the staff it stands.',
        'Near the eye, the transom covers a wide angle; far down the staff, a narrow one. Half the transom and the distance from the eye make a right-angled triangle, so the tangent of half the angle is one divided by the other.',
      ],
      figure: triangleFigure(),
      figureLabel: 'Side view: the eye, the staff and the transom form a right-angled triangle whose angle at the eye is half the angle between the stars.',
      show: { label: 'Show me the transom', run: show.transom },
    },
    {
      id: 'transoms', title: 'Why there are several transoms',
      body: [
        'The staff is only so long. A long transom could not span a small angle, because it would have to stand beyond the end of the staff. A short one could not span a wide angle, because it would have to come too close to the eye.',
        'So each transom serves a range of angles, and each has its own scale on its own face of the staff. Choose one whose range holds your two stars.',
      ],
      figure: transomsFigure(),
      figureLabel: 'Three transoms of different lengths touching the same two lines of sight, each at a different distance along the staff.',
      show: { label: 'Show me the transom in use', run: show.transom },
    },
    {
      id: 'aim', title: 'Why you aim, turn and slide',
      body: [
        'The two ends of the transom are equally far from the staff, so the staff must point exactly midway between the stars. The transom must also lie along the line joining them, which is why you turn it. Only then does sliding bring both ends onto their stars together.',
        'The hard part is that your eye cannot look at both ends at once. Observers glanced from one end to the other, and that was a main source of error with this instrument.',
      ],
      figure: aimFigure(),
      figureLabel: 'The view along the staff in three stages: aimed between the two stars, the transom turned along the line joining them, then slid until its ends touch both.',
      show: { label: 'Show me the view along the staff', run: show.sight },
    },
    {
      id: 'scale', title: 'Why the scale is uneven',
      body: [
        'Each mark on the staff is placed where the transom must stand for that angle. Because the angle depends on the tangent, the marks are not evenly spaced: they spread far apart at the small angles down the staff, and crowd together at the large angles near the eye.',
        'So the instrument is most exact for small angles. That is also why the divisions here go down to single minutes in some places, and only to degrees in others.',
      ],
      figure: scaleFigure(),
      figureLabel: 'The scale of the shortest transom along the staff: the marks for 4, 5 and 6 degrees stand far apart, those for 15, 20 and 30 degrees close together near the eye.',
      show: { label: 'Show me the scale', run: show.scale },
    },
  ];
}
