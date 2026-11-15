// A marine sextant with a micrometer drum, on a ship's deck.
//
// The frame is a 60° sector. At its apex the index arm pivots, carrying the
// index mirror. The horizon glass, fixed to the frame, is silvered on the half
// nearer the frame and clear on the other; the telescope looks through it at
// the sea horizon. Starlight reflected by the index mirror and then by the
// silvered half reaches the eye turned through twice the angle between the
// mirrors, so the arc is graduated in double degrees (0–120°). Whole degrees
// are read at the arm's index on the arc; the drum, turning once per degree,
// gives the minutes.
//
// Frame coordinates: the frame lies in z = 0 with the optics on its +z face;
// y is up with the instrument upright; the telescope looks toward −x.
import * as THREE from 'three';
import { D2R, R2D, wrap360 } from '../../core/astro';
import { dipMinutes } from '../../core/nav';
import { brushMarks, canvasTexture, engraveText, ENGRAVE, ENGRAVE_FONT, seededRandom, strokeLine } from '../../three/engrave';
import { brass, cylinder, darkBrass, engravedBrass, steel, wood } from '../../three/materials';
import { uvAtLocalPoint, uvToCanvas } from '../../three/uv';

/** The observer's eye: height above the deck, and above the sea (on a ship's deck). */
export const EYE_Y = 1.6;
export const EYE_ABOVE_SEA = 4;
/** Dip of the sea horizon for that eye, degrees. */
export const DIP = dipMinutes(EYE_ABOVE_SEA) / 60;
/** The sea disc: its edge, at this radius, is drawn exactly DIP below the eye's horizontal. */
export const SEA_RADIUS = 2600;
export const SEA_Y = EYE_Y - SEA_RADIUS * Math.tan(DIP * D2R);

const ARC_IN = 0.150, ARC_OUT = 0.172;          // graduated band, m from the pivot
const FRAME_R = 0.176;
/** Arm direction (degrees from straight down, positive toward +x) at reading 0; readings increase toward −x. */
const PSI_ZERO = 29;
const PSI_MIN = -35, PSI_MAX = 33;              // frame sector
const Z_OPT = 0.026;                            // height of the optics above the frame face
const H2: [number, number] = [-0.045, -0.075];  // horizon glass centre
const EYE_LOCAL = new THREE.Vector3(H2[0] + 0.13, H2[1], Z_OPT); // eyepiece
const DRUM_R = 0.013, DRUM_AT = ARC_OUT + 0.021, DRUM_X = 0.016, DRUM_LEN = 0.014;
const ARC_TEX = 2048, DRUM_W = 1024, DRUM_H = 128;
const READ_ARC = ARC_IN + 0.004;

/** Arm direction for a reading. */
export const armAngle = (reading: number): number => PSI_ZERO - reading / 2;

// ---- the engraved scales -------------------------------------------------

/** Arc canvas: the ring texture spans ±ARC_OUT; a direction ψ points along (sin ψ, cos ψ) in canvas pixels. */
function drawArc(g: CanvasRenderingContext2D, S: number): void {
  const c = S / 2, k = c / ARC_OUT;
  const pt = (rho: number, psi: number): [number, number] => [c + Math.sin(psi * D2R) * rho * k, c + Math.cos(psi * D2R) * rho * k];
  // Brass band (only the sector is used by the mesh).
  const grad = g.createRadialGradient(c, c, ARC_IN * k, c, c, ARC_OUT * k);
  grad.addColorStop(0, '#d8d2c2'); grad.addColorStop(1, '#bdb6a4');   // silvered arc inlay
  g.fillStyle = grad;
  g.beginPath(); g.arc(c, c, ARC_OUT * k, 0, Math.PI * 2); g.moveTo(c + ARC_IN * k, c); g.arc(c, c, ARC_IN * k, 0, Math.PI * 2, true); g.fill();
  brushMarks(g, S, S, seededRandom(31), 1500);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE; g.lineCap = 'butt';
  const r0 = ARC_IN + 0.0008;
  for (let r = -5; r <= 125; r++) {
    const psi = armAngle(r), L = r % 10 === 0 ? 0.011 : r % 5 === 0 ? 0.008 : 0.005;
    strokeLine(g, pt(r0, psi), pt(r0 + L, psi), r % 5 === 0 ? 4 : 2.6);
  }
  for (let r = 0; r <= 120; r += 10) {
    const psi = armAngle(r);
    // Upright with the arc at the bottom: tops toward the pivot.
    engraveText(g, String(r), ...pt(ARC_IN + 0.0165, psi), -psi * D2R, `600 34px ${ENGRAVE_FONT}`);
  }
  g.lineWidth = 3;
  g.beginPath(); g.arc(c, c, r0 * k, 0, Math.PI * 2); g.stroke();
}

/** Arc pixel → reading. */
export function arcReadingAt(px: number, py: number, S = ARC_TEX): number {
  const psi = Math.atan2(px - S / 2, py - S / 2) * R2D;
  return 2 * (PSI_ZERO - psi);
}

/** Drum canvas: wraps round the drum; minute m sits at u = −m/60 (mod 1). */
function drawDrum(g: CanvasRenderingContext2D, W: number, H: number): void {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#d9d3c4'); gr.addColorStop(0.5, '#ece7da'); gr.addColorStop(1, '#cfc8b6');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = ENGRAVE; g.fillStyle = ENGRAVE;
  const x = (m: number) => (((-m / 60) % 1) + 1) % 1 * W;
  for (let m = 0; m < 60; m++) {
    const L = m % 10 === 0 ? 0.55 : m % 5 === 0 ? 0.4 : 0.25;
    strokeLine(g, [x(m), 0], [x(m), H * L], m % 5 === 0 ? 3 : 2);
    if (m === 0) strokeLine(g, [W, 0], [W, H * L], 3);
  }
  for (let m = 0; m < 60; m += 10) {
    engraveText(g, String(m), x(m) - 2, H * 0.76, -Math.PI / 2, `600 34px ${ENGRAVE_FONT}`);
  }
}

/** Drum u → minutes. */
export const drumMinutesAtU = (u: number): number => ((((-u * 60) % 60) + 60) % 60);

// ---- the model -----------------------------------------------------------

function sectorShape(rIn: number, rOut: number, psi0: number, psi1: number): THREE.Shape {
  const s = new THREE.Shape();
  const p = (r: number, psi: number) => new THREE.Vector2(Math.sin(psi * D2R) * r, -Math.cos(psi * D2R) * r);
  const a0 = (psi0 - 90) * D2R, a1 = (psi1 - 90) * D2R;
  s.moveTo(p(rIn, psi0).x, p(rIn, psi0).y);
  s.absarc(0, 0, rOut, a0, a1, false);
  s.absarc(0, 0, rIn, a1, a0, true);
  s.closePath();
  return s;
}

/** A flat mirror standing on the frame: centre (x, y), unit normal (nx, ny) in the frame plane. */
function mirror(x: number, y: number, nx: number, ny: number, width: number, z0: number, z1: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.PlaneGeometry(width, z1 - z0);
  const t = new THREE.Vector3(-ny, nx, 0), up = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(nx, ny, 0);
  const m = new THREE.Mesh(g, mat);
  m.matrixAutoUpdate = false;
  m.matrix.makeBasis(t, up, n).setPosition(x, y, (z0 + z1) / 2);
  return m;
}

/** A tube with a wall (inner and outer radius), open at both ends, along y. */
function hollowTube(rIn: number, rOut: number, len: number, mat: THREE.Material): THREE.Mesh {
  const h = len / 2;
  const profile = [[rIn, -h], [rOut, -h], [rOut, h], [rIn, h], [rIn, -h]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.Mesh(new THREE.LatheGeometry(profile, 40), mat);
}

const tubeBrass = darkBrass.clone(); tubeBrass.side = THREE.DoubleSide;
const lensGlass = new THREE.MeshStandardMaterial({ color: 0xb8cad8, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
const silver = new THREE.MeshStandardMaterial({ color: 0xe6ebf2, metalness: 1, roughness: 0.04, side: THREE.DoubleSide });
const clearGlass = new THREE.MeshStandardMaterial({ color: 0x9fb6c8, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.18, side: THREE.DoubleSide });

export class SextantModel {
  readonly root = new THREE.Group();
  readonly yaw = new THREE.Group();
  readonly pitch = new THREE.Group();
  readonly body = new THREE.Group();
  readonly arm = new THREE.Group();
  readonly arc: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
  readonly drum: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  readonly drumSpin = new THREE.Group();
  readonly indexMirror: THREE.Mesh;
  readonly horizonMirror: THREE.Mesh;
  readonly armIndex = new THREE.Object3D();
  readonly drumIndex = new THREE.Object3D();

  /** Azimuth the telescope faces, degrees. */
  az = 150;
  /** Elevation of the telescope's line of sight: at the sea horizon. */
  readonly sightAlt = -DIP;
  /** Sextant reading (angle between the direct and reflected lines of sight), degrees. */
  reading = 20;

  constructor() {
    // Hold the eyepiece at eye height over the deck, turning about it.
    this.root.position.set(0, EYE_Y, 0);
    this.root.add(this.yaw);
    this.yaw.add(this.pitch);
    this.pitch.add(this.body);
    this.body.position.copy(EYE_LOCAL).negate();
    const b = this.body;

    // Frame: a sector plate with lightening holes.
    const frameShape = sectorShape(0.03, FRAME_R, PSI_MIN, PSI_MAX);
    for (const [r, psi, rad] of [[0.075, -14, 0.017], [0.075, 14, 0.017], [0.115, 0, 0.02], [0.115, -24, 0.012], [0.115, 24, 0.012]]) {
      const h = new THREE.Path();
      h.absarc(Math.sin(psi * D2R) * r, -Math.cos(psi * D2R) * r, rad, 0, Math.PI * 2, true);
      frameShape.holes.push(h);
    }
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.004, bevelEnabled: false, curveSegments: 48 });
    frameGeo.translate(0, 0, -0.002);
    b.add(new THREE.Mesh(frameGeo, brass));
    const top = cylinder(0.03, 0.004, brass, 40); top.rotation.x = Math.PI / 2; b.add(top);

    // Graduated arc inlay on the front face.
    this.arc = new THREE.Mesh(
      new THREE.RingGeometry(ARC_IN, ARC_OUT, 128, 1, (PSI_MIN - 90) * D2R, (PSI_MAX - PSI_MIN) * D2R),
      engravedBrass(canvasTexture(ARC_TEX, drawArc), { metalness: 0.6, roughness: 0.35 }));
    this.arc.position.z = 0.0021;
    b.add(this.arc);

    // Horizon glass: silvered on the half nearer the frame, clear above; normal bisects the
    // telescope's backward axis and the direction to the index mirror.
    const u = new THREE.Vector2(H2[0], H2[1]).normalize();
    const nH = new THREE.Vector2(1 - u.x, -u.y).normalize();
    this.horizonMirror = mirror(H2[0], H2[1], nH.x, nH.y, 0.032, 0.006, Z_OPT, silver);
    b.add(this.horizonMirror);
    const clear = mirror(H2[0], H2[1], nH.x, nH.y, 0.032, Z_OPT, 0.046, clearGlass);
    clear.userData.glass = true; b.add(clear);
    // Its mount: a plate backs only the silvered half; the clear half sits in an open frame.
    const tH = new THREE.Vector2(-nH.y, nH.x), turnH = Math.atan2(nH.y, nH.x) + Math.PI / 2;
    const hPart = (w: number, d: number, hgt: number, along: number, back: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, hgt), darkBrass);
      m.position.set(H2[0] + tH.x * along - nH.x * back, H2[1] + tH.y * along - nH.y * back, z);
      m.rotation.z = turnH; b.add(m);
    };
    hPart(0.036, 0.003, Z_OPT - 0.004, 0, 0.0025, (0.004 + Z_OPT) / 2);  // backing of the silvered half
    for (const side of [-1, 1]) hPart(0.002, 0.004, 0.044, side * 0.017, 0.0005, 0.026); // side posts
    hPart(0.036, 0.004, 0.002, 0, 0.0005, 0.047);                          // top bar

    // Telescope: an open tube from just behind the horizon glass back to the eyepiece,
    // with an object glass at the front and an eye lens at the back.
    const T_IN = 0.0095, tStart = H2[0] + 0.025, tLen = EYE_LOCAL.x - tStart;
    const tube = hollowTube(T_IN, 0.011, tLen, tubeBrass);
    tube.rotation.z = Math.PI / 2; tube.position.set(tStart + tLen / 2, H2[1], Z_OPT); b.add(tube);
    const eyecup = hollowTube(T_IN, 0.014, 0.012, tubeBrass);
    eyecup.rotation.z = Math.PI / 2; eyecup.position.set(EYE_LOCAL.x - 0.006, H2[1], Z_OPT); b.add(eyecup);
    for (const x of [tStart + 0.002, EYE_LOCAL.x - 0.008]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(T_IN, 32), lensGlass);
      lens.rotation.y = Math.PI / 2; lens.position.set(x, H2[1], Z_OPT); lens.userData.glass = true; b.add(lens);
    }
    // The bracket holding the telescope reaches up to the tube's underside, not into it.
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, Z_OPT - 0.011), brass);
    bracket.position.set(0.02, H2[1], (Z_OPT - 0.011) / 2); b.add(bracket);

    // Handle on the back face (held in the right hand).
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.095, 0.024), wood);
    grip.position.set(0.012, -0.082, -0.04); b.add(grip);
    for (const y of [-0.04, -0.124]) {
      const post = cylinder(0.004, 0.03, brass); post.rotation.x = Math.PI / 2; post.position.set(0.012, y, -0.017); b.add(post);
    }

    // Index arm with its mirror, the index mark at the arc, and the micrometer drum below it.
    b.add(this.arm);
    const armShape = new THREE.Shape();
    armShape.moveTo(-0.014, 0.012); armShape.lineTo(0.014, 0.012); armShape.lineTo(0.007, -(ARC_IN - 0.012));
    armShape.lineTo(0, -(ARC_IN - 0.0004)); armShape.lineTo(-0.007, -(ARC_IN - 0.012)); armShape.closePath();
    const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: 0.003, bevelEnabled: false });
    armGeo.translate(0, 0, 0.0025);
    this.arm.add(new THREE.Mesh(armGeo, darkBrass));
    // A bright index line down the arm's tip, which points at the arc's degree marks.
    const indexLine = new THREE.Mesh(new THREE.BoxGeometry(0.0007, 0.014, 0.0004), new THREE.MeshBasicMaterial({ color: 0xf3e6c0 }));
    indexLine.position.set(0, -(ARC_IN - 0.0075), 0.0057); this.arm.add(indexLine);
    const boss = cylinder(0.012, 0.006, darkBrass, 32); boss.rotation.x = Math.PI / 2; boss.position.z = 0.006; this.arm.add(boss);
    // The index mirror turns with the arm; at reading 0 it is parallel to the horizon glass.
    const nI0 = new THREE.Vector2(u.x - 1, u.y).normalize();
    const nArm = nI0.clone().rotateAround(new THREE.Vector2(0, 0), -PSI_ZERO * D2R);
    this.indexMirror = mirror(0, 0, nArm.x, nArm.y, 0.045, 0.006, 0.046, silver);
    this.arm.add(this.indexMirror);
    const iBack = mirror(-nArm.x * 0.003, -nArm.y * 0.003, nArm.x, nArm.y, 0.05, 0.005, 0.048, darkBrass);
    this.arm.add(iBack);
    this.armIndex.position.set(0, -READ_ARC, 0.0021); this.arm.add(this.armIndex);
    // The arm continues behind the frame to the micrometer below the arc.
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.014, DRUM_AT - ARC_IN + 0.012, 0.003), darkBrass);
    back.position.set(0, -(ARC_IN + DRUM_AT) / 2, -0.0035); this.arm.add(back);
    const drumBlock = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), darkBrass);
    drumBlock.position.set(0, -DRUM_AT, 0.001); this.arm.add(drumBlock);
    // Drum: its axis along the arc, graduated end toward the arm, where a fixed tab marks the reading.
    const drumAxis = new THREE.Group(); drumAxis.position.set(DRUM_X, -DRUM_AT, 0.006); drumAxis.rotation.z = Math.PI / 2;
    this.arm.add(drumAxis);
    drumAxis.add(this.drumSpin);
    this.drum = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, DRUM_LEN, 96, 1),
      engravedBrass(canvasTexture(DRUM_W, drawDrum, DRUM_H), { metalness: 0.5, roughness: 0.4 }));
    this.drumSpin.add(this.drum);
    const knurl = cylinder(DRUM_R * 0.92, 0.008, steel, 48); knurl.position.y = -(DRUM_LEN / 2 + 0.004); this.drumSpin.add(knurl);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.005, 0.0015), brass);
    tab.position.set(DRUM_X - DRUM_LEN / 2 - 0.004, -DRUM_AT, 0.006 + DRUM_R - 0.0004); this.arm.add(tab);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0006, 0.0004), new THREE.MeshBasicMaterial({ color: 0x2a1a08 }));
    mark.position.set(DRUM_X - DRUM_LEN / 2 - 0.004, -DRUM_AT, 0.006 + DRUM_R + 0.0006); this.arm.add(mark);
    this.drumIndex.position.set(DRUM_X - DRUM_LEN / 2 + 0.0015, -DRUM_AT, 0.006 + DRUM_R); this.arm.add(this.drumIndex);

    // Display stand from the deck to the handle.
    const handleAt = new THREE.Vector3(0.012, -0.13, -0.04).sub(EYE_LOCAL);
    const rod = cylinder(0.008, EYE_Y + handleAt.y, brass);
    rod.position.set(handleAt.x, (-EYE_Y + handleAt.y) / 2, handleAt.z);
    this.yaw.add(rod);

    this.pose();
  }

  setAim(az: number): void { this.az = wrap360(az); }
  setReading(r: number): void { this.reading = Math.max(0, Math.min(120, r)); }

  pose(): void {
    // Turning by 90° − az brings the telescope's forward axis (−x) to azimuth az.
    this.yaw.rotation.y = (90 - this.az) * D2R;
    // Lift the forward axis to the line-of-sight elevation (a rotation about +z lowers −x).
    this.pitch.rotation.z = -this.sightAlt * D2R;
    this.arm.rotation.z = armAngle(this.reading) * D2R;
    const minutes = (((this.reading % 1) + 1) % 1) * 60;
    this.drumSpin.rotation.y = minutes * 6 * D2R;
    this.root.updateMatrixWorld(true);
  }

  /** The eyepiece, world coordinates. */
  eye(out = new THREE.Vector3()): THREE.Vector3 { return this.body.localToWorld(out.copy(EYE_LOCAL)); }

  /** World direction of the telescope's line of sight (through the clear half, to the horizon). */
  telescopeAxis(out = new THREE.Vector3()): THREE.Vector3 { return out.set(-1, 0, 0).transformDirection(this.body.matrixWorld); }

  /** World normal of the frame (the optics side). */
  frameNormal(out = new THREE.Vector3()): THREE.Vector3 { return out.set(0, 0, 1).transformDirection(this.body.matrixWorld); }

  /** Where the silvered half looks: the line of sight turned up by the reading about the frame's normal. */
  reflectedRotation(out = new THREE.Quaternion()): THREE.Quaternion {
    return out.setFromAxisAngle(this.frameNormal(new THREE.Vector3()), -this.reading * D2R);
  }

  reflectedDirection(out = new THREE.Vector3()): THREE.Vector3 {
    return this.telescopeAxis(out).applyQuaternion(this.reflectedRotation());
  }

  /**
   * Trace the line of sight back out of the instrument off the two mirrors as
   * modelled: from the eyepiece to the horizon glass, then to the index mirror,
   * then to the sky. Returns the world direction it leaves in.
   */
  traceReflected(out = new THREE.Vector3()): THREE.Vector3 {
    const ray = new THREE.Ray(this.eye(new THREE.Vector3()), this.telescopeAxis(new THREE.Vector3()));
    for (const m of [this.horizonMirror, this.indexMirror]) {
      const n = new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3().setFromMatrixPosition(m.matrixWorld));
      const hit = ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return out.set(NaN, NaN, NaN);
      ray.direction.reflect(n);
      ray.origin.copy(hit);
    }
    return out.copy(ray.direction);
  }

  /** Arc value under the arm's index mark, read through the arc texture (continuous, degrees). */
  readArc(): number {
    const p = this.arc.worldToLocal(this.armIndex.getWorldPosition(new THREE.Vector3()));
    p.z = 0;
    const uv = uvAtLocalPoint(this.arc.geometry, p);
    return uv ? arcReadingAt(...uvToCanvas(uv, ARC_TEX)) : NaN;
  }

  /** Minutes on the drum under its index line, read through the drum texture. */
  readDrum(): number {
    const p = this.drum.worldToLocal(this.drumIndex.getWorldPosition(new THREE.Vector3()));
    const uv = uvAtLocalPoint(this.drum.geometry, p, 0.001);
    return uv ? drumMinutesAtU(uv.x) : NaN;
  }

  /** What a navigator reads: the degree mark the index has passed, plus the drum's minutes (degrees). */
  readSextant(): number {
    const m = this.readDrum();
    return Math.round(this.readArc() - m / 60) + m / 60;
  }

  /** World point of the arm's index on the arc, and of the drum's index line (for close-ups). */
  arcIndexPoint(out = new THREE.Vector3()): THREE.Vector3 { return this.armIndex.getWorldPosition(out); }
  drumIndexPoint(out = new THREE.Vector3()): THREE.Vector3 { return this.drumIndex.getWorldPosition(out); }
}

/** A plank deck with a rail, around the observer. */
export function makeDeck(): THREE.Group {
  const g = new THREE.Group();
  const planks = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 7), new THREE.MeshStandardMaterial({ color: 0x3b2716, roughness: 0.85 }));
  planks.position.y = -0.06; g.add(planks);
  const rnd = seededRandom(5);
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x1e140b, roughness: 1 });
  for (let i = -3.4; i <= 3.4; i += 0.2) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.002, 7), seamMat);
    seam.position.set(i + (rnd() - 0.5) * 0.01, 0.001, 0); g.add(seam);
  }
  const railMat = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.6 });
  for (const s of [-1, 1]) for (const axis of ['x', 'z'] as const) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 7 : 0.08, 0.06, axis === 'x' ? 0.08 : 7), railMat);
    rail.position.set(axis === 'x' ? 0 : s * 3.46, 1.0, axis === 'x' ? s * 3.46 : 0);
    g.add(rail);
    for (let t = -3.4; t <= 3.41; t += 0.85) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), railMat);
      post.position.set(axis === 'x' ? t : s * 3.46, 0.5, axis === 'x' ? s * 3.46 : t);
      g.add(post);
    }
  }
  return g;
}
