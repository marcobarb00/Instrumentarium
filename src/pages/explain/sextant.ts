// "How it works" for the sextant: why each step does what it does.
import type { ExplainSection } from '../../ui/shell';
import { C, circle, dot, fid, line, path, star, svg, t } from '../../ui/figure';

export interface SextantShows {
  whole(): void;
  glass(): void;
  mirrors(): void;
  scale(): void;
  horizon(): void;
}

const D = Math.PI / 180;
type P = [number, number];
const f = (n: number) => n.toFixed(1);

function deckFigure(): string {
  const eye: P = [141.7, 70.6];
  return svg(170,
    path('M0 150Q40 142 80 150T160 150T240 150T300 150L300 170L0 170Z', C.blue, 0.8, '', '#d7e0ea')
    + `<g transform="rotate(-8 150 130)">` + path('M95 125L205 125L190 150L110 150Z', C.ink, 1, '', '#b9a27a') + line(150, 125, 150, 70, C.ink, 2) + '</g>'
    + dot(eye[0], eye[1], 3)
    + line(eye[0], eye[1], 8, 147, C.blue, 1.2) + line(eye[0], eye[1], 34, 12, C.sun, 1.6) + star(30, 10, 6)
    + path(`M${f(eye[0] - 56)} ${f(eye[1] + 32)}A65 65 0 0 1 ${f(eye[0] - 57)} ${f(eye[1] - 31)}`, C.red, 1.6)
    + t(66, 76, 'this angle', { color: C.red, size: 11, anchor: 'end' })
    + line(246, 26, 246, 100, C.ink, 1.2) + line(246, 26, 226, 96, C.soft, 1, '3 3') + line(246, 26, 266, 96, C.soft, 1, '3 3')
    + t(246, 16, 'a plumb line swings', { size: 11 }));
}

function glassFigure(): string {
  const panel = (cx: number, starY: number, label: string, color: string) => {
    const cy = 72, r = 52, h = cy + 16, id = fid('view');
    return `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><g clip-path="url(#${id})">`
      + `<rect x="${cx - r}" y="${cy - r}" width="${r}" height="${2 * r}" fill="#141a28"/>`
      + `<rect x="${cx - r}" y="${h}" width="${r}" height="${r}" fill="#2f4a63"/>`
      + `<rect x="${cx}" y="${cy - r}" width="${r}" height="${2 * r}" fill="#222c42"/>`
      + line(cx, h, cx + r, h, '#8fa6bd', 0.8, '3 3') + '</g>'
      + circle(cx, cy, r, C.ink, 1.4) + line(cx, cy - r, cx, cy + r, C.soft, 1.2)
      + star(cx + 24, starY, 6, '#efe6c8')
      + t(cx - 26, 13, 'clear', { size: 11 }) + t(cx + 26, 13, 'silvered', { size: 11 })
      + t(cx, 142, label, { size: 12, color });
  };
  return svg(150, panel(80, 44, 'star’s image too high', C.red) + panel(220, 88, 'touching the horizon', C.green));
}

function mirrorsFigure(): string {
  const I: P = [170, 80], H: P = [130, 160], E: P = [272, 160], theta = 20 * D;
  const norm = ([x, y]: P): P => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  const rot = ([x, y]: P, a: number): P => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const reflect = ([x, y]: P, [mx, my]: P): P => { const k = 2 * (x * mx + y * my); return [x - k * mx, y - k * my]; };
  // The horizon glass sends the ray from the index mirror along the line to the eye.
  const u = norm([H[0] - I[0], H[1] - I[1]]), n = norm([1 - u[0], 0 - u[1]]);
  // Turn the index mirror by θ, the way that raises the star.
  const candidates = [theta, -theta].map(a => { const m = rot(n, a); const w = reflect(u, m); return { m, s: [-w[0], -w[1]] as P }; });
  const { m, s } = candidates.find(c => c.s[1] < 0)!;
  const mirror = ([x, y]: P, [nx, ny]: P, len: number, color: string, w: number, dash = '') => line(x - ny * len, y + nx * len, x + ny * len, y - nx * len, color, w, dash);
  const star0: P = [I[0] + s[0] * 100, I[1] + s[1] * 100], far: P = [E[0] + s[0] * 66, E[1] + s[1] * 66];
  return svg(204,
    line(E[0], E[1], 14, E[1], C.blue, 1.2) + t(16, E[1] - 7, 'sea horizon', { anchor: 'start', color: C.blue, size: 11 })
    + line(star0[0], star0[1], I[0], I[1], C.sun, 2) + line(I[0], I[1], H[0], H[1], C.sun, 2) + line(H[0], H[1], E[0], E[1], C.sun, 2)
    + star(star0[0], star0[1], 6) + t(star0[0] + 10, star0[1] + 2, 'star', { anchor: 'start', color: C.red, size: 11 })
    + mirror(I, n, 18, C.soft, 1.4, '3 3') + mirror(I, m, 20, C.ink, 4) + mirror(H, n, 16, C.ink, 4)
    + t(I[0] + 24, I[1] - 8, 'index mirror,', { anchor: 'start', size: 11 }) + t(I[0] + 24, I[1] + 5, 'on the arm', { anchor: 'start', size: 11 })
    + t(H[0] - 14, H[1] + 16, 'horizon glass', { anchor: 'end', size: 11 })
    + dot(E[0], E[1], 3.2) + t(E[0] + 1, E[1] + 16, 'eye', { size: 11 })
    + line(E[0], E[1], far[0], far[1], C.red, 1, '4 3')
    + path(`M${E[0] - 52} ${E[1]}A52 52 0 0 1 ${f(E[0] + s[0] * 52)} ${f(E[1] + s[1] * 52)}`, C.red, 1.6)
    + t(150, 196, 'the star’s height: twice the angle the mirror turned', { color: C.red, size: 11 }));
}

function scaleFigure(): string {
  const cx = 150, cy = 12, R = 128;
  const p = (reading: number, r: number): P => { const a = (30 - reading / 2) * D; return [cx + r * Math.sin(a), cy + r * Math.cos(a)]; };
  let marks = '';
  for (let k = 0; k <= 120; k += 10) { const [x0, y0] = p(k, R), [x1, y1] = p(k, R + (k % 40 === 0 ? 9 : 5)); marks += line(x0, y0, x1, y1, C.ink, 1); }
  const [ax, ay] = p(70, R + 2), [lx, ly] = p(0, R), [rx, ry] = p(120, R);
  return svg(184,
    path(`M${cx} ${cy}L${f(lx)} ${f(ly)}A${R} ${R} 0 0 1 ${f(rx)} ${f(ry)}Z`, C.rubric, 1.4, '', '#efe4c8') + marks
    + [0, 40, 80, 120].map(k => { const [x, y] = p(k, R + 20); return t(x, y + 4, String(k), { italic: false, size: 11 }); }).join('')
    + line(cx, cy, ax, ay, C.ink, 3.5) + dot(cx, cy, 3.5)
    + circle(ax, ay, 7, C.ink, 1.2, '', C.moon)
    + t(ax - 12, ay - 12, 'drum', { anchor: 'end', size: 11 })
    + t(cx + 8, cy + 42, 'index arm', { anchor: 'start', size: 11 })
    + t(cx, 180, 'an arc of 60°, a sixth of a circle, marked to 120°', { size: 11, color: C.rubric }));
}

function dipFigure(): string {
  const E: P = [172, 92], cx = 172, cy = 454, r = 340;
  const y = (x: number) => cy - Math.sqrt(r * r - (x - cx) * (x - cx));
  const dip = Math.acos(r / (cy - E[1])), Tx = cx - r * Math.sin(dip), Ty = cy - r * Math.cos(dip);
  const dirT = Math.hypot(Tx - E[0], Ty - E[1]), ux = (Tx - E[0]) / dirT, uy = (Ty - E[1]) / dirT;
  const a = 28 * D, sx = E[0] - 128 * Math.cos(a), sy = E[1] - 128 * Math.sin(a);
  return svg(196,
    path(`M0 ${f(y(0))}A${r} ${r} 0 0 1 300 ${f(y(300))}L300 196L0 196Z`, C.blue, 0.8, '', '#d7e0ea')
    + line(E[0], E[1], E[0], y(E[0]), C.ink, 1.6) + dot(E[0], E[1], 3)
    + line(E[0], E[1], 12, E[1], C.soft, 1.2, '4 3') + line(E[0], E[1], E[0] + ux * 170, E[1] + uy * 170, C.blue, 1.3)
    + line(E[0], E[1], sx, sy, C.sun, 1.8) + star(sx, sy, 6)
    + path(`M${f(E[0] - 56)} ${E[1]}A56 56 0 0 0 ${f(E[0] + ux * 56)} ${f(E[1] + uy * 56)}`, C.red, 2)
    + path(`M${f(E[0] - 88 * Math.cos(a))} ${f(E[1] - 88 * Math.sin(a))}A88 88 0 0 0 ${f(E[0] + ux * 88)} ${f(E[1] + uy * 88)}`, C.green, 1.3)
    + t(E[0] + 8, E[1] - 4, 'eye', { anchor: 'start', size: 11 })
    + t(14, E[1] - 5, 'true level', { anchor: 'start', size: 11 })
    + t(E[0] - 66, E[1] + 13, 'dip', { anchor: 'end', color: C.red, size: 11 })
    + t(200, 40, 'the sextant measures', { anchor: 'start', color: C.green, size: 11 }) + t(200, 53, 'from the sea horizon', { anchor: 'start', color: C.green, size: 11 })
    + line(198, 46, E[0] - 78, E[1] - 26, C.soft, 0.8)
    + t(20, 186, 'sea horizon (the drop is exaggerated)', { anchor: 'start', color: C.blue, size: 11 }));
}

export function sextantExplanation(show: SextantShows): ExplainSection[] {
  return [
    {
      id: 'deck', title: 'Why a ship needs a different instrument',
      body: [
        'A quadrant’s plumb line needs a steady place to hang. On a rolling deck it swings, and the reading goes with it. Yet a navigator needs a star’s altitude to find the ship’s position.',
        'The sextant does without a plumb line. It measures the angle between the star and the sea horizon, seeing both in the same view. When the ship rolls, the star and the horizon move together, so the angle between them can still be measured.',
      ],
      figure: deckFigure(),
      figureLabel: 'A ship rolling at sea: a plumb line swings, but the angle from the observer’s eye between the horizon and the star does not depend on the roll.',
      show: { label: 'Show me the sextant', run: show.whole },
    },
    {
      id: 'glass', title: 'Why the horizon glass is half silvered',
      body: [
        'To compare two things in different directions, you must see them at once. The horizon glass does this. Its clear half lets you look straight through to the sea horizon. Its silvered half is a mirror that shows you the light arriving from the index mirror, which is looking up at the sky.',
        'So one view holds two pictures side by side: the horizon, and a piece of sky brought down from above. Your job is to make the star in one touch the horizon in the other.',
      ],
      figure: glassFigure(),
      figureLabel: 'The view through the telescope: the clear half shows the sea horizon, the silvered half the star’s image, first too high, then touching the horizon’s level.',
      show: { label: 'Show me the horizon glass', run: show.glass },
    },
    {
      id: 'mirrors', title: 'Why moving the arm brings the star down',
      body: [
        'The index mirror rides on the arm. When a mirror turns, the ray it reflects turns twice as far. With two reflections in a row, the light reaching your eye is turned through exactly twice the angle between the two mirrors.',
        'With the mirrors parallel the silvered half shows the horizon itself, and the arc reads 0. Swing the arm through 20° and the silvered half now looks 40° higher. When the star’s image touches the horizon, the angle the light was turned through is the star’s height above the horizon.',
      ],
      figure: mirrorsFigure(),
      figureLabel: 'The path of the starlight: from the star to the index mirror, to the horizon glass, to the eye, which also sees the horizon directly. The star’s height is twice the angle the index mirror has turned.',
      show: { label: 'Show me the two mirrors', run: show.mirrors },
    },
    {
      id: 'scale', title: 'Why the arc reads double, and what the drum does',
      body: [
        'Because the light turns twice as far as the arm, each real degree of the arc is engraved as two. That is why an arc of 60°, a sixth of a circle, gives the instrument its name and reads up to 120°: you read the star’s height directly, with no doubling to do.',
        'The arm’s index gives the whole degree: take the last mark it has passed. The micrometer drum moves the arm by one degree of reading in one full turn, and its scale divides that turn into 60 minutes.',
      ],
      figure: scaleFigure(),
      figureLabel: 'The sextant’s frame: an arc of 60 degrees marked from 0 to 120, with the index arm and its micrometer drum.',
      show: { label: 'Show me the arc and the drum', run: show.scale },
    },
    {
      id: 'dip', title: 'Why the reading needs a small correction',
      body: [
        'Your eye is above the water, so you look slightly down to see the sea horizon. That drop is the dip. Here, with your eye 4 metres above the sea, it is about 3.5′. The sextant measures from the sea horizon, so its reading is a little more than the star’s true altitude.',
        'A navigator subtracts the dip, and also the bending of starlight by the air, called refraction. This site’s sky has no refraction, so the check on this page takes off only the dip.',
      ],
      figure: dipFigure(),
      figureLabel: 'The eye above the curved sea: the sea horizon lies below true level by the dip, so the sextant’s angle is larger than the star’s altitude.',
      show: { label: 'Show me the horizon in the telescope', run: show.horizon },
    },
  ];
}
