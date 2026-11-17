// The 3D stage every instrument page shares: renderer, camera, orbit controls,
// sky, night lighting, camera fly-to and the "look through the sights" mode.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Observer } from '../core/observer';
import { setMaxAnisotropy } from './engrave';
import { Highlighter } from './highlight';
import { addNightLights, applyEnvironment } from './materials';
import { Sky, type SkyOptions } from './sky';
import type { CameraPose } from './views';

export interface SightHooks {
  /** World position of the observer's eye right behind the near sight, on the line of sight. */
  eye(out: THREE.Vector3): THREE.Vector3;
  /** World direction the instrument is pointing. */
  aim(out: THREE.Vector3): THREE.Vector3;
  /**
   * Turn the instrument by small screen angles, in degrees: `right` across the
   * view, `up` toward the zenith. Called for drags and arrow keys.
   */
  nudge(right: number, up: number): void;
  /** Field of view with the eye at the sights (fully zoomed in), degrees. */
  fov?: number;
  /** Field of view when the sight view opens, fully zoomed out, degrees (default SIGHT_FOV_WIDE). */
  wideFov?: number;
  /** How far behind the near sight the eye starts in the wide view, m (default 0.3). */
  wideBack?: number;
  /** Extra drawing after the sight view is rendered (e.g. the sextant's mirror half). */
  afterRender?(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  /** ↑ ↓ move what is seen (e.g. the sextant's star image) rather than the aim: their sense is reversed. */
  keysMoveImage?: boolean;
}

/** Sight view: it opens wide, with the eye this far behind the near sight, and zooms in to the sights. */
export const SIGHT_FOV_WIDE = 40;
const SIGHT_BACK_WIDE = 0.3; // default; instruments may set SightHooks.wideBack
/** Each zoom step multiplies the field of view by this (or divides). */
const SIGHT_ZOOM_STEP = 0.7;

export interface StageOptions {
  container: HTMLElement;
  labelLayer?: HTMLElement;
  sky?: SkyOptions;
  cameraPosition: THREE.Vector3;
  cameraTarget: THREE.Vector3;
  minDistance?: number;
  maxDistance?: number;
  lanternAt?: THREE.Vector3;
}

export class WebGLUnavailableError extends Error {}

/** Lowest the orbiting camera may go, m above the ground. */
const MIN_CAMERA_Y = 0.2;
/** Arrow-key steps, degrees: normal and with Shift held. */
export const AIM_STEP = 0.5;
export const AIM_STEP_FINE = 0.02;
/** Dragging with Shift held moves the aim this much slower. */
const DRAG_FINE = 0.2;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 6000);
  readonly controls: OrbitControls;
  readonly sky: Sky;
  private readonly frameFns: ((dt: number) => void)[] = [];
  private readonly sightFns: ((on: boolean) => void)[] = [];
  private fly: { start: number; ms: number; p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; u0: THREE.Vector3; u1: THREE.Vector3 } | null = null;
  private sightHooks: SightHooks | null = null;
  private home = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  private readonly clock = new THREE.Clock();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly sph0 = new THREE.Spherical();
  private readonly sph1 = new THREE.Spherical();
  private width = 1;
  private height = 1;

  constructor(private readonly opts: StageOptions) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      throw new WebGLUnavailableError(String(e));
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    opts.container.appendChild(r.domElement);
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());

    this.scene.background = new THREE.Color(0x03050b);
    applyEnvironment(r, this.scene);
    addNightLights(this.scene, opts.lanternAt);

    this.camera.position.copy(opts.cameraPosition);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.copy(opts.cameraTarget);
    this.controls.enableDamping = true;
    // Allow looking up at the sky from below the orbit centre; the frame loop
    // keeps the camera above the ground.
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.minDistance = opts.minDistance ?? 0.6;
    this.controls.maxDistance = opts.maxDistance ?? 14;

    this.sky = new Sky({ labelLayer: opts.labelLayer, ...opts.sky });
    this.scene.add(this.sky.group);

    const resize = () => this.resize();
    addEventListener('resize', resize);
    new ResizeObserver(resize).observe(opts.container);
    this.resize();
    this.bindAiming();
  }

  get inSight(): boolean { return this.sightHooks !== null; }

  private readonly highlighter = new Highlighter();
  /** Light up parts of the instrument for a moment. */
  highlight(objects: THREE.Object3D[], ms?: number): void { this.highlighter.flash(objects, ms); }

  updateSky(obs: Observer): void { this.sky.update(obs); }

  onFrame(fn: (dt: number) => void): void { this.frameFns.push(fn); }
  onSightChange(fn: (on: boolean) => void): void { this.sightFns.push(fn); }

  /** The overall view of instrument and sky, given by the page (usually toward its target star). */
  setHomeView(fn: () => CameraPose): void { this.homeView = fn; }
  private homeView: (() => CameraPose) | null = null;

  /** Fly back to the home view; `ms` = 0 jumps there. */
  goHome(ms = 900): void {
    if (!this.homeView) return;
    const v = this.homeView();
    if (ms <= 0) {
      if (this.inSight) this.exitSight();
      this.fly = null;
      this.camera.position.copy(v.position);
      this.controls.target.copy(v.target);
      this.camera.up.set(0, 1, 0);
      this.controls.update();
    } else this.flyTo(v.position, v.target, ms);
  }

  /**
   * Glide the camera to look from `pos` at `target` (world coordinates). `up`
   * rolls the view, e.g. to read a scale that lies at an angle; any later
   * flight without it rolls back upright.
   */
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, ms = 900, up = new THREE.Vector3(0, 1, 0)): void {
    if (this.inSight) this.exitSight();
    this.fly = {
      start: performance.now(), ms, p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos.clone(), t1: target.clone(),
      u0: this.camera.up.clone(), u1: up.clone().normalize(),
    };
  }

  /**
   * Look along the instrument's line of sight. The view opens wide, from a step
   * behind the near sight, so both sights and the stars round them show; zoom
   * in (zoomSight) to bring the eye up to the sights.
   */
  enterSight(hooks: SightHooks): void {
    if (this.inSight) return;
    this.fly = null;
    this.home.pos.copy(this.camera.position);
    this.home.tgt.copy(this.controls.target);
    this.sightHooks = hooks;
    this.controls.enabled = false;
    this.camera.fov = hooks.wideFov ?? SIGHT_FOV_WIDE;
    this.applyProjection();
    this.updatePointScale();
    this.sightFns.forEach(f => f(true));
  }

  /** Zoom the sight view in (+1) or out (−1) by one step. */
  zoomSight(dir: 1 | -1): void {
    const h = this.sightHooks;
    if (!h) return;
    const narrow = h.fov ?? 9;
    const fov = this.camera.fov * (dir > 0 ? SIGHT_ZOOM_STEP : 1 / SIGHT_ZOOM_STEP);
    this.camera.fov = Math.min(h.wideFov ?? SIGHT_FOV_WIDE, Math.max(narrow, fov));
    this.applyProjection();
  }

  /** How far behind the near sight the eye is for the current zoom: at the sights when fully zoomed in. */
  private sightBack(): number {
    const narrow = this.sightHooks?.fov ?? 9;
    const wide = this.sightHooks?.wideFov ?? SIGHT_FOV_WIDE;
    const t = Math.max(0, Math.min(1, (this.camera.fov - narrow) / (wide - narrow)));
    return (this.sightHooks?.wideBack ?? SIGHT_BACK_WIDE) * t;
  }

  exitSight(): void {
    if (!this.inSight) return;
    this.sightHooks = null;
    this.controls.enabled = true;
    this.camera.fov = this.orbitFov();
    this.camera.position.copy(this.home.pos);
    this.controls.target.copy(this.home.tgt);
    this.camera.up.set(0, 1, 0);
    this.applyProjection();
    this.updatePointScale();
    this.sightFns.forEach(f => f(false));
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.frameFns.forEach(f => f(dt));
    this.highlighter.update();
    const h = this.sightHooks;
    if (h) {
      this.scene.updateMatrixWorld();
      const aim = h.aim(this.v2), eye = h.eye(this.v1).addScaledVector(aim, -this.sightBack());
      this.camera.position.copy(eye);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(eye.add(aim));
    } else {
      if (this.fly) {
        const f = this.fly, t = Math.min(1, (performance.now() - f.start) / f.ms), k = t * t * (3 - 2 * t);
        this.controls.target.lerpVectors(f.t0, f.t1, k);
        this.camera.up.lerpVectors(f.u0, f.u1, k);
        if (this.camera.up.lengthSq() < 1e-6) this.camera.up.copy(f.u1);
        this.camera.up.normalize();
        if (t >= 1) {
          this.camera.position.copy(f.p1);
          this.fly = null;
        } else {
          // Swing round the target (distance, elevation and the shorter way in azimuth) rather
          // than moving in a straight line, which passes through the target when the new view
          // faces the other way, and the orbit controls then fail.
          const a = this.sph0.setFromVector3(this.v1.subVectors(f.p0, f.t0));
          const b = this.sph1.setFromVector3(this.v2.subVectors(f.p1, f.t1));
          let dTheta = (b.theta - a.theta) % (2 * Math.PI);
          if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
          if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
          this.sph0.set(a.radius + (b.radius - a.radius) * k, a.phi + (b.phi - a.phi) * k, a.theta + dTheta * k);
          this.camera.position.setFromSpherical(this.sph0).add(this.controls.target);
        }
      }
      this.controls.update();
      if (this.camera.position.y < MIN_CAMERA_Y) this.camera.position.y = MIN_CAMERA_Y;
    }
    this.renderer.render(this.scene, this.camera);
    this.sky.occlusion = !this.inSight;
    this.sky.positionLabels(this.camera, this.width, this.height);
    if (h?.afterRender && this.sightHooks === h) h.afterRender(this.renderer, this.scene, this.camera);
  }

  private resize(): void {
    const el = this.opts.container;
    this.width = el.clientWidth || innerWidth;
    this.height = el.clientHeight || innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    if (!this.inSight) this.camera.fov = this.orbitFov();
    this.applyProjection();
    this.updatePointScale();
  }

  /**
   * Screen space covered by the panel (left on desktop, bottom on phones). The
   * view centre (and, in sight mode, the crosshair) moves into the free area.
   */
  setViewInset(left: number, bottom: number): void {
    this.inset = { left, bottom };
    this.applyProjection();
  }
  private inset = { left: 0, bottom: 0 };

  /**
   * Camera distance at which an object of `radius` fits in the part of the
   * view the panel leaves free (with a little margin).
   */
  fitDistance(radius: number, margin = 1.1): number {
    const t = Math.tan((this.orbitFov() * Math.PI) / 360);
    const freeH = (this.height - this.inset.bottom) / this.height, freeW = (this.width - this.inset.left) / this.width;
    const d = (radius * margin) / Math.min(t * freeH, t * (this.width / this.height) * freeW);
    // Before the page has a size (e.g. opened in a hidden tab) fall back to a plain framing.
    return Number.isFinite(d) && d > 0 ? d : radius * 3;
  }

  private applyProjection(): void {
    const { left, bottom } = this.inset;
    if (!left && !bottom) this.camera.clearViewOffset();
    else this.camera.setViewOffset(this.width, this.height, -left / 2, bottom / 2, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  /** 50° vertically, widened on portrait screens so the instrument still fits across. */
  private orbitFov(): number {
    const aspect = this.width / this.height;
    if (aspect >= 1) return 50;
    return Math.min(75, Math.max(50, 2 * Math.atan(Math.tan(22 * Math.PI / 180) / aspect) * 180 / Math.PI));
  }

  private updatePointScale(): void {
    this.sky.setPointScale(this.renderer.getPixelRatio() * (this.inSight ? 2 : 1));
  }

  /** Arrow keys always aim the active instrument; dragging aims while in sight mode. */
  private aimKeys: SightHooks | null = null;
  /** Hooks used by the arrow keys when not in sight mode. */
  setAimHooks(h: SightHooks): void { this.aimKeys = h; }

  private bindAiming(): void {
    addEventListener('keydown', e => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') {
        if (this.inSight) this.exitSight(); else this.goHome();
        e.preventDefault();
        return;
      }
      if (this.inSight && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_')) {
        this.zoomSight(e.key === '+' || e.key === '=' ? 1 : -1);
        e.preventDefault();
        return;
      }
      const h = this.sightHooks ?? this.aimKeys;
      if (!h) return;
      // In the sight view the normal step follows the zoom: coarse when wide, fine when close.
      const normal = this.inSight ? Math.min(2, Math.max(0.25, this.camera.fov / 20)) : AIM_STEP;
      const s = e.shiftKey ? AIM_STEP_FINE : normal;
      if (e.key === 'ArrowLeft') h.nudge(-s, 0);
      else if (e.key === 'ArrowRight') h.nudge(s, 0);
      else if (e.key === 'ArrowUp') h.nudge(0, h.keysMoveImage ? -s : s);
      else if (e.key === 'ArrowDown') h.nudge(0, h.keysMoveImage ? s : -s);
      else return;
      e.preventDefault();
    });
    const el = this.renderer.domElement;
    let drag: { x: number; y: number; id: number } | null = null;
    el.addEventListener('pointerdown', e => {
      if (!this.inSight) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id || !this.sightHooks) return;
      const k = (this.camera.fov / this.height) * (e.shiftKey ? DRAG_FINE : 1);
      // Grab-the-sky feel: dragging the view right turns the instrument left.
      this.sightHooks.nudge(-(e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    el.addEventListener('wheel', e => {
      if (!this.inSight) return;
      this.zoomSight(e.deltaY < 0 ? 1 : -1);
      e.preventDefault();
    }, { passive: false });
    const end = () => { drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}

