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
}

/**
 * The observer standing a little behind and to one side of the instrument, at
 * eye height, looking straight at a star (`dir`, a unit vector toward it): the
 * star is at the centre of the view, and for low stars the instrument shows
 * in front. For high stars the instrument drops out of view; aiming at them is
 * done through the sights.
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
  return { position, target: position.clone().addScaledVector(d, back) };
}
