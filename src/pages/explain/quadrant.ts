// "How it works" for the quadrant: why each step does what it does.
import type { ExplainSection } from '../../ui/shell';
import { C, circle, dot, line, path, star, svg, t } from '../../ui/figure';

export interface QuadrantShows {
  /** The instrument as a whole. */
  whole(): void;
  sights(): void;
  plumb(): void;
  ring(): void;
}

const D = Math.PI / 180;

/** The sky as a dome over the observer, north at the back. */
function coordinatesFigure(): string {
  const cx = 150, cy = 128, R = 105, ry = 30;
  const at = (alt: number, az: number): [number, number] => {
    const c = Math.cos(alt * D);
    return [cx + R * c * Math.sin(az * D), cy - ry * c * Math.cos(az * D) - R * Math.sin(alt * D)];
  };
  const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const azArc: [number, number][] = [], altArc: [number, number][] = [];
  for (let a = 0; a <= 110; a += 5) azArc.push(at(0, a));
  for (let a = 0; a <= 40; a += 4) altArc.push(at(a, 110));
  const [sx, sy] = at(40, 110), [nx, ny] = at(0, 0);
  return svg(182,
    path(`M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}`, C.soft, 1)
    + `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${ry}" fill="none" stroke="${C.ink}" stroke-width="1.2"/>`
    + dot(cx, cy, 3) + line(cx, cy, sx, sy, C.ink, 0.8, '3 3')
    + path(poly(azArc), C.blue, 3) + path(poly(altArc), C.red, 3) + star(sx, sy, 6)
    + dot(nx, ny, 2.6) + t(nx, ny - 6, 'north', { size: 11 })
    + t(sx + 9, sy - 2, 'star', { anchor: 'start', color: C.red })
    + t(262, 104, 'altitude', { anchor: 'start', color: C.red, size: 11 })
    + t(cx + 30, cy + 46, 'azimuth, from north through east', { color: C.blue, size: 11 }));
}

function sightsFigure(): string {
  const panel = (cx: number, off: [number, number], label: string, color: string) => {
    const cy = 54;
    return circle(cx, cy, 44, C.ink, 0, '', '#141a28')
      + circle(cx, cy, 30, '#d9b36a', 5)
      + circle(cx + off[0], cy + off[1], 11, '#d9b36a', 3)
      + star(cx + off[0] * 1.9, cy + off[1] * 1.9, 5, '#efe6c8')
      + t(cx, 116, label, { color, size: 12 });
  };
  return svg(124, panel(84, [13, -9], 'the rings out of line', C.red) + panel(216, [0, 0], 'star through both', C.green));
}

function plumbFigure(): string {
  const a = 32 * D, L = 130, Ax = 200, Ay = 34;
  const Rx = Ax - L * Math.cos(a), Ry = Ay + L * Math.sin(a), Sx = Ax + L * Math.sin(a), Sy = Ay + L * Math.cos(a);
  const f = (n: number) => n.toFixed(1);
  return svg(204,
    path(`M${Ax} ${Ay}L${f(Rx)} ${f(Ry)}A${L} ${L} 0 0 0 ${f(Sx)} ${f(Sy)}Z`, C.rubric, 1.6, '', '#efe4c8')
    + line(Rx - 12 * Math.cos(a), Ry + 12 * Math.sin(a), Ax + 44 * Math.cos(a), Ay - 44 * Math.sin(a), C.ink, 0.8, '3 3')
    + star(Ax + 50 * Math.cos(a), Ay - 50 * Math.sin(a), 6)
    + dot(Rx - 14 * Math.cos(a), Ry + 14 * Math.sin(a), 3)
    + t(Rx - 22, Ry + 24, 'eye', { size: 11 })
    + line(Ax, Ay, Ax, Ay + L + 14, C.ink, 1.3) + path(`M${Ax - 4} ${Ay + L + 14}L${Ax + 4} ${Ay + L + 14}L${Ax} ${Ay + L + 24}Z`, C.ink, 0.6, '', C.ink)
    + line(Rx, Ry, Rx + 78, Ry, C.soft, 1, '4 3')
    + path(`M${f(Rx + 44)} ${f(Ry)}A44 44 0 0 0 ${f(Rx + 44 * Math.cos(a))} ${f(Ry - 44 * Math.sin(a))}`, C.red, 1.6)
    + path(`M${Ax} ${Ay + 52}A52 52 0 0 0 ${f(Ax + 52 * Math.sin(a))} ${f(Ay + 52 * Math.cos(a))}`, C.red, 1.6)
    + t(Rx + 2, Ry - 34, 'altitude', { anchor: 'end', color: C.red, size: 11 }) + line(Rx + 4, Ry - 34, Rx + 36, Ry - 12, C.soft, 0.8)
    + t(298, Ay + 30, 'the same', { anchor: 'end', color: C.red, size: 11 }) + t(298, Ay + 43, 'angle', { anchor: 'end', color: C.red, size: 11 }) + line(Ax + 46, Ay + 36, Ax + 16, Ay + 50, C.soft, 0.8)
    + t(Ax - 8, Ay + L + 26, 'plumb line', { anchor: 'end', size: 11 }));
}

function ringFigure(): string {
  const cx = 150, cy = 88, r = 66, az = 110 * D;
  const px = cx + (r - 6) * Math.sin(az), py = cy - (r - 6) * Math.cos(az);
  return svg(178,
    circle(cx, cy, r, C.ink, 1.4) + circle(cx, cy, r - 12, C.ink, 0.7)
    + path(`M${cx} ${cy - r + 6}A${r - 6} ${r - 6} 0 0 1 ${px.toFixed(1)} ${py.toFixed(1)}`, C.blue, 3)
    + line(cx, cy, px, py, C.rubric, 3) + dot(cx, cy, 3)
    + t(cx, cy - r - 6, 'north', { size: 11 }) + t(cx + r + 6, cy + 4, 'east', { anchor: 'start', size: 11 })
    + t(cx, cy + r + 15, 'south', { size: 11 }) + t(cx - r - 6, cy + 4, 'west', { anchor: 'end', size: 11 })
    + t(cx + r + 10, cy - 42, 'azimuth', { anchor: 'start', color: C.blue, size: 11 }));
}

export function quadrantExplanation(show: QuadrantShows): ExplainSection[] {
  return [
    {
      id: 'coordinates', title: 'Two numbers place a star in your sky',
      body: [
        'From where you stand, any star’s position takes two angles. Its altitude is how high it stands above the horizon, from 0° on the horizon to 90° overhead. Its azimuth is which way you face to see it, counted round the horizon from north through east.',
        'Both change all night as the sky turns, and they differ from place to place. So a reading belongs to one place and one moment.',
      ],
      figure: coordinatesFigure(),
      figureLabel: 'A dome over the observer: altitude rises from the horizon to the star, azimuth runs along the horizon from north through east.',
      show: { label: 'Show me the quadrant', run: show.whole },
    },
    {
      id: 'sights', title: 'Why there are two sights',
      body: [
        'Two points fix a line. When a star shows through both rings on the top edge, that edge points straight at the star. With only one ring, you could see the star from many angles and the edge could point anywhere.',
        'The farther apart the sights are, the less a small slip of the eye matters. That is why quadrants were built large: this one has a radius of a metre.',
      ],
      figure: sightsFigure(),
      figureLabel: 'The view through the two rings: out of line, and lined up with the star in both.',
      show: { label: 'Show me the sights', run: show.sights },
    },
    {
      id: 'plumb', title: 'Why the plumb line gives the altitude',
      body: [
        'The cord always hangs straight down, whatever the instrument does, so it gives a fixed reference: the true vertical.',
        'Aim at the horizon and the top edge is level, the plate’s other straight edge is vertical, and the cord lies along that edge: the scale reads 0°. Tilt the plate up by any angle and that edge tilts away from the vertical by the same angle, while the cord stays put. So the angle between the cord and the edge, which the scale measures, always equals the height of the star.',
      ],
      figure: plumbFigure(),
      figureLabel: 'The tilted quadrant: the angle the sighting edge makes with level equals the angle between the plumb line and the plate’s other edge.',
      show: { label: 'Show me the plumb line', run: show.plumb },
    },
    {
      id: 'ring', title: 'Why the ring gives the azimuth',
      body: [
        'The quadrant turns on its post, and a pointer turns with it, always in the direction the sights face. The ring under the pointer is fixed to the ground with 0° toward north, so the pointer reads the direction of the star.',
      ],
      figure: ringFigure(),
      figureLabel: 'The ring seen from above: the pointer’s angle from north, through east, is the azimuth.',
      show: { label: 'Show me the azimuth ring', run: show.ring },
    },
  ];
}
