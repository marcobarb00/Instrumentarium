// Helpers for drawing engraved scales onto canvases that become brass textures.
import * as THREE from 'three';

export const ENGRAVE = 'rgba(48,28,8,0.9)';
export const ENGRAVE_FONT = 'Georgia, "Times New Roman", serif';

let maxAnisotropy = 1;
/** Call once the renderer exists so textures can use its anisotropic filtering. */
export function setMaxAnisotropy(n: number): void { maxAnisotropy = n; }

/** Deterministic pseudo-random numbers (Park–Miller), for repeatable wear and grain. */
export function seededRandom(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Draw on a fresh canvas and wrap it in a texture. Outside a browser (unit
 * tests) no canvas exists, so an empty texture is returned and `draw` is skipped.
 */
export function canvasTexture(width: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, height = width): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  if (g) draw(g, width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAnisotropy;
  return t;
}

/** The prototype's polished-brass gradient. */
export function brassGradient(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#e3bd76'); gr.addColorStop(0.45, '#c99a48'); gr.addColorStop(1, '#a87a30');
  return gr;
}

/** Fine horizontal streaks that read as hand-finished metal. */
export function brushMarks(g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, n = 2500): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(80,50,10,${rnd() * 0.05})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 40, 1.5);
  }
}

export function strokeLine(g: CanvasRenderingContext2D, a: [number, number], b: [number, number], width: number): void {
  g.lineWidth = width;
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
}

export function strokeCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, width: number, a0 = 0, a1 = Math.PI * 2): void {
  g.lineWidth = width;
  g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
}

/**
 * Engrave text centred at (x, y), rotated by `rot` radians. `mirror` flips it
 * horizontally, for faces whose texture is seen from behind.
 */
export function engraveText(g: CanvasRenderingContext2D, text: string, x: number, y: number, rot: number, font: string, mirror = false): void {
  g.save();
  g.translate(x, y); g.rotate(rot); if (mirror) g.scale(-1, 1);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 0, 0);
  g.restore();
}
