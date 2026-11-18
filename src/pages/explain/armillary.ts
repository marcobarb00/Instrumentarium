// "How it works" for Ptolemy's armillary: why each step does what it does.
import type { ExplainSection } from '../../ui/shell';
import { C, circle, dot, line, path, star, svg, t } from '../../ui/figure';

export interface ArmillaryShows {
  /** The ecliptic ring (with the colure fixed to it). */
  ecliptic(): void;
  /** The meridian ring and the index on the stand. */
  pole(): void;
  /** The outer ring and its pointer on the ecliptic. */
  outer(): void;
  /** The view along the outer ring. */
  along(): void;
  /** The inner ring and the sighting ring. */
  sights(): void;
}

/**
 * The celestial sphere seen from outside, with the ecliptic as an ellipse and
 * its north pole at the top. A circle of longitude runs from the pole down
 * through the point at `x` on the front of the ecliptic.
 */
function sphere(cx: number, cy: number, r: number): { body: string; front: (u: number) => [number, number]; meridian: string; onMeridian: (f: number) => [number, number]; lowerHalf: string } {
  const ry = r * 0.31, mx = cx + r * 0.62;
  const front = (u: number): [number, number] => [cx + r * Math.cos(u), cy + ry * Math.sin(u)];
  const ex = mx, ey = cy + ry * Math.sqrt(1 - ((mx - cx) / r) ** 2);
  const qx = cx + r * 0.85, qy = cy - r * 0.6;
  const onMeridian = (f: number): [number, number] => {
    // Point at fraction f along the quadratic curve from the pole to the ecliptic.
    const a = (1 - f) * (1 - f), b = 2 * f * (1 - f), c = f * f;
    return [a * cx + b * qx + c * ex, a * (cy - r) + b * qy + c * ey];
  };
  return {
    body: circle(cx, cy, r, C.ink, 1.2) + `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="none" stroke="${C.rubric}" stroke-width="2"/>` + dot(cx, cy - r, 2.6),
    front,
    meridian: `M${cx} ${cy - r}Q${qx} ${qy} ${ex} ${ey}`,
    onMeridian,
    // The second half of that curve, from its midpoint down to the ecliptic.
    lowerHalf: (() => { const [mx, my] = onMeridian(0.5); return `M${mx.toFixed(1)} ${my.toFixed(1)}Q${((qx + ex) / 2).toFixed(1)} ${((qy + ey) / 2).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`; })(),
  };
}

function coordinatesFigure(): string {
  const s = sphere(150, 92, 66);
  const [sx, sy] = s.onMeridian(0.5), [ex, ey] = s.onMeridian(1);
  const [vx, vy] = s.front(2.45);
  return svg(185,
    s.body + path(s.meridian, C.ink, 0.9, '3 3')
    + path(`M${vx.toFixed(1)} ${vy.toFixed(1)}A66 20.5 0 0 0 ${ex.toFixed(1)} ${ey.toFixed(1)}`, C.blue, 3)
    + path(s.lowerHalf, C.red, 2.6) // the latitude: from the star down its circle of longitude to the ecliptic
    + star(sx, sy, 6)
    + t(158, 22, 'pole of the ecliptic', { anchor: 'start' })
    + t(sx + 9, sy - 4, 'star', { anchor: 'start', color: C.red })
    + t(ex + 13, (sy + ey) / 2 - 4, 'latitude', { anchor: 'start', color: C.red })
    + t(150, 130, 'longitude', { color: C.blue })
    + t(vx + 4, vy + 15, '0°', { anchor: 'start', italic: false, size: 11 })
    + t(222, 96, 'ecliptic', { anchor: 'start', color: C.rubric }));
}

function poleFigure(): string {
  const a = (42 * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  return svg(150,
    line(30, 120, 270, 120, C.ink, 1.4) + t(32, 136, 'south', { anchor: 'start', size: 11 }) + t(268, 136, 'north', { anchor: 'end', size: 11 })
    + dot(150, 120, 3)
    + line(150, 120, 150 + 130 * dx, 120 - 130 * dy, C.rubric, 2.2) + star(150 + 136 * dx, 120 - 136 * dy, 6, C.ink)
    + t(236, 22, 'celestial pole', { anchor: 'end' })
    + path(`M190 120A40 40 0 0 0 ${(150 + 40 * dx).toFixed(1)} ${(120 - 40 * dy).toFixed(1)}`, C.red, 1.4)
    + t(196, 112, 'your latitude', { anchor: 'start', color: C.red })
    + t(100, 60, 'the sky turns', { size: 11 }) + t(100, 73, 'about this axis', { size: 11 }));
}

function outerFigure(): string {
  const s = sphere(150, 88, 64);
  const [mx, my] = s.onMeridian(0.42);
  return svg(190,
    s.body + path(`${s.meridian}`, C.blue, 2.6)
    + circle(mx, my, 6, C.ink, 0.6, '', C.moon)
    + t(158, 18, 'pole of the ecliptic', { anchor: 'start' })
    + t(mx + 10, my - 6, 'the guide', { anchor: 'start' })
    + t(220, 92, 'ecliptic', { anchor: 'start', color: C.rubric })
    + line(22, 176, 42, 176, C.blue, 2.6) + t(48, 180, 'the outer ring: every point at the guide’s longitude', { anchor: 'start', size: 11 }));
}

function alignFigure(): string {
  const one = (cx: number, on: boolean) => {
    const s = sphere(cx, 74, 44);
    const [mx, my] = s.onMeridian(0.42);
    return s.body + path(s.meridian, C.blue, 2.2) + circle(mx + (on ? 0 : 16), my + (on ? 0 : -6), 5, C.ink, 0.6, '', C.moon);
  };
  return svg(150,
    one(80, false) + one(220, true)
    + t(80, 140, 'turned wrong: off the ring', { size: 11 })
    + t(220, 140, 'turned right: on the ring', { size: 11, color: C.green }));
}

function sightsFigure(): string {
  const s = sphere(150, 92, 66);
  const [sx, sy] = s.onMeridian(0.5);
  const cx = 150, cy = 92, k = 1.7, fx = cx + (sx - cx) * k, fy = cy + (sy - cy) * k;
  const sq = (f: number) => {
    const x = cx + (sx - cx) * f, y = cy + (sy - cy) * f;
    return `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/>`;
  };
  return svg(205,
    s.body + path(s.meridian, C.green, 2.6)
    + line(cx, cy, fx, fy, C.ink, 0.9, '3 3') + sq(0.35) + sq(0.85) + star(fx, fy, 6)
    + t(fx + 9, fy + 4, 'star', { anchor: 'start', color: C.red })
    + t(222, 96, 'ecliptic', { anchor: 'start', color: C.rubric })
    + line(22, 176, 42, 176, C.green, 2.6) + t(48, 180, 'inner ring: crosses the ecliptic at the longitude', { anchor: 'start', size: 11 })
    + `<rect x="29" y="189" width="6" height="6" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/>` + t(48, 197, 'sights: slid along the ring to the latitude', { anchor: 'start', size: 11 }));
}

export function armillaryExplanation(show: ArmillaryShows): ExplainSection[] {
  return [
    {
      id: 'ecliptic', title: 'Measuring along the sun’s path',
      body: [
        'Ptolemy placed the stars by the ecliptic, the circle the sun follows through the year. A star’s longitude is how far along the ecliptic it lies, counted from the spring equinox in twelve signs of 30°; its latitude is how far north or south of the ecliptic it stands. His star catalogue in the Almagest gives every star this way.',
        'The ecliptic suited him because the sun, moon and planets all move along it: measuring the stars against the same circle makes it easy to say where the wanderers are among them.',
      ],
      figure: coordinatesFigure(),
      figureLabel: 'The sphere with the ecliptic: a star’s longitude runs along the ecliptic from 0°, its latitude up from the ecliptic toward the pole of the ecliptic.',
      show: { label: 'Show me the ecliptic ring', run: show.ecliptic },
    },
    {
      id: 'pole', title: 'Why you raise the pole',
      body: [
        'The sky turns once a day about an axis through the celestial pole, which stands above the northern horizon at an angle equal to your latitude (above the southern horizon, south of the equator).',
        'The armillary’s rings turn on an axle held by the meridian ring. Sliding that ring until the index reads your latitude points the axle at the celestial pole, so the rings can turn exactly as the sky does.',
      ],
      figure: poleFigure(),
      figureLabel: 'The celestial pole stands above the north horizon at an angle equal to your latitude; the sky turns about that axis.',
      show: { label: 'Show me the meridian ring', run: show.pole },
    },
    {
      id: 'guide', title: 'Why you need a guide',
      body: [
        'With the pole set, the rings can still turn on their axle, and only one position matches the sky: the one where the instrument’s ecliptic lies along the real ecliptic. But the ecliptic is not drawn on the sky. You cannot sight it.',
        'What you can sight is a body whose longitude you already know: the moon, from tables of its motion, or a star already measured. Ptolemy used the sun by day and the moon at dusk. The guide ties the rings to the sky.',
      ],
      show: { label: 'Show me the outer ring', run: show.outer },
    },
    {
      id: 'outer', title: 'Why the outer ring is set to the guide’s longitude',
      body: [
        'The outer ring turns about the poles of the ecliptic, so it is always a circle of longitude: every point on it has the same longitude, whatever its latitude. Setting its pointer to the guide’s longitude makes it the circle the guide lies on in the sky.',
        'That is why only the longitude is needed: the guide’s latitude does not matter, because the ring passes through every latitude.',
      ],
      figure: outerFigure(),
      figureLabel: 'The outer ring is a circle of longitude through the ecliptic’s pole; the guide lies somewhere on it.',
      show: { label: 'Show me the outer ring', run: show.outer },
    },
    {
      id: 'align', title: 'Why you bring the guide onto the ring',
      body: [
        'In the sky, the guide lies on its own circle of longitude. On the instrument, the outer ring is that circle, but only if the rings are turned as the sky is. Turn them on the axle: when the guide lies in the plane of the outer ring, the instrument’s ecliptic lies on the sky’s.',
        'You see this by putting your eye level with the ring’s flat face, so that the face shrinks to one straight edge, and turning until that edge cuts the guide in half. Ptolemy says the star should seem fastened to the near and far parts of the face. The ring has some thickness, but the guide is so far away that the face and the middle of the ring point the same way.',
        'There is a second position where the guide also reaches the edge. The ring’s plane passes through the guide there too, but the ecliptic ring then lies away from the zodiac, so keep turning until you reach the right one.',
      ],
      figure: alignFigure(),
      figureLabel: 'Two spheres: turned wrongly, the guide is off the outer ring; turned rightly, the guide is on it.',
      show: { label: 'Show me the view along the ring', run: show.along },
    },
    {
      id: 'sights', title: 'Why the sights give the star’s place',
      body: [
        'The inner ring, like the outer, is a circle of longitude. When the star shows through both sights, it lies in the inner ring’s plane, so the inner ring is the star’s circle of longitude, and its pointer on the ecliptic ring gives the longitude.',
        'The sights are on the sighting ring, which slides along the inner ring. How far it has slid from the ecliptic, north or south, is the star’s latitude, read on the inner ring’s scale.',
      ],
      figure: sightsFigure(),
      figureLabel: 'The inner ring through the star crosses the ecliptic at its longitude; the sights slide along it to the latitude.',
      show: { label: 'Show me the inner and sighting rings', run: show.sights },
    },
  ];
}
