// A planispheric astrolabe hung from a turning stand.
//
// Front: the mater's raised limb carries a 24-hour scale; inside it sits the
// plate for the observer's latitude, and over the plate turns the rete (the
// star map: ecliptic ring and star pointers) and the rule. Back: the alidade,
// a sighting rule with two pierced vanes, turns over a degree scale, a zodiac
// and a calendar.
//
// The instrument hangs from its ring, so gravity holds it vertical. The stand
// turns it to face the star's azimuth; the alidade is then raised until the
// star shows through both vanes and its end reads the altitude.
import * as THREE from 'three';
import { D2R, R2D, wrap180, wrap360 } from '../../core/astro';
import { NAMED_BRIGHT, equatorialOfDate } from '../../core/catalogue';
import { eclipticToEquatorial, meanObliquity, sunLongitude } from '../../core/sun';
import { canvasTexture } from '../../three/engrave';
import { brass, cord, cylinder, darkBrass, engravedBrass, stone, wood } from '../../three/materials';
import { uvAtLocalPoint, uvToCanvas } from '../../three/uv';
import {
  backAngleAt, backAngleOfLongitude, drawBack, drawLimb, drawPlate, drawRete, layoutRete, limbHoursAt, pxToUnit, TEX,
  type ReteLayout, type ReteStarInput,
} from './drawings';
import { plateGeometry, plateToHorizontal, turn, type PlateGeometry } from './geometry';

export const MATER_R = 0.40;        // outer radius, m
export const PLATE_R = 0.34;        // plate radius = Tropic of Capricorn
export const CENTER_Y = 1.45;       // height of the centre
/** Where the scales are read, as fractions of MATER_R (middle of each tick band). */
const READ_BACK = 0.93, READ_LIMB = 0.955;
/** The sighting vanes: distance from the centre along the alidade, and height above it. */
const VANE_X = 0.24, VANE_H = 0.035;
const Z = { plate: 0.0045, rete: 0.006, limb: 0.008, rule: 0.0088, back: -0.0062, alidade: -0.0092 };

/** Engraved faces: worn brass, less mirror-like than the frame, so the scales read from any side. */
const FACE: THREE.MeshStandardMaterialParameters = { metalness: 0.55, roughness: 0.45 };

/** Stars bright enough, and far enough from the pole and the rim, to get a pointer. */
const RETE_MAG = 2.1;

export class AstrolabeModel {
  readonly root = new THREE.Group();
  /** Turns with the stand (azimuth). */
  readonly azGroup = new THREE.Group();
  /** The instrument itself: front toward +Z, star side of the alidade toward −X. */
  readonly body = new THREE.Group();
  readonly alidade = new THREE.Group();
  readonly reteGroup = new THREE.Group();
  readonly ruleGroup = new THREE.Group();
  readonly plate: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  readonly rete: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  readonly limb: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
  readonly back: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  readonly vaneLow = new THREE.Object3D();
  readonly vaneHigh = new THREE.Object3D();
  readonly marker: THREE.Mesh;
  /** Front meshes that can be grabbed to turn the rete or the rule. */
  readonly frontParts: THREE.Object3D[];
  readonly ruleMesh: THREE.Mesh;

  /** Azimuth the instrument faces (the alidade's star side), degrees. */
  az = 150;
  /** Alidade angle above the horizontal on the star side, degrees (−90…90). */
  alt = 20;
  /** Rete turned clockwise by this angle: equal to the local sidereal time when set right. */
  reteAngle = 0;
  /** Direction of the rule's edge, clockwise from the top. */
  ruleAngle = 150;

  geo: PlateGeometry = plateGeometry(41.9, 23.44);
  layout!: ReteLayout;
  sunLon = 0;
  private plateKey = '';
  private reteKey = '';
  private backKey = '';
  private markerId = -1;

  constructor() {
    const root = this.root;
    const base = cylinder(0.85, 0.08, stone, 64); base.position.y = 0.04; root.add(base);
    root.add(this.azGroup);

    // The turning stand: a disc, a post out of the instrument's plane, and an arm over it.
    const table = cylinder(0.8, 0.04, wood, 64); table.position.y = 0.1; this.azGroup.add(table);
    const postAt = new THREE.Vector3(0.45, 0, -0.45), armY = 2.3;
    const post = cylinder(0.03, armY - 0.1, wood); post.position.set(postAt.x, 0.1 + (armY - 0.1) / 2, postAt.z); this.azGroup.add(post);
    const armDir = new THREE.Vector3(-postAt.x, 0, -postAt.z), armLen = armDir.length() + 0.03;
    const arm = cylinder(0.022, armLen, wood);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir.normalize());
    arm.position.set(postAt.x / 2, armY, postAt.z / 2); this.azGroup.add(arm);
    const ringTop = CENTER_Y + MATER_R + 0.132;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, armY - ringTop, 6), cord);
    line.position.y = (armY + ringTop) / 2; this.azGroup.add(line);

    this.body.position.y = CENTER_Y;
    this.azGroup.add(this.body);
    const b = this.body;

    // Mater, raised limb and throne.
    const mater = cylinder(MATER_R, 0.01, darkBrass, 160); mater.rotation.x = Math.PI / 2; mater.position.z = -0.001; b.add(mater);
    const wallOut = new THREE.Mesh(new THREE.CylinderGeometry(MATER_R, MATER_R, Z.limb - 0.004, 160, 1, true), brass);
    wallOut.rotation.x = Math.PI / 2; wallOut.position.z = (Z.limb + 0.004) / 2; b.add(wallOut);
    const wallIn = new THREE.Mesh(new THREE.CylinderGeometry(PLATE_R, PLATE_R, Z.limb - 0.004, 160, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x8c672c, metalness: 0.9, roughness: 0.42, side: THREE.DoubleSide }));
    wallIn.rotation.x = Math.PI / 2; wallIn.position.z = (Z.limb + 0.004) / 2; b.add(wallIn);
    this.limb = new THREE.Mesh(new THREE.RingGeometry(PLATE_R, MATER_R, 256, 1),
      engravedBrass(canvasTexture(TEX, (g, S) => drawLimb(g, S, PLATE_R / MATER_R)), FACE));
    this.limb.position.z = Z.limb; b.add(this.limb);

    const throne = new THREE.Shape();
    throne.moveTo(-0.09, MATER_R - 0.03);
    throne.quadraticCurveTo(-0.075, MATER_R + 0.035, -0.032, MATER_R + 0.05);
    throne.quadraticCurveTo(0, MATER_R + 0.085, 0.032, MATER_R + 0.05);
    throne.quadraticCurveTo(0.075, MATER_R + 0.035, 0.09, MATER_R - 0.03);
    throne.closePath();
    const hole = new THREE.Path(); hole.absarc(0, MATER_R + 0.052, 0.008, 0, Math.PI * 2, true); throne.holes.push(hole);
    const throneGeo = new THREE.ExtrudeGeometry(throne, { depth: 0.012, bevelEnabled: false, curveSegments: 24 });
    throneGeo.translate(0, 0, -0.007);
    b.add(new THREE.Mesh(throneGeo, brass));
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 8, 24), brass);
    shackle.position.y = MATER_R + 0.064; shackle.rotation.y = Math.PI / 2; b.add(shackle);
    const armilla = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.005, 10, 32), brass);
    armilla.position.y = MATER_R + 0.093; b.add(armilla);

    // Plate, rete, rule and the central pin with its wedge.
    this.plate = new THREE.Mesh(new THREE.CircleGeometry(PLATE_R, 160), engravedBrass(new THREE.Texture(), FACE));
    this.plate.position.z = Z.plate; b.add(this.plate);
    this.reteGroup.position.z = Z.rete; b.add(this.reteGroup);
    this.rete = new THREE.Mesh(new THREE.CircleGeometry(PLATE_R, 160),
      engravedBrass(new THREE.Texture(), { alphaTest: 0.5, side: THREE.DoubleSide, color: 0xc08a4a, metalness: 0.8, roughness: 0.32 }));
    this.reteGroup.add(this.rete);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.0045, 0.0075, 32), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
    this.marker.visible = false; this.reteGroup.add(this.marker);

    const rule = new THREE.Shape(), w = 0.022, tip = MATER_R * 0.975, shoulder = MATER_R * 0.8;
    rule.moveTo(0, -tip); rule.lineTo(w, -shoulder); rule.lineTo(w, shoulder); rule.lineTo(0, tip); rule.closePath();
    this.ruleMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(rule, { depth: 0.0018, bevelEnabled: false }), brass);
    this.ruleGroup.position.z = Z.rule; this.ruleGroup.add(this.ruleMesh); b.add(this.ruleGroup);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 2 * tip * 0.995, 0.0004), new THREE.MeshBasicMaterial({ color: 0x2a1a08 }));
    edge.position.set(0.0006, 0, 0.0019); this.ruleGroup.add(edge);
    const pin = cylinder(0.007, 0.024, brass); pin.rotation.x = Math.PI / 2; pin.position.z = 0.003; b.add(pin);
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.007, 0.004), darkBrass); wedge.position.z = 0.013; b.add(wedge);

    // Back and alidade.
    this.back = new THREE.Mesh(new THREE.CircleGeometry(MATER_R, 160), engravedBrass(new THREE.Texture(), FACE));
    this.back.rotation.y = Math.PI; this.back.position.z = Z.back; b.add(this.back);
    this.alidade.position.z = 0; b.add(this.alidade);
    const ali = new THREE.Shape(), aw = 0.015, aTip = MATER_R * 0.97, aShoulder = MATER_R * 0.76;
    ali.moveTo(-aTip, 0); ali.lineTo(-aShoulder, aw); ali.lineTo(aShoulder, aw); ali.lineTo(aTip, 0);
    ali.lineTo(aShoulder, -aw); ali.lineTo(-aShoulder, -aw); ali.closePath();
    const aliMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ali, { depth: 0.0025, bevelEnabled: false }), brass);
    aliMesh.position.z = Z.alidade; this.alidade.add(aliMesh);
    for (const x of [VANE_X, -VANE_X]) {
      const vs = new THREE.Shape();
      vs.moveTo(0.009, -0.016); vs.lineTo(0.057, -0.016); vs.lineTo(0.057, 0.016); vs.lineTo(0.009, 0.016); vs.closePath();
      const vh = new THREE.Path(); vh.absarc(VANE_H, 0, 0.006, 0, Math.PI * 2, true); vs.holes.push(vh);
      const vg = new THREE.ExtrudeGeometry(vs, { depth: 0.0025, bevelEnabled: false, curveSegments: 20 });
      vg.rotateY(Math.PI / 2); vg.translate(x - 0.00125, 0, 0);
      this.alidade.add(new THREE.Mesh(vg, brass));
    }
    this.vaneLow.position.set(VANE_X, 0, -VANE_H); this.alidade.add(this.vaneLow);
    this.vaneHigh.position.set(-VANE_X, 0, -VANE_H); this.alidade.add(this.vaneHigh);
    const backPin = cylinder(0.011, 0.004, darkBrass); backPin.rotation.x = Math.PI / 2; backPin.position.z = -0.0105; b.add(backPin);

    this.frontParts = [this.ruleMesh, this.rete, this.plate, this.limb];
    this.pose();
  }

  /**
   * Set the plate, rete and calendar for an observer and instant. Textures are
   * redrawn only when their inputs change (plate: latitude; rete and calendar: year).
   */
  configure(lat: number, date: Date): void {
    const year = date.getUTCFullYear(), eps = meanObliquity(new Date(Date.UTC(year, 6, 1)));
    this.sunLon = sunLongitude(date);
    const pk = `${lat.toFixed(4)}|${eps.toFixed(4)}`;
    if (pk !== this.plateKey) {
      this.plateKey = pk;
      this.geo = plateGeometry(lat, eps);
      this.setMap(this.plate, canvasTexture(TEX, (g, S) => drawPlate(g, S, this.geo)));
      this.reteKey = '';
    }
    const rk = `${year}|${this.geo.s}|${eps.toFixed(4)}`;
    if (rk !== this.reteKey) {
      this.reteKey = rk;
      const mid = new Date(Date.UTC(year, 6, 1));
      const eq = equatorialOfDate(mid);
      const stars: ReteStarInput[] = NAMED_BRIGHT
        .map(s => ({ id: s.id, name: s.name, ra: eq.ra[s.id], dec: eq.dec[s.id], mag: s.mag }))
        .filter(s => s.mag <= RETE_MAG && this.geo.s * s.dec >= -eps + 1.5 && this.geo.s * s.dec <= 70);
      this.layout = layoutRete(this.geo, stars, lon => eclipticToEquatorial(lon, eps));
      this.setMap(this.rete, canvasTexture(TEX, (g, S) => drawRete(g, S, this.layout)));
      this.setMarker(this.markerId);
    }
    if (String(year) !== this.backKey) {
      this.backKey = String(year);
      this.setMap(this.back, canvasTexture(TEX, (g, S) => drawBack(g, S, year, sunLongitude)));
    }
  }

  private setMap(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, tex: THREE.Texture): void {
    mesh.material.map?.dispose();
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
  }

  /** Star ids that have a pointer on the rete. */
  reteStarIds(): Set<number> { return new Set(this.layout.pointers.map(p => p.id)); }

  /** Show a small ring round one star's pointer tip (−1 hides it). */
  setMarker(id: number): void {
    this.markerId = id;
    const p = this.layout?.pointers.find(q => q.id === id);
    this.marker.visible = !!p;
    if (p) this.marker.position.set(p.tip[0] * PLATE_R, p.tip[1] * PLATE_R, 0.0006);
  }

  setAim(az: number, alt: number): void {
    this.az = wrap360(az);
    this.alt = Math.max(-90, Math.min(90, alt));
  }
  setRete(psi: number): void { this.reteAngle = wrap360(psi); }
  setRule(psi: number): void { this.ruleAngle = wrap360(psi); }

  pose(): void {
    // Turning the stand by 90° − az brings the alidade's star side (−X) to azimuth az.
    this.azGroup.rotation.y = (90 - this.az) * D2R;
    this.alidade.rotation.z = -this.alt * D2R;
    this.reteGroup.rotation.z = -this.reteAngle * D2R;
    this.ruleGroup.rotation.z = -this.ruleAngle * D2R;
    this.root.updateMatrixWorld(true);
  }

  /** World direction of the line of sight through the vanes (low vane → high vane). */
  sightDirection(out = new THREE.Vector3()): THREE.Vector3 {
    const hi = this.vaneHigh.getWorldPosition(new THREE.Vector3());
    return out.copy(hi).sub(this.vaneLow.getWorldPosition(new THREE.Vector3())).normalize();
  }

  /** The observer's eye for the sight view: just behind the low vane. */
  eye(out = new THREE.Vector3()): THREE.Vector3 {
    return this.alidade.localToWorld(out.set(VANE_X + 0.03, 0, -VANE_H));
  }

  /** World unit normal of the front face. */
  frontNormal(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(0, 0, 1).transformDirection(this.body.matrixWorld);
  }

  centre(out = new THREE.Vector3()): THREE.Vector3 { return this.body.getWorldPosition(out); }

  /** World point at the star end of the alidade, over the degree scale. */
  alidadeTip(out = new THREE.Vector3()): THREE.Vector3 {
    return this.alidade.localToWorld(out.set(-READ_BACK * MATER_R, 0, Z.back - 0.0005));
  }

  /** The back's degree scale under the alidade's star end, read through the texture. */
  readAlidade(): number {
    const p = this.back.worldToLocal(this.alidadeTip());
    p.z = 0;
    const uv = uvAtLocalPoint(this.back.geometry, p);
    return uv ? backAngleAt(...uvToCanvas(uv, TEX)) : NaN;
  }

  /** World point where one end of the rule's edge crosses the hour scale. */
  ruleTip(end: 1 | -1, out = new THREE.Vector3()): THREE.Vector3 {
    return this.ruleGroup.localToWorld(out.set(0, end * READ_LIMB * MATER_R, 0));
  }

  /** Hours on the limb under one end of the rule. */
  readRule(end: 1 | -1): number {
    const p = this.limb.worldToLocal(this.ruleTip(end));
    p.z = 0;
    const uv = uvAtLocalPoint(this.limb.geometry, p);
    return uv ? limbHoursAt(...uvToCanvas(uv, TEX)) : NaN;
  }

  /** The sun's place on the ecliptic ring, in world coordinates. */
  sunPoint(out = new THREE.Vector3()): THREE.Vector3 {
    const [x, y] = this.layout.eclipticPoint(this.sunLon);
    return this.rete.localToWorld(out.set(x * PLATE_R, y * PLATE_R, 0));
  }

  /** The end of the rule lying over the sun's place. */
  ruleEndOverSun(): 1 | -1 {
    const [x, y] = turn(this.layout.eclipticPoint(this.sunLon), this.reteAngle);
    const psiSun = Math.atan2(x, y) * R2D;
    return Math.cos((psiSun - this.ruleAngle) * D2R) >= 0 ? 1 : -1;
  }

  /** World position of a star's pointer tip, or null if it has none. */
  pointerTip(id: number, out = new THREE.Vector3()): THREE.Vector3 | null {
    const p = this.layout.pointers.find(q => q.id === id);
    return p ? this.rete.localToWorld(out.set(p.tip[0] * PLATE_R, p.tip[1] * PLATE_R, 0)) : null;
  }

  /** Altitude and azimuth of the plate's lines under a world point, read through the plate texture. */
  plateReadingAt(world: THREE.Vector3): { alt: number; az: number } | null {
    const p = this.plate.worldToLocal(world.clone());
    p.z = 0;
    const uv = uvAtLocalPoint(this.plate.geometry, p);
    if (!uv) return null;
    return plateToHorizontal(...pxToUnit(...uvToCanvas(uv, TEX)), this.geo);
  }

  /** Angle on the back (counter-clockwise from the star side) of a date on the calendar ring. */
  calendarAngle(y: number, m: number, d: number): number {
    return backAngleOfLongitude(sunLongitude(new Date(Date.UTC(y, m - 1, d, 12))));
  }

  /** World point on the back at angle θ (as seen from behind) and radius `frac` × MATER_R. */
  backPoint(theta: number, frac: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.body.localToWorld(out.set(-Math.cos(theta * D2R) * frac * MATER_R, Math.sin(theta * D2R) * frac * MATER_R, Z.back));
  }

  /** Alidade angle that lays it across a date on the back's calendar (noon UT of that date). */
  alidadeForDate(y: number, m: number, d: number): number {
    const th = this.calendarAngle(y, m, d);
    // The alidade is a diameter; use whichever end gives an angle in −90…90.
    let a = wrap180(th);
    if (a > 90) a -= 180;
    if (a < -90) a += 180;
    return a;
  }

  /** Turn the rete with a drag: the angle of a world point about the centre, clockwise from the top, as seen from the front. */
  frontAngleOf(world: THREE.Vector3): number {
    const p = this.body.worldToLocal(world.clone());
    return Math.atan2(p.x, p.y) * R2D;
  }
}
