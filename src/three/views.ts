// Camera framings shared by the instrument pages.
import * as THREE from 'three';

export interface CameraPose {
  position: THREE.Vector3;
  /** Orbit centre; the camera looks at it. */
  target: THREE.Vector3;
}

export interface StandingViewOptions {
  /** How far behind the instrument the observer stands, m (away from the star). */
  back?: number;
  /** Sideways offset, m: positive to the observer's right, negative to the left. */
  side?: number;
  /** Eye height, m. */
  eyeY?: number;
  /**
   * A point of the instrument to keep in the picture. The view then turns from
   * the star toward it: halfway when both fit, otherwise until the instrument
   * sits `keepAngle` below the middle of the view (the star may then be above it).
   */
  keep?: THREE.Vector3;
  /** Degrees (default 17). */
  keepAngle?: number;
}

/**
 * The observer standing a little behind and to one side of the instrument, at
 * eye height, looking toward a star (`dir`, a unit vector toward it). Without
 * `keep` the star is at the centre of the view; with it, the view tilts toward
 * the instrument so that both show when they can, and the instrument always does.
 */
export function standingViewToward(pivot: THREE.Vector3, dir: THREE.Vector3, o: StandingViewOptions = {}): CameraPose {
  const d = dir.clone().normalize();
  const back = o.back ?? 2.8, side = o.side ?? -0.5, eyeY = o.eyeY ?? 1.6;
  // Horizontal direction toward the star (due north for a star at the zenith).
  let hx = d.x, hz = d.z;
  const hl = Math.hypot(hx, hz);
  if (hl < 1e-6) { hx = 0; hz = 1; } else { hx /= hl; hz /= hl; }
  const rx = -hz, rz = hx; // the observer's right
  const position = new THREE.Vector3(pivot.x - hx * back + rx * side, eyeY, pivot.z - hz * back + rz * side);
  let look = d;
  if (o.keep) {
    const toKeep = o.keep.clone().sub(position).normalize(), a = toKeep.angleTo(d);
    const axis = new THREE.Vector3().crossVectors(toKeep, d);
    if (axis.lengthSq() > 1e-10) look = toKeep.applyAxisAngle(axis.normalize(), Math.min(a / 2, ((o.keepAngle ?? 17) * Math.PI) / 180));
  }
  return { position, target: position.clone().addScaledVector(look, back) };
}
