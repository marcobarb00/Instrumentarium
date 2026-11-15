// Armillary sphere page: raise the pole to the latitude, turn the sphere with
// the hours, and find where and when a star rises from the horizon ring and the
// hour circle.
import '../styles/atlas.css';
import * as THREE from 'three';
import { D2R, directionFromHorizontal, horizontalFromDirection, horizontalFromEquatorial, lstDeg, wrap360 } from '../core/astro';
import { displayName, NAMED_BRIGHT, type Star } from '../core/catalogue';
import { Observer } from '../core/observer';
import { riseTime } from '../core/rising';
import { apparentSolarTime, equationOfTime, meanObliquity, sunLongitude } from '../core/sun';
import { hhmm, utcToZoned, zoneOffsetMinutes } from '../core/time';
import { amplitudeOf } from '../instruments/armillary/drawings';
import { ArmillaryModel, CENTER_Y } from '../instruments/armillary/model';
import { Stage, WebGLUnavailableError, type SightHooks } from '../three/stage';
import { MeasurementCheck } from '../ui/check';
import { button, checkbox, h, numberField, selectField, slider } from '../ui/dom';
import { observerControls } from '../ui/observer-controls';
import { instrumentShell } from '../ui/shell';

const V = () => new THREE.Vector3();
const noValue = () => '';
/** Minutes of time the sphere turns per second while it runs with the clock. */
const RUN_RATE = 40;

const shell = instrumentShell({
  id: 'armillary',
  kicker: 'Plate IV',
  title: 'Armillary sphere',
  lead: 'The circles of the heavens in brass, round a small Earth. The horizon and the meridian stand still; inside them the sphere of the stars turns once a day about the pole. Raise the pole to your latitude, turn the sphere, and find where and when a star rises.',
});

let stage: Stage;
try {
  stage = new Stage({
    container: shell.stage,
    labelLayer: shell.labels,
    cameraPosition: new THREE.Vector3(0.8, 1.6, -0.8),
    cameraTarget: new THREE.Vector3(0, CENTER_Y, 0),
    minDistance: 0.12,
  });
} catch (e) {
  if (e instanceof WebGLUnavailableError) shell.showError('This instrument needs WebGL, which isn’t available in this browser.');
  throw e;
}
shell.onInsetChange((left, bottom) => stage.setViewInset(left, bottom));

// A lantern carried by the observer, so the scales can be read.
const handLamp = new THREE.PointLight(0xffd6a0, 1.4, 4, 1.2);
handLamp.position.set(0.2, 0.25, 0);
stage.camera.add(handLamp);
stage.scene.add(stage.camera);

const obs = new Observer();
const armillary = new ArmillaryModel(meanObliquity(obs.utc));
armillary.setPole(60);
stage.scene.add(armillary.root);
stage.sky.setOccluders([armillary.root]);
let target: Star | null = null;

const latText = (lat: number) => `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}`;
const placeName = () => (obs.place.id === 'custom' ? 'this place' : obs.place.name);

// ---- 1 · pick a star ----
const s1 = shell.section('1 · Pick a star');
const pick = selectField('Star');
const where = h('div', { class: 'hint' });
s1.append(pick.el, where);

/** Stars that rise and set here (neither always up nor never seen), brightest first. */
function risingStars(): Star[] {
  return NAMED_BRIGHT.filter(s => Math.abs(stage.sky.placeOf(s).dec) < 89 - Math.abs(obs.lat)).sort((a, b) => a.mag - b.mag);
}
function refreshTargets(): void {
  const keep = pick.select.value, list = risingStars();
  pick.select.replaceChildren(...list.map(s => h('option', { value: s.name }, `${displayName(s)} · mag ${s.mag.toFixed(1)}`)));
  const next = list.find(s => s.name === keep) ?? list.find(s => s.name === 'Vega') ?? list[0];
  if (next) pick.select.value = next.name;
  pickTarget();
}
function pickTarget(): void {
  target = NAMED_BRIGHT.find(s => s.name === pick.select.value) ?? null;
  stage.sky.setTarget(target);
  if (!target) { armillary.setStar(null); where.textContent = ''; return; }
  const p = stage.sky.placeOf(target);
  armillary.setStar({ ra: p.ra, dec: p.dec });
  const ra = p.ra / 15, hh = Math.floor(ra), mm = Math.round((ra - hh) * 60);
  where.textContent = `${displayName(target)}: right ascension ${hh}h ${String(mm).padStart(2, '0')}m, declination ${p.dec >= 0 ? '+' : '−'}${Math.abs(p.dec).toFixed(1)}°. A gold ring marks its place on the sphere, with a thread to it from the Earth.`;
  resetCheck();
}
pick.select.addEventListener('change', () => { pickTarget(); stage.goHome(); });

// ---- 2 · latitude ----
const s2 = shell.section('2 · Raise the pole');
const latHint = h('p', {});
const poleS = slider({ label: 'Raise or lower the pole', min: -90, max: 90, step: 0.05, value: armillary.poleElevation, format: noValue, onInput: v => setPole(v) });
const poleStatus = h('div', { class: 'status', role: 'status' });
const zoomNotch = button('Zoom to the notch', () => {
  armillary.pose();
  const p = armillary.notchPoint(), north = armillary.poleElevation >= 0 ? 1 : -1;
  stage.flyTo(p.clone().add(new THREE.Vector3(-0.2, 0.07, north * 0.06)), p);
});
s2.append(latHint, poleS.el, zoomNotch, poleStatus);

function setPole(e: number): void {
  armillary.setPole(e);
  poleS.set(armillary.poleElevation);
  resetCheck();
}

// ---- 3 · turn the sphere ----
const s3 = shell.section('3 · Turn the sphere');
s3.append(h('p', {}, 'The sphere turns westward once a day, carrying the stars and the sun with it. The hour index on the axis was set to XII when the sun on the zodiac stood on the meridian, so the hour circle round the pole shows sundial time.'));
const turnS = slider({ label: 'Turn the sphere (the hours of the night)', min: 0, max: 1440, step: 1, value: obs.minutes, format: noValue, onInput: v => obs.setMinutes(v) });
let running = false;
const runBtn = button('Turn with time', () => setRunning(!running));
const sightBtn = button('Look out from the Earth', () => (stage.inSight ? stage.exitSight() : enterEarthView()));
const starStatus = h('div', { class: 'status', role: 'status' });
s3.append(turnS.el, h('div', { class: 'row' }, runBtn, sightBtn), starStatus);
function setRunning(on: boolean): void {
  running = on;
  runBtn.textContent = on ? 'Stop' : 'Turn with time';
}

// ---- 4 · rising ----
const s4 = shell.section('4 · Where and when does it rise?');
s4.append(h('p', {}, 'Turn the sphere until the gold ring sits on the horizon on the eastern side. On the horizon ring, read how many degrees north or south of the east point (ORIENS) the star rises. On the hour circle, read the hour under the index; each small division is a quarter of an hour.'));
const zoomRise = button('Zoom to the star at the horizon', () => {
  armillary.pose();
  const dir = armillary.starDirection(), p = armillary.horizonPointToward(dir);
  const out = V().set(dir.x, 0, dir.z).normalize();
  stage.flyTo(p.clone().addScaledVector(out, 0.2).add(new THREE.Vector3(0, 0.15, 0)), p);
});
const zoomDial = button('Zoom to the hour circle', () => {
  armillary.pose();
  const p = armillary.dialPoint(), pole = armillary.poleDirection();
  stage.flyTo(p.clone().addScaledVector(pole, 0.17).add(new THREE.Vector3(0, 0.02, -0.04 * Math.sign(pole.z || 1))), p);
});
const backHome = button('Back to the overall view (Esc)', () => stage.goHome());
const ampIn = numberField('Degrees from east', { step: 0.5, min: 0, max: 90, placeholder: 'e.g. 23' });
const ns = selectField('Toward');
ns.select.append(h('option', { value: 'N' }, 'north'), h('option', { value: 'S' }, 'south'));
const timeId = 'arm-time';
const timeIn = h('input', { type: 'time', id: timeId, step: '60' });
const timeField = h('div', { class: 'field' }, h('label', { for: timeId, class: 'field-row' }, h('span', {}, 'Hour you read')), timeIn);
const check = new MeasurementCheck();
const checkBtn = button('Check my measurement', checkMeasurement, 'primary');
let riseClock: number | null = null;
const showRise = button('Set the sky to that moment', () => {
  if (riseClock === null) return;
  setRunning(false);
  obs.setMinutes(riseClock);
  stage.goHome();
});
showRise.hidden = true;
s4.append(zoomRise, zoomDial, backHome, h('div', { class: 'row' }, ampIn.el, ns.el), timeField, checkBtn, check.el, showRise);

const fmtMin = (m: number) => hhmm(((Math.round(m) % 1440) + 1440) % 1440);
const signedMin = (e: number) => { const r = Math.round(e); return `${r >= 0 ? '+' : '−'}${Math.abs(r)} min`; };
const fmtAmp = (v: number) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? 'N' : 'S'} of E`;

function resetCheck(): void { showRise.hidden = true; riseClock = null; }

function checkMeasurement(): void {
  if (!target) return;
  const [hh, mm] = timeIn.value.split(':').map(Number);
  const a = parseFloat(ampIn.input.value);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || Number.isNaN(a)) {
    check.message('Type both readings: the degrees from the east point on the horizon, and the hour on the hour circle.');
    return;
  }
  const p = stage.sky.placeOf(target);
  // The night shown on this page: from noon on the evening's date to noon the next day.
  const t0 = new Date(obs.utc.getTime() - obs.minutes * 60e3), t1 = new Date(t0.getTime() + 1440 * 60e3);
  const rise = riseTime(p.ra, p.dec, obs.lat, obs.lon, t0, t1);
  if (!rise) { check.message(`${displayName(target)} does not rise between noon and noon here.`); return; }
  const az = horizontalFromEquatorial(p.ra, p.dec, lstDeg(rise, obs.lon), obs.lat).az;
  const solar = apparentSolarTime(rise, obs.lon) * 60;
  const amp = amplitudeOf(az);
  const yoursAmp = ns.select.value === 'S' ? -a : a;

  const zoneMin = zoneOffsetMinutes(obs.zone, rise), eot = equationOfTime(rise), lonMin = obs.lon * 4 - zoneMin;
  const local = utcToZoned(obs.zone, rise);
  riseClock = (local.minutes - 720 + 1440) % 1440;
  const latNote = Math.abs(armillary.poleElevation - obs.lat) > 0.5
    ? ` Your sphere is set for ${latText(armillary.poleElevation)}, not ${placeName()}’s ${latText(obs.lat)}: that alone moves both readings.` : '';
  const foot = `By the clock (${obs.zoneLabel}) it rises at ${hhmm(local.minutes)}. Sundial time differs by ${signedMin(eot + lonMin)}: `
    + `${signedMin(eot)} from the equation of time and ${signedMin(lonMin)} from where ${placeName()} lies in its time zone. `
    + `A real star shows a few minutes earlier, lifted by refraction; this sky, like the sphere, has none.${latNote}`;
  check.show(displayName(target), [
    { quantity: 'Hour it rises (sundial)', yours: hh * 60 + mm, truth: solar, circular: true, period: 1440, format: fmtMin, formatError: signedMin },
    { quantity: 'Where it rises', yours: yoursAmp, truth: amp.signed, format: fmtAmp },
  ], {
    fine: 6, close: 20,
    fineText: 'Excellent: within the quarter-hour divisions of the hour circle.',
    closeText: 'Close. Is the gold ring exactly on the horizon, and the pole raised to the right latitude?',
    farText: 'Quite far off. Check the latitude on the meridian, and that the star is rising in the east, not setting in the west.',
  }, foot);
  showRise.hidden = false;
}

// ---- the sky ----
const sSky = shell.section('The sky');
const exact = h('div', { class: 'exact' });
const cheat = checkbox('Show exact instrument readings');
sSky.append(observerControls(obs), cheat.el, exact);

// ---- views ----
stage.setHomeView(() => {
  const c = armillary.centre(), az = (obs.lat >= 0 ? 215 : 325) * D2R, d = stage.fitDistance(0.34) * 0.92;
  const dir = new THREE.Vector3(-Math.sin(az), 0.55, Math.cos(az)).normalize();
  return { position: c.clone().addScaledVector(dir, d), target: c.clone().add(new THREE.Vector3(0, 0.02, 0)) };
});

// Looking out from the Earth at the centre: the rings lie along their circles in the sky.
const view = { az: 90, alt: 10 };
const earthView: SightHooks = {
  eye: out => armillary.centre(out),
  aim: out => out.set(...directionFromHorizontal(view.alt, view.az)),
  nudge: (right, up) => {
    view.az = wrap360(view.az + right / Math.max(0.2, Math.cos(view.alt * D2R)));
    view.alt = Math.max(-60, Math.min(89, view.alt + up));
  },
  fov: 12,
  wideBack: 0,
};
function enterEarthView(): void {
  armillary.pose();
  const d = armillary.starDirection(), p = horizontalFromDirection(d.x, d.y, d.z);
  view.az = p.az; view.alt = Math.max(5, p.alt);
  stage.enterSight(earthView);
}
stage.onSightChange(on => {
  sightBtn.textContent = on ? 'Step back' : 'Look out from the Earth';
  armillary.earth.visible = !on;
  armillary.thread.visible = !on && target !== null;
  shell.showSight(on, { exit: () => stage.exitSight(), zoom: d => stage.zoomSight(d) });
});
// Outside the Earth view the arrow keys work the sphere: ← → turn it, ↑ ↓ raise and lower the pole.
stage.setAimHooks({
  eye: out => armillary.centre(out),
  aim: out => out.set(0, 0, 1),
  nudge: (right, up) => {
    if (up) setPole(armillary.poleElevation + up);
    if (right) obs.setMinutes(Math.max(0, Math.min(1440, obs.minutes + right * 4)));
  },
});

// ---- updates ----
let listKey = '';
function updateSky(): void {
  stage.updateSky(obs);
  armillary.setSky(obs.lst, sunLongitude(obs.utc));
  turnS.set(obs.minutes);
  latHint.textContent = `Slide the meridian round in its notches until the horizon cuts it at ${placeName()}’s latitude, ${latText(obs.lat)}. `
    + `Read the meridian’s numbers just above the horizon, counted from the raised ${obs.lat >= 0 ? 'north' : 'south'} pole. Arrow keys ↑ ↓ also move it.`;
  zoomNotch.textContent = `Zoom to the ${obs.lat >= 0 ? 'north' : 'south'} notch`;
  const key = `${obs.lat}|${obs.date}`;
  if (key !== listKey) { listKey = key; refreshTargets(); }
}
obs.onChange(updateSky);
updateSky();
stage.goHome(0);

const sd = V();
stage.onFrame(dt => {
  if (running) {
    const m = obs.minutes + dt * RUN_RATE;
    obs.setMinutes(m >= 1440 ? 0 : m);
  }
  armillary.pose();
  const pole = armillary.poleElevation, lat = obs.lat;
  const off = pole - lat;
  poleStatus.classList.toggle('on', Math.abs(off) < 0.15);
  poleStatus.textContent = Math.abs(off) < 0.15 ? `Set for ${latText(lat)}.`
    : `Not yet: ${off > 0 ? 'lower' : 'raise'} the ${lat >= 0 ? 'north' : 'south'} pole${Math.abs(off) < 2 ? ' a little' : ''}.`;
  if (target) {
    armillary.starDirection(sd);
    const p = horizontalFromDirection(sd.x, sd.y, sd.z), east = p.az < 180, name = displayName(target);
    const on = Math.abs(p.alt) < 0.3;
    starStatus.classList.toggle('on', on && east);
    starStatus.textContent = on
      ? (east ? `On the sphere, ${name} is on the horizon, rising. Read the horizon and the hour circle.` : `On the sphere, ${name} is on the horizon, setting in the west.`)
      : p.alt > 0 ? `On the sphere, ${name} is above the horizon${east ? ', climbing in the east' : ', going down in the west'}.`
        : `On the sphere, ${name} is below the horizon${east ? ', about to rise in the east' : ''}.`;
    if (cheat.input.checked) {
      const a = armillary.readAmplitude(sd);
      exact.textContent = `Meridian at the notch reads ${armillary.readLatitude().toFixed(2)}° · hour index ${fmtMin(armillary.readHour() * 60)} · `
        + `toward the star the horizon reads ${a.deg.toFixed(2)}° ${a.ns} of ${a.ew} · star ${p.alt.toFixed(2)}° above the sphere’s horizon`;
    }
  }
  if (!cheat.input.checked) exact.textContent = '';
});
stage.start();

// Development aid: inspect the live scene from the browser console.
if (import.meta.env.DEV) Object.assign(window, { __instrument: { stage, armillary, obs } });
