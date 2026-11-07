// The 3D stage every instrument page shares: renderer, camera, orbit controls,
// sky, night lighting, camera fly-to and the "look through the sights" mode.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Observer } from '../core/observer';
import { setMaxAnisotropy } from './engrave';
import { addNightLights, applyEnvironment } from './materials';
import { Sky, type SkyOptions } from './sky';

export interface SightHooks {
  /** World position of the observer's eye at the instrument. */
  eye(out: THREE.Vector3): THREE.Vector3;
  /** World direction the instrument is pointing. */
  aim(out: THREE.Vector3): THREE.Vector3;
  /**
   * Turn the instrument by small screen angles, in degrees: `right` across the
   * view, `up` toward the zenith. Called for drags and arrow keys.
   */
  nudge(right: number, up: number): void;
  /** Field of view in sight mode, degrees. */
  fov?: number;
}

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

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 6000);
  readonly controls: OrbitControls;
  readonly sky: Sky;
  private readonly frameFns: ((dt: number) => void)[] = [];
  private readonly sightFns: ((on: boolean) => void)[] = [];
  private fly: { start: number; ms: number; p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3 } | null = null;
  private sightHooks: SightHooks | null = null;
  private home = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  private readonly clock = new THREE.Clock();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
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
    this.controls.maxPolarAngle = Math.PI * 0.49;
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

  updateSky(obs: Observer): void { this.sky.update(obs); }

  onFrame(fn: (dt: number) => void): void { this.frameFns.push(fn); }
  onSightChange(fn: (on: boolean) => void): void { this.sightFns.push(fn); }

  /** Glide the camera to look from `pos` at `target` (world coordinates). */
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, ms = 900): void {
    if (this.inSight) this.exitSight();
    this.fly = { start: performance.now(), ms, p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos.clone(), t1: target.clone() };
  }

  enterSight(hooks: SightHooks): void {
    if (this.inSight) return;
    this.fly = null;
    this.home.pos.copy(this.camera.position);
    this.home.tgt.copy(this.controls.target);
    this.sightHooks = hooks;
    this.controls.enabled = false;
    this.camera.fov = hooks.fov ?? 9;
    this.applyProjection();
    this.updatePointScale();
    this.sightFns.forEach(f => f(true));
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
    const h = this.sightHooks;
    if (h) {
      this.scene.updateMatrixWorld();
      const eye = h.eye(this.v1), aim = h.aim(this.v2);
      this.camera.position.copy(eye);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(eye.add(aim));
    } else {
      if (this.fly) {
        const f = this.fly, t = Math.min(1, (performance.now() - f.start) / f.ms), k = t * t * (3 - 2 * t);
        this.camera.position.lerpVectors(f.p0, f.p1, k);
        this.controls.target.lerpVectors(f.t0, f.t1, k);
        if (t >= 1) this.fly = null;
      }
      this.controls.update();
    }
    this.renderer.render(this.scene, this.camera);
    this.sky.positionLabels(this.camera, this.width, this.height);
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
      if (e.key === 'Escape' && this.inSight) { this.exitSight(); e.preventDefault(); return; }
      const h = this.sightHooks ?? this.aimKeys;
      if (!h) return;
      const s = e.shiftKey ? 0.1 : 0.5;
      if (e.key === 'ArrowLeft') h.nudge(-s, 0);
      else if (e.key === 'ArrowRight') h.nudge(s, 0);
      else if (e.key === 'ArrowUp') h.nudge(0, s);
      else if (e.key === 'ArrowDown') h.nudge(0, -s);
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
      const k = this.camera.fov / this.height;
      // Grab-the-sky feel: dragging the view right turns the instrument left.
      this.sightHooks.nudge(-(e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = () => { drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}

