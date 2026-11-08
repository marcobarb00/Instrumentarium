// Camera framings shared by the instrument pages.
import * as THREE from 'three';

export interface CameraPose {
  position: THREE.Vector3;
  /** Orbit centre; the camera looks at it. */
  target: THREE.Vector3;
}

export interface SkyViewOptions {
  /** Preferred distance behind the instrument, m. */
  distance?: number;
  /** Lowest allowed eye height, m. */
  minEyeY?: number;
  /** How far below the view centre the instrument sits, as a fraction of the distance. */
  drop?: number;
}

/**
 * An over-the-shoulder view of the sky: the camera stands behind and a little
 * above `pivot` and looks straight along `dir` (a unit vector toward a star),
 * so the star is at the centre of the view and the instrument just below it.
 * For high stars the camera moves closer so it stays above the ground.
 */
export function skyViewToward(pivot: THREE.Vector3, dir: THREE.Vector3, o: SkyViewOptions = {}): CameraPose {
  const d = dir.clone().normalize();
  const minY = o.minEyeY ?? 0.35, drop = o.drop ?? 0.22;
  // Up in the camera's view: perpendicular to d, toward the zenith.
  const worldUp = new THREE.Vector3(0, 1, 0);
  let up = worldUp.clone().addScaledVector(d, -d.y);
  if (up.lengthSq() < 1e-6) up = new THREE.Vector3(0, 0, 1); // star at the zenith
  up.normalize();
  // Eye height is pivot.y − D·(d.y − drop·up.y); keep it above minY.
  const fall = d.y - drop * up.y;
  let D = o.distance ?? 3.4;
  if (fall > 1e-6) D = Math.min(D, (pivot.y - minY) / fall);
  D = Math.max(1.2, D);
  const position = pivot.clone().addScaledVector(d, -D).addScaledVector(up, drop * D);
  position.y = Math.max(position.y, minY);
  return { position, target: position.clone().addScaledVector(d, D) };
}
