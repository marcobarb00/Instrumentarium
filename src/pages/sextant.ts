// Sextant page: on a ship's deck, bring a star's reflection down to the sea
// horizon in the split telescope view, then read the arc and the drum.
import '../styles/atlas.css';
import * as THREE from 'three';
import { directionFromHorizontal, wrap180 } from '../core/astro';
import { displayName, type Star } from '../core/catalogue';
import { degMin, refractionMinutes } from '../core/nav';
import { Observer } from '../core/observer';
import { DIP, EYE_ABOVE_SEA, EYE_Y, makeDeck, SEA_RADIUS, SEA_Y, SextantModel } from '../instruments/sextant/model';
import { SKY_RADIUS } from '../three/sky';
import { SIGHT_FOV_WIDE, Stage, WebGLUnavailableError, type SightHooks } from '../three/stage';
import { standingViewToward } from '../three/views';
import { MeasurementCheck } from '../ui/check';
import { button, checkbox, h, numberField, selectField, slider } from '../ui/dom';
import { observerControls } from '../ui/observer-controls';
import { instrumentShell } from '../ui/shell';

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const V = () => new THREE.Vector3();
/** Narrowest view through the telescope (about 4× magnification), degrees. */
const TELESCOPE_FOV = 6;

const shell = instrumentShell({
  id: 'sextant',
  kicker: 'Plate III',
  title: 'Sextant',
  lead: 'Look at the sea horizon through the telescope. The horizon glass is silvered on one half: there the index mirror shows the sky, raised by twice the angle of the index arm. Move the arm until the star’s image sits on the horizon, then read the arc and the micrometer drum.',
});

let stage: Stage;
try {
  stage = new Stage({
    container: shell.stage,
    labelLayer: shell.labels,
    cameraPosition: new THREE.Vector3(-1.2, 1.75, -1.2),
    cameraTarget: new THREE.Vector3(0, EYE_Y, 0),
    minDistance: 0.06,
    sky: { sea: { surfaceY: SEA_Y, radius: SEA_RADIUS } },
  });
} catch (e) {
  if (e instanceof WebGLUnavailableError) shell.showError('This instrument needs WebGL, which isn’t available in this browser.');
  throw e;
}

let insetLeft = 0;
shell.onInsetChange((left, bottom) => { insetLeft = left; stage.setViewInset(left, bottom); });

// A lantern carried by the observer, so the scales can be read.
const handLamp = new THREE.PointLight(0xffd6a0, 1.2, 4, 1.2);
handLamp.position.set(0.2, 0.25, 0);
stage.camera.add(handLamp);
stage.scene.add(stage.camera);

const obs = new Observer();
const sextant = new SextantModel();
stage.scene.add(makeDeck(), sextant.root);
stage.sky.setOccluders([sextant.root]);
let target: Star | null = null;
const noValue = () => '';

// The edge of the silvering, and the reflected star's label, over the telescope view.
const glass = h('div', { class: 'split-glass', 'aria-hidden': 'true' });
const reflLabel = h('div', { class: 'slabel target split-label', 'aria-hidden': 'true' });
document.body.append(glass, reflLabel);

// ---- 1 · pick a star ----
const s1 = shell.section('1 · Pick a star');
const pick = selectField('Star');
const where = h('div', { class: 'hint' });
s1.append(pick.el, where);

function refreshTargets(): void {
  const keep = pick.select.value;
  const vis = stage.sky.visibleNamed(10).filter(s => stage.sky.placeOf(s).alt < 80);
  pick.select.replaceChildren(...vis.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`)));
  const next = vis.find(s => s.name === keep) ?? vis.find(s => s.name === 'Vega') ?? vis[0];
  if (next) pick.select.value = next.name;
  pickTarget();
}
function pickTarget(): void {
  target = stage.sky.visibleNamed(-90).find(s => s.name === pick.select.value) ?? null;
  stage.sky.setTarget(target);
  reflLabel.textContent = target ? displayName(target) : '';
  if (!target) { where.textContent = 'No bright named star is between 10° and 80° up. Try another hour.'; return; }
  const p = stage.sky.placeOf(target);
  const dir = COMPASS[Math.round(p.az / 45) % 8], high = p.alt < 25 ? 'low' : p.alt < 55 ? 'midway up' : 'high';
  where.textContent = `Look ${high} in the ${dir}.`;
}
pick.select.addEventListener('change', () => { pickTarget(); stage.goHome(); });

// Home view: standing just behind the sextant, looking at the star.
stage.setHomeView(() => {
  const p = target ? stage.sky.placeOf(target) : { alt: 30, az: 180 };
  return standingViewToward(new THREE.Vector3(0, EYE_Y, 0), new THREE.Vector3(...directionFromHorizontal(p.alt, p.az)), { back: 1.2, side: -0.3, eyeY: 1.75 });
});

// ---- 2 · face the star ----
const s2 = shell.section('2 · Face the star');
s2.append(h('p', {}, 'Turn until the star is straight ahead, then look through the telescope. Through the clear left half of the horizon glass you see the sea horizon; the silvered right half shows the sky above it, raised by the reading on the arc.'));
const turnS = slider({ label: 'Turn', min: 0, max: 360, step: 0.05, value: sextant.az, format: noValue, onInput: v => setAim(v) });
const sightBtn = button('Look through the telescope', () => (stage.inSight ? stage.exitSight() : stage.enterSight(sight)), 'primary');
s2.append(turnS.el, sightBtn);

// ---- 3 · bring the star down ----
const s3 = shell.section('3 · Bring the star down to the horizon');
s3.append(h('p', {}, 'Swing the index arm until the star’s image comes down to the horizon, then turn the micrometer drum until it just touches. In the telescope view the arrow keys do the same: ← → turn, ↑ ↓ move the star’s image (Shift for fine steps); or drag the image.'));
const armS = slider({ label: 'Index arm', min: 0, max: 120, step: 0.01, value: sextant.reading, format: noValue, onInput: v => setReading(v) });
const drumS = slider({ label: 'Micrometer drum', min: 0, max: 59.9, step: 0.1, value: 0, format: noValue, onInput: v => setReading(Math.floor(sextant.reading) + v / 60) });
const status = h('div', { class: 'status', role: 'status' }, '');
s3.append(armS.el, drumS.el, status);

function setAim(az: number): void { sextant.setAim(az); turnS.set(sextant.az); }
function setReading(r: number): void {
  sextant.setReading(r);
  armS.set(sextant.reading);
  drumS.set((((sextant.reading % 1) + 1) % 1) * 60);
}

const sight: SightHooks = {
  eye: out => sextant.eye(out),
  aim: out => sextant.telescopeAxis(out),
  // ← → turn the sextant; ↑ ↓ swing the arm, which moves the star's image down or up.
  nudge: (right, up) => { setAim(sextant.az + right); setReading(sextant.reading + up); },
  fov: TELESCOPE_FOV,
  wideBack: 0,
  afterRender: renderMirrorHalf,
  keysMoveImage: true,
};
stage.setAimHooks(sight);
stage.onSightChange(on => {
  sightBtn.textContent = on ? 'Lower the sextant' : 'Look through the telescope';
  shell.showSight(on, { exit: () => stage.exitSight(), zoom: d => stage.zoomSight(d) });
  // At the eyepiece the instrument itself is out of focus: hide it.
  sextant.root.visible = !on;
  document.body.classList.toggle('split-sight', on);
  if (!on) reflLabel.style.display = 'none';
});

// The silvered half: the same view turned up by the reading about the frame's normal (two
// reflections make a rotation through twice the angle between the mirrors).
const reflCam = new THREE.PerspectiveCamera();
const size = new THREE.Vector2(), qRot = new THREE.Quaternion(), starPos = V();
function renderMirrorHalf(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
  r.getSize(size);
  const cx = Math.round((size.x + insetLeft) / 2);
  reflCam.copy(camera);
  sextant.reflectedRotation(qRot);
  reflCam.quaternion.premultiply(qRot);
  reflCam.updateMatrixWorld();
  r.setScissorTest(true);
  r.setScissor(cx, 0, size.x - cx, size.y);
  r.render(scene, reflCam);
  r.setScissorTest(false);
  // Label the star where it shows in the mirror.
  if (target) {
    const p = stage.sky.placeOf(target);
    starPos.set(...directionFromHorizontal(p.alt, p.az)).multiplyScalar(SKY_RADIUS).project(reflCam);
    const x = ((starPos.x + 1) / 2) * size.x, y = ((1 - starPos.y) / 2) * size.y;
    const show = starPos.z < 1 && x > cx && x < size.x && y > 0 && y < size.y;
    reflLabel.style.display = show ? 'block' : 'none';
    if (show) { reflLabel.style.left = `${x}px`; reflLabel.style.top = `${y}px`; }
  }
}

// ---- 4 · read and check ----
const s4 = shell.section('4 · Read the sextant');
s4.append(h('p', {}, 'Whole degrees are read where the arm’s index points on the arc (the last mark it has passed); the drum gives the minutes, one turn per degree.'));
const flyFront = (p: THREE.Vector3, dist: number) => {
  sextant.pose();
  stage.flyTo(p.clone().addScaledVector(sextant.frameNormal(V()), dist * Math.max(1, stage.fitDistance(0.5) / 1.2)), p);
};
const zoomArc = button('Zoom to the arc', () => flyFront(sextant.arcIndexPoint(), 0.11));
const zoomDrum = button('Zoom to the drum', () => flyFront(sextant.drumIndexPoint(), 0.09));
const backToSky = button('Back to the sky view (Esc)', () => stage.goHome());
const readDeg = numberField('Arc, degrees', { step: 1, placeholder: 'e.g. 34', min: 0, max: 120 });
const readMin = numberField('Drum, minutes', { step: 0.1, placeholder: 'e.g. 36.5', min: 0, max: 60 });
const check = new MeasurementCheck();
const signedMin = (e: number) => `${e >= 0 ? '+' : '−'}${Math.abs(e * 60).toFixed(1)}′`;
const checkBtn = button('Check my measurement', () => {
  if (!target) return;
  const d = parseFloat(readDeg.input.value), m = parseFloat(readMin.input.value);
  if (Number.isNaN(d) || Number.isNaN(m)) { check.message('Type the degrees from the arc and the minutes from the drum.'); return; }
  const p = stage.sky.placeOf(target), hs = p.alt + DIP, yours = d + m / 60;
  const foot = `The sextant measures from the sea horizon, which lies ${(DIP * 60).toFixed(1)}′ below the true horizontal for an eye ${EYE_ABOVE_SEA} m above the sea (the dip). `
    + `Taking it off gives the observed altitude: ${degMin(yours)} − ${(DIP * 60).toFixed(1)}′ = ${degMin(yours - DIP)}, against a true ${degMin(p.alt)}. `
    + `At sea you would also subtract refraction (about ${refractionMinutes(p.alt).toFixed(1)}′ at this altitude); this sky has none, so it isn’t needed here.`;
  check.show(displayName(target), [{ quantity: 'Sextant altitude', yours, truth: hs, format: (v: number) => degMin(v), formatError: signedMin }], {
    fine: 1 / 60, close: 5 / 60,
    fineText: 'Excellent: within a minute of arc, as good as a sextant gives.',
    closeText: 'Close. Check that the star just touches the horizon, and read the drum again.',
    farText: 'Quite far off. Is the star’s image sitting on the horizon, and did you take the degree from the mark the index has passed?',
  }, foot);
}, 'primary');
s4.append(zoomArc, zoomDrum, backToSky, h('div', { class: 'row' }, readDeg.el, readMin.el), checkBtn, check.el);

// ---- the sky ----
const s5 = shell.section('The sky');
const exact = h('div', { class: 'exact' });
const cheat = checkbox('Show exact instrument readings');
s5.append(observerControls(obs), cheat.el, exact);

function updateSky(): void {
  stage.updateSky(obs);
  refreshTargets();
}
obs.onChange(updateSky);
updateSky();
stage.goHome(0);

// ---- per frame ----
stage.onFrame(() => {
  sextant.pose();
  if (target) {
    const p = stage.sky.placeOf(target);
    // Height of the star's image above the horizon in the view, and how far it is to the side.
    const off = p.alt - (sextant.reading - DIP);
    const side = wrap180(p.az - sextant.az) * Math.cos(p.alt * Math.PI / 180);
    const fov = stage.inSight ? stage.camera.fov : SIGHT_FOV_WIDE;
    const halfW = (fov / 2) * stage.camera.aspect;
    const touching = Math.abs(off) < 0.5 / 60;
    let text = touching ? `The star touches the horizon (${(Math.abs(off) * 60).toFixed(1)}′): now read the arc and the drum`
      : `The star’s image is ${degMin(Math.abs(off))} ${off > 0 ? 'above' : 'below'} the horizon`;
    if (side <= 0) text += ' · turn a little left so it shows in the silvered half';
    else if (side > halfW) text += ' · turn right toward the star';
    status.classList.toggle('on', touching && side > 0 && side < halfW);
    status.textContent = text;
  }
  exact.textContent = cheat.input.checked
    ? `Arc ${sextant.readArc().toFixed(2)}°, drum ${sextant.readDrum().toFixed(1)}′: reading ${degMin(sextant.readSextant())}` + (target ? ` · altitude + dip = ${degMin(stage.sky.placeOf(target).alt + DIP)}` : '')
    : '';
});
stage.start();

if (import.meta.env.DEV) Object.assign(window, { __instrument: { stage, sextant, obs } });
