// Find the texture coordinate under a point on a flat mesh. Used to read an
// instrument's engraved scale exactly where a cord, pointer or edge crosses it,
// from the real geometry, so tests check the model rather than a formula.
import * as THREE from 'three';

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const bary = new THREE.Vector3(), tri = new THREE.Triangle(), proj = new THREE.Vector3();
const ua = new THREE.Vector2(), ub = new THREE.Vector2(), uc = new THREE.Vector2();

/**
 * UV at `p` (in the mesh's local frame). The point is projected onto each
 * triangle's plane; returns null if it falls outside every triangle.
 */
export function uvAtLocalPoint(geometry: THREE.BufferGeometry, p: THREE.Vector3): THREE.Vector2 | null {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const index = geometry.index;
  const count = index ? index.count : pos.count;
  for (let i = 0; i < count; i += 3) {
    const i0 = index ? index.getX(i) : i, i1 = index ? index.getX(i + 1) : i + 1, i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    tri.set(a, b, c);
    const plane = tri.getPlane(new THREE.Plane());
    plane.projectPoint(p, proj);
    tri.getBarycoord(proj, bary);
    if (bary.x >= -1e-9 && bary.y >= -1e-9 && bary.z >= -1e-9) {
      ua.fromBufferAttribute(uv, i0); ub.fromBufferAttribute(uv, i1); uc.fromBufferAttribute(uv, i2);
      return new THREE.Vector2(
        ua.x * bary.x + ub.x * bary.y + uc.x * bary.z,
        ua.y * bary.x + ub.y * bary.y + uc.y * bary.z);
    }
  }
  return null;
}

/** UV → canvas pixel for a texture drawn on a canvas of size w×h (Three flips Y by default). */
export function uvToCanvas(uv: THREE.Vector2, w: number, h = w): [number, number] {
  return [uv.x * w, (1 - uv.y) * h];
}
