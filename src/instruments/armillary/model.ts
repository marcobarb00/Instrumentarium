// Ptolemy's armillary (Almagest V.1), the "astrolabon": rings for measuring a
// star's ecliptic longitude and latitude against a body whose longitude is known.
//
// Outermost to innermost:
// - Meridian ring: stands in the meridian, carried by the stand, and slides
//   round in its cradle to raise the pole to the latitude. It holds the axle of
// - the colure ring, turning on the poles of the equator, to which the
// - ecliptic ring is fixed at right angles, graduated in 360° of longitude.
//   The colure carries pegs at the poles of the ecliptic, on which turn
// - the outer ring (outside the pair), set to the known body's longitude, and
// - the inner ring (inside the pair), turned to the star; graduated in latitude.
// - Inside the inner ring slides the sighting ring with its two sights.
//
// World frame (shared by every scene): north = +Z, east = −X, up = +Y.
// `meridianFrame`: +Y is the north celestial pole, the equator's highest point is −Z.
// `sphere` turns about that +Y by `turn`; with turn = −LST it matches the sky:
// a point at right ascension α, declination δ is then at hour angle LST − α.
// `eclFrame`: +Y is the north pole of the ecliptic, −Z the vernal equinox
// (longitude 0) and −X longitude 90°; longitude λ, latitude β is at
// (−cos β sin λ, sin β, −cos β cos λ), the same form as `equatorialVector`.
// The outer and inner rings turn about eclFrame's +Y by their longitude and lie in
// their own x = 0 plane, their longitude end at −Z; the sighting ring turns about
// the inner ring's X by the latitude.
import * as THREE from 'three';
import { D2R, R2D, wrap180, wrap360 } from '../../core/astro';
import { canvasTexture } from '../../three/engrave';
import { brass, darkBrass, engravedBrass, steel, wood } from '../../three/materials';
import { uvAtLocalPoint, uvToCanvas } from '../../three/uv';
import {
  drawEcliptic, drawLatitude, drawMeridian, ECL_READ_INNER, ECL_READ_OUTER, eclipticLonAt, LAT_READ, latitudeAt,
  meridianValue, STRIP_W, stripHeight, stripThetaAt,
} from './drawings';

/** Height of the instrument's centre above the ground, m. */
export const CENTER_Y = 1.25;

// Ring radii (inner, outer) and thickness, m.
const R6_IN = 0.315, R6_OUT = 0.345, T6 = 0.008; // meridian
const R5_IN = 0.281, R5_OUT = 0.297, T5 = 0.008; // outer
const R3_IN = 0.237, R3_OUT = 0.272, T3 = 0.006; // ecliptic and colure
const R2_IN = 0.209, R2_OUT = 0.229, T2 = 0.008; // inner (latitude)
const R1_IN = 0.194, R1_OUT = 0.2065, T1 = 0.006; // sighting ring
const R1_MID = (R1_IN + R1_OUT) / 2;
/** The sights stand off the sighting ring's face, so the line of sight clears the inner ring. */
const SIGHT_X = T2 / 2 + 0.005;
const HOLE_R = 0.0012;
/** Distance from the centre of the chord along which the eye looks across the outer ring: just outside the ecliptic ring. */
const OUTER_CHORD = (R3_OUT + R5_IN) / 2;
/** Gap between a ring's face and the engraved texture laid on it. */
const FACE_GAP = 0.0002;
/** Where the scales are read, as radii. */
const READ_MERIDIAN = R6_IN + 0.9 * (R6_OUT - R6_IN);
const READ_ECL_INNER = R3_IN + ECL_READ_INNER * (R3_OUT - R3_IN);
const READ_ECL_OUTER = R3_IN + ECL_READ_OUTER * (R3_OUT - R3_IN);
const READ_LAT = R2_IN + LAT_READ * (R2_OUT - R2_IN);

const H_MER = stripHeight(R6_IN, R6_OUT), H_ECL = stripHeight(R3_IN, R3_OUT), H_LAT = stripHeight(R2_IN, R2_OUT);

const V = () => new THREE.Vector3();

/** Unit vector of right ascension `ra`, declination `dec` in the sphere's frame (or of λ, β in eclFrame). */
export function equatorialVector(ra: number, dec: number, out = V()): THREE.Vector3 {
  const a = ra * D2R, d = dec * D2R;
  return out.set(-Math.cos(d) * Math.sin(a), Math.sin(d), -Math.cos(d) * Math.cos(a));
}

/** Flat ring in the XY plane, facing +Z, its body centred on z = 0. */
function annulus(rIn: number, rOut: number, depth: number, mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 180 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}

/**
 * The engraved face of a ring: an annulus in the XY plane facing +Z, with the
 * strip UVs of drawings.ts (u = 1 − θ/360 round the ring, v = 0 inside to 1 outside).
 */
function faceGeometry(rIn: number, rOut: number, seg = 1440): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = (i / seg) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    for (const [r, v] of [[rIn, 0], [rOut, 1]]) { pos.push(r * c, r * s, 0); uv.push(1 - i / seg, v); nrm.push(0, 0, 1); }
  }
  for (let i = 0; i < seg; i++) {
    const a = 2 * i, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

type Face = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** A face lying on the ring of plane x = 0: on its +X side (side 1) or −X side (−1). */
function sideFace(geo: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial, thickness: number, side: 1 | -1): Face {
  const f = new THREE.Mesh(geo, mat);
  f.rotation.y = (side * Math.PI) / 2;
  f.position.x = side * (thickness / 2 + FACE_GAP);
  return f;
}

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 16), mat);
  m.position.addVectors(a, b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V().subVectors(b, a).normalize());
  return m;
}

/** A thin blade from radius r0 to r1 along −Z, at height y and offset x. */
function blade(r0: number, r1: number, x: number, y: number, w: number, hgt: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, Math.abs(r1 - r0)), mat);
  m.position.set(x, y, -(r0 + r1) / 2);
  return m;
}

/** A sight: a small square plate across the line of sight with a hole in it. */
function sightPlate(): THREE.Mesh {
  const s = new THREE.Shape(), a = 0.007;
  s.moveTo(-a, -a); s.lineTo(a, -a); s.lineTo(a, a); s.lineTo(-a, a); s.lineTo(-a, -a);
  const hole = new THREE.Path(); hole.absarc(0, 0, HOLE_R, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.0015, bevelEnabled: false, curveSegments: 32 });
  g.translate(0, 0, -0.00075);
  return new THREE.Mesh(g, darkBrass);
}

/** Read a strip face at a world point: the face angle θ under it, or NaN off the face. */
function faceTheta(face: Face, world: THREE.Vector3, H: number): number {
  const p = face.worldToLocal(world.clone());
  p.z = 0;
  const uv = uvAtLocalPoint(face.geometry, p);
  return uv ? stripThetaAt(uvToCanvas(uv, STRIP_W, H)[0], STRIP_W) : NaN;
}

export class PtolemyArmillary {
  readonly root = new THREE.Group();
  readonly meridianFrame = new THREE.Group();
  readonly sphere = new THREE.Group();
  readonly eclFrame = new THREE.Group();
  readonly outer = new THREE.Group();
  readonly inner = new THREE.Group();
  readonly sighting = new THREE.Group();
  readonly meridianFaces: Face[] = [];
  readonly eclipticFaces: { mesh: Face; face: 1 | -1 }[] = [];
  readonly latitudeFaces: Face[] = [];
  /** Where each scale is read: the pointers' tips. */
  private readonly outerTip = new THREE.Object3D();
  private readonly innerTip = new THREE.Object3D();
  private readonly latTip = new THREE.Object3D();
  private readonly nearHole = new THREE.Object3D();
  private readonly farHole = new THREE.Object3D();
  /** Rings and parts that can block a line of sight (for tests and label occlusion). */
  readonly solids: THREE.Object3D[] = [];

  /** Elevation of the north celestial pole above the horizon, degrees (negative: the south pole is raised). */
  poleElevation = 60;
  /** How far the rings are turned about the poles, degrees; −LST matches the sky. */
  turn = 0;
  /** Longitude the outer ring is set to, degrees. */
  outerLon = 0;
  /** Longitude the inner ring is turned to, degrees. */
  innerLon = 0;
  /** Latitude the sighting ring is slid to, degrees. */
  sightLat = 0;

  constructor(readonly eps = 23.44) {
    this.root.position.set(0, CENTER_Y, 0);
    this.root.add(this.meridianFrame);
    this.meridianFrame.add(this.sphere);
    this.sphere.add(this.eclFrame);
    this.eclFrame.rotation.z = -eps * D2R;
    this.eclFrame.add(this.outer, this.inner);
    this.inner.add(this.sighting);

    const mat = (draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, H: number) =>
      engravedBrass(canvasTexture(STRIP_W, draw, H), { metalness: 0.3, roughness: 0.55 });

    // ---- stand: a turned wooden foot and a brass pillar up to the cradle of the meridian ring ----
    const groundY = -CENTER_Y;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.05, 48), wood);
    foot.position.y = groundY + 0.025;
    const footTop = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.06, 40), wood);
    footTop.position.y = groundY + 0.08;
    const cradleY = -R6_OUT - 0.012;
    const pillar = rod(new THREE.Vector3(0, groundY + 0.1, 0), new THREE.Vector3(0, cradleY - 0.01, 0), 0.022, brass);
    const knop = new THREE.Mesh(new THREE.SphereGeometry(0.034, 24, 16), brass);
    knop.position.y = groundY + 0.5;
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.07), brass);
    cradle.position.y = cradleY;
    this.root.add(foot, footTop, pillar, knop, cradle);
    for (const x of [-1, 1]) {
      // Cheeks either side of the ring hold it upright; between them, open, the index.
      for (const z of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.014), darkBrass);
        cheek.position.set(x * (T6 / 2 + 0.003), cradleY + 0.02, z * 0.02);
        this.root.add(cheek);
      }
      // The index: a fine blade standing up from the cradle, its tip on the meridian's degrees.
      const top = -READ_MERIDIAN, bottom = cradleY + 0.01;
      const idx = new THREE.Mesh(new THREE.BoxGeometry(0.0008, top - bottom, 0.0012), steel);
      idx.position.set(x * (T6 / 2 + FACE_GAP + 0.0009), (top + bottom) / 2, 0);
      this.root.add(idx);
    }

    // ---- meridian ring ----
    const mer = annulus(R6_IN, R6_OUT, T6, brass);
    mer.rotation.y = Math.PI / 2;
    this.meridianFrame.add(mer);
    const merGeo = faceGeometry(R6_IN, R6_OUT), merMat = mat(drawMeridian, H_MER);
    for (const side of [1, -1] as const) {
      const f = sideFace(merGeo, merMat, T6, side);
      this.meridianFrame.add(f); this.meridianFaces.push(f);
    }
    // Bearings for the axle at the poles.
    for (const y of [-1, 1]) {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, T6 + 0.006, 20), darkBrass);
      boss.rotation.z = Math.PI / 2; boss.position.y = y * (R6_IN - 0.002);
      this.meridianFrame.add(boss);
    }

    // ---- colure and ecliptic ----
    const colure = annulus(R3_IN, R3_OUT, T3, brass); // plane z = 0 of the sphere: through both pairs of poles
    this.sphere.add(colure);
    for (const y of [-1, 1]) this.sphere.add(rod(new THREE.Vector3(0, y * (R3_OUT - 0.004), 0), new THREE.Vector3(0, y * (R6_IN + 0.002), 0), 0.0035, steel));
    const ecl = annulus(R3_IN, R3_OUT, T3, brass);
    ecl.rotation.x = -Math.PI / 2;
    this.eclFrame.add(ecl);
    const eclGeo = faceGeometry(R3_IN, R3_OUT);
    for (const face of [1, -1] as const) {
      const f = new THREE.Mesh(eclGeo, mat((g, w, h) => drawEcliptic(g, w, h, face), H_ECL));
      f.rotation.x = -face * Math.PI / 2;
      f.position.y = face * (T3 / 2 + FACE_GAP);
      this.eclFrame.add(f); this.eclipticFaces.push({ mesh: f, face });
    }
    // Pegs at the poles of the ecliptic: outward for the outer ring, inward for the inner.
    for (const y of [-1, 1]) {
      this.eclFrame.add(rod(new THREE.Vector3(0, y * (R3_OUT - 0.004), 0), new THREE.Vector3(0, y * (R5_OUT + 0.003), 0), 0.0028, steel));
      this.eclFrame.add(rod(new THREE.Vector3(0, y * (R3_IN + 0.004), 0), new THREE.Vector3(0, y * (R2_IN - 0.002), 0), 0.0028, steel));
    }

    // ---- outer ring, with pointers reaching in over both faces of the ecliptic ----
    const outerRing = annulus(R5_IN, R5_OUT, T5, brass);
    outerRing.rotation.y = Math.PI / 2;
    this.outer.add(outerRing);
    for (const y of [-1, 1]) {
      this.outer.add(blade(READ_ECL_OUTER - 0.0015, R5_IN + 0.002, 0, y * (T3 / 2 + FACE_GAP + 0.0009), 0.0012, 0.0008, steel));
      this.outer.add(blade(R3_OUT + 0.001, R5_IN + 0.002, 0, y * (T3 / 2 + 0.0035), 0.004, 0.005, brass));
    }
    this.outerTip.position.set(0, 0, -READ_ECL_OUTER);
    this.outer.add(this.outerTip);

    // ---- inner ring: graduated in latitude, with pointers reaching out over the ecliptic ----
    const innerRing = annulus(R2_IN, R2_OUT, T2, brass);
    innerRing.rotation.y = Math.PI / 2;
    this.inner.add(innerRing);
    const latGeo = faceGeometry(R2_IN, R2_OUT), latMat = mat(drawLatitude, H_LAT);
    for (const side of [1, -1] as const) {
      const f = sideFace(latGeo, latMat, T2, side);
      this.inner.add(f); this.latitudeFaces.push(f);
    }
    for (const y of [-1, 1]) {
      this.inner.add(blade(R2_OUT - 0.002, READ_ECL_INNER + 0.0015, 0, y * (T3 / 2 + FACE_GAP + 0.0009), 0.0012, 0.0008, steel));
      this.inner.add(blade(R2_OUT - 0.002, R3_IN - 0.001, 0, y * (T3 / 2 + 0.0035), 0.004, 0.005, brass));
    }
    this.innerTip.position.set(0, 0, -READ_ECL_INNER);
    this.inner.add(this.innerTip);

    // ---- sighting ring: two sights standing off its face, and an index over the latitude scale ----
    const sightRing = annulus(R1_IN, R1_OUT, T1, brass);
    sightRing.rotation.y = Math.PI / 2;
    this.sighting.add(sightRing);
    for (const z of [-1, 1]) {
      const plate = sightPlate();
      plate.position.set(SIGHT_X, 0, z * R1_MID);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(SIGHT_X - T1 / 2 - 0.007 + 0.001, 0.004, 0.003), darkBrass);
      arm.position.set((T1 / 2 + SIGHT_X - 0.007) / 2, 0, z * R1_MID);
      this.sighting.add(plate, arm);
    }
    this.nearHole.position.set(SIGHT_X, 0, R1_MID);
    this.farHole.position.set(SIGHT_X, 0, -R1_MID);
    this.sighting.add(this.nearHole, this.farHole);
    for (const x of [-1, 1]) this.sighting.add(blade(R1_OUT - 0.002, READ_LAT + 0.0015, x * (T2 / 2 + FACE_GAP + 0.0009), 0, 0.0008, 0.0012, steel));
    this.latTip.position.set(0, 0, -READ_LAT);
    this.sighting.add(this.latTip);

    this.solids.push(mer, colure, ecl, outerRing, innerRing, sightRing);

    this.setPole(this.poleElevation);
    this.setTurn(0); this.setOuter(0); this.setInner(0); this.setSight(0);
  }

  setPole(e: number): void {
    this.poleElevation = Math.max(-90, Math.min(90, e));
    this.meridianFrame.rotation.x = (90 - this.poleElevation) * D2R;
  }
  setTurn(deg: number): void { this.turn = wrap360(deg); this.sphere.rotation.y = this.turn * D2R; }
  setOuter(lon: number): void { this.outerLon = wrap360(lon); this.outer.rotation.y = this.outerLon * D2R; }
  setInner(lon: number): void { this.innerLon = wrap360(lon); this.inner.rotation.y = this.innerLon * D2R; }
  setSight(lat: number): void { this.sightLat = Math.max(-89, Math.min(89, lat)); this.sighting.rotation.x = this.sightLat * D2R; }

  pose(): void { this.root.updateMatrixWorld(true); }
  centre(out = V()): THREE.Vector3 { return this.root.getWorldPosition(out); }

  // ---- lines of sight ----

  /** World position of the near sight's hole. */
  sightEye(out = V()): THREE.Vector3 { return this.nearHole.getWorldPosition(out); }
  /** World direction through both sights. */
  sightAim(out = V()): THREE.Vector3 {
    return this.farHole.getWorldPosition(out).sub(this.nearHole.getWorldPosition(V())).normalize();
  }
  farSight(out = V()): THREE.Vector3 { return this.farHole.getWorldPosition(out); }

  /** World direction toward a point at `psi` round the outer ring from its longitude end (+ toward the north pole of the ecliptic). */
  outerAim(psi: number, out = V()): THREE.Vector3 {
    return out.set(0, Math.sin(psi * D2R), -Math.cos(psi * D2R)).transformDirection(this.outer.matrixWorld);
  }
  /**
   * An eye in the plane of the outer ring's face, just outside the ring, looking
   * in direction `psi` along a chord that crosses the ring's opening clear of
   * the ecliptic and the rings inside it. The near and far parts of the face
   * line up, and a body on the ring's great circle appears on that line.
   */
  outerEye(psi: number, out = V()): THREE.Vector3 {
    const a = V().set(0, Math.sin(psi * D2R), -Math.cos(psi * D2R)), p = V().set(0, Math.cos(psi * D2R), Math.sin(psi * D2R));
    const half = Math.sqrt(R5_IN * R5_IN - OUTER_CHORD * OUTER_CHORD);
    const e = V().set(T5 / 2, 0, 0).addScaledVector(p, OUTER_CHORD).addScaledVector(a, -(half + 0.06));
    return this.outer.localToWorld(out.copy(e));
  }
  /**
   * Show only these parts (null: everything). The sight views use it, so that
   * rings which have nothing to do with the sighting cannot hide the sky.
   */
  isolate(keep: THREE.Object3D[] | null): void {
    const kept = new Set<THREE.Object3D>();
    keep?.forEach(k => k.traverse(o => kept.add(o)));
    this.root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.visible = !keep || kept.has(o); });
  }
  /** World normal of the outer ring's plane. */
  outerNormal(out = V()): THREE.Vector3 { return out.set(1, 0, 0).transformDirection(this.outer.matrixWorld); }
  /** Angle between a world direction and the outer ring's plane, degrees. */
  offOuterPlane(dir: THREE.Vector3): number { return Math.asin(Math.abs(this.outerNormal().dot(dir))) * R2D; }
  /** `psi` on the outer ring that points nearest to a world direction. */
  outerPsiToward(dir: THREE.Vector3): number {
    const d = dir.clone().transformDirection(this.outer.matrixWorld.clone().invert());
    return Math.atan2(d.y, -d.z) * R2D;
  }

  /**
   * Turn the rings about the poles so the outer ring's plane passes through a
   * world direction: of the (usually two) turns that do, the one nearest the
   * present turn. Returns false, and turns to the closest approach, if none does.
   */
  turnToBringOuterTo(dir: THREE.Vector3): boolean {
    this.pose();
    const a = dir.clone().transformDirection(this.meridianFrame.matrixWorld.clone().invert());
    // Normal of the outer ring in the sphere's frame (before the turn).
    const nE = V().set(Math.cos(this.outerLon * D2R), 0, -Math.sin(this.outerLon * D2R));
    const n = nE.applyAxisAngle(new THREE.Vector3(0, 0, 1), -this.eps * D2R);
    const A = a.x * n.x + a.z * n.z, B = a.x * n.z - a.z * n.x, C = a.y * n.y;
    const R = Math.hypot(A, B), phi0 = Math.atan2(B, A) * R2D;
    let ok = true, cands: number[];
    if (R < 1e-12 || Math.abs(C) > R) { ok = false; cands = [phi0, phi0 + 180]; } else {
      const k = Math.acos(-C / R) * R2D;
      cands = [phi0 + k, phi0 - k];
    }
    if (!ok) {
      // Closest approach: the turn minimising |n·a|.
      const f = (t: number) => Math.abs(A * Math.cos(t * D2R) + B * Math.sin(t * D2R) + C);
      cands.sort((x, y) => f(x) - f(y));
      cands = [cands[0]];
    }
    const best = cands.reduce((p, c) => (Math.abs(wrap180(c - this.turn)) < Math.abs(wrap180(p - this.turn)) ? c : p));
    this.setTurn(best);
    this.pose();
    return ok;
  }

  /** Turn the inner ring and slide the sighting ring so the sights point along a world direction. */
  pointSightsAt(dir: THREE.Vector3): void {
    this.pose();
    const d = dir.clone().transformDirection(this.eclFrame.matrixWorld.clone().invert());
    this.setInner(Math.atan2(-d.x, -d.z) * R2D);
    this.setSight(Math.asin(Math.max(-1, Math.min(1, d.y))) * R2D);
    this.pose();
  }

  // ---- readings, through the engraved textures ----

  /** Where the index on the stand meets the meridian ring. */
  meridianIndexPoint(out = V()): THREE.Vector3 { return this.root.localToWorld(out.set(0, -READ_MERIDIAN, 0)); }
  /** The meridian's number under the index: the elevation of the pole. */
  readPole(side: 1 | -1 = 1): number {
    const face = this.meridianFaces[side > 0 ? 0 : 1];
    return meridianValue(faceTheta(face, this.meridianIndexPoint(), H_MER));
  }

  outerIndexPoint(out = V()): THREE.Vector3 { return this.outerTip.getWorldPosition(out); }
  innerIndexPoint(out = V()): THREE.Vector3 { return this.innerTip.getWorldPosition(out); }
  latIndexPoint(out = V()): THREE.Vector3 { return this.latTip.getWorldPosition(out); }

  private readEcliptic(p: THREE.Vector3, face: 1 | -1): number {
    const f = this.eclipticFaces.find(e => e.face === face)!.mesh;
    return eclipticLonAt(faceTheta(f, p, H_ECL), face);
  }
  /** Longitude on the ecliptic ring under the outer ring's pointer (face 1: northern face). */
  readOuter(face: 1 | -1 = 1): number { return this.readEcliptic(this.outerIndexPoint(), face); }
  /** Longitude on the ecliptic ring under the inner ring's pointer. */
  readInnerLon(face: 1 | -1 = 1): number { return this.readEcliptic(this.innerIndexPoint(), face); }
  /** Latitude on the inner ring under the sighting ring's index: + north. */
  readLat(side: 1 | -1 = 1): number {
    return latitudeAt(faceTheta(this.latitudeFaces[side > 0 ? 0 : 1], this.latIndexPoint(), H_LAT));
  }
  /** World normal of the inner ring's plane: its graduated faces look along ±this. */
  innerNormal(out = V()): THREE.Vector3 { return out.set(1, 0, 0).transformDirection(this.inner.matrixWorld); }
  /** World normal of the meridian ring's plane. */
  meridianNormal(out = V()): THREE.Vector3 { return out.set(1, 0, 0).transformDirection(this.meridianFrame.matrixWorld); }
  /** A world direction in the instrument's ecliptic coordinates: where the rings would put it. */
  eclipticOf(dir: THREE.Vector3): { lon: number; lat: number } {
    const d = dir.clone().transformDirection(this.eclFrame.matrixWorld.clone().invert());
    return { lon: wrap360(Math.atan2(-d.x, -d.z) * R2D), lat: Math.asin(Math.max(-1, Math.min(1, d.y))) * R2D };
  }
  /** World direction of the north pole of the ecliptic, as the instrument holds it. */
  eclipticPole(out = V()): THREE.Vector3 { return out.set(0, 1, 0).transformDirection(this.eclFrame.matrixWorld); }
}
