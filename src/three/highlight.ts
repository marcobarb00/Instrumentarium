// Light up parts of an instrument for a moment ("Show me"): each mesh gets a
// copy of its material that glows gold, pulsing, and its own material back
// afterwards. Shared materials are never changed.
import * as THREE from 'three';

const GLOW = new THREE.Color(0xffc45a);

export class Highlighter {
  private lit: { mesh: THREE.Mesh; orig: THREE.Material; copy: THREE.MeshStandardMaterial }[] = [];
  private start = 0;
  private ms = 0;

  flash(objects: THREE.Object3D[], ms = 3200): void {
    this.clear();
    for (const o of objects) o.traverse(n => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return;
      if (this.lit.some(l => l.mesh === mesh)) return;
      const copy = mesh.material.clone();
      copy.emissive = GLOW.clone();
      copy.emissiveIntensity = 0;
      this.lit.push({ mesh, orig: mesh.material, copy });
      mesh.material = copy;
    });
    this.start = performance.now();
    this.ms = ms;
  }

  /** Call every frame. */
  update(now = performance.now()): void {
    if (!this.lit.length) return;
    const t = (now - this.start) / this.ms;
    if (t >= 1) { this.clear(); return; }
    // Three soft pulses, fading out.
    const k = 0.5 - 0.5 * Math.cos(t * Math.PI * 6);
    for (const l of this.lit) l.copy.emissiveIntensity = 0.6 * k * (1 - 0.4 * t);
  }

  clear(): void {
    for (const l of this.lit) { l.mesh.material = l.orig; l.copy.dispose(); }
    this.lit = [];
  }
}
