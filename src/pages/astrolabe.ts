// Astrolabe page: take a star's altitude with the alidade on the back, set the
// rete on the front from it, and read the hour with the rule.
import '../styles/atlas.css';
import * as THREE from 'three';
import { D2R, directionFromHorizontal, R2D, wrap180 } from '../core/astro';
import { displayName, type Star } from '../core/catalogue';
import { Observer } from '../core/observer';
import { apparentSolarTime, equationOfTime, zodiacPlace } from '../core/sun';
import { hhmm, zoneOffsetMinutes } from '../core/time';
import { CENTER_Y, AstrolabeModel } from '../instruments/astrolabe/model';
import { Stage, WebGLUnavailableError, type SightHooks } from '../three/stage';
import { skyViewToward } from '../three/views';
import { MeasurementCheck } from '../ui/check';
import { button, checkbox, h, numberField, selectField, slider } from '../ui/dom';
import { observerControls } from '../ui/observer-controls';
import { instrumentShell } from '../ui/shell';

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const V = () => new THREE.Vector3();

const shell = instrumentShell({
  id: 'astrolabe',
  kicker: 'Plate II',
  title: 'Astrolabe',
  lead: 'Hanging from its ring, the astrolabe measures a star’s altitude with the sighting rule on its back. On the front, the rete, a pierced map of the stars, turns over a plate engraved for your latitude. Set the star on its altitude circle and the rule, laid across the sun’s place, shows the hour.',
});

let stage: Stage;
try {
  stage = new Stage({
    container: shell.stage,
    labelLayer: shell.labels,
    cameraPosition: new THREE.Vector3(-2.2, 1.5, -2.2),
    cameraTarget: new THREE.Vector3(0, CENTER_Y, 0),
    minDistance: 0.2,
  });
} catch (e) {
  if (e instanceof WebGLUnavailableError) shell.showError('This instrument needs WebGL, which isn’t available in this browser.');
  throw e;
}
shell.onInsetChange((left, bottom) => stage.setViewInset(left, bottom));

// A lantern carried by the observer, so whichever face is turned toward you can be read.
const handLamp = new THREE.PointLight(0xffd6a0, 1.6, 5, 1.2);
handLamp.position.set(0.25, 0.3, 0);
stage.camera.add(handLamp);
stage.scene.add(stage.camera);

const obs = new Observer();
const astro = new AstrolabeModel();
stage.scene.add(astro.root);
stage.sky.setOccluders([astro.root]);
let target: Star | null = null;
const noValue = () => '';

// ---- 1 · pick a star ----
const s1 = shell.section('1 · Pick a star');
const pick = selectField('Star');
const where = h('div', { class: 'hint' });
s1.append(h('p', {}, 'Only stars with a pointer on the rete can be used.'), pick.el, where);

function refreshTargets(): void {
  const keep = pick.select.value, onRete = astro.reteStarIds();
  const vis = stage.sky.visibleNamed(6).filter(s => onRete.has(s.id));
  pick.select.replaceChildren(...vis.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`)));
  const next = vis.find(s => s.name === keep) ?? vis.find(s => s.name === 'Vega') ?? vis[0];
  if (next) pick.select.value = next.name;
  pickTarget();
}
function pickTarget(): void {
  target = stage.sky.visibleNamed(-90).find(s => s.name === pick.select.value) ?? null;
  stage.sky.setTarget(target);
  updateMarker();
  updateTexts();
}
pick.select.addEventListener('change', () => { pickTarget(); stage.goHome(); });

// Home view: toward the star, from the observer's left of the instrument (its front side once
// it is aimed), so the instrument stands to the right of the star, clear of the panel.
const centre = new THREE.Vector3(0, CENTER_Y, 0);
stage.setHomeView(() => {
  const p = target ? stage.sky.placeOf(target) : { alt: 30, az: 180 };
  const dir = new THREE.Vector3(...directionFromHorizontal(p.alt, p.az));
  const v = skyViewToward(centre, dir, { distance: 2.8 });
  const right = new THREE.Vector3(dir.z, 0, -dir.x);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize().multiplyScalar(0.55);
  v.position.add(right); v.target.add(right);
  return v;
});

// ---- camera helpers ----
/**
 * Look square-on at a face: the whole instrument, or a detail at `at` from
 * `dist` (desktop distance; moved back on small screens so as much shows).
 */
function viewFace(front: boolean, at?: THREE.Vector3, dist?: number): void {
  const whole = stage.fitDistance(0.5);
  dist = dist === undefined ? whole : dist * Math.max(1, whole / 1.2);
  astro.pose();
  const n = astro.frontNormal(V()).multiplyScalar(front ? 1 : -1);
  const tgt = at ?? astro.centre(V());
  stage.flyTo(tgt.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, at ? 0 : 0.04, 0)), tgt);
}

// ---- which part the arrow keys move ----
type Part = 'sight' | 'rete' | 'rule';
const partHooks = (part: Part): SightHooks => ({
  ...sight,
  nudge: part === 'sight' ? sight.nudge : (right, up) => {
    const d = right + up;
    if (part === 'rete') setRete(astro.reteAngle + d); else setRule(astro.ruleAngle + d);
  },
});
const useKeys = (part: Part) => stage.setAimHooks(partHooks(part));

// ---- 2 · altitude ----
const s2 = shell.section('2 · Take its altitude');
s2.append(h('p', {}, 'Turn the stand until the star is in the instrument’s plane, then raise the alidade until the star shows through both sights. Its end then points to the altitude on the scale round the back.'));
const turnS = slider({ label: 'Turn the stand', min: 0, max: 360, step: 0.05, value: astro.az, format: noValue, onInput: v => { setAim(v, astro.alt); useKeys('sight'); } });
const aliS = slider({ label: 'Raise the alidade', min: 0, max: 90, step: 0.05, value: astro.alt, format: noValue, onInput: v => { setAim(astro.az, v); useKeys('sight'); } });
const status = h('div', { class: 'status', role: 'status' }, 'Off target');
const sightBtn = button('Look through the sights', () => (stage.inSight ? stage.exitSight() : stage.enterSight(sight)), 'primary');
const zoomAli = button('Zoom to the alidade’s end', () => { astro.pose(); viewFace(false, astro.alidadeTip(), 0.3); });
const readAlt = numberField('Altitude you read °', { step: 0.5, placeholder: 'e.g. 21.5', min: 0, max: 90 });
s2.append(turnS.el, aliS.el, status, sightBtn, zoomAli, readAlt.el);

function setAim(az: number, alt: number): void {
  astro.setAim(az, Math.max(0, Math.min(90, alt)));
  turnS.set(astro.az); aliS.set(astro.alt);
}
const sight: SightHooks = {
  eye: out => astro.eye(out),
  aim: out => astro.sightDirection(out),
  nudge: (right, up) => setAim(astro.az + right / Math.max(0.2, Math.cos(astro.alt * D2R)), astro.alt + up),
  fov: 9,
};
useKeys('sight');
stage.onSightChange(on => {
  sightBtn.textContent = on ? 'Step back from the instrument' : 'Look through the sights';
  shell.showSight(on, () => stage.exitSight());
  if (on) useKeys('sight');
});

// ---- 3 · rete ----
const s3 = shell.section('3 · Set the rete');
const reteHint = h('p', {});
const sideNote = h('p', { class: 'note' });
const reteS = slider({ label: 'Turn the rete', min: 0, max: 360, step: 0.05, value: astro.reteAngle, format: noValue, onInput: v => { setRete(v); useKeys('rete'); } });
const showFront = button('Show the front', () => viewFace(true));
const zoomPointer = button('Zoom to the star’s pointer', () => {
  astro.pose();
  const p = target && astro.pointerTip(target.id);
  if (p) viewFace(true, p, 0.42);
});
const mark = checkbox('Mark the star’s pointer', () => updateMarker());
mark.input.checked = true;
s3.append(reteHint, showFront, zoomPointer, reteS.el, mark.el, h('p', { class: 'note' }, 'You can also drag the rete or the rule on the instrument. Arrow keys move whichever part you used last (Shift = fine).'), sideNote);

function setRete(psi: number): void { astro.setRete(psi); reteS.set(astro.reteAngle); }
function updateMarker(): void { astro.setMarker(mark.input.checked && target ? target.id : -1); }

// ---- 4 · hour ----
const s4 = shell.section('4 · Read the hour');
const sunText = h('p', {});
const ruleS = slider({ label: 'Turn the rule', min: 0, max: 360, step: 0.05, value: astro.ruleAngle, format: noValue, onInput: v => { setRule(v); useKeys('rule'); } });
const zoomSun = button('Zoom to the sun’s place', () => { astro.pose(); viewFace(true, astro.sunPoint(), 0.42); });
const zoomRim = button('Zoom to the rim under the rule', () => { astro.pose(); viewFace(true, astro.ruleTip(astro.ruleEndOverSun()), 0.32); });
const zoomDate = button('Find tonight’s date on the back', () => {
  const [y, m, d] = obs.date.split('-').map(Number);
  astro.setAim(astro.az, astro.alidadeForDate(y, m, d));
  aliS.set(Math.max(0, astro.alt));
  astro.pose();
  // Look at where the alidade crosses the calendar and zodiac rings.
  viewFace(false, astro.backPoint(astro.calendarAngle(y, m, d), 0.68), 0.38);
});
const backToSky = button('Back to the sky view (Esc)', () => stage.goHome());
const timeId = 'astro-time';
const timeIn = h('input', { type: 'time', id: timeId, step: '60' });
const timeField = h('div', { class: 'field' }, h('label', { for: timeId, class: 'field-row' }, h('span', {}, 'Hour you read')), timeIn);
const check = new MeasurementCheck();
const checkBtn = button('Check my measurement', checkMeasurement, 'primary');
s4.append(sunText, zoomSun, ruleS.el, zoomRim, zoomDate, backToSky, timeField, checkBtn, check.el);

function setRule(psi: number): void { astro.setRule(psi); ruleS.set(astro.ruleAngle); }

const fmtMin = (m: number) => hhmm(((Math.round(m) % 1440) + 1440) % 1440);
const signedMin = (e: number) => `${e >= 0 ? '+' : '−'}${Math.abs(e).toFixed(0)} min`;

function checkMeasurement(): void {
  if (!target) return;
  const [hh, mm] = timeIn.value.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) { check.message('Type the hour you read where the rule crosses the rim.'); return; }
  const solar = apparentSolarTime(obs.utc, obs.lon) * 60;
  const p = stage.sky.placeOf(target);
  const readings = [{ quantity: 'Hour', yours: hh * 60 + mm, truth: solar, circular: true, period: 1440, format: fmtMin, formatError: signedMin }];
  const a = parseFloat(readAlt.input.value);
  if (!Number.isNaN(a)) readings.push({ quantity: 'Altitude', yours: a, truth: p.alt } as typeof readings[number]);

  // Sundial time vs clock time: the equation of time, and the distance from the zone's meridian.
  const zoneMin = zoneOffsetMinutes(obs.zone, obs.utc), eot = equationOfTime(obs.utc), lonMin = obs.lon * 4 - zoneMin;
  const clockMin = (obs.utc.getTime() / 60000 + zoneMin) % 1440;
  const dLon = obs.lon - zoneMin / 4;
  const foot = `An astrolabe tells local sundial time. The clock read ${fmtMin(clockMin)} (${obs.zoneLabel}); sundial time differs by ${signedMin(eot + lonMin)}: `
    + `${signedMin(eot)} from the equation of time (the sun’s uneven pace through the year) and ${signedMin(lonMin)} because ${obs.place.name === 'Custom place' ? 'this place' : obs.place.name} lies `
    + `${Math.abs(dLon).toFixed(1)}° ${dLon < 0 ? 'west' : 'east'} of the meridian its clocks keep.`;
  check.show(displayName(target), readings, {
    fine: 6, close: 20,
    fineText: 'Excellent: within the few minutes an astrolabe can show.',
    closeText: 'Close. Check the altitude, the side of the meridian, and where the rule crosses the rim.',
    farText: 'Quite far off. Is the pointer on the correct side of the meridian, and the rule on the sun’s place?',
  }, foot);
}

// ---- the sky ----
const s5 = shell.section('The sky');
const exact = h('div', { class: 'exact' });
const cheat = checkbox('Show exact instrument readings');
s5.append(observerControls(obs), cheat.el, exact);

function updateTexts(): void {
  sunText.textContent = `Tonight the sun stands at ${zodiacPlace(astro.sunLon)}. Turn the rule so its edge crosses that degree of the ecliptic ring on the rete, then read the hour where the same end crosses the rim. Each small division is 4 minutes.`;
  if (!target) {
    where.textContent = 'No star with a pointer is up. Try a later hour.';
    reteHint.textContent = ''; sideNote.textContent = '';
    return;
  }
  const p = stage.sky.placeOf(target);
  const dir = COMPASS[Math.round(p.az / 45) % 8], high = p.alt < 25 ? 'low' : p.alt < 55 ? 'midway up' : 'high';
  where.textContent = `Look ${high} in the ${dir}.`;
  const east = p.az < 180;
  reteHint.textContent = `Turn the rete until the tip of ${displayName(target)}’s pointer lies on the altitude circle of your reading, on the ${east ? 'eastern (left)' : 'western (right)'} half of the plate, because the star is in the ${east ? 'east' : 'west'}. The circles are 2° apart, numbered every 10° down the meridian.`;
  const ha = Math.abs(wrap180(obs.lst - p.ra));
  sideNote.textContent = ha < 20 || ha > 160
    ? `${displayName(target)} is close to the meridian, where its altitude hardly changes, so the hour you find will be uncertain. A star further east or west gives a sharper answer.`
    : '';
}

function updateSky(): void {
  stage.updateSky(obs);
  astro.configure(obs.lat, obs.utc);
  refreshTargets();
}
obs.onChange(updateSky);
updateSky();
stage.goHome(0);

// ---- dragging the rete and rule on the front ----
{
  const el = stage.renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const plane = new THREE.Plane(), hit = V();
  let grab: { part: 'rete' | 'rule'; last: number; id: number } | null = null;
  const cast = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
  };
  const angleAt = (e: PointerEvent): number | null => {
    cast(e);
    astro.pose();
    plane.setFromNormalAndCoplanarPoint(astro.frontNormal(V()), astro.centre(V()));
    return ray.ray.intersectPlane(plane, hit) ? astro.frontAngleOf(hit) : null;
  };
  // Capture phase: runs before the orbit controls, which are disabled while dragging a part.
  el.addEventListener('pointerdown', e => {
    if (stage.inSight || grab) return;
    cast(e);
    astro.pose();
    const first = ray.intersectObject(astro.root, true)[0];
    if (!first) return;
    const o = first.object;
    const part = o.parent === astro.ruleGroup ? 'rule' : (o === astro.rete || o === astro.plate) ? 'rete' : null;
    if (!part) return;
    const a = angleAt(e);
    if (a === null) return;
    grab = { part, last: a, id: e.pointerId };
    stage.controls.enabled = false;
    el.setPointerCapture(e.pointerId);
    useKeys(part);
  }, { capture: true });
  el.addEventListener('pointermove', e => {
    if (!grab || e.pointerId !== grab.id) return;
    const a = angleAt(e);
    if (a === null) return;
    const d = wrap180(a - grab.last) * (e.shiftKey ? 0.2 : 1);
    grab.last = a;
    if (grab.part === 'rete') setRete(astro.reteAngle + d); else setRule(astro.ruleAngle + d);
  });
  const end = (e: PointerEvent) => {
    if (!grab || e.pointerId !== grab.id) return;
    grab = null;
    if (!stage.inSight) stage.controls.enabled = true;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---- per frame ----
const aim = V(), tdir = V(), tip = V();
stage.onFrame(() => {
  astro.pose();
  if (target) {
    const p = stage.sky.placeOf(target);
    astro.sightDirection(aim);
    tdir.set(...directionFromHorizontal(p.alt, p.az));
    const off = aim.angleTo(tdir) * R2D;
    const on = off < 0.35;
    status.classList.toggle('on', on);
    status.textContent = on ? `On target (${off.toFixed(2)}° off): now read the alidade` : `Off target by ${off.toFixed(1)}°`;
  }
  if (cheat.input.checked) {
    let s = `Alidade reads ${astro.readAlidade().toFixed(2)}° · rule reads ${fmtMin(astro.readRule(astro.ruleEndOverSun()) * 60)} · sundial time ${fmtMin(apparentSolarTime(obs.utc, obs.lon) * 60)}`;
    const t = target && astro.pointerTip(target.id, tip);
    const r = t && astro.plateReadingAt(t);
    if (target && r) s += ` · ${displayName(target)}’s pointer is on the ${r.alt.toFixed(2)}° circle, ${r.az < 180 ? 'east' : 'west'}`;
    exact.textContent = s;
  } else exact.textContent = '';
});
stage.start();

if (import.meta.env.DEV) Object.assign(window, { __instrument: { stage, astro, obs } });
