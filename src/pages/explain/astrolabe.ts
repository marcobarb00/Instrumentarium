// "How it works" for the astrolabe: why each step does what it does.
import type { ExplainSection } from '../../ui/shell';
import { arrowMarker, C, circle, dot, fid, line, path, star, svg, t } from '../../ui/figure';

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
  const clip = fid('plate');
  return svg(180,
    `<defs><clipPath id="${clip}"><circle cx="150" cy="90" r="75"/></clipPath></defs>`
    + `<g clip-path="url(#${clip})">`
    + line(150, 15, 150, 165, C.soft, 0.8)
    + circle(150, 128, 70, C.rubric, 1.8)
    + circle(150, 112, 46) + circle(150, 98, 26) + circle(150, 88, 10)
    + '</g>'
    + circle(150, 90, 75, C.ink, 1.4) + dot(150, 84, 2.2)
    + t(226, 132, 'horizon', { anchor: 'start', color: C.rubric })
    + t(70, 58, 'altitude', { anchor: 'end' }) + t(70, 72, 'circles', { anchor: 'end' }) + line(72, 66, 108, 86, C.soft, 0.8)
    + line(153, 84, 226, 90, C.soft, 0.8) + t(230, 94, 'zenith', { anchor: 'start' })
    + t(92, 106, 'E', { italic: false, size: 11, color: C.muted }) + t(208, 106, 'W', { italic: false, size: 11, color: C.muted }));
}

function reteFigure(): string {
  const m = fid('arr');
  return svg(185,
    arrowMarker(m)
    + circle(150, 95, 75, C.soft, 1, '4 3')
    + circle(150, 77, 50, C.rubric, 2)
    + dot(150, 95, 2.8) + t(158, 109, 'pole', { anchor: 'start' })
    + [[100, 125], [203, 60], [118, 52], [196, 132], [82, 82]].map(([x, y]) => path(`M${x} ${y}l-4 -10l8 0z`, C.ink, 0.8, '', C.rubric)).join('')
    + t(150, 16, 'ecliptic: the sun’s path through the year', { color: C.rubric })
    + line(199, 132, 228, 150, C.soft, 0.8) + t(230, 156, 'star pointers', { anchor: 'start' })
    + `<path d="M${150 - 82 * Math.sin(1.05)} ${95 - 82 * Math.cos(1.05)}A82 82 0 0 1 ${150 - 82 * Math.sin(0.35)} ${95 - 82 * Math.cos(0.35)}" fill="none" stroke="${C.ink}" stroke-width="1.2" marker-end="url(#${m})"/>`
    + t(70, 40, 'turns once', { anchor: 'end', size: 11 }) + t(70, 53, 'a day', { anchor: 'end', size: 11 }));
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
  const clip = fid('plate');
  // A pointer reaching in from outside the circle: from the left (side −1) or the right (+1).
  const tri = (x: number, y: number, side: 1 | -1, fill: string) => path(`M${x} ${y}l${-10 * side} -5l${2 * side} 10z`, C.ink, 0.6, '', fill);
  return svg(190,
    `<defs><clipPath id="${clip}"><circle cx="150" cy="90" r="75"/></clipPath></defs>`
    + `<g clip-path="url(#${clip})">` + line(150, 15, 150, 165, C.soft, 0.8) + circle(150, 128, 70, C.rubric, 1.6) + '</g>'
    + circle(150, 90, 75, C.ink, 1.3) + circle(150, 104, 38, C.ink, 1.4)
    + tri(113.1, 94.1, -1, C.green) + tri(186.9, 94.1, 1, '#e6dccb')
    + line(181, 88, 193, 100, C.red, 1.6) + line(193, 88, 181, 100, C.red, 1.6)
    + t(150, 52, 'your altitude circle', { size: 11 })
    + t(80, 182, 'star in the east: here', { color: C.green }) + t(222, 182, 'not here', { color: C.red }));
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
    + circle(cx, cy - 14, 40, C.rubric, 1.6)
    + line(111, 28.5, 189, 163.5, C.ink, 3) + dot(cx, cy, 2.5)
    + dot(163.6, 119.6, 4.2, C.sun)
    + line(168, 121, 236, 128, C.soft, 0.8) + t(240, 126, 'the sun’s', { anchor: 'start' }) + t(240, 139, 'place', { anchor: 'start' })
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
        'Over the plate lies the rete, a pierced map of the sky. Each pointer marks a bright star; the off-centre ring is the ecliptic, the sun’s yearly path among the stars, divided into the signs of the zodiac.',
        'The rete turns about the pole at the centre, once a day, as the sky turns over your head; the plate stays still, as your horizon does. Only stars with a pointer can be used, which is why the star list is shorter than the sky.',
      ],
      figure: reteFigure(),
      figureLabel: 'The rete: an off-centre ecliptic ring and star pointers, turning about the pole.',
      show: { label: 'Show me the rete', run: show.rete },
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
        'Each altitude circle crosses both halves of the plate, because a star reaches the same height once rising in the east and once setting in the west. So you put the pointer on the side where you saw the star.',
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
