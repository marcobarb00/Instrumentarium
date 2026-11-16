// Cross-staff page: measure the angle between two stars by holding the staff
// to the eye, turning and sliding the transom until its ends touch both, and
// reading the staff's scale where the transom stands.
import '../styles/atlas.css';
import * as THREE from 'three';
import { angularSeparation, D2R, directionFromHorizontal } from '../core/astro';
import { displayName, NAMED_BRIGHT, starByName, type Star } from '../core/catalogue';
import { Observer } from '../core/observer';
import { angleRange, TRANSOMS } from '../instruments/cross-staff/drawings';
import { CrossStaff } from '../instruments/cross-staff/model';
import { Stage, WebGLUnavailableError, type SightHooks } from '../three/stage';
import { MeasurementCheck } from '../ui/check';
import { button, checkbox, h, numberField, selectField, slider } from '../ui/dom';
import { observerControls } from '../ui/observer-controls';
import { instrumentShell } from '../ui/shell';

const V = () => new THREE.Vector3();
const noValue = () => '';
/** An end counts as touching its star within this, degrees. */
const ON = 0.05;
/** Well-known pairs to start with, when both are up. */
const PAIRS: [string, string][] = [
  ['Castor', 'Pollux'], ['Betelgeuse', 'Rigel'], ['Dubhe', 'Merak'], ['Aldebaran', 'Betelgeuse'], ['Vega', 'Altair'],
  ['Deneb', 'Vega'], ['Arcturus', 'Spica'], ['Capella', 'Castor'], ['Sirius', 'Procyon'], ['Altair', 'Deneb'], ['Regulus', 'Denebola'],
];

const shell = instrumentShell({
  id: 'cross-staff',
  kicker: 'Plate V',
  title: 'Cross-staff',
  lead: 'A staff held to the eye, with a cross-piece, the transom, sliding along it. Turn the transom to lie between two stars and slide it until one end touches each: the scale on the staff, where the transom stands, gives the angle between them.',
});

let stage: Stage;
try {
  stage = new Stage({
    container: shell.stage,
    labelLayer: shell.labels,
    cameraPosition: new THREE.Vector3(0.6, 1.8, -0.8),
    cameraTarget: new THREE.Vector3(0, 1.6, 0.5),
    minDistance: 0.08,
  });
} catch (e) {
  if (e instanceof WebGLUnavailableError) shell.showError('This instrument needs WebGL, which isn’t available in this browser.');
  throw e;
}
shell.onInsetChange((left, bottom) => stage.setViewInset(left, bottom));

const handLamp = new THREE.PointLight(0xffd6a0, 1.0, 3, 1.2);
handLamp.position.set(0.15, 0.2, 0);
stage.camera.add(handLamp);
stage.scene.add(stage.camera);

const obs = new Observer();
const xs = new CrossStaff();
stage.scene.add(xs.root);
stage.sky.setOccluders([xs.root]);

let starA: Star | null = null, starB: Star | null = null;

// ---- formatting ----
const dm = (v: number) => {
  let d = Math.floor(Math.abs(v)), m = Math.round((Math.abs(v) - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return `${d}°${String(m).padStart(2, '0')}′`;
};
const signedDm = (e: number) => { const r = Math.round(e * 60); return `${r >= 0 ? '+' : '−'}${dm(Math.abs(r) / 60)}`; };

const dirOfStar = (s: Star, out = V()) => { const p = stage.sky.placeOf(s); return out.set(...directionFromHorizontal(p.alt, p.az)); };
const truthOf = (a: Star, b: Star) => {
  const p = stage.sky.placeOf(a), q = stage.sky.placeOf(b);
  return angularSeparation(p.ra, p.dec, q.ra, q.dec);
};

// ---- 1 · two stars ----
const s1 = shell.section('1 · Pick two stars');
const pickA = selectField('First star'), pickB = selectField('Second star');
const pairHint = h('div', { class: 'hint' });
s1.append(h('div', { class: 'row' }, pickA.el, pickB.el), pairHint);
pickA.select.addEventListener('change', () => setPair(true));
pickB.select.addEventListener('change', () => setPair(true));

// ---- 2 · transom ----
const s2 = shell.section('2 · Choose a transom');
s2.append(h('p', {}, 'The staff came with transoms of several lengths. A short one, far down the staff, spans small angles; a long one, near the eye, spans large ones. Each is read on its own face of the staff.'));
const transomPick = selectField('Transom');
transomPick.select.append(...TRANSOMS.map((t, i) => {
  const [lo, hi] = angleRange(t);
  return h('option', { value: String(i) }, `${t.name}: ${Math.round(t.half * 200)} cm long, ${Math.ceil(lo)}° to ${Math.floor(hi)}°`);
}));
transomPick.select.value = String(xs.transom);
transomPick.select.addEventListener('change', () => { xs.setTransom(+transomPick.select.value); syncSliders(); });
s2.append(transomPick.el);

// ---- 3 · sight ----
const s3 = shell.section('3 · Put the staff to your eye');
s3.append(
  h('ol', { class: 'steps' },
    h('li', {}, 'Aim the staff between the two stars: drag, or use the arrow keys.'),
    h('li', {}, 'Turn the transom until it lies along the line from one star to the other: ⟲ ⟳, or the A and D keys.'),
    h('li', {}, 'Slide the transom until one end touches each star: nearer the eye to widen the angle, farther to narrow it. W and S keys, or the buttons.'),
    h('li', {}, '“Glance” looks at one end, then the other, as the observer’s eye had to: hard to see both ends at once.')),
);
const sightBtn = button('Put the staff to your eye', () => (stage.inSight ? stage.exitSight() : enterSight()));
const rollS = slider({ label: 'Turn the transom', min: -180, max: 180, step: 0.05, value: 0, format: noValue, onInput: v => xs.setRoll(v) });
const slideS = slider({ label: 'Slide the transom', min: 0, max: 1, step: 0.0001, value: 0.5, format: noValue, onInput: v => { const t = xs.current; xs.setDistance(t.dMin + v * (t.dMax - t.dMin)); } });
const endStatus = h('div', { class: 'status', role: 'status' });
s3.append(sightBtn, endStatus, rollS.el, slideS.el);

function syncSliders(): void {
  const t = xs.current;
  rollS.set(xs.roll);
  slideS.set((xs.distance - t.dMin) / (t.dMax - t.dMin));
}

// ---- 4 · read and check ----
const s4 = shell.section('4 · Read the staff');
s4.append(h('p', {}, 'On the face of the staff marked with your transom’s number, read the scale at the transom’s edge nearer the eye. The numbers are degrees; where there is room, the small marks are 10′ or 30′.'));
const zoomScale = button('Zoom to the scale at the transom', () => {
  xs.pose();
  // Look straight at the face, the view turned so its numbers read upright.
  const p = xs.readPoint(), n = xs.faceNormal(), top = xs.faceUp(), toEye = V().subVectors(xs.eye(), p).normalize();
  stage.flyTo(p.clone().addScaledVector(n, 0.075).addScaledVector(top, -0.02).addScaledVector(toEye, 0.012), p, 900, top);
});
const backHome = button('Back to the overall view (Esc)', () => stage.goHome());
const degIn = numberField('Degrees', { step: 1, min: 0, max: 90, placeholder: 'e.g. 4' });
const minIn = numberField('Minutes', { step: 1, min: 0, max: 59, placeholder: '0' });
const check = new MeasurementCheck();
const checkBtn = button('Check my measurement', checkMeasurement, 'primary');
s4.append(zoomScale, backHome, h('div', { class: 'row' }, degIn.el, minIn.el), checkBtn, check.el);

function checkMeasurement(): void {
  if (!starA || !starB) return;
  const d = parseFloat(degIn.input.value);
  if (Number.isNaN(d)) { check.message('Type the angle you read on the staff.'); return; }
  const yours = d + (parseFloat(minIn.input.value) || 0) / 60;
  const truth = truthOf(starA, starB);
  xs.pose();
  const spanned = xs.trueAngle(), miss = endMisses();
  const foot = `Where the error came from: the transom’s ends spanned ${dm(spanned)} (${signedDm(spanned - truth)} from the true angle), `
    + `with the ends ${dm(miss.worst)} at most from their stars; reading the scale ${signedDm(yours - spanned)}. `
    + 'Observers found the cross-staff hard to use well: the eye cannot look at both ends at once, and it never sits exactly at the end of the staff. Here it does.';
  check.show(`${displayName(starA)} to ${displayName(starB)}`, [
    { quantity: 'Angle between them', yours, truth, format: dm, formatError: signedDm },
  ], {
    fine: 0.2, close: 1,
    fineText: 'Excellent: as fine as the marks on the staff allow.',
    closeText: 'Close. Does each end sit exactly on its star? Glance at each end in turn.',
    farText: 'Quite far off. Check that you read the face marked with your transom’s number, at the transom’s edge nearer the eye.',
  }, foot);
}

// ---- the sky ----
const sSky = shell.section('The sky');
const exact = h('div', { class: 'exact' });
const cheat = checkbox('Show exact instrument readings');
sSky.append(observerControls(obs), cheat.el, exact);

// ---- sight view ----
/** `aim` turned by small screen angles, degrees: `right` across the view, `up` toward the top. */
function turnedAim(aim: THREE.Vector3, right: number, up: number): THREE.Vector3 {
  const r = V().crossVectors(aim, new THREE.Vector3(0, 1, 0));
  if (r.lengthSq() < 1e-8) r.set(1, 0, 0);
  r.normalize();
  const u = V().crossVectors(r, aim).normalize();
  return aim.clone().addScaledVector(r, right * D2R).addScaledVector(u, up * D2R).normalize();
}

/** Where the eye looks: along the staff, or at one end of the transom. */
let glance: 0 | 1 | -1 = 0;
const sight: SightHooks = {
  eye: out => xs.eye(out),
  aim: out => (glance === 0 ? out.copy(xs.aim) : xs.endDirection(glance, out)),
  nudge: (right, up) => { xs.setAim(turnedAim(xs.aim, right, up)); },
  fov: 6,
  // Opens wide enough for the longest angle this transom spans.
  get wideFov() { return Math.min(90, Math.ceil(angleRange(xs.current)[1] * 1.25 / 5) * 5); },
  wideBack: 0,
};
function enterSight(): void { glance = 0; stage.enterSight(sight); updateGlance(); }

// On-screen controls for the transom while looking along the staff (and the keys W S A D).
const glanceBtn = button('Glance: both ends', () => { glance = glance === 0 ? 1 : glance === 1 ? -1 : 0; updateGlance(); });
function updateGlance(): void {
  glanceBtn.textContent = glance === 0 ? 'Glance: both ends' : glance === 1 ? 'Glance: one end' : 'Glance: other end';
  if (glance !== 0 && stage.camera.fov > 20) for (let i = 0; i < 4; i++) stage.zoomSight(1);
  if (glance === 0) for (let i = 0; i < 12; i++) stage.zoomSight(-1);
}
function holdButton(label: string, aria: string, act: (fine: boolean) => void): HTMLButtonElement {
  const b = button(label, () => {});
  b.setAttribute('aria-label', aria);
  let timer = 0;
  const stop = () => { clearInterval(timer); timer = 0; };
  b.addEventListener('pointerdown', e => { act(e.shiftKey); stop(); timer = window.setInterval(() => act(e.shiftKey), 60); });
  b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  return b;
}
const ROLL_STEP = 0.5, SLIDE_STEP = 0.001;
const turnBy = (deg: number) => { xs.setRoll(xs.roll + deg); syncSliders(); };
const slideBy = (m: number) => { xs.setDistance(xs.distance + m); syncSliders(); };
const controls = h('div', { class: 'xs-controls' },
  holdButton('⟲', 'Turn the transom counter-clockwise', f => turnBy(f ? ROLL_STEP / 10 : ROLL_STEP)),
  holdButton('⟳', 'Turn the transom clockwise', f => turnBy(f ? -ROLL_STEP / 10 : -ROLL_STEP)),
  holdButton('Nearer', 'Slide the transom nearer the eye', f => slideBy(f ? -SLIDE_STEP / 10 : -SLIDE_STEP)),
  holdButton('Farther', 'Slide the transom farther from the eye', f => slideBy(f ? SLIDE_STEP / 10 : SLIDE_STEP)),
  glanceBtn);
const sightStatus = h('div', { class: 'xs-status', role: 'status' });
document.body.append(controls, sightStatus);

addEventListener('keydown', e => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  const k = e.key.toLowerCase(), f = e.shiftKey;
  if (k === 'a') turnBy(f ? ROLL_STEP / 10 : ROLL_STEP);
  else if (k === 'd') turnBy(f ? -ROLL_STEP / 10 : -ROLL_STEP);
  else if (k === 'w') slideBy(f ? -SLIDE_STEP / 10 : -SLIDE_STEP);
  else if (k === 's') slideBy(f ? SLIDE_STEP / 10 : SLIDE_STEP);
  else if (k === 'g' && stage.inSight) glanceBtn.click();
  else return;
  e.preventDefault();
});

stage.onSightChange(on => {
  sightBtn.textContent = on ? 'Step back' : 'Put the staff to your eye';
  shell.showSight(on, { exit: () => stage.exitSight(), zoom: d => stage.zoomSight(d) });
});
stage.setAimHooks(sight);

stage.setHomeView(() => {
  // From behind the observer's left shoulder, looking past the middle of the staff toward the stars.
  xs.pose();
  const mid = xs.eye().addScaledVector(xs.aim, 0.45);
  const fwd = V().set(xs.aim.x, 0, xs.aim.z);
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
  fwd.normalize();
  const left = V().set(fwd.z, 0, -fwd.x);
  const position = mid.clone().addScaledVector(fwd, -1.05).addScaledVector(left, 0.4).add(new THREE.Vector3(0, 0.22, 0));
  return { position, target: mid.clone().addScaledVector(xs.aim, 2.5) };
});

// ---- updates ----
const up = (minAlt: number) => NAMED_BRIGHT.filter(s => stage.sky.placeOf(s).alt > minAlt).sort((a, b) => a.mag - b.mag);

/** Hold the staff up roughly toward the pair: aimed near them, the transom level, as one first raises it. */
function raiseToward(): void {
  if (!starA || !starB) return;
  const mid = V().addVectors(dirOfStar(starA), dirOfStar(starB)).normalize();
  xs.setAim(turnedAim(mid, 2, -1.5));
  xs.setRoll(0);
  const sep = truthOf(starA, starB);
  // A transom that can span the angle, if the current one cannot.
  const [lo, hi] = angleRange(xs.current);
  if (sep < lo || sep > hi) {
    const k = TRANSOMS.findIndex(t => { const [a, b] = angleRange(t); return sep > a + 0.2 && sep < b - 0.2; });
    if (k >= 0) { xs.setTransom(k); transomPick.select.value = String(k); }
  }
  xs.setDistance((xs.current.dMin + xs.current.dMax) / 2);
  syncSliders();
}

function setPair(raise: boolean): void {
  starA = NAMED_BRIGHT.find(s => s.name === pickA.select.value) ?? null;
  starB = NAMED_BRIGHT.find(s => s.name === pickB.select.value) ?? null;
  stage.sky.setTargets([starA, starB].filter((s): s is Star => s !== null));
  if (starA && starB && starA === starB) pairHint.textContent = 'Pick two different stars.';
  else if (starA && starB) {
    const sep = truthOf(starA, starB);
    pairHint.textContent = sep > 90 ? 'These two are more than 90° apart: too far for the cross-staff. Pick a closer pair.'
      : sep < angleRange(TRANSOMS[0])[0] ? 'These two are too close together for the cross-staff’s scales. Pick a wider pair.'
        : `The two stars are ringed in the sky. How far apart are they? That is what you will measure.`;
  }
  if (raise) { raiseToward(); if (!stage.inSight) stage.goHome(); }
}

function refreshStars(): void {
  const list = up(8);
  const opts = () => list.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`));
  const keepA = pickA.select.value, keepB = pickB.select.value;
  pickA.select.replaceChildren(...opts()); pickB.select.replaceChildren(...opts());
  const has = (n: string) => list.some(s => s.name === n);
  let a = has(keepA) ? keepA : '', b = has(keepB) ? keepB : '';
  if (!a || !b) {
    const pair = PAIRS.find(([p, q]) => has(p) && has(q) && starByName(p) && starByName(q));
    [a, b] = pair ?? [list[0]?.name ?? '', list[1]?.name ?? ''];
  }
  pickA.select.value = a; pickB.select.value = b;
  const changed = a !== starA?.name || b !== starB?.name;
  setPair(changed);
}

function updateSky(): void {
  stage.updateSky(obs);
  refreshStars();
}
obs.onChange(updateSky);
updateSky();
stage.goHome(0);

/** How far each end of the transom is from the star it is nearer to, degrees. */
function endMisses(): { a: number; b: number; worst: number; swapped: boolean } {
  if (!starA || !starB) return { a: NaN, b: NaN, worst: NaN, swapped: false };
  const da = dirOfStar(starA), db = dirOfStar(starB), e1 = xs.endDirection(1), e2 = xs.endDirection(-1);
  const straight = Math.max(e1.angleTo(da), e2.angleTo(db)), crossed = Math.max(e1.angleTo(db), e2.angleTo(da));
  const swapped = crossed < straight;
  const a = (swapped ? e2 : e1).angleTo(da) / D2R, b = (swapped ? e1 : e2).angleTo(db) / D2R;
  return { a, b, worst: Math.max(a, b), swapped };
}

stage.onFrame(() => {
  xs.pose();
  if (starA && starB) {
    const m = endMisses(), na = displayName(starA), nb = displayName(starB);
    const part = (n: string, v: number) => (v < ON ? `on ${n}` : `${v.toFixed(v < 2 ? 2 : 1)}° from ${n}`);
    const text = m.a < ON && m.b < ON ? `Both ends touch their stars. Read the staff.` : `One end ${part(na, m.a)}; the other ${part(nb, m.b)}.`;
    endStatus.textContent = text; sightStatus.textContent = text;
    endStatus.classList.toggle('on', m.worst < ON); sightStatus.classList.toggle('on', m.worst < ON);
  }
  if (cheat.input.checked && starA && starB) {
    exact.textContent = `Staff reads ${xs.readAngle().toFixed(3)}° · the ends span ${xs.trueAngle().toFixed(3)}° · the stars are ${truthOf(starA, starB).toFixed(3)}° apart · transom ${(xs.distance * 100).toFixed(1)} cm from the eye`;
  } else exact.textContent = '';
});
stage.start();

// Development aid: inspect the live scene from the browser console.
if (import.meta.env.DEV) Object.assign(window, { __instrument: { stage, crossStaff: xs, obs } });
