// The night sky: gradient dome, dark ground with a hill line, every catalogue
// star at its computed position, and HTML labels for the bright named stars.
// Optionally the moon, as seen from the observer's place, lit by the sun.
import * as THREE from 'three';
import { D2R, directionFromHorizontal, horizontalFromEquatorial } from '../core/astro';
import { displayName, equatorialOfDate, NAMED_BRIGHT, STARS, starColour, type Star, type StarPlace } from '../core/catalogue';
import { moonSemidiameter, moonTopocentric, type MoonPlace } from '../core/moon';
import type { Observer } from '../core/observer';
import { sunEquatorial } from '../core/sun';

export const SKY_RADIUS = 2000;

export interface SeaOptions {
  /** Height of the water surface in the scene, m. */
  surfaceY: number;
  /** Radius of the sea disc: its edge is the visible horizon, m (inside the sky dome). */
  radius: number;
}

export interface SkyOptions {
  /** Replace the land and hills with open sea out to a sharp horizon. */
  sea?: SeaOptions;
  /** Named stars at least this bright get a label (the target is always labelled). */
  labelMag?: number;
  /** Element that holds the floating labels. */
  labelLayer?: HTMLElement;
  /** Show the moon. */
  moon?: boolean;
}

/** The moon's place for the observer: topocentric equatorial and ecliptic coordinates, altitude and azimuth. */
export type MoonSkyPlace = MoonPlace & StarPlace;

/** Distance at which the moon is drawn, inside the dome and in front of the stars. */
const MOON_DRAW = SKY_RADIUS * 0.95;

const MOON_VERT = /* glsl */ `
  varying vec3 vN; void main(){ vN = normalize((modelMatrix * vec4(normal, 0.)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const MOON_FRAG = /* glsl */ `
  uniform vec3 uSun; varying vec3 vN;
  void main(){ float lit = smoothstep(-.03, .08, dot(normalize(vN), uSun));
    gl_FragColor = vec4(mix(vec3(.035, .04, .05), vec3(.95, .92, .84), lit), 1.); }`;

const STAR_VERT = /* glsl */ `
  attribute float size; attribute vec3 color; uniform float uScale; varying vec3 vC;
  void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_PointSize = size * uScale; }`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vC;
  void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); a = a * a;
    gl_FragColor = vec4(vC * (.6 + 1.4 * a), a); }`;

export const magnitudeSize = (m: number): number => Math.max(1.2, 7.5 - m * 1.25);

export class Sky {
  readonly group = new THREE.Group();
  readonly points: THREE.Points;
  private readonly mat: THREE.ShaderMaterial;
  /** Current place of every star, indexed like STARS. */
  readonly places: StarPlace[] = STARS.map(() => ({ ra: 0, dec: 0, alt: -90, az: 0 }));
  private eqCacheKey = '';
  private eq: { ra: Float64Array; dec: Float64Array } = { ra: new Float64Array(0), dec: new Float64Array(0) };
  private labels: { star: Star; el: HTMLElement }[] = [];
  private target: Star | null = null;
  private readonly tmp = new THREE.Vector3();
  private occluders: THREE.Object3D[] = [];
  private readonly ray = new THREE.Raycaster();
  private readonly dir = new THREE.Vector3();
  private occluded = new Set<Star>();
  /** Hide labels of stars behind the occluders (off in the sight view, where the sights are always in front). */
  occlusion = true;
  private frameNo = 0;
  /** The moon (when the sky has one) and its current place. */
  readonly moon: THREE.Mesh | null = null;
  moonPlace: MoonSkyPlace | null = null;
  private moonLabel: HTMLElement | null = null;

  constructor(private readonly opts: SkyOptions = {}) {
    if (opts.sea) this.group.add(makeDome(), makeSea(opts.sea));
    else this.group.add(makeDome(), makeGround(), makeHills());

    const n = STARS.length, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
    const col = new Float32Array(n * 3);
    STARS.forEach((s, i) => col.set(starColour(s.bv), i * 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uScale: { value: 1 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    if (opts.moon) {
      this.moon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({
        uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) } }, vertexShader: MOON_VERT, fragmentShader: MOON_FRAG,
      }));
      this.group.add(this.moon);
    }
    this.buildLabels();
  }

  /** Multiplies every star's point size (device pixel ratio, sight-mode zoom). */
  setPointScale(k: number): void { this.mat.uniforms.uScale.value = k; }

  /** Recompute every star's altitude and azimuth for the observer's instant. */
  update(obs: Observer): void {
    const utc = obs.utc;
    const key = utc.toISOString().slice(0, 10);
    if (key !== this.eqCacheKey) { this.eq = equatorialOfDate(utc); this.eqCacheKey = key; }
    const lst = obs.lst, lat = obs.lat;
    const P = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const S = this.points.geometry.attributes.size as THREE.BufferAttribute;
    STARS.forEach((s, i) => {
      const h = horizontalFromEquatorial(this.eq.ra[i], this.eq.dec[i], lst, lat);
      const pl = this.places[i];
      pl.ra = this.eq.ra[i]; pl.dec = this.eq.dec[i]; pl.alt = h.alt; pl.az = h.az;
      const [x, y, z] = directionFromHorizontal(h.alt, h.az);
      P.setXYZ(i, x * SKY_RADIUS, y * SKY_RADIUS, z * SKY_RADIUS);
      S.setX(i, h.alt < 0 ? 0 : magnitudeSize(s.mag) * (h.alt < 3 ? h.alt / 3 : 1));
    });
    P.needsUpdate = true; S.needsUpdate = true;
    if (this.moon) this.updateMoon(utc, lst, lat);
  }

  private updateMoon(utc: Date, lst: number, lat: number): void {
    const m = moonTopocentric(utc, lat, lst), h = horizontalFromEquatorial(m.ra, m.dec, lst, lat);
    this.moonPlace = { ...m, alt: h.alt, az: h.az };
    const moon = this.moon!;
    moon.position.set(...directionFromHorizontal(h.alt, h.az)).multiplyScalar(MOON_DRAW);
    moon.scale.setScalar(MOON_DRAW * Math.tan(moonSemidiameter(m.dist) * D2R));
    const s = sunEquatorial(utc), hs = horizontalFromEquatorial(s.ra, s.dec, lst, lat);
    // The sun is so far off that its direction from the moon is its direction from here.
    ((moon.material as THREE.ShaderMaterial).uniforms.uSun.value as THREE.Vector3).set(...directionFromHorizontal(hs.alt, hs.az));
  }

  placeOf(s: Star): StarPlace { return this.places[s.id]; }

  /** Named bright stars above `minAlt`, brightest first. */
  visibleNamed(minAlt = 6): Star[] {
    return NAMED_BRIGHT.filter(s => this.places[s.id].alt > minAlt).sort((a, b) => a.mag - b.mag);
  }

  setTarget(s: Star | null): void {
    this.target = s;
    this.buildLabels();
  }

  private buildLabels(): void {
    const layer = this.opts.labelLayer;
    if (!layer) return;
    layer.replaceChildren();
    const labelMag = this.opts.labelMag ?? 2.0;
    const stars = NAMED_BRIGHT.filter(s => s.mag <= labelMag || s === this.target);
    this.labels = stars.map(star => {
      const el = document.createElement('div');
      el.className = 'slabel' + (star === this.target ? ' target' : '');
      el.textContent = displayName(star);
      layer.appendChild(el);
      return { star, el };
    });
    if (this.moon) {
      this.moonLabel = document.createElement('div');
      this.moonLabel.className = 'slabel moon';
      this.moonLabel.textContent = 'Moon';
      layer.appendChild(this.moonLabel);
    }
  }

  /** Objects (the instrument) that hide the labels of stars behind them. */
  setOccluders(objs: THREE.Object3D[]): void { this.occluders = objs; }

  /** Move the HTML labels to follow their stars on screen. */
  positionLabels(camera: THREE.Camera, width: number, height: number): void {
    // Occlusion is re-tested every few frames; it changes slowly.
    const testOcclusion = this.occlusion && this.occluders.length > 0 && this.frameNo++ % 6 === 0;
    if (!this.occlusion) this.occluded.clear();
    for (const { star, el } of this.labels) {
      const pl = this.places[star.id];
      if (pl.alt < 1) { el.style.display = 'none'; continue; }
      const [x, y, z] = directionFromHorizontal(pl.alt, pl.az);
      if (testOcclusion) {
        this.ray.set(camera.position, this.dir.set(x, y, z).multiplyScalar(SKY_RADIUS).sub(camera.position).normalize());
        if (this.ray.intersectObjects(this.occluders, true).length) this.occluded.add(star); else this.occluded.delete(star);
      }
      if (this.occluded.has(star)) { el.style.display = 'none'; continue; }
      const p = this.tmp.set(x, y, z).multiplyScalar(SKY_RADIUS).project(camera);
      if (p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = `${((p.x + 1) / 2) * width}px`;
      el.style.top = `${((1 - p.y) / 2) * height}px`;
    }
    const ml = this.moonLabel, mp = this.moonPlace;
    if (ml && mp) {
      const p = this.tmp.set(...directionFromHorizontal(mp.alt, mp.az)).multiplyScalar(SKY_RADIUS).project(camera);
      const show = mp.alt > 1 && p.z <= 1 && Math.abs(p.x) <= 1.1 && Math.abs(p.y) <= 1.1 && this.occlusion;
      ml.style.display = show ? 'block' : 'none';
      if (show) {
        // Below the disc, so the label never covers it.
        const r = (Math.tan(moonSemidiameter(mp.dist) * D2R) / Math.tan(((camera as THREE.PerspectiveCamera).fov ?? 50) * D2R / 2)) * height / 2;
        ml.style.left = `${((p.x + 1) / 2) * width}px`;
        ml.style.top = `${((1 - p.y) / 2) * height + r + 8}px`;
      }
    }
  }
}

function makeDome(): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 1.4, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ float h = clamp(vP.y, 0., 1.);
      vec3 c = mix(vec3(.075, .10, .18), vec3(.008, .012, .03), pow(h, .45)); if (vP.y < 0.) c = vec3(.01, .012, .016);
      gl_FragColor = vec4(c, 1.); }`,
  }));
}

/** Night sea: dark water with a little sheen, whose edge makes the horizon line. */
function makeSea(o: SeaOptions): THREE.Mesh {
  const sea = new THREE.Mesh(new THREE.CircleGeometry(o.radius, 512),
    new THREE.MeshStandardMaterial({ color: 0x02050a, roughness: 0.3, metalness: 0, envMapIntensity: 0.12 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = o.surfaceY;
  return sea;
}

function makeGround(): THREE.Mesh {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(SKY_RADIUS * 1.35, 64),
    new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  return ground;
}

/** A low, irregular hill line on the horizon (at most ~1.4° high). */
function makeHills(): THREE.Mesh {
  const n = 256, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, r = SKY_RADIUS * 0.9;
    const h = (Math.sin(a * 3) * 0.5 + Math.sin(a * 7 + 1) * 0.3 + Math.sin(a * 17 + 2) * 0.2 + 1) * 0.012 * r + 2;
    pos.push(Math.cos(a) * r, -1, Math.sin(a) * r, Math.cos(a) * r, h, Math.sin(a) * r);
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.DoubleSide }));
}
