// The cross-staff: a square staff held with one end at the eye, and a transom
// that slides along it at right angles. Slide the transom until its two ends
// touch two stars; the scale on the staff, where the transom stands, gives the
// angle between them. Three transoms of different lengths serve different
// ranges of angle, each read on its own face of the staff.
//
// `staff` frame: origin at the eye end, the staff runs along −Z; the transom
// lies along X. Roll 0 holds the transom level (X horizontal); positive roll
// turns it counter-clockwise as the observer sees it.
import * as THREE from 'three';
import { D2R, R2D } from '../../core/astro';
import { canvasTexture } from '../../three/engrave';
import { brass, darkBrass, wood } from '../../three/materials';
import { uvAtLocalPoint, uvToCanvas } from '../../three/uv';
import { angleAt, distanceAtX, drawScale, STAFF_A, STAFF_L, STRIP_H, STRIP_W, TRANSOMS } from './drawings';

/** Height of the observer's eye, m. */
export const EYE_Y = 1.6;
/** The transom's thickness along the staff, and its depth. */
const TR_T = 0.01, TR_D = 0.014;
const FACE_GAP = 0.0002;

const V = () => new THREE.Vector3();

type Face = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/**
 * A face of the staff, its outward normal `n` and across-direction `ev` chosen
 * so the strip reads the right way round from outside: (−Z) × ev = n.
 */
function faceGeometry(n: THREE.Vector3, ev: THREE.Vector3): THREE.BufferGeometry {
  const ed = new THREE.Vector3(0, 0, -1), off = n.clone().multiplyScalar(STAFF_A / 2 + FACE_GAP);
  const p = (d: number, v: number) => ed.clone().multiplyScalar(d).addScaledVector(ev, (v - 0.5) * STAFF_A).add(off);
  const pts = [p(0, 0), p(STAFF_L, 0), p(STAFF_L, 1), p(0, 1)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(q => [q.x, q.y, q.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Faces for transoms I, II, III: top, right and left (as the observer holds it). */
const FACES: [THREE.Vector3, THREE.Vector3][] = [
  [new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)],
  [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)],
];

export class CrossStaff {
  readonly root = new THREE.Group();
  readonly staff = new THREE.Group();
  readonly faces: Face[] = [];
  readonly transoms: THREE.Group[] = [];
  /** World direction the staff points in. */
  readonly aim = new THREE.Vector3(0, 0, 1);
  roll = 0;
  transom = 1;
  /** Distance of the transom's eye-side face from the eye, m. */
  distance = 0.4;

  constructor() {
    this.root.add(this.staff);
    this.staff.position.set(0, EYE_Y, 0);

    const body = new THREE.Mesh(new THREE.BoxGeometry(STAFF_A, STAFF_A, STAFF_L), wood);
    body.position.z = -STAFF_L / 2;
    this.staff.add(body);
    // Brass caps at both ends.
    for (const z of [-0.004, -STAFF_L + 0.004]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(STAFF_A + 0.002, STAFF_A + 0.002, 0.008), brass);
      cap.position.z = z; this.staff.add(cap);
    }
    FACES.forEach(([n, ev], i) => {
      const t = TRANSOMS[i];
      const mat = new THREE.MeshStandardMaterial({ map: canvasTexture(STRIP_W, (g, w, h) => drawScale(g, w, h, t, 91 + i), STRIP_H), roughness: 0.7, metalness: 0 });
      const f = new THREE.Mesh(faceGeometry(n, ev), mat);
      this.staff.add(f); this.faces.push(f);
    });

    for (const t of TRANSOMS) {
      const g = new THREE.Group();
      // The bar, set so its eye-side face is at the group's origin.
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * t.half, TR_D, TR_T), wood);
      bar.position.z = -TR_T / 2;
      // A brass socket round the staff, and brass tips at the ends.
      // Its eye-side face is flush with the bar's: that edge is read on the scale.
      const socket = new THREE.Mesh(new THREE.BoxGeometry(STAFF_A + 0.008, STAFF_A + 0.008, TR_T + 0.004), darkBrass);
      socket.position.z = -(TR_T + 0.004) / 2;
      g.add(bar, socket);
      for (const s of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.004, TR_D + 0.002, TR_T), brass);
        tip.position.set(s * (t.half - 0.002), 0, -TR_T / 2);
        g.add(tip);
      }
      this.staff.add(g); this.transoms.push(g);
    }
    this.setTransom(1);
    this.setAim(this.aim);
  }

  get current() { return TRANSOMS[this.transom]; }

  setTransom(i: number): void {
    this.transom = Math.max(0, Math.min(TRANSOMS.length - 1, i));
    this.transoms.forEach((g, k) => { g.visible = k === this.transom; });
    this.setDistance(this.distance);
  }
  setDistance(d: number): void {
    const t = this.current;
    this.distance = Math.max(t.dMin, Math.min(t.dMax, d));
    this.transoms[this.transom].position.z = -this.distance;
  }
  setAim(dir: THREE.Vector3): void { this.aim.copy(dir).normalize(); this.orient(); }
  setRoll(deg: number): void { this.roll = ((deg % 360) + 540) % 360 - 180; this.orient(); }

  private orient(): void {
    const up = Math.abs(this.aim.y) > 0.999 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    // Matrix4.lookAt, as for a camera: local −Z toward the target, +X to the right, +Y up.
    this.staff.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), this.aim, up));
    this.staff.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.roll * D2R));
  }

  pose(): void { this.root.updateMatrixWorld(true); }
  eye(out = V()): THREE.Vector3 { return this.staff.getWorldPosition(out); }

  /** World direction from the eye to one end of the transom (+1: the end on local +X). */
  endDirection(side: 1 | -1, out = V()): THREE.Vector3 {
    return this.staff.localToWorld(out.set(side * this.current.half, 0, -this.distance)).sub(this.eye()).normalize();
  }
  /** World position of one end of the transom. */
  endPoint(side: 1 | -1, out = V()): THREE.Vector3 { return this.staff.localToWorld(out.set(side * this.current.half, 0, -this.distance)); }

  /** The angle the transom's ends span, exactly (for checks). */
  trueAngle(): number { return angleAt(this.current, this.distance); }

  /** Where the scale is read: on the current transom's face, at the transom's eye-side edge. */
  readPoint(out = V()): THREE.Vector3 {
    const [n] = FACES[this.transom];
    return this.staff.localToWorld(out.copy(n).multiplyScalar(STAFF_A / 2 + FACE_GAP).add(V().set(0, 0, -this.distance)));
  }
  /** World direction across the current face toward the tops of its numbers. */
  faceUp(out = V()): THREE.Vector3 { return out.copy(FACES[this.transom][1]).transformDirection(this.staff.matrixWorld); }
  /** Outward world normal of the current transom's face. */
  faceNormal(out = V()): THREE.Vector3 { return out.copy(FACES[this.transom][0]).transformDirection(this.staff.matrixWorld); }

  /** The angle engraved on the staff where the transom stands, read through the face's texture. */
  readAngle(): number {
    const f = this.faces[this.transom];
    const p = f.worldToLocal(this.readPoint());
    const uv = uvAtLocalPoint(f.geometry, p, 1e-4);
    return uv ? angleAt(this.current, distanceAtX(uvToCanvas(uv, STRIP_W, STRIP_H)[0])) : NaN;
  }

  /**
   * Hold the staff so the transom's ends touch two world directions: aimed
   * between them, turned so the transom joins them, slid to their angle.
   * Returns false if the current transom cannot span that angle.
   */
  frame(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const aim = V().addVectors(a, b).normalize();
    this.roll = 0; this.setAim(aim); this.pose();
    const x = V().set(1, 0, 0).transformDirection(this.staff.matrixWorld), y = V().set(0, 1, 0).transformDirection(this.staff.matrixWorld);
    const d = V().subVectors(a, b);
    this.setRoll(Math.atan2(d.dot(y), d.dot(x)) * R2D);
    const sep = a.angleTo(b) * R2D, t = this.current;
    this.setDistance(t.half / Math.tan((sep / 2) * D2R));
    this.pose();
    return Math.abs(this.trueAngle() - sep) < 1e-9;
  }
}
