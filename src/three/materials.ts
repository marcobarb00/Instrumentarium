// Shared materials and the night-time lighting rig.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const brass = new THREE.MeshStandardMaterial({ color: 0xc9973f, metalness: 0.92, roughness: 0.3 });
export const darkBrass = new THREE.MeshStandardMaterial({ color: 0x8c672c, metalness: 0.9, roughness: 0.42 });
export const wood = new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.65 });
export const stone = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.95 });
export const steel = new THREE.MeshStandardMaterial({ color: 0x777b83, metalness: 1, roughness: 0.3 });
export const cord = new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.8 });

/** Brass carrying an engraved canvas texture. */
export function engravedBrass(map: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map, metalness: 0.85, roughness: 0.33, ...opts });
}

/** Real-time reflections for the metal: a blurred room environment, as in the prototype. */
export function applyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

/** Moonlight, sky fill and a warm lantern near the instrument. */
export function addNightLights(scene: THREE.Scene, lanternAt = new THREE.Vector3(-1.3, 1.2, -1.0)): THREE.PointLight {
  scene.add(new THREE.HemisphereLight(0x5a6c9a, 0x0a0805, 0.5));
  const moon = new THREE.DirectionalLight(0xc8d2ff, 1.3);
  moon.position.set(-5, 6, -2);
  scene.add(moon);
  const lantern = new THREE.PointLight(0xffd6a0, 3.2, 7, 1.4);
  lantern.position.copy(lanternAt);
  scene.add(lantern);
  return lantern;
}

export function cylinder(r: number, h: number, m: THREE.Material, seg = 24): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
}
