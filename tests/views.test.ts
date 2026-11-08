import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal } from '../src/core/astro';
import { skyViewToward } from '../src/three/views';

const R2D = 180 / Math.PI;

describe('sky view toward a star', () => {
  const pivot = new THREE.Vector3(0, 1.72, 0);

  it('centres the star, keeps the eye above ground and the instrument in view', () => {
    for (const alt of [0, 5, 21.5, 45, 60, 75, 88]) {
      for (const az of [0, 90, 180, 303]) {
        const dir = new THREE.Vector3(...directionFromHorizontal(alt, az));
        const v = skyViewToward(pivot, dir);
        const look = v.target.clone().sub(v.position).normalize();
        expect(look.angleTo(dir) * R2D).toBeLessThan(1e-6);             // star at the view centre
        expect(v.position.y).toBeGreaterThanOrEqual(0.35 - 1e-9);         // above the ground
        const toPivot = pivot.clone().sub(v.position);
        expect(toPivot.angleTo(look) * R2D).toBeLessThan(20);            // instrument within the 50° view
        expect(toPivot.dot(look)).toBeGreaterThan(0);                     // and in front of the camera
      }
    }
  });
});
