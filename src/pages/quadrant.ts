// Quadrant page: port of references/Quadrant prototype.html onto the shared modules.
import '../styles/atlas.css';
import * as THREE from 'three';
import { D2R, directionFromHorizontal, R2D } from '../core/astro';
import { displayName, type Star } from '../core/catalogue';
import { Observer } from '../core/observer';
import { PIVOT_Y, QuadrantModel } from '../instruments/quadrant/model';
import { Stage, WebGLUnavailableError, type SightHooks } from '../three/stage';
import { skyViewToward } from '../three/views';
import { MeasurementCheck } from '../ui/check';
import { button, checkbox, h, numberField, selectField, slider } from '../ui/dom';
import { observerControls } from '../ui/observer-controls';
import { instrumentShell } from '../ui/shell';

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

const shell = instrumentShell({
  id: 'quadrant',
  kicker: 'Plate I',
  title: 'Quadrant',
  lead: 'Sight a star along the top edge, with the corner the cord hangs from pointing at the star. The plumb line hangs straight down, and where it crosses the scale gives the star’s altitude. The pointer on the base ring gives its azimuth.',
});

let stage: Stage;
try {
  stage = new Stage({
    container: shell.stage,
    labelLayer: shell.labels,
    cameraPosition: new THREE.Vector3(-2.9, 1.35, -2.7),
    cameraTarget: new THREE.Vector3(0, 1.35, 0.2),
  });
} catch (e) {
  if (e instanceof WebGLUnavailableError) shell.showError('This instrument needs WebGL, which isn’t available in this browser.');
  throw e;
}

shell.onInsetChange((left, bottom) => stage.setViewInset(left, bottom));

const obs = new Observer();
const quadrant = new QuadrantModel();
stage.scene.add(quadrant.root);
stage.sky.setOccluders([quadrant.root]);
let target: Star | null = null;

// ---- 1 · pick a star ----
const s1 = shell.section('1 · Pick a star');
const pick = selectField('Star');
const where = h('div', { class: 'hint' });
s1.append(pick.el, where);

function refreshTargets(): void {
  const keep = pick.select.value;
  const vis = stage.sky.visibleNamed(6);
  pick.select.replaceChildren(...vis.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`)));
  const next = vis.find(s => s.name === keep) ?? vis.find(s => s.name === 'Vega') ?? vis[0];
  if (next) pick.select.value = next.name;
  pickTarget();
}
function pickTarget(): void {
  target = stage.sky.visibleNamed(-90).find(s => s.name === pick.select.value) ?? null;
  stage.sky.setTarget(target);
  if (!target) { where.textContent = 'No bright named star is up. Try a later hour.'; return; }
  const p = stage.sky.placeOf(target);
  const dir = COMPASS[Math.round(p.az / 45) % 8], high = p.alt < 25 ? 'low' : p.alt < 55 ? 'midway up' : 'high';
  where.textContent = `Look ${high} in the ${dir}.`;
}
pick.select.addEventListener('change', () => { pickTarget(); stage.goHome(); });

// Home view: over the instrument toward the chosen star (due south, 30° up if none).
const pivot = new THREE.Vector3(0, PIVOT_Y, 0);
stage.setHomeView(() => {
  const p = target ? stage.sky.placeOf(target) : { alt: 30, az: 180 };
  return skyViewToward(pivot, new THREE.Vector3(...directionFromHorizontal(p.alt, p.az)));
});

// ---- 2 · aim ----
const s2 = shell.section('2 · Aim the instrument');
const noValue = () => '';
const turn = slider({ label: 'Turn', min: 0, max: 360, step: 0.05, value: quadrant.az, format: noValue, onInput: v => setAim(v, quadrant.alt) });
const tilt = slider({ label: 'Tilt', min: 0, max: 89, step: 0.05, value: quadrant.alt, format: noValue, onInput: v => setAim(quadrant.az, v) });
const status = h('div', { class: 'status', role: 'status' }, 'Off target');
const sightBtn = button('Look through the sights', () => (stage.inSight ? stage.exitSight() : stage.enterSight(sight)), 'primary');
s2.append(turn.el, tilt.el, status, sightBtn);

function setAim(az: number, alt: number): void {
  quadrant.setAim(az, alt);
  turn.set(quadrant.az); tilt.set(quadrant.alt);
}
const sight: SightHooks = {
  eye: out => quadrant.eye(out),
  aim: out => quadrant.sightDirection(out),
  nudge: (right, up) => setAim(quadrant.az + right / Math.max(0.2, Math.cos(quadrant.alt * D2R)), quadrant.alt + up),
  fov: 9,
};
stage.setAimHooks(sight);
stage.onSightChange(on => {
  sightBtn.textContent = on ? 'Step back from the instrument' : 'Look through the sights';
  shell.showSight(on, () => stage.exitSight());
});

// ---- 3 · read & check ----
const s3 = shell.section('3 · Read the scales');
const flyLocal = (pos: THREE.Vector3, tgt: THREE.Vector3) => {
  quadrant.pose();
  stage.flyTo(quadrant.azGroup.localToWorld(pos), quadrant.azGroup.localToWorld(tgt));
};
// Look square-on at the plate, centred on where the cord crosses the scale.
const zoomPlumb = button('Zoom to the plumb line', () => {
  quadrant.pose();
  const tgt = quadrant.azGroup.worldToLocal(quadrant.plumbCrossing());
  flyLocal(tgt.clone().add(new THREE.Vector3(-0.75, 0.05, 0)), tgt);
});
const zoomRing = button('Zoom to the azimuth ring', () => flyLocal(new THREE.Vector3(0.25, 0.75, 1.05), new THREE.Vector3(0, 0.14, 0.6)));
const backToSky = button('Back to the sky view (Esc)', () => stage.goHome());
const readAlt = numberField('Altitude °', { step: 0.5, placeholder: 'e.g. 34.5', min: 0, max: 90 });
const readAz = numberField('Azimuth °', { step: 1, placeholder: 'optional', min: 0, max: 360 });
const check = new MeasurementCheck();
const checkBtn = button('Check my measurement', () => {
  if (!target) return;
  const a = parseFloat(readAlt.input.value), z = parseFloat(readAz.input.value);
  if (Number.isNaN(a)) { check.message('Type the altitude you read where the plumb line crosses the scale.'); return; }
  const p = stage.sky.placeOf(target);
  const readings = [{ quantity: 'Altitude', yours: a, truth: p.alt }];
  if (!Number.isNaN(z)) readings.push({ quantity: 'Azimuth', yours: z, truth: p.az, circular: true } as typeof readings[number]);
  check.show(displayName(target), readings, { fine: 0.5, close: 2 });
}, 'primary');
s3.append(zoomPlumb, zoomRing, backToSky, h('div', { class: 'row' }, readAlt.el, readAz.el), checkBtn, check.el);

// ---- the sky ----
const s4 = shell.section('The sky');
const exact = h('div', { class: 'exact' });
const cheat = checkbox('Show exact instrument readings');
s4.append(observerControls(obs), cheat.el, exact);

function updateSky(): void {
  stage.updateSky(obs);
  refreshTargets();
}
obs.onChange(updateSky);
updateSky();
stage.goHome(0);

// ---- per frame ----
const aim = new THREE.Vector3(), tdir = new THREE.Vector3();
stage.onFrame(dt => {
  quadrant.update(dt);
  if (target) {
    const p = stage.sky.placeOf(target);
    quadrant.sightDirection(aim);
    tdir.set(...directionFromHorizontal(p.alt, p.az));
    const off = aim.angleTo(tdir) * R2D;
    const on = off < 0.35;
    status.classList.toggle('on', on);
    status.textContent = on ? `On target (${off.toFixed(2)}° off): now read the plumb line` : `Off target by ${off.toFixed(1)}°`;
  }
  exact.textContent = cheat.input.checked
    ? `Plumb line reads ${quadrant.readPlumb().toFixed(2)}°, pointer reads ${quadrant.readPointer().toFixed(2)}°`
    : '';
});
stage.start();

// Development aid: inspect the live scene from the browser console.
if (import.meta.env.DEV) Object.assign(window, { __instrument: { stage, quadrant, obs } });
