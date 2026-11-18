// Ptolemy's armillary page: raise the pole, set the outer ring to the
// longitude of a body whose place is known (the moon, or a reference star),
// turn the rings until that body lies on the outer ring, then sight a star
// and read its ecliptic longitude and latitude.
import '../styles/atlas.css';
import * as THREE from 'three';
import { D2R, directionFromHorizontal, wrap180, wrap360 } from '../core/astro';
import { displayName, NAMED_BRIGHT, type Star } from '../core/catalogue';
import { eclipticFromEquatorial } from '../core/ecliptic';
import { Observer } from '../core/observer';
import { meanObliquity, SIGNS } from '../core/sun';
import { SIGN_NAMES } from '../instruments/armillary/drawings';
import { CENTER_Y, PtolemyArmillary } from '../instruments/armillary/model';
import { Stage, WebGLUnavailableError, type SightHooks } from '../three/stage';
import { MeasurementCheck } from '../ui/check';
import { button, checkbox, h, numberField, selectField, slider } from '../ui/dom';
import { observerControls } from '../ui/observer-controls';
import { instrumentShell } from '../ui/shell';
import { armillaryExplanation } from './explain/armillary';

const V = () => new THREE.Vector3();
const noValue = () => '';
/** How close (degrees) counts as set. */
const SET_TOL = 0.1;

const shell = instrumentShell({
  id: 'armillary',
  kicker: 'Plate IV',
  title: 'Ptolemy’s armillary',
  lead: 'The instrument Ptolemy describes in the Almagest for measuring the stars against the ecliptic. Set it from the moon or from a star whose place you know, then sight another star and read its longitude and latitude from the rings.',
});

let stage: Stage;
try {
  stage = new Stage({
    container: shell.stage,
    labelLayer: shell.labels,
    sky: { moon: true },
    cameraPosition: new THREE.Vector3(0.8, 1.6, -0.8),
    cameraTarget: new THREE.Vector3(0, CENTER_Y, 0),
    minDistance: 0.1,
  });
} catch (e) {
  if (e instanceof WebGLUnavailableError) shell.showError('This instrument needs WebGL, which isn’t available in this browser.');
  throw e;
}
shell.onInsetChange((left, bottom) => stage.setViewInset(left, bottom));

// A lantern carried by the observer, so the scales can be read.
const handLamp = new THREE.PointLight(0xffd6a0, 1.2, 4, 1.2);
handLamp.position.set(0.2, 0.25, 0);
stage.camera.add(handLamp);
stage.scene.add(stage.camera);

const obs = new Observer();
const eps = meanObliquity(obs.utc);
const arm = new PtolemyArmillary(eps);
arm.setPole(60);
arm.setTurn(-obs.lst + 40);
arm.setInner(90); arm.setSight(20);
stage.scene.add(arm.root);
stage.sky.setOccluders([arm.root]);

// ---- formatting ----
const dm = (v: number) => {
  let d = Math.floor(Math.abs(v)), m = Math.round((Math.abs(v) - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return `${d}°${String(m).padStart(2, '0')}′`;
};
const lonText = (lon: number) => {
  const l = wrap360(lon); let s = Math.floor(l / 30), d = l - s * 30;
  if (Math.round(d * 60) === 1800) { s = (s + 1) % 12; d = 0; }
  return `${dm(d)} of ${SIGNS[s % 12]}`;
};
const latText = (b: number) => `${dm(b)} ${b >= 0 ? 'N' : 'S'}`;
const poleText = (lat: number) => `${dm(lat)} ${lat >= 0 ? 'N' : 'S'}`;
const placeName = () => (obs.place.id === 'custom' ? 'this place' : obs.place.name);
const signedDeg = (e: number) => { const r = Math.round(e * 60); return `${r >= 0 ? '+' : '−'}${dm(Math.abs(r) / 60)}`; };

// ---- guides and stars ----
interface Body { kind: 'moon' | 'star'; star?: Star; name: string; lon: number; lat: number; alt: number; az: number }
const MOON = 'moon';

function bodyOf(key: string): Body | null {
  if (key === MOON) {
    const m = stage.sky.moonPlace;
    return m ? { kind: 'moon', name: 'the moon', lon: m.lon, lat: m.lat, alt: m.alt, az: m.az } : null;
  }
  const s = NAMED_BRIGHT.find(x => x.name === key);
  if (!s) return null;
  const p = stage.sky.placeOf(s), e = eclipticFromEquatorial(p.ra, p.dec, eps);
  return { kind: 'star', star: s, name: displayName(s), lon: e.lon, lat: e.lat, alt: p.alt, az: p.az };
}
const dirOf = (b: Body, out = V()) => out.set(...directionFromHorizontal(b.alt, b.az));
const upStars = (minAlt: number) => NAMED_BRIGHT.filter(s => stage.sky.placeOf(s).alt > minAlt).sort((a, b) => a.mag - b.mag);

// ---- 1 · pole ----
const s1 = shell.section('1 · Raise the pole', { why: 'pole' });
const poleHint = h('p', {});
const poleS = slider({ label: 'Slide the meridian ring in its cradle', min: -90, max: 90, step: 0.05, value: arm.poleElevation, format: noValue, onInput: v => setPole(v) });
const poleStatus = h('div', { class: 'status', role: 'status' });
const zoomPole = button('Zoom to the index on the stand', () => {
  arm.pose();
  const p = arm.meridianIndexPoint(), n = arm.meridianNormal();
  const side = n.dot(V().subVectors(stage.camera.position, p)) >= 0 ? 1 : -1;
  stage.flyTo(p.clone().addScaledVector(n, side * 0.1).add(new THREE.Vector3(0, 0.02, 0)), p);
  setActive('pole');
});
s1.append(poleHint, poleS.el, zoomPole, poleStatus);
function setPole(e: number): void { arm.setPole(e); poleS.set(arm.poleElevation); }

// ---- 2 · guide ----
const s2 = shell.section('2 · Choose a guide', { why: 'guide' });
s2.append(h('p', {}, 'Ptolemy set the instrument from a body whose longitude he already knew: the sun by day, the moon at dusk, or a star whose place he had already fixed. Here its place comes from the tables, as an almanac would give it.'));
const guidePick = selectField('Guide');
const guideInfo = h('div', { class: 'hint' });
s2.append(guidePick.el, guideInfo);
guidePick.select.addEventListener('change', () => { updateGuide(); updateTargets(); });

// ---- 3 · outer ring ----
const s3 = shell.section('3 · Set the outer ring', { why: 'outer' });
s3.append(h('p', {}, 'Turn the outer ring on the poles of the ecliptic until its pointer stands at the guide’s longitude on the ecliptic ring. Each sign has 30 degrees, marked 10, 20, 30; the small divisions are 10′.'));
const outerS = slider({ label: 'Turn the outer ring', min: 0, max: 360, step: 0.01, value: arm.outerLon, format: noValue, onInput: v => { arm.setOuter(v); } });
const outerStatus = h('div', { class: 'status', role: 'status' });
const zoomOuter = button('Zoom to the outer ring’s pointer', () => { setActive('outer'); zoomToEcliptic(arm.outerIndexPoint(), arm.outer); });
s3.append(outerS.el, zoomOuter, outerStatus);

/** Look down on the ecliptic ring at a pointer, and stay with the ring that carries it as it turns. */
function zoomToEcliptic(p: THREE.Vector3, carrier: THREE.Object3D): void {
  arm.pose();
  const k = arm.eclipticPole(), side = k.y >= -0.1 ? 1 : -1, out = V().subVectors(p, arm.centre()).normalize();
  stage.flyTo(p.clone().addScaledVector(k, side * 0.1).addScaledVector(out, 0.02), p);
  stage.follow(carrier);
}

/** What the view along the outer ring shows: the guide clear of the ring's edge, on it, and hidden behind the ring. */
function ringFigure(): HTMLElement {
  const nx = 0.5, ny = 0.866, w = 26;
  const view = (cx: number, off: number, label: string, strong = false) => {
    const mx = cx + off * nx, my = 46 + off * ny;
    const band = `M${cx - 60} ${46 + 60 * 0.577}L${cx + 60} ${46 - 60 * 0.577}L${cx + 60 + w * nx} ${46 - 60 * 0.577 + w * ny}L${cx - 60 + w * nx} ${46 + 60 * 0.577 + w * ny}Z`;
    return `<clipPath id="ring-view-${cx}"><circle cx="${cx}" cy="46" r="38"/></clipPath>`
      + `<circle cx="${cx}" cy="46" r="38" fill="#141a28"/>`
      + `<circle cx="${mx}" cy="${my}" r="6.5" fill="#efe6c8"/>`
      + `<path d="${band}" fill="#c9973f" clip-path="url(#ring-view-${cx})"/>`
      + (off > 0 ? `<circle cx="${mx}" cy="${my}" r="6.5" fill="none" stroke="#141a28" stroke-width="1" stroke-dasharray="2 2"/>` : '')
      + `<text x="${cx}" y="103" text-anchor="middle" font-size="12" fill="#2b2620"${strong ? ' font-weight="600"' : ''}>${label}</text>`;
  };
  const fig = h('figure', { class: 'ring-figure' });
  fig.innerHTML = `<svg viewBox="0 0 300 112" width="100%" role="img" aria-label="Three views along the outer ring: the guide clear of the ring's edge, cut in half by the edge (set), and hidden behind the ring">`
    + view(50, -16, 'not yet') + view(150, 0, 'set', true) + view(250, 15, 'hidden: not yet') + '</svg>';
  return fig;
}

// ---- 4 · turn onto the guide ----
const s4 = shell.section('4 · Bring the guide onto the ring', { why: 'align' });
// Filled in with the chosen guide's name by updateGuide().
const dragStep = h('li', {}), cutStep = h('li', {});
s4.append(
  h('p', {}, 'The outer ring now stands at the guide’s longitude, but all the rings can still turn together on the poles, and only one position matches the sky: the one where the guide lies in the outer ring’s plane.'),
  h('ol', { class: 'steps' },
    h('li', {}, 'Press “Sight along the outer ring”. Your eye goes level with the ring’s flat face, so that face shrinks to one straight edge. The other rings are left out of this view, so they cannot hide the guide.'),
    dragStep, cutStep),
  ringFigure(),
  h('p', { class: 'hint' }, 'The ring has some thickness, so you line up on the edge of its face, not on the middle of the ring: the ring itself hides the other half of the guide. The guide is so far away that the edge and the middle point the same way.'));
const turnS = slider({ label: 'Turn the rings on the poles', min: 0, max: 360, step: 0.01, value: arm.turn, format: noValue, onInput: v => { arm.setTurn(v); } });
const ringBtn = button('Sight along the outer ring', () => (stage.inSight ? stage.exitSight() : enterRingView()));
const turnStatus = h('div', { class: 'status', role: 'status' });
s4.append(turnS.el, ringBtn, turnStatus, h('p', { class: 'hint' }, 'The heavens keep turning: if you change the time, set the rings again.'));

// ---- 5 · sight the star ----
const s5 = shell.section('5 · Sight a star', { why: 'sights' });
s5.append(h('p', {}, 'Turn the inner ring toward the star and slide the sighting ring along it until the star shows through both sights.'));
const targetPick = selectField('Star');
const sightBtn = button('Look through the sights', () => (stage.inSight ? stage.exitSight() : enterSights()));
const starStatus = h('div', { class: 'status', role: 'status' });
s5.append(targetPick.el, sightBtn, starStatus);
targetPick.select.addEventListener('change', () => { target = bodyOf(targetPick.select.value)?.star ?? null; stage.sky.setTarget(target); });

// ---- 6 · read and check ----
const s6 = shell.section('6 · Read the rings', { why: 'sights' });
s6.append(h('p', {}, 'The longitude is where the inner ring’s pointer stands on the ecliptic ring. The latitude is where the sighting ring’s index stands on the inner ring, north (SEPTENTRIO) or south (MERIDIES) of the ecliptic.'));
const zoomLon = button('Zoom to the longitude', () => { setActive('sights'); zoomToEcliptic(arm.innerIndexPoint(), arm.inner); });
const zoomLat = button('Zoom to the latitude', () => {
  arm.pose();
  const p = arm.latIndexPoint(), n = arm.innerNormal();
  const side = n.dot(V().subVectors(stage.camera.position, p)) >= 0 ? 1 : -1;
  stage.flyTo(p.clone().addScaledVector(n, side * 0.09).addScaledVector(V().subVectors(p, arm.centre()).normalize(), 0.03), p);
  stage.follow(arm.sighting);
  setActive('sights');
});
const backHome = button('Back to the overall view (Esc)', () => stage.goHome());
const signIn = selectField('Sign');
signIn.select.append(...SIGNS.map((s, i) => h('option', { value: String(i) }, `${s} (${SIGN_NAMES[i]})`)));
const lonDeg = numberField('Degrees', { step: 1, min: 0, max: 30, placeholder: '0–30' });
const lonMin = numberField('Minutes', { step: 1, min: 0, max: 59, placeholder: '0' });
const latDeg = numberField('Latitude °', { step: 1, min: 0, max: 90, placeholder: '0–90' });
const latMin = numberField('Minutes', { step: 1, min: 0, max: 59, placeholder: '0' });
const latNS = selectField('Toward');
latNS.select.append(h('option', { value: 'N' }, 'north'), h('option', { value: 'S' }, 'south'));
const check = new MeasurementCheck();
const checkBtn = button('Check my measurement', checkMeasurement, 'primary');
s6.append(h('div', { class: 'row' }, zoomLon, zoomLat), backHome,
  signIn.el, h('div', { class: 'row' }, lonDeg.el, lonMin.el), h('div', { class: 'row' }, latDeg.el, latMin.el, latNS.el), checkBtn, check.el);

function checkMeasurement(): void {
  if (!target) return;
  const d = parseFloat(lonDeg.input.value), b = parseFloat(latDeg.input.value);
  if (Number.isNaN(d) || Number.isNaN(b)) { check.message('Type both readings: the degrees of the sign on the ecliptic ring, and the latitude on the inner ring.'); return; }
  const lon = +signIn.select.value * 30 + d + (parseFloat(lonMin.input.value) || 0) / 60;
  const lat = (latNS.select.value === 'S' ? -1 : 1) * (b + (parseFloat(latMin.input.value) || 0) / 60);
  const truth = bodyOf(target.name)!;
  // Split the error: how the rings stood against the sky, where the sights pointed, and the reading itself.
  arm.pose();
  const onRings = arm.eclipticOf(dirOf(truth));
  const setLon = wrap180(onRings.lon - truth.lon), setLat = onRings.lat - truth.lat;
  const aimLon = wrap180(arm.innerLon - onRings.lon), aimLat = arm.sightLat - onRings.lat;
  const readLon = wrap180(lon - arm.innerLon), readLat = lat - arm.sightLat;
  const part = (a: number, b2: number) => `${signedDeg(a)} in longitude, ${signedDeg(b2)} in latitude`;
  const g = bodyOf(guidePick.select.value);
  const foot = `Where the error came from: setting up the rings ${part(setLon, setLat)}; pointing the sights ${part(aimLon, aimLat)}; reading the scales ${part(readLon, readLat)}. `
    + 'The true place is the catalogue position carried forward to this date by precession, on the ecliptic of date.'
    + (g?.kind === 'moon' ? ` The moon’s place was given as seen from ${placeName()}; Ptolemy had to work out that correction for parallax himself.` : '');
  check.show(displayName(target), [
    { quantity: 'Longitude', yours: lon, truth: truth.lon, circular: true, format: lonText, formatError: signedDeg },
    { quantity: 'Latitude', yours: lat, truth: truth.lat, format: latText, formatError: signedDeg },
  ], {
    fine: 0.25, close: 1, worst: true,
    fineText: 'Excellent: within a few of the smallest divisions.',
    closeText: 'Close. Is the guide exactly on the outer ring’s face, and the star in both sights?',
    farText: 'Quite far off. Check the outer ring’s setting, the pole, and that the rings were turned onto the guide after the last change of time.',
  }, foot);
}

// ---- the part in hand: arrow keys and the fine-adjustment bar work it, wherever the focus is ----
type Part = 'pole' | 'outer' | 'turn' | 'sights';
/** Degrees per arrow-key press, and with Shift. */
const KEY_STEP = 0.1, KEY_FINE = 0.02;
/** Degrees per step of the bar's coarse and fine buttons. */
const BAR_COARSE = 0.25, BAR_FINE = 0.02;
const PARTS: Record<Part, { label: string; move: (d: number) => void; label2?: string; move2?: (d: number) => void }> = {
  pole: { label: 'Meridian ring', move: d => setPole(arm.poleElevation + d) },
  outer: { label: 'Outer ring', move: d => arm.setOuter(arm.outerLon + d) },
  turn: { label: 'All the rings', move: d => arm.setTurn(arm.turn + d) },
  sights: { label: 'Inner ring', move: d => arm.setInner(arm.innerLon + d), label2: 'Sighting ring', move2: d => arm.setSight(arm.sightLat + d) },
};
let active: Part = 'pole';
function moveActive(right: number, up: number): void {
  const p = PARTS[active];
  if (p.move2) { if (right) p.move(right); if (up) p.move2(up); } else p.move(right + up);
}
/** A button that repeats while it is held down. */
function repeatButton(text: string, aria: string, act: () => void): HTMLButtonElement {
  const b = button(text, () => {});
  b.setAttribute('aria-label', aria);
  let timer = 0;
  const stop = () => { clearInterval(timer); timer = 0; };
  b.addEventListener('pointerdown', () => { act(); stop(); timer = window.setInterval(act, 90); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { act(); e.preventDefault(); } });
  return b;
}
const barRow = (label: string, move: (d: number) => void) => h('div', { class: 'part-row' },
  repeatButton('«', `${label}: back a quarter degree`, () => move(-BAR_COARSE)), repeatButton('‹', `${label}: back a little`, () => move(-BAR_FINE)),
  h('span', { class: 'part-name' }, label),
  repeatButton('›', `${label}: on a little`, () => move(BAR_FINE)), repeatButton('»', `${label}: on a quarter degree`, () => move(BAR_COARSE)));
const partBar = h('div', { class: 'part-bar', role: 'group', 'aria-label': 'Fine adjustment' });
document.body.append(partBar);
function setActive(p: Part): void {
  active = p;
  const part = PARTS[p];
  partBar.replaceChildren(barRow(part.label, part.move), ...(part.move2 ? [barRow(part.label2!, part.move2)] : []),
    h('div', { class: 'part-keys' }, part.move2 ? '← → inner ring · ↑ ↓ sighting ring · Shift for fine steps' : '← → arrow keys · Shift for fine steps'));
}
setActive('pole');
/** Using a slider makes its part the one in hand, and its arrow keys work in the same steps as everywhere else. */
function bindSlider(input: HTMLInputElement, part: Part): void {
  input.addEventListener('pointerdown', () => setActive(part));
  input.addEventListener('focus', () => setActive(part));
  input.addEventListener('keydown', e => {
    const k = e.key, s = e.shiftKey ? KEY_FINE : KEY_STEP;
    if (k === 'ArrowRight') moveActive(s, 0); else if (k === 'ArrowLeft') moveActive(-s, 0);
    else if (k === 'ArrowUp') moveActive(0, s); else if (k === 'ArrowDown') moveActive(0, -s); else return;
    e.preventDefault();
  });
}
bindSlider(poleS.input, 'pole'); bindSlider(outerS.input, 'outer'); bindSlider(turnS.input, 'turn');
// Working in a step puts its part in hand.
([[s1, 'pole'], [s3, 'outer'], [s4, 'turn'], [s5, 'sights'], [s6, 'sights']] as [HTMLElement, Part][])
  .forEach(([sec, part]) => sec.addEventListener('pointerdown', () => { if (active !== part) setActive(part); }));

// ---- how it works ----
shell.explain(armillaryExplanation({
  ecliptic: () => { stage.goHome(); stage.highlight([arm.solids[1], arm.solids[2], ...arm.eclipticFaces.map(f => f.mesh)]); },
  pole: () => { zoomPole.click(); stage.highlight([arm.solids[0], ...arm.meridianFaces]); },
  outer: () => { setActive('outer'); zoomToEcliptic(arm.outerIndexPoint(), arm.outer); stage.highlight([arm.outer]); },
  along: () => enterRingView(),
  sights: () => { stage.goHome(); stage.highlight([arm.inner, arm.sighting]); },
}));

// ---- the sky ----
const sSky = shell.section('The sky');
const exact = h('div', { class: 'exact' });
const cheat = checkbox('Show exact instrument readings');
sSky.append(observerControls(obs), cheat.el, exact);

// ---- views ----
stage.setHomeView(() => {
  const c = arm.centre(), az = (obs.lat >= 0 ? 205 : 335) * D2R, d = stage.fitDistance(0.38) * 0.95;
  const dir = new THREE.Vector3(-Math.sin(az), 0.45, Math.cos(az)).normalize();
  return { position: c.clone().addScaledVector(dir, d), target: c.clone() };
});

/** `aim` turned by small screen angles, degrees: `right` across the view, `up` toward the top. */
function turnedAim(aim: THREE.Vector3, right: number, up: number): THREE.Vector3 {
  const r = V().crossVectors(aim, new THREE.Vector3(0, 1, 0));
  if (r.lengthSq() < 1e-8) r.set(1, 0, 0);
  r.normalize();
  const u = V().crossVectors(r, aim).normalize();
  return aim.clone().addScaledVector(r, right * D2R).addScaledVector(u, up * D2R).normalize();
}

// Along the outer ring: the eye on the plane of its face. Turning the view turns the rings on the poles.
const ring = { psi: 0 };
const rd = V();
/** Look along the ring at the point of it nearest the guide, so the guide stays in view while the rings turn. */
function trackGuide(): void {
  const g = bodyOf(guidePick.select.value);
  if (g && g.alt > 0) ring.psi = arm.outerPsiToward(dirOf(g, rd));
}
const ringView: SightHooks = {
  eye: out => arm.outerEye(ring.psi, out),
  aim: out => { trackGuide(); return arm.outerAim(ring.psi, out); },
  // Keys and dragging turn the rings directly, as the slider does. (Solving for the turn that puts the
  // edge where the view asks fails: as the rings turn the edge sweeps across the sky, stops and comes
  // back, and beyond that point no turn will do, so the solution jumps from side to side.)
  nudge: (right, up) => arm.setTurn(arm.turn + (Math.abs(right) >= Math.abs(up) ? right : up)),
  // Larger steps in the wide view, fine ones close up.
  get keyStep() { return Math.max(KEY_STEP, stage.camera.fov / 40); },
  fov: 4,
  wideFov: 60,
  wideBack: 0.25,
};
function enterRingView(): void {
  arm.pose();
  trackGuide();
  setActive('turn');
  arm.isolate([arm.outer]);
  sightMode = 'ring';
  stage.enterSight(ringView);
}

const sights: SightHooks = {
  eye: out => arm.sightEye(out),
  aim: out => arm.sightAim(out),
  nudge: (right, up) => { arm.pointSightsAt(turnedAim(arm.sightAim(), right, up)); },
  fov: 4,
  wideBack: 0.3,
};
function enterSights(): void {
  arm.pose();
  const t = target && bodyOf(target.name);
  // Start with the star somewhere in the wide view, as an observer would first turn roughly toward it.
  if (t && t.alt > 0 && arm.sightAim().angleTo(dirOf(t)) > 15 * D2R) arm.pointSightsAt(turnedAim(dirOf(t), 6, -4));
  setActive('sights');
  arm.isolate([arm.inner, arm.sighting]);
  sightMode = 'sights';
  stage.enterSight(sights);
}

let sightMode: 'ring' | 'sights' | null = null;
stage.onSightChange(on => {
  if (!on) { sightMode = null; arm.isolate(null); }
  ringBtn.textContent = sightMode === 'ring' ? 'Step back' : 'Sight along the outer ring';
  sightBtn.textContent = sightMode === 'sights' ? 'Step back' : 'Look through the sights';
  shell.showSight(on, { exit: () => stage.exitSight(), zoom: d => stage.zoomSight(d) });
});
// Outside the sight views the arrow keys work whichever part was used last.
stage.setAimHooks({
  eye: out => arm.centre(out),
  aim: out => out.set(0, 0, 1),
  nudge: (right, up) => moveActive(right, up),
  keyStep: KEY_STEP,
});

// ---- updates ----
let target: Star | null = null;

function updateGuide(): void {
  const keep = guidePick.select.value;
  const stars = upStars(5);
  const moon = stage.sky.moonPlace;
  const opts = [h('option', { value: MOON }, 'The moon' + (moon && moon.alt <= 0 ? ' (below the horizon)' : '')),
    ...stars.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`))];
  guidePick.select.replaceChildren(...opts);
  const fallback = moon && moon.alt > 5 ? MOON : (stars.find(s => s.name === 'Aldebaran') ?? stars[0])?.name ?? MOON;
  guidePick.select.value = keep && [...guidePick.select.options].some(o => o.value === keep) ? keep : fallback;
  const g = bodyOf(guidePick.select.value);
  const name = g?.name ?? 'the guide';
  dragStep.textContent = `Turn the rings until the guide (${name}) reaches that edge: drag the view, use the arrow keys, or move the slider. The view stays on the guide while the edge sweeps across it.`;
  cutStep.textContent = `Stop when the edge cuts the guide (${name}) in half.`;
  if (!g) { guideInfo.textContent = ''; return; }
  const where = `longitude ${lonText(g.lon)}, latitude ${latText(g.lat)}`;
  guideInfo.textContent = g.kind === 'moon'
    ? (g.alt <= 0 ? `The moon is below the horizon at ${obs.clockLabel}. Change the time below, or choose a star.`
      : `The moon, as seen from ${placeName()} at ${obs.clockLabel}: ${where}. It moves about half a degree an hour among the stars, so this place holds for this minute. Line up the middle of its disc.`)
    : `${g.name}: ${where}, from a star catalogue carried forward to this date by precession. Only its longitude is needed to set the rings.`;
}

function updateTargets(): void {
  const keep = targetPick.select.value || 'Capella';
  const list = upStars(5).filter(s => s.name !== guidePick.select.value);
  targetPick.select.replaceChildren(...list.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`)));
  const next = list.find(s => s.name === keep) ?? list[0];
  if (next) targetPick.select.value = next.name;
  if (next !== target) { target = next ?? null; stage.sky.setTarget(target); }
}

function updateSky(): void {
  stage.updateSky(obs);
  poleHint.textContent = `Slide the meridian ring round in its cradle until the index on the stand points to ${placeName()}’s latitude, ${poleText(obs.lat)}: the height of the pole.`;
  updateGuide();
  updateTargets();
}
obs.onChange(updateSky);
updateSky();
stage.goHome(0);

const gd = V(), td = V();
// What the sight views are showing, for when the panel is out of reach.
const sightNote = h('div', { class: 'facing', role: 'status' });
document.body.append(sightNote);
stage.onFrame(() => {
  arm.pose();
  outerS.set(arm.outerLon);
  turnS.set(arm.turn);
  const off = arm.poleElevation - obs.lat;
  poleStatus.classList.toggle('on', Math.abs(off) < 0.15);
  poleStatus.textContent = Math.abs(off) < 0.15 ? `Set for ${poleText(obs.lat)}.`
    : `Not yet: ${off > 0 ? 'lower' : 'raise'} the ${obs.lat >= 0 ? 'north' : 'south'} pole${Math.abs(off) < 2 ? ' a little' : ''}.`;

  const g = bodyOf(guidePick.select.value);
  if (g) {
    const o = wrap180(arm.outerLon - g.lon);
    outerStatus.classList.toggle('on', Math.abs(o) < SET_TOL);
    outerStatus.textContent = Math.abs(o) < SET_TOL ? `Set at ${g.kind === 'moon' ? 'the moon’s' : `${g.name}’s`} longitude.`
      : `Not yet: turn it ${o > 0 ? 'back' : 'on'}${Math.abs(o) < 2 ? ' a little' : ''}.`;
    const plane = arm.offOuterPlane(dirOf(g, gd)), turnOff = Math.abs(wrap180(arm.turn + obs.lst));
    const onEdge = plane < SET_TOL, ok = onEdge && Math.abs(o) < SET_TOL && turnOff < 0.5;
    // The eye is on the ring's +normal face, so a guide on the other side lies behind the ring.
    const behind = arm.outerNormal().dot(gd) < 0 && plane < 9;
    turnStatus.classList.toggle('on', ok);
    const message = g.alt <= 0 ? 'The guide is below the horizon.'
      : Math.abs(o) >= SET_TOL ? 'Set the outer ring first.'
        : ok ? 'Set: the guide lies on the ring’s edge, and the rings stand as the heavens do.'
          : onEdge && turnOff >= 5 ? 'The guide is on the edge, but this is the wrong position: the ecliptic ring lies away from the zodiac. Keep turning the rings until the guide comes onto the edge again.'
            : onEdge ? 'Nearly: turn the rings a little more.'
              : `Not yet: the guide is ${plane.toFixed(1)}° off the edge${behind ? ', hidden behind the ring' : ''}.`;
    turnStatus.textContent = message;
    if (sightMode === 'ring') sightNote.textContent = message;
  }
  if (target) {
    const t = bodyOf(target.name)!;
    const miss = arm.sightAim().angleTo(dirOf(t, td)) / D2R;
    starStatus.classList.toggle('on', miss < 0.15);
    starStatus.textContent = t.alt <= 0 ? `${displayName(target)} is below the horizon.`
      : miss < 0.15 ? `${displayName(target)} shows through both sights. Read the rings.` : `${displayName(target)} is not in the sights yet.`;
    if (sightMode === 'sights') sightNote.textContent = starStatus.textContent;
  }
  if (cheat.input.checked) {
    const lon = arm.readInnerLon(), lat = arm.readLat();
    exact.textContent = `Pole ${arm.readPole().toFixed(2)}° · outer ring ${lonText(arm.readOuter())} · rings turned ${signedDeg(wrap180(arm.turn + obs.lst))} from the sky`
      + ` · inner ring ${lonText(lon)} · latitude ${latText(lat)}${g ? ` · guide ${arm.offOuterPlane(gd).toFixed(2)}° off the outer ring` : ''}`;
  } else exact.textContent = '';
});
stage.start();

// Development aid: inspect the live scene from the browser console.
if (import.meta.env.DEV) Object.assign(window, { __instrument: { stage, armillary: arm, obs } });
