// The quadrant with plumb line, ported from references/Quadrant prototype.html.
//
// A quarter-circle brass plate turns on a post (azimuth) and tilts on a
// horizontal axle (altitude). The observer sights along the top edge with the
// apex — the corner the plumb line hangs from — toward the star. The cord hangs
// straight down, and the angle between it and the plate's other (vertical) edge
// equals the star's altitude, read where the cord crosses the arc.
import * as THREE from 'three';
import { D2R, R2D, wrap360 } from '../../core/astro';
import { brushMarks, canvasTexture, engraveText, ENGRAVE, ENGRAVE_FONT, seededRandom, strokeCircle, strokeLine } from '../../three/engrave';
import { brass, cord, cylinder, darkBrass, engravedBrass, steel, stone, wood } from '../../three/materials';
import { uvAtLocalPoint, uvToCanvas } from '../../three/uv';

export const RQ = 1.0;          // quadrant radius, m
export const PIVOT_Y = 1.72;    // height of the altitude axle
export const PLATE_TEX = 2048;  // plate texture size, px
export const RING_TEX = 2048;
export const RING_R = 0.7;
export const PLUMB_LEN = RQ * 1.07;
/** Fraction of the radius where the cord is read (middle of the tick band). */
const READ_R = 0.93;

// ---- the engraved scales -------------------------------------------------

/** Plate canvas: apex at (0,0); the scale angle θ points along (sin θ, cos θ). */
const platePoint = (r: number, th: number): [number, number] => [r * Math.sin(th * D2R), r * Math.cos(th * D2R)];
/** Inverse of platePoint: the scale value at a canvas pixel. */
export const plateAngleAt = (px: number, py: number): number => Math.atan2(px, py) * R2D;

function drawPlate(g: CanvasRenderingContext2D, S: number): void {
  const rnd = seededRandom(7);
  g.save();
  g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S, 0, Math.PI / 2); g.closePath(); g.clip();
  const gr = g.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, '#e3bd76'); gr.addColorStop(0.45, '#c99a48'); gr.addColorStop(1, '#a87a30');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  brushMarks(g, S, S, rnd);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE;
  [0.975, 0.86, 0.73, 0.7, 0.28].forEach((f, i) => strokeCircle(g, 0, 0, S * f, i === 3 ? 2 : 3.5, 0, Math.PI / 2));
  for (let th = 0; th <= 90.001; th += 0.5) {
    const big = th % 10 === 0, mid = th % 5 === 0, one = th % 1 === 0;
    const r0 = S * 0.975, r1 = S * (big ? 0.86 : mid ? 0.885 : one ? 0.915 : 0.94);
    strokeLine(g, platePoint(r0, th), platePoint(r1, th), big ? 5 : mid ? 3.5 : 2.2);
  }
  // The plate is seen from its other face, so lettering is mirrored.
  for (let th = 10; th <= 80; th += 10) engraveText(g, String(th), ...platePoint(S * 0.795, th), -th * D2R, `600 64px ${ENGRAVE_FONT}`, true);
  engraveText(g, 'QVADRANS', ...platePoint(S * 0.5, 45), -45 * D2R, `italic 600 74px ${ENGRAVE_FONT}`, true);
  engraveText(g, 'ALTITVDO STELLARVM', ...platePoint(S * 0.6, 45), -45 * D2R, `italic 40px ${ENGRAVE_FONT}`, true);
  // rosette
  g.translate(...platePoint(S * 0.16, 45)); g.lineWidth = 3;
  for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, 40, 16, 40, 0, 0, 7); g.stroke(); }
  g.restore();
}

/** Ring canvas: azimuth A points along (−sin A, cos A) from the centre. */
export const ringAngleAt = (px: number, py: number, S = RING_TEX): number => wrap360(Math.atan2(-(px - S / 2), py - S / 2) * R2D);

function drawRing(g: CanvasRenderingContext2D, S: number): void {
  const c = S / 2, rO = c * 0.985, rI = c * 0.70;
  const grad = g.createRadialGradient(c, c, rI, c, c, rO);
  grad.addColorStop(0, '#b88a3c'); grad.addColorStop(0.5, '#dcb36a'); grad.addColorStop(1, '#a87b31');
  g.fillStyle = grad; g.beginPath(); g.arc(c, c, rO, 0, 7); g.arc(c, c, rI, 0, 7, true); g.fill();
  g.strokeStyle = ENGRAVE;
  [rO - 6, rI + 4, c * 0.89].forEach(r => strokeCircle(g, c, c, r, 3));
  for (let A = 0; A < 360; A++) {
    const L = A % 10 === 0 ? 0.085 : A % 5 === 0 ? 0.06 : 0.035;
    const s = Math.sin(A * D2R), co = Math.cos(A * D2R);
    strokeLine(g, [c - s * (rO - 6), c + co * (rO - 6)], [c - s * (rO - 6 - L * c), c + co * (rO - 6 - L * c)], A % 10 === 0 ? 4 : 2.2);
  }
  g.fillStyle = ENGRAVE;
  for (let A = 0; A < 360; A += 10) {
    const card = ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' } as Record<number, string>)[A];
    const r = card ? c * 0.775 : c * 0.82;
    engraveText(g, card || String(A), c - Math.sin(A * D2R) * r, c + Math.cos(A * D2R) * r, A * D2R + Math.PI, card ? `bold 86px ${ENGRAVE_FONT}` : `40px ${ENGRAVE_FONT}`);
  }
}

// ---- the model -----------------------------------------------------------

function plateGeometry(xOff: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([xOff, 0, 0, xOff, 0, RQ, xOff, -RQ, RQ, xOff, -RQ, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

export class QuadrantModel {
  readonly root = new THREE.Group();
  readonly azGroup = new THREE.Group();
  readonly altGroup = new THREE.Group();
  readonly plumb = new THREE.Group();
  /** Plate face carrying the scale (used for reading). */
  readonly plate: THREE.Mesh;
  readonly ring: THREE.Mesh;
  readonly vaneFront = new THREE.Object3D();
  readonly vaneRear = new THREE.Object3D();
  readonly pointerTip = new THREE.Object3D();
  az = 150;
  alt = 20;
  private swing = 0;
  private swingV = 0;
  private prevAlt = 20;

  constructor() {
    const root = this.root;
    const ped = cylinder(0.72, 0.14, stone, 64); ped.position.y = 0.07; root.add(ped);
    this.ring = new THREE.Mesh(new THREE.CircleGeometry(RING_R, 128),
      engravedBrass(canvasTexture(RING_TEX, drawRing), { alphaTest: 0.5, roughness: 0.35 }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.146; root.add(this.ring);
    const post = cylinder(0.045, PIVOT_Y - 0.25, wood); post.position.y = 0.14 + (PIVOT_Y - 0.25) / 2; root.add(post);

    const az = this.azGroup; root.add(az);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.6), brass); arm.position.set(0, 0.156, 0.32); az.add(arm);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 3), brass);
    tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.156, 0.65); az.add(tip);
    this.pointerTip.position.set(0, 0.156, 0.685); az.add(this.pointerTip);
    const hub = cylinder(0.07, 0.03, brass); hub.position.y = 0.155; az.add(hub);
    const collar = cylinder(0.06, 0.08, brass); collar.position.y = PIVOT_Y - 0.1; az.add(collar);
    const head = cylinder(0.05, 0.16, darkBrass); head.position.y = PIVOT_Y - 0.02; az.add(head);
    const axle = cylinder(0.016, 0.16, brass); axle.rotation.z = Math.PI / 2; axle.position.set(-0.08, PIVOT_Y, 0); az.add(axle);

    this.altGroup.position.set(-0.12, PIVOT_Y, 0); az.add(this.altGroup);
    // Built with the plate in +Z, then turned round so the apex leads toward the star.
    const body = new THREE.Group(); body.rotation.y = Math.PI; this.altGroup.add(body);
    const plateTex = canvasTexture(PLATE_TEX, drawPlate);
    this.plate = new THREE.Mesh(plateGeometry(0.006), engravedBrass(plateTex, { alphaTest: 0.5, side: THREE.DoubleSide }));
    body.add(this.plate);
    body.add(new THREE.Mesh(plateGeometry(-0.006), engravedBrass(plateTex, { alphaTest: 0.5, color: 0x9a7330, metalness: 0.9, roughness: 0.45, side: THREE.DoubleSide })));

    const rim = new THREE.TorusGeometry(RQ, 0.013, 10, 96, Math.PI / 2); rim.rotateZ(-Math.PI / 2); rim.rotateY(-Math.PI / 2);
    body.add(new THREE.Mesh(rim, brass));
    const top = cylinder(0.013, RQ, brass); top.rotation.x = Math.PI / 2; top.position.z = RQ / 2; body.add(top);
    const side = cylinder(0.013, RQ, brass); side.position.y = -RQ / 2; body.add(side);
    const tube = cylinder(0.014, RQ - 0.08, darkBrass); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.04, 0.04 + (RQ - 0.08) / 2); body.add(tube);
    for (const z of [0.05, RQ - 0.02]) {
      const v = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 24), brass); v.position.set(0, 0.04, z); body.add(v);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), brass); s.position.set(0, 0.012, z); body.add(s);
    }
    this.vaneFront.position.set(0, 0.04, 0.05); body.add(this.vaneFront);
    this.vaneRear.position.set(0, 0.04, RQ - 0.02); body.add(this.vaneRear);
    const pin = cylinder(0.022, 0.06, brass); pin.rotation.z = Math.PI / 2; pin.position.x = 0.012; body.add(pin);

    // Plumb line: hangs from the apex, just in front of the plate face.
    this.plumb.position.set(-0.145, PIVOT_Y, 0); az.add(this.plumb);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, PLUMB_LEN, 6), cord);
    line.position.y = -PLUMB_LEN / 2; this.plumb.add(line);
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 16), steel);
    bob.rotation.x = Math.PI; bob.position.y = -PLUMB_LEN - 0.03; this.plumb.add(bob);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 8), steel);
    knot.position.y = -PLUMB_LEN + 0.02; knot.scale.y = 0.6; this.plumb.add(knot);

    this.setAim(this.az, this.alt);
    this.update(0);
  }

  setAim(az: number, alt: number): void {
    this.az = wrap360(az);
    this.alt = Math.min(89, Math.max(0, alt));
  }

  /** Turn and tilt the model to the current aim (the plumb keeps its sway). */
  pose(): void {
    this.azGroup.rotation.y = -this.az * D2R;
    this.altGroup.rotation.x = -this.alt * D2R;
    this.root.updateMatrixWorld(true);
  }

  /** Apply the aim to the model; `dt` > 0 lets the plumb bob sway. */
  update(dt: number): void {
    this.azGroup.rotation.y = -this.az * D2R;
    this.altGroup.rotation.x = -this.alt * D2R;
    if (dt > 0) {
      this.swingV += (-(this.alt - this.prevAlt) * D2R * 1.2) * 0.6;
      this.swingV += (-28 * this.swing - 2.2 * this.swingV) * dt;
      this.swing = Math.max(-0.3, Math.min(0.3, this.swing + this.swingV * dt));
    } else {
      this.swing = 0; this.swingV = 0;
    }
    this.prevAlt = this.alt;
    this.plumb.rotation.x = this.swing;
    this.root.updateMatrixWorld(true);
  }

  /** World direction of the line of sight (rear vane → front vane). */
  sightDirection(out = new THREE.Vector3()): THREE.Vector3 {
    const f = this.vaneFront.getWorldPosition(new THREE.Vector3());
    return out.copy(f).sub(this.vaneRear.getWorldPosition(new THREE.Vector3())).normalize();
  }

  /** The observer's eye for the sight view (at the front vane, looking out). */
  eye(out = new THREE.Vector3()): THREE.Vector3 {
    return this.altGroup.localToWorld(out.set(0, 0.04, 0.06));
  }

  /**
   * The altitude scale value under the plumb line, found geometrically: where
   * the cord crosses the scale band, mapped through the plate's UVs onto the
   * engraved canvas.
   */
  readPlumb(): number {
    const p = this.plumbCrossingLocal();
    const uv = uvAtLocalPoint(this.plate.geometry, p);
    if (!uv) return NaN;
    return plateAngleAt(...uvToCanvas(uv, PLATE_TEX));
  }

  /** World position where the cord crosses the scale band. */
  plumbCrossing(out = new THREE.Vector3()): THREE.Vector3 {
    return this.plate.localToWorld(out.copy(this.plumbCrossingLocal()));
  }

  /** The cord, projected onto the plate face, at the reading radius (plate frame). */
  private plumbCrossingLocal(): THREE.Vector3 {
    const top = this.plate.worldToLocal(this.plumb.localToWorld(new THREE.Vector3(0, 0, 0)));
    const bottom = this.plate.worldToLocal(this.plumb.localToWorld(new THREE.Vector3(0, -PLUMB_LEN, 0)));
    const d = bottom.sub(top);
    const r2 = (m: number) => { const p = top.clone().addScaledVector(d, m); return p.y * p.y + p.z * p.z; };
    let lo = 0, hi = 1;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2;
      if (r2(m) < (READ_R * RQ) ** 2) lo = m; else hi = m;
    }
    const p = top.addScaledVector(d, lo);
    p.x = 0.006;
    return p;
  }

  /** The azimuth scale value under the pointer tip. */
  readPointer(): number {
    const p = this.pointerTip.getWorldPosition(new THREE.Vector3());
    this.ring.worldToLocal(p);
    p.z = 0;
    const uv = uvAtLocalPoint(this.ring.geometry, p);
    if (!uv) return NaN;
    return ringAngleAt(...uvToCanvas(uv, RING_TEX));
  }
}
