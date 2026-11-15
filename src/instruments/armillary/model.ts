// Armillary sphere: the great and lesser circles of the heavens as brass rings
// round a small Earth.
//
// Fixed: the horizon ring, carried by the stand, and the meridian ring, which
// slides round in notches of the horizon to raise the pole to the latitude.
// Turning inside the meridian on the polar axis: the equator, the two tropics,
// the arctic and antarctic circles, the two colures and the broad zodiac band
// with the sun on it. An hour circle on the meridian round the north pole, with
// an index on the axis, tells the time as the sphere turns.
//
// World frame (shared by every scene): north = +Z, east = −X, up = +Y.
// In `meridianFrame` the north celestial pole is +Y; the equator's highest
// point (hour angle 0) is −Z and hour angle 90° (the west point) is +X.
// `sphere` turns about that +Y by −LST, so a point at right ascension α,
// declination δ sits at hour angle LST − α, as in the sky.
import * as THREE from 'three';
import { D2R } from '../../core/astro';
import { eclipticToEquatorial } from '../../core/sun';
import { canvasTexture } from '../../three/engrave';
import { brass, darkBrass, engravedBrass, steel, wood } from '../../three/materials';
import { uvAtLocalPoint, uvToCanvas } from '../../three/uv';
import {
  amplitudeOf, DIAL_INNER, DIAL_TEX, DIAL_TIP, dialHoursAt, drawDial, drawEquator, drawHorizon, drawMeridian, drawZodiac,
  EQUATOR_TEX, HORIZON_INNER, HORIZON_TEX, horizonAzimuthAt, MERIDIAN_INNER, MERIDIAN_TEX, meridianAlphaAt, meridianValue, ZODIAC_TEX,
} from './drawings';

/** Height of the sphere's centre above the ground, m. */
export const CENTER_Y = 1.2;
/** Radius of the turning rings, m. */
export const R = 0.24;
const ZODIAC_R = R + 0.002;
const MARK_R = R + 0.007;
const MER_OUT = R + 0.03, MER_IN = MER_OUT * MERIDIAN_INNER, MER_T = 0.004;
const HOR_OUT = R + 0.09, HOR_IN = HOR_OUT * HORIZON_INNER, HOR_T = 0.006;
const DIAL_OUT = 0.042, DIAL_IN = DIAL_OUT * DIAL_INNER, DIAL_Y = MER_OUT + 0.006;
/** Radius fractions at which scales are read: on the ticks. */
const READ_HORIZON = 0.85, READ_MERIDIAN = 0.95;

const V = () => new THREE.Vector3();

/** Unit vector of right ascension `ra`, declination `dec` in the sphere's frame. */
export function equatorialVector(ra: number, dec: number, out = V()): THREE.Vector3 {
  const a = ra * D2R, d = dec * D2R;
  return out.set(-Math.cos(d) * Math.sin(a), Math.sin(d), -Math.cos(d) * Math.cos(a));
}

/**
 * A band on the sphere: the circle round axis U×V, `offset` along that axis,
 * `halfWidth` either side. u runs 0→1 from U toward V; v = 1 on the side the
 * axis points to. Faces point outward.
 */
function bandGeometry(U: THREE.Vector3, Vv: THREE.Vector3, offset: number, radius: number, halfWidth: number, seg = 360): THREE.BufferGeometry {
  const A = V().crossVectors(U, Vv).normalize();
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = V(), r = V();
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    r.copy(U).multiplyScalar(Math.cos(t)).addScaledVector(Vv, Math.sin(t));
    for (const s of [-1, 1]) {
      p.copy(A).multiplyScalar(offset + s * halfWidth).addScaledVector(r, radius);
      pos.push(p.x, p.y, p.z); uv.push(i / seg, s < 0 ? 0 : 1);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = 2 * i, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const backBrass = darkBrass.clone(); backBrass.side = THREE.BackSide;

/** A band: engraved (or plain) outside, plain brass inside. */
function band(geo: THREE.BufferGeometry, outside: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, outside), new THREE.Mesh(geo, backBrass));
  return g;
}

/** A flat ring with some thickness, in its XY plane. */
function annulus(rIn: number, rOut: number, depth: number, mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 160 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 16), mat);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V().subVectors(b, a).normalize());
  return m;
}

export interface StarOnSphere { ra: number; dec: number }

export class ArmillaryModel {
  /** At the centre of the sphere; holds the fixed parts. */
  readonly root = new THREE.Group();
  readonly meridianFrame = new THREE.Group();
  readonly sphere = new THREE.Group();
  readonly horizonFace: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
  readonly meridianFaces: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>; m: 1 | -1 }[] = [];
  readonly dial: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
  readonly pointer = new THREE.Group();
  readonly pointerTip = new THREE.Object3D();
  readonly earth: THREE.Mesh;
  readonly sun: THREE.Mesh;
  readonly marker: THREE.Mesh;
  readonly thread: THREE.Line;

  /** Elevation of the north celestial pole above the horizon, degrees (negative: the south pole is raised). */
  poleElevation = 41.9;
  /** Local sidereal time the sphere is turned to, degrees. */
  lst = 0;
  /** The sun's ecliptic longitude, degrees. */
  sunLon = 0;
  star: StarOnSphere | null = null;

  constructor(readonly eps = 23.44) {
    this.root.position.set(0, CENTER_Y, 0);
    this.root.add(this.meridianFrame);
    this.meridianFrame.add(this.sphere);

    // ---- fixed: horizon ring and stand ----
    const hBody = annulus(HOR_IN, HOR_OUT, HOR_T, brass);
    hBody.rotation.x = -Math.PI / 2; hBody.position.y = -HOR_T / 2; this.root.add(hBody);
    this.horizonFace = new THREE.Mesh(new THREE.RingGeometry(HOR_IN, HOR_OUT, 360, 1),
      engravedBrass(canvasTexture(HORIZON_TEX, drawHorizon), { metalness: 0.55, roughness: 0.45 }));
    this.horizonFace.rotation.x = -Math.PI / 2; this.horizonFace.position.y = 0.0002;
    this.root.add(this.horizonFace);
    // Notches in the horizon where the meridian passes, north and south.
    for (const z of [-1, 1]) for (const x of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.014), darkBrass);
      cheek.position.set(x * (MER_T / 2 + 0.002), -0.004, z * (HOR_IN + 0.002)); this.root.add(cheek);
    }
    // Stand: a turned wooden foot, a brass pillar to a cradle under the meridian, and four
    // stays up to the horizon.
    const groundY = -CENTER_Y;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 48), wood);
    foot.position.y = groundY + 0.025; this.root.add(foot);
    const footTop = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.06, 40), wood);
    footTop.position.y = groundY + 0.08; this.root.add(footTop);
    const cradleY = -MER_OUT - 0.008;
    this.root.add(rod(new THREE.Vector3(0, groundY + 0.1, 0), new THREE.Vector3(0, cradleY - 0.008, 0), 0.02, brass));
    const knop = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 16), brass);
    knop.position.y = -0.6; this.root.add(knop);
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, 0.05), brass);
    cradle.position.y = cradleY; this.root.add(cradle);
    for (const x of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.03), darkBrass);
      c.position.set(x * (MER_T / 2 + 0.002), cradleY + 0.012, 0); this.root.add(c);
    }
    for (const az of [45, 135, 225, 315]) {
      const a = az * D2R, rr = HOR_OUT - 0.012;
      this.root.add(rod(new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(-Math.sin(a) * rr, -HOR_T, Math.cos(a) * rr), 0.006, brass));
    }
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 16), new THREE.MeshStandardMaterial({ color: 0x4f6f7d, roughness: 0.75, metalness: 0.1 }));
    this.root.add(this.earth);

    // ---- meridian ring and the hour circle ----
    const mBody = annulus(MER_IN, MER_OUT, MER_T, brass);
    mBody.rotation.y = Math.PI / 2; this.meridianFrame.add(mBody);
    for (const m of [1, -1] as const) {
      const face = new THREE.Mesh(new THREE.RingGeometry(MER_IN, MER_OUT, 360, 1),
        engravedBrass(canvasTexture(MERIDIAN_TEX, (g, S) => drawMeridian(g, S, m)), { metalness: 0.55, roughness: 0.45 }));
      face.rotation.y = (m * Math.PI) / 2; face.position.x = m * (MER_T / 2 + 0.0002);
      this.meridianFrame.add(face);
      this.meridianFaces.push({ mesh: face, m });
    }
    const dBody = annulus(DIAL_IN, DIAL_OUT, 0.002, brass);
    dBody.rotation.x = -Math.PI / 2; dBody.position.y = DIAL_Y - 0.001; this.meridianFrame.add(dBody);
    this.dial = new THREE.Mesh(new THREE.RingGeometry(DIAL_IN, DIAL_OUT, 192, 1),
      engravedBrass(canvasTexture(DIAL_TEX, drawDial), { metalness: 0.55, roughness: 0.45 }));
    this.dial.rotation.x = -Math.PI / 2; this.dial.position.y = DIAL_Y + 0.0002;
    this.meridianFrame.add(this.dial);
    // The dial is held off the meridian by a post on its north side.
    const post = new THREE.Mesh(new THREE.BoxGeometry(MER_T, DIAL_Y - MER_OUT + 0.004, 0.006), darkBrass);
    post.position.set(0, (DIAL_Y + MER_OUT) / 2 - 0.002, DIAL_OUT - 0.003); this.meridianFrame.add(post);

    // ---- the turning sphere ----
    const eq = equatorialVector;
    const U = eq(0, 0), E90 = eq(90, 0), ecl90 = eq(90, eps);
    const eqTex = engravedBrass(canvasTexture(EQUATOR_TEX[0], drawEquator, EQUATOR_TEX[1]), { metalness: 0.6, roughness: 0.4 });
    this.sphere.add(band(bandGeometry(U, E90, 0, R, 0.009), eqTex));
    const zodTex = engravedBrass(canvasTexture(ZODIAC_TEX[0], drawZodiac, ZODIAC_TEX[1]), { metalness: 0.6, roughness: 0.4 });
    this.sphere.add(band(bandGeometry(U, ecl90, 0, ZODIAC_R, 0.02), zodTex));
    for (const dec of [eps, -eps, 90 - eps, eps - 90]) {
      this.sphere.add(band(bandGeometry(U, E90, R * Math.sin(dec * D2R), R * Math.cos(dec * D2R), 0.004, 180), brass));
    }
    // Colures: the great circles through the poles and the equinoxes, and through the solstices.
    const equinoctial = annulus(R - 0.006, R - 0.0005, 0.0025, brass);
    equinoctial.rotation.y = Math.PI / 2; this.sphere.add(equinoctial);
    this.sphere.add(annulus(R - 0.006, R - 0.0005, 0.0025, brass));
    // The axis, with the hour index on its northern end.
    this.sphere.add(rod(new THREE.Vector3(0, -MER_OUT - 0.002, 0), new THREE.Vector3(0, DIAL_Y + 0.005, 0), 0.0022, steel));
    this.sphere.add(this.pointer);
    const len = DIAL_TIP * DIAL_OUT + 0.003;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0012, len), steel);
    blade.position.set(0, DIAL_Y + 0.0022, -len / 2); this.pointer.add(blade);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 20), steel);
    hub.position.y = DIAL_Y + 0.002; this.pointer.add(hub);
    this.pointerTip.position.set(0, DIAL_Y + 0.0002, -DIAL_TIP * DIAL_OUT); this.pointer.add(this.pointerTip);

    // The sun on the zodiac.
    this.sun = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.0025, 24),
      new THREE.MeshStandardMaterial({ color: 0xf2c25a, emissive: 0x7a4a08, metalness: 0.7, roughness: 0.3 }));
    this.sphere.add(this.sun);

    // The chosen star: a gold ring, drawn over everything, and a thread to it from the Earth.
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0014, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, depthTest: false, transparent: true }));
    this.marker.renderOrder = 10;
    const tg = new THREE.BufferGeometry().setFromPoints([V(), V()]);
    this.thread = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6 }));
    this.sphere.add(this.marker, this.thread);

    this.setPole(this.poleElevation);
    this.setSky(0, 0);
    this.setStar(null);
  }

  setPole(e: number): void {
    this.poleElevation = Math.max(-90, Math.min(90, e));
    this.meridianFrame.rotation.x = (90 - this.poleElevation) * D2R;
  }

  /** Turn the sphere to a sidereal time and put the sun at its place on the zodiac. */
  setSky(lst: number, sunLon: number): void {
    this.lst = lst; this.sunLon = sunLon;
    this.sphere.rotation.y = -lst * D2R;
    const l = sunLon * D2R, U = equatorialVector(0, 0), Vv = equatorialVector(90, this.eps);
    const dir = U.multiplyScalar(Math.cos(l)).addScaledVector(Vv, Math.sin(l));
    this.sun.position.copy(dir).multiplyScalar(ZODIAC_R + 0.0013);
    this.sun.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    // The index was set to XII with the sun on the meridian: it follows the sun's hour angle.
    this.pointer.rotation.y = this.sunRA() * D2R;
  }

  /** The sun's right ascension, from its place on the zodiac. */
  sunRA(): number { return eclipticToEquatorial(this.sunLon, this.eps).ra; }

  setStar(s: StarOnSphere | null): void {
    this.star = s;
    this.marker.visible = this.thread.visible = s !== null;
    if (!s) return;
    const dir = equatorialVector(s.ra, s.dec);
    this.marker.position.copy(dir).multiplyScalar(MARK_R);
    this.marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const P = this.thread.geometry.attributes.position as THREE.BufferAttribute;
    P.setXYZ(1, dir.x * (MARK_R - 0.009), dir.y * (MARK_R - 0.009), dir.z * (MARK_R - 0.009));
    P.needsUpdate = true;
    this.thread.geometry.computeBoundingSphere();
  }

  pose(): void { this.root.updateMatrixWorld(true); }

  centre(out = V()): THREE.Vector3 { return this.root.getWorldPosition(out); }

  /** World direction from the Earth at the centre to the chosen star's place on the sphere. */
  starDirection(out = V()): THREE.Vector3 {
    return this.marker.getWorldPosition(out).sub(this.centre(V())).normalize();
  }
  /** World direction from the centre to the sun on the zodiac. */
  sunDirection(out = V()): THREE.Vector3 {
    return this.sun.getWorldPosition(out).sub(this.centre(V())).normalize();
  }

  /** Point on the horizon's degree scale in the direction of `dir` (world). */
  horizonPointToward(dir: THREE.Vector3, out = V()): THREE.Vector3 {
    const h = V().set(dir.x, 0, dir.z).normalize().multiplyScalar(READ_HORIZON * HOR_OUT);
    return out.copy(this.centre(V())).add(h);
  }

  /** Azimuth engraved on the horizon in the direction of `dir`, read through its texture. */
  readHorizon(dir: THREE.Vector3): number {
    const p = this.horizonFace.worldToLocal(this.horizonPointToward(dir));
    p.z = 0;
    const uv = uvAtLocalPoint(this.horizonFace.geometry, p);
    return uv ? horizonAzimuthAt(...uvToCanvas(uv, HORIZON_TEX)) : NaN;
  }
  /** The same, as the horizon is engraved: degrees north or south of east or west. */
  readAmplitude(dir: THREE.Vector3): ReturnType<typeof amplitudeOf> { return amplitudeOf(this.readHorizon(dir)); }

  /** Where the horizon cuts the meridian under the raised pole (north notch, or south for a raised south pole). */
  notchPoint(out = V()): THREE.Vector3 {
    const z = (this.poleElevation >= 0 ? 1 : -1) * READ_MERIDIAN * MER_OUT;
    return this.root.localToWorld(out.set(0, 0, z));
  }
  /** The number on the meridian at the notch: the elevation of the pole. */
  readLatitude(m: 1 | -1 = 1): number {
    const face = this.meridianFaces.find(f => f.m === m)!.mesh;
    const p = face.worldToLocal(this.notchPoint());
    p.z = 0;
    const uv = uvAtLocalPoint(face.geometry, p);
    return uv ? meridianValue(meridianAlphaAt(...uvToCanvas(uv, MERIDIAN_TEX), m)) : NaN;
  }

  /** Hour under the index on the hour circle, 0–24, read through its texture. */
  readHour(): number {
    const p = this.dial.worldToLocal(this.pointerTip.getWorldPosition(V()));
    p.z = 0;
    const uv = uvAtLocalPoint(this.dial.geometry, p);
    return uv ? dialHoursAt(...uvToCanvas(uv, DIAL_TEX)) : NaN;
  }
  dialPoint(out = V()): THREE.Vector3 { return this.dial.getWorldPosition(out); }
  /** World direction of the polar axis (toward the north pole). */
  poleDirection(out = V()): THREE.Vector3 { return out.set(0, 1, 0).transformDirection(this.meridianFrame.matrixWorld); }
}
