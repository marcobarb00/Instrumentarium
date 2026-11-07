// Home page: the gallery of instruments, plus the observer's sky tonight.
import '../styles/atlas.css';
import { apparentPlace, CATALOGUE_LICENSE, CATALOGUE_SOURCE, NAMED_BRIGHT } from '../core/catalogue';
import { Observer } from '../core/observer';
import { INSTRUMENTS } from '../instruments';
import { fmtDeg, h } from '../ui/dom';
import { graduatedFrame } from '../ui/frame';
import { observerControls } from '../ui/observer-controls';
import { PLATE_ART } from '../ui/plates';
import { siteHeader } from '../ui/shell';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function plate(i: (typeof INSTRUMENTS)[number]): HTMLElement {
  const art = h('div', {});
  art.innerHTML = PLATE_ART[i.id]();
  const inner = i.ready
    ? h('a', { class: 'plate-inner', href: `./${i.id}/` })
    : h('div', { class: 'plate-inner' });
  inner.append(
    art.firstElementChild!,
    h('div', { class: 'no' }, `Plate ${i.plate}`),
    h('h3', {}, i.name),
    h('p', {}, i.blurb),
    h('div', { class: 'go' + (i.ready ? '' : ' soon') }, i.ready ? 'Open the instrument →' : 'In preparation'));
  return h('article', { class: 'plate' + (i.ready ? '' : ' unready') }, graduatedFrame(inner));
}

function skyTonight(obs: Observer): HTMLElement {
  const tbody = h('tbody');
  const caption = h('span', {});
  const render = () => {
    const utc = obs.utc, lst = obs.lst;
    const up = NAMED_BRIGHT.map(s => ({ s, p: apparentPlace(s, utc, lst, obs.lat) }))
      .filter(x => x.p.alt > 10).sort((a, b) => a.s.mag - b.s.mag).slice(0, 8);
    tbody.replaceChildren(...up.map(({ s, p }) => h('tr', {},
      h('td', {}, s.name), h('td', {}, fmtDeg(p.alt)), h('td', {}, `${fmtDeg(p.az, 0)} ${COMPASS[Math.round(p.az / 45) % 8]}`), h('td', {}, s.mag.toFixed(1)))));
    caption.textContent = `The brightest named stars more than 10° above the horizon of ${obs.place.name === 'Custom place' ? `${obs.lat.toFixed(1)}°, ${obs.lon.toFixed(1)}°` : obs.place.name} at ${obs.clockLabel} on the evening of ${obs.date}. Every instrument page opens on this sky.`;
  };
  obs.onChange(render);
  render();
  const inner = h('div', { class: 'sky-now' },
    observerControls(obs),
    h('div', { class: 'up' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Star'), h('th', {}, 'Altitude'), h('th', {}, 'Azimuth'), h('th', {}, 'Mag.'))),
      tbody)));
  return h('figure', { style: 'margin:0' }, graduatedFrame(inner),
    h('figcaption', { class: 'caption' }, h('span', {}, h('span', { class: 'fig' }, 'Table 1. '), caption)));
}

const obs = new Observer();
const page = h('div', { class: 'page' },
  h('div', { class: 'page-head' },
    h('div', { class: 'titles' },
      h('div', { class: 'kicker' }, 'A cabinet of the heavens'),
      h('h1', {}, 'Instrumentarium'),
      h('p', { class: 'subtitle' }, 'Measuring the real sky with the instruments of the old astronomers')),
    h('nav', { 'aria-label': 'Plates' }, ...INSTRUMENTS.map(i => i.ready
      ? h('a', { href: `./${i.id}/` }, `${i.plate} ${i.name}`)
      : h('span', { class: 'soon' }, `${i.plate} ${i.name}`)))),
  h('div', { class: 'double-rule' }),
  h('div', { class: 'intro' },
    h('p', {}, h('span', { class: 'dropcap' }, 'E'),
      'ach plate below opens a working instrument, built in brass and wood, standing under tonight’s sky. Aim it at a real star, read its scale with your own eyes, then check your reading against the position computed for your place and hour.'),
    h('aside', {}, h('div', { class: 'tag' }, 'How to use'),
      'Choose a place and an hour below. Every instrument page starts from the same sky, and you can change it there too.')),
  h('h2', { class: 'section-title' }, h('span', { class: 'num' }, 'I · The plates'), 'Five instruments'),
  h('div', { class: 'plates' }, ...INSTRUMENTS.map(plate)),
  h('h2', { class: 'section-title' }, h('span', { class: 'num' }, 'II · The observer'), 'Your sky'),
  skyTonight(obs),
  h('p', { class: 'colophon' },
    `Star positions: ${CATALOGUE_SOURCE}, licensed ${CATALOGUE_LICENSE}; precessed to the date of observation. Altitudes are geometric (no atmospheric refraction).`));

document.body.append(siteHeader('./'), page);
