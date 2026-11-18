// "How it works" for the astrolabe: why each step does what it does.
import type { ExplainSection } from '../../ui/shell';
import { almucantar, horizontalToPlate, plateGeometry, type XY } from '../../instruments/astrolabe/geometry';
import { arrowMarker, C, circle, dot, fid, line, path, star, svg, t } from '../../ui/figure';

/** The diagrams draw a real plate, for Rome's latitude, so their circles lie where the brass has them. */
const PLATE = plateGeometry(41.9, 23.44);
const toFig = ([x, y]: XY, cx: number, cy: number, r: number): XY => [cx + r * x, cy - r * y];
/** One altitude circle as an SVG path (clip it to the plate). */
function altitudeCircle(alt: number, cx: number, cy: number, r: number, stroke: string, w: number): string {
  const d = almucantar(alt, PLATE, 180).filter(p => Number.isFinite(p[0]) && Math.hypot(...p) < 6)
    .map((p, i) => { const [X, Y] = toFig(p, cx, cy, r); return `${i ? 'L' : 'M'}${X.toFixed(1)} ${Y.toFixed(1)}`; }).join('');
  return path(d, stroke, w);
}

export interface AstrolabeShows {
  /** The front: the plate (and the whole face). */
  plate(): void;
  rete(): void;
  /** The back: the alidade and its scales. */
  back(): void;
  /** The chosen star's pointer on the rete. */
  pointer(): void;
  /** The rule and the hour scale on the rim. */
  hour(): void;
}

function projectionFigure(): string {
  return svg(160,
    line(20, 80, 290, 80, C.rubric, 2) + t(290, 72, 'the plate', { anchor: 'end', color: C.rubric })
    + circle(150, 80, 55, C.ink, 1.2)
    + dot(150, 25) + t(158, 22, 'north pole', { anchor: 'start' })
    + dot(150, 135) + t(158, 148, 'south pole: the eye', { anchor: 'start' })
    + line(150, 135, 192.1, 44.6, C.ink, 0.8, '3 3') + star(192.1, 44.6) + dot(175.6, 80, 3, C.blue)
    + line(150, 135, 228.5, 80, C.ink, 0.8, '3 3') + star(201.7, 98.8) + dot(228.5, 80, 3, C.blue)
    + t(200, 40, 'star', { anchor: 'start', color: C.red })
    + t(290, 112, 'its place', { anchor: 'end', color: C.blue }) + t(290, 125, 'on the plate', { anchor: 'end', color: C.blue }));
}

function plateFigure(): string {
  const clip = fid('plate'), cx = 150, cy = 92, r = 75;
  const [zx, zy] = toFig(horizontalToPlate(90, 0, PLATE), cx, cy, r);
  const [hx, hy] = toFig(horizontalToPlate(0, 305, PLATE), cx, cy, r);
  const [ax, ay] = toFig(horizontalToPlate(20, 120, PLATE), cx, cy, r);
  return svg(190,
    `<defs><clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`
    + `<g clip-path="url(#${clip})">`
    + line(cx, cy - r, cx, cy + r, C.soft, 0.8)
    + altitudeCircle(20, cx, cy, r, C.ink, 0.8) + altitudeCircle(40, cx, cy, r, C.ink, 0.8) + altitudeCircle(60, cx, cy, r, C.ink, 0.8)
    + altitudeCircle(0, cx, cy, r, C.rubric, 2)
    + '</g>'
    + circle(cx, cy, r, C.ink, 1.4) + dot(zx, zy, 2.2)
    + t(cx, 12, 'south', { size: 11 }) + t(cx, cy + 40, 'north', { size: 11 })
    + t(68, cy + 4, 'east', { anchor: 'end', size: 12, color: C.green }) + t(232, cy + 4, 'west', { anchor: 'start', size: 12, color: C.green })
    + line(zx + 2, zy, 228, 52, C.soft, 0.8) + t(232, 54, 'zenith', { anchor: 'start' })
    + line(hx, hy, 228, 136, C.soft, 0.8) + t(232, 140, 'horizon', { anchor: 'start', color: C.rubric })
    + line(ax, ay, 70, 46, C.soft, 0.8) + t(68, 38, 'altitude', { anchor: 'end' }) + t(68, 51, 'circles', { anchor: 'end' }));
}

function reteFigure(): string {
  const m = fid('arr');
  return svg(185,
    arrowMarker(m)
    + circle(150, 95, 75, C.soft, 1, '4 3')
    + circle(150, 73.7, 53.7, C.rubric, 2)
    + dot(150, 95, 2.8) + t(158, 109, 'pole', { anchor: 'start' })
    + [[100, 125], [203, 60], [118, 52], [196, 132], [82, 82]].map(([x, y]) => path(`M${x} ${y}l-4 -10l8 0z`, C.ink, 0.8, '', C.rubric)).join('')
    + t(150, 13, 'ecliptic: the sun’s path through the year', { color: C.rubric })
    + line(199, 132, 228, 150, C.soft, 0.8) + t(230, 156, 'star pointers', { anchor: 'start' })
    + `<path d="M${150 - 82 * Math.sin(1.05)} ${95 - 82 * Math.cos(1.05)}A82 82 0 0 1 ${150 - 82 * Math.sin(0.35)} ${95 - 82 * Math.cos(0.35)}" fill="none" stroke="${C.ink}" stroke-width="1.2" marker-end="url(#${m})"/>`
    + t(70, 40, 'turns once', { anchor: 'end', size: 11 }) + t(70, 53, 'a day', { anchor: 'end', size: 11 }));
}

/** Side view of the sky above a plan of the plate, on one scale: the two solstices drop onto the plate as the ends of a diameter. */
function eclipticFigure(): string {
  const eps = (23.44 * Math.PI) / 180, R = 60, cx = 160, cy = 76, py = 256;
  const near = R * Math.tan(Math.PI / 4 - eps / 2), far = R * Math.tan(Math.PI / 4 + eps / 2);
  const sx = cx + R * Math.cos(eps), sy = cy - R * Math.sin(eps), wx = cx - R * Math.cos(eps), wy = cy + R * Math.sin(eps);
  const nearX = cx + near, farX = cx - far, midX = (nearX + farX) / 2, rad = (nearX - farX) / 2;
  return svg(392,
    line(44, cy, 254, cy, C.ink, 1.6) + t(258, cy + 4, 'plate', { anchor: 'start', size: 11 })
    + circle(cx, cy, R, C.ink, 1.1) + line(sx, sy, wx, wy, C.rubric, 2.4)
    + dot(cx, cy + R, 2.6) + t(cx + 8, cy + R + 13, 'south pole: the eye', { anchor: 'start', size: 11 })
    + line(cx, cy + R, sx, sy, C.ink, 0.8, '3 3') + line(cx, cy + R, farX, cy, C.ink, 0.8, '3 3')
    + dot(sx, sy, 3.4, C.sun) + dot(wx, wy, 3.4, C.sun)
    + t(296, sy - 9, 'summer solstice', { anchor: 'end', size: 11 }) + t(wx - 7, wy + 14, 'winter solstice', { anchor: 'end', size: 11 })
    + dot(nearX, cy, 3, C.blue) + dot(farX, cy, 3, C.blue)
    + line(nearX, cy, nearX, py, C.blue, 0.8, '4 3') + line(farX, cy, farX, py, C.blue, 0.8, '4 3')
    + circle(cx, py, far, C.ink, 1.1) + circle(cx, py, near, C.soft, 1, '4 3') + circle(cx, py, R, C.soft, 1)
    + circle(midX, py, rad, C.rubric, 2.4)
    + dot(nearX, py, 3, C.blue) + dot(farX, py, 3, C.blue)
    + dot(cx, py, 3) + line(midX - 4, py - 4, midX + 4, py + 4, C.red, 1.6) + line(midX + 4, py - 4, midX - 4, py + 4, C.red, 1.6)
    + dot(24, 368, 3) + t(34, 372, 'the pole, where the rete turns', { anchor: 'start', size: 11 })
    + line(20, 380, 28, 388, C.red, 1.6) + line(28, 380, 20, 388, C.red, 1.6) + t(34, 388, 'the centre of the ecliptic ring, halfway between the solstices', { anchor: 'start', size: 11 }));
}

function altitudeFigure(): string {
  return svg(165,
    circle(100, 30, 6) + line(100, 36, 100, 40, C.ink, 2) + circle(100, 95, 55, C.ink, 1.3)
    + line(30, 95, 270, 95, C.soft, 1, '4 3') + t(34, 89, 'level', { anchor: 'start', size: 11 })
    + line(49.1, 126.8, 150.9, 63.2, C.rubric, 3)
    + line(150.9, 63.2, 232, 13, C.ink, 0.8, '3 3') + star(238, 10) + t(250, 14, 'star', { anchor: 'start', color: C.red })
    + path('M130 95A30 30 0 0 0 125.5 79.3', C.red, 1.4) + t(136, 88, 'altitude', { anchor: 'start', color: C.red })
    + t(100, 162, 'hanging from its ring, the instrument stays upright', { size: 11 }));
}

function settingFigure(): string {
  const clip = fid('plate'), cx = 150, cy = 90, r = 75;
  const [zx, zy] = toFig(horizontalToPlate(90, 0, PLATE), cx, cy, r);
  /** A pointer whose tip touches the altitude circle, its body reaching outward. */
  const pointer = ([x, y]: XY, fill: string) => {
    const l = Math.hypot(x - zx, y - zy), ux = (x - zx) / l, uy = (y - zy) / l;
    return path(`M${x.toFixed(1)} ${y.toFixed(1)}L${(x + 12 * ux - 4 * uy).toFixed(1)} ${(y + 12 * uy + 4 * ux).toFixed(1)}L${(x + 12 * ux + 4 * uy).toFixed(1)} ${(y + 12 * uy - 4 * ux).toFixed(1)}Z`, C.ink, 0.6, '', fill);
  };
  const e = toFig(horizontalToPlate(30, 112, PLATE), cx, cy, r), w = toFig(horizontalToPlate(30, 248, PLATE), cx, cy, r);
  const [lx, ly] = toFig(horizontalToPlate(30, 205, PLATE), cx, cy, r);
  return svg(196,
    `<defs><clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`
    + `<g clip-path="url(#${clip})">` + line(cx, cy - r, cx, cy + r, C.soft, 0.8) + altitudeCircle(0, cx, cy, r, C.rubric, 1.6) + altitudeCircle(30, cx, cy, r, C.ink, 1.5) + '</g>'
    + circle(cx, cy, r, C.ink, 1.3)
    + pointer(e, C.green) + pointer(w, '#e6dccb')
    + line(w[0] + 3, w[1] - 7, w[0] + 15, w[1] + 5, C.red, 1.6) + line(w[0] + 15, w[1] - 7, w[0] + 3, w[1] + 5, C.red, 1.6)
    + line(lx, ly, 228, 34, C.soft, 0.8) + t(232, 30, 'your altitude', { anchor: 'start', size: 11 }) + t(232, 43, 'circle', { anchor: 'start', size: 11 })
    + t(68, cy + 4, 'east', { anchor: 'end', color: C.green }) + t(232, cy + 4, 'west', { anchor: 'start', color: C.muted })
    + t(78, 188, 'star in the east: here', { color: C.green }) + t(226, 188, 'not on this side', { color: C.red }));
}

function sunFigure(): string {
  const ticks = (y0: number, y1: number, step: number) => {
    let s = '';
    for (let x = 24; x <= 276; x += step) s += line(x, y0, x, y1, C.ink, 0.7);
    return s;
  };
  return svg(112,
    `<rect x="20" y="30" width="260" height="22" fill="#efe4c8" stroke="${C.ink}" stroke-width="0.8"/>`
    + `<rect x="20" y="56" width="260" height="22" fill="#efe4c8" stroke="${C.ink}" stroke-width="0.8"/>`
    + ticks(30, 38, 8.4) + ticks(56, 64, 7)
    + t(26, 48, 'calendar', { anchor: 'start', size: 11 }) + t(26, 74, 'zodiac', { anchor: 'start', size: 11 })
    + line(176, 20, 176, 88, C.rubric, 3)
    + t(176, 14, 'a date', { color: C.rubric }) + t(176, 104, 'the sun’s degree that day', { color: C.rubric }));
}

function hourFigure(): string {
  const cx = 150, cy = 96;
  let ticks = '';
  for (let k = 0; k < 24; k++) {
    const a = (k * 15 * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
    ticks += line(cx + 64 * s, cy - 64 * c, cx + 70 * s, cy - 70 * c, C.ink, 0.8);
  }
  return svg(192,
    circle(cx, cy, 80, C.ink, 1.3) + circle(cx, cy, 64, C.ink, 0.9) + ticks
    + t(cx, cy - 86, 'XII', { italic: false, size: 11 }) + t(cx - 85, cy + 4, 'VI', { anchor: 'end', italic: false, size: 11 }) + t(cx + 85, cy + 4, 'XVIII', { anchor: 'start', italic: false, size: 11 })
    + circle(cx, cy - 18.2, 45.8, C.rubric, 1.6)
    + line(111, 28.5, 189, 163.5, C.ink, 3) + dot(cx, cy, 2.5)
    + dot(164.6, 121.2, 4.2, C.sun)
    + line(169, 122, 236, 128, C.soft, 0.8) + t(240, 126, 'the sun’s', { anchor: 'start' }) + t(240, 139, 'place', { anchor: 'start' })
    + t(196, 182, 'the hour', { anchor: 'start', color: C.rubric }));
}

export function astrolabeExplanation(show: AstrolabeShows): ExplainSection[] {
  return [
    {
      id: 'projection', title: 'The sky drawn flat',
      body: [
        'An astrolabe is a model of the sky you can hold in one hand. To flatten the round sky onto brass, its makers drew it as seen from the south celestial pole onto the plane of the equator: the stereographic projection.',
        'This drawing has one property that makes the instrument possible: every circle in the sky stays a circle on the brass. The horizon, the circles of equal altitude, the path of the sun: all of them can be engraved with a compass.',
      ],
      figure: projectionFigure(),
      figureLabel: 'Side view: lines from the south pole through stars on the sphere meet the plane of the equator, which is the plate.',
      show: { label: 'Show me the plate', run: show.plate },
    },
    {
      id: 'plate', title: 'The plate: your own sky',
      body: [
        'The plate is fixed. It carries the circles that belong to your place on Earth: the horizon, the circles of altitude every 2° up to the point overhead, and lines of direction. Below the horizon are lines for the hours of the night and for twilight.',
        'Because the horizon depends on latitude, a plate serves only one latitude. Astrolabes came with several plates, one for each city the owner might use them in. Ours is engraved for the place you choose in the sky settings.',
      ],
      figure: plateFigure(),
      figureLabel: 'The plate: the horizon circle and the altitude circles closing in on the zenith.',
      show: { label: 'Show me the plate', run: show.plate },
    },
    {
      id: 'rete', title: 'The rete: the turning stars',
      body: [
        'Over the plate lies the rete, a pierced map of the sky. Each pointer marks a bright star; the ring set off-centre is the ecliptic, the sun’s yearly path among the stars, divided into the signs of the zodiac.',
        'The rete turns about the pole at the centre, once a day, as the sky turns over your head; the plate stays still, as your horizon does. Only stars with a pointer can be used, which is why the star list is shorter than the sky.',
      ],
      figure: reteFigure(),
      figureLabel: 'The rete: an off-centre ecliptic ring and star pointers, turning about the pole.',
      show: { label: 'Show me the rete', run: show.rete },
    },
    {
      id: 'offcentre', title: 'Why the ecliptic ring is off-centre',
      body: [
        'The rete turns about the celestial pole, at the middle of the plate. A circle is centred there only if every point of it is equally far from the pole, as on the equator and the two tropics.',
        'The ecliptic is not like that. It is tilted 23½° to the equator, so half of it lies north of the equator and half south. In the drawing, northern points land near the middle of the plate and southern points far out. The summer solstice, the ecliptic’s northernmost point, lands closest to the pole, on the tropic of Cancer. The winter solstice, its southernmost, lands on the opposite side, farthest out, on the tropic of Capricorn at the rim.',
        'The projection keeps circles as circles, so the ecliptic is still a true circle, and those two points are the ends of its diameter. Its centre is halfway between them, and because one is near the pole and the other far from it, that halfway point cannot be the pole. So as the rete turns, the ring swings round the middle of the plate, and the sun, riding on it, is nearer the middle in summer and farther out in winter.',
      ],
      figure: eclipticFigure(),
      figureLabel: 'Above, a side view: the tilted ecliptic’s two solstices project onto the plate at unequal distances on opposite sides of the pole. Below, the plan: those two points are the ends of the ecliptic ring’s diameter, so its centre is not at the pole.',
      show: { label: 'Show me the ecliptic ring', run: show.rete },
    },
    {
      id: 'altitude', title: 'Why you measure an altitude',
      body: [
        'The astrolabe hangs from its ring, so it always stands upright. When the star shows through both sights of the alidade on the back, the alidade points straight at it, and its tip gives the angle above level: the star’s altitude.',
        'That altitude is the one thing about the star’s present position you can measure. The next step turns it into the whole sky.',
      ],
      figure: altitudeFigure(),
      figureLabel: 'The hanging astrolabe with its alidade pointing at a star; the angle above level is the altitude.',
      show: { label: 'Show me the alidade', run: show.back },
    },
    {
      id: 'setting', title: 'Why you set the star on its altitude circle',
      body: [
        'On the plate, the circle of your altitude is every place in your sky where a star at that height can be. Turn the rete until the star’s pointer touches that circle and the rete stands as the sky does now: every other star on it is where it really is.',
        'Each altitude circle crosses both halves of the plate, because a star reaches the same height once rising in the east and once setting in the west. The plate’s middle line is your meridian, running from south to north. Everything to its left is the eastern sky, marked ORIENS, and everything to its right the western sky, marked OCCIDENS. So note which way you faced to sight the star: if your azimuth was between 0° and 180° the pointer goes on the left, and between 180° and 360° on the right.',
      ],
      figure: settingFigure(),
      figureLabel: 'An altitude circle on the plate: the pointer goes on the eastern side, where the star is, not the western.',
      show: { label: 'Show me the pointer', run: show.pointer },
    },
    {
      id: 'sun', title: 'Why the date gives the sun’s place',
      body: [
        'The sun moves along the ecliptic about a degree a day, once round in a year. On the back, the calendar ring is engraved against the zodiac ring, so laying the alidade on a date reads off the sun’s place in the zodiac that day.',
        'The sun is on the rete too: it is the point of the ecliptic ring at that degree. Once the rete is set by the star, that point shows where the sun is, even at night, below the horizon.',
      ],
      figure: sunFigure(),
      figureLabel: 'The calendar and zodiac rings side by side: the alidade across a date reads the sun’s degree.',
      show: { label: 'Show me the calendar', run: show.back },
    },
    {
      id: 'hour', title: 'Why the rule tells the hour',
      body: [
        'The time of day is just how far the sun has turned past the meridian. The rim carries 24 hours fixed to the plate, with XII at the top: when the sun is on the meridian, it is noon.',
        'Lay the rule from the centre across the sun’s place on the rete and its end points to the sun’s hour on the rim. That is local sundial time, the time an astrolabe tells; clocks differ from it by the equation of time and by where you are in your time zone.',
      ],
      figure: hourFigure(),
      figureLabel: 'The rule from the centre across the sun’s place on the ecliptic ring points to the hour on the rim.',
      show: { label: 'Show me the rule and the rim', run: show.hour },
    },
  ];
}
