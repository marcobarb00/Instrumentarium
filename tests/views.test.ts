import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { directionFromHorizontal } from '../src/core/astro';
import { standingViewToward } from '../src/three/views';

const R2D = 180 / Math.PI;

describe('standing view toward a star', () => {
  const pivot = new THREE.Vector3(0, 1.72, 0);

  it('centres the star from eye height, standing behind the instrument; low stars show the instrument too', () => {
    for (const alt of [0, 5, 15, 21.5, 45, 66, 88, 90]) {
      for (const az of [0, 90, 180, 303]) {
        const dir = new THREE.Vector3(...directionFromHorizontal(alt, az));
        const v = standingViewToward(pivot, dir);
        const look = v.target.clone().sub(v.position).normalize();
        expect(look.angleTo(dir) * R2D).toBeLessThan(1e-6);             // star at the view centre
        expect(v.position.y).toBeCloseTo(1.6, 9);                        // eye height
        const toPivot = pivot.clone().sub(v.position);
        const flatDir = new THREE.Vector3(dir.x, 0, dir.z);
        if (flatDir.lengthSq() > 1e-9) expect(toPivot.dot(flatDir)).toBeGreaterThan(0); // instrument ahead, not under the camera
        if (alt <= 15) expect(toPivot.angleTo(look) * R2D).toBeLessThan(25); // and inside the 50° view
      }
    }
  });
});
