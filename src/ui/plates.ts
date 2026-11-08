// Engraving-style line drawings of each instrument for the home page plates.
// Scales are generated, so ticks are evenly divided like the real instruments.

const INK = '#1d2a44', RED = '#8d2f24';
const D = Math.PI / 180;

const svg = (body: string, label: string) =>
  `<svg viewBox="0 0 400 300" role="img" aria-label="${label}" fill="none" stroke="${INK}" stroke-linecap="round">${body}</svg>`;

function ticks(cx: number, cy: number, r: number, a0: number, a1: number, step: number, len: (a: number) => number, toXY: (a: number, rr: number) => [number, number]): string {
  let s = '';
  for (let a = a0; a <= a1 + 1e-6; a += step) {
    const [x0, y0] = toXY(a, r), [x1, y1] = toXY(a, r - len(a));
    s += `M${(cx + x0).toFixed(1)} ${(cy + y0).toFixed(1)}L${(cx + x1).toFixed(1)} ${(cy + y1).toFixed(1)}`;
  }
  return `<path d="${s}" stroke-width="0.7"/>`;
}

function quadrant(): string {
  // Tilted 25° toward a star at upper right: apex in front, sighting edge rising
  // to it, plumb line hanging straight down across the scale.
  const ax = 290, ay = 52, R = 210, tilt = 25;
  const pt = (a: number, r: number): [number, number] => [-r * Math.sin(a * D), r * Math.cos(a * D)];
  const arc = (r: number) => `<path d="M${ax - r} ${ay} A${r} ${r} 0 0 0 ${ax} ${ay + r}" />`;
  const plate =
    `<path d="M${ax} ${ay}L${ax - R} ${ay}A${R} ${R} 0 0 0 ${ax} ${ay + R}Z" stroke-width="1.6" fill="#f3eee2"/>` +
    arc(R - 10) + arc(R - 26) +
    ticks(ax, ay, R - 10, 0, 90, 2, a => (a % 10 === 0 ? 16 : 7), pt) +
    `<circle cx="${ax - R * 0.15}" cy="${ay - 8}" r="5"/><circle cx="${ax - R * 0.9}" cy="${ay - 8}" r="5"/>` +
    `<path d="M${ax - R * 0.15} ${ay - 3}V${ay}M${ax - R * 0.9} ${ay - 3}V${ay}"/>` +
    `<text x="${ax - 82}" y="${ay + 74}" font-family="Cormorant Garamond" font-style="italic" font-size="16" fill="${INK}" stroke="none" transform="rotate(-45 ${ax - 82} ${ay + 74})">QVADRANS</text>`;
  return svg(
    `<g transform="rotate(${-tilt} ${ax} ${ay})">${plate}</g>` +
    `<path d="M${ax} ${ay}V${ay + 222}" stroke="${RED}" stroke-width="1"/>` +
    `<path d="M${ax - 4} ${ay + 222}l4 14l4 -14z" fill="${INK}"/>` +
    `<path d="M370 18l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="${INK}" stroke="none"/>`,
    'Line drawing of a quadrant tilted toward a star, its plumb line hanging across the scale');
}

function astrolabe(): string {
  const cx = 200, cy = 158, R = 118;
  const pt = (a: number, r: number): [number, number] => [r * Math.cos(a * D), r * Math.sin(a * D)];
  let rete = '';
  for (const [a, r] of [[30, 70], [100, 92], [160, 60], [220, 84], [290, 76], [340, 98]]) {
    const [x, y] = pt(a, r);
    rete += `<path d="M${cx + x * 0.7} ${cy + y * 0.7}L${cx + x} ${cy + y}" stroke-width="1.4"/><circle cx="${cx + x}" cy="${cy + y}" r="2.2" fill="${INK}"/>`;
  }
  return svg(
    `<circle cx="${cx}" cy="${cy - R - 14}" r="10" stroke-width="1.4"/><path d="M${cx - 16} ${cy - R + 2}Q${cx} ${cy - R - 22} ${cx + 16} ${cy - R + 2}" stroke-width="1.4"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" stroke-width="1.6" fill="#f3eee2"/><circle cx="${cx}" cy="${cy}" r="${R - 14}"/>` +
    ticks(cx, cy, R, 0, 360, 5, a => (a % 15 === 0 ? 12 : 6), pt) +
    `<circle cx="${cx}" cy="${cy - 10}" r="${R * 0.5}" stroke-width="0.6" stroke-dasharray="2 2"/>` +
    `<circle cx="${cx}" cy="${cy - 22}" r="${R * 0.32}" stroke-width="0.6" stroke-dasharray="2 2"/>` +
    `<circle cx="${cx + 18}" cy="${cy - 18}" r="${R * 0.62}" stroke="${RED}" stroke-width="1.2"/>` + rete +
    `<path d="M${cx - R + 14} ${cy + 30}L${cx + R - 14} ${cy - 30}" stroke-width="2.2"/><circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>`,
    'Line drawing of an astrolabe with its rete and rule');
}

function sextant(): string {
  const px = 200, py = 50, R = 210;
  const pt = (a: number, r: number): [number, number] => [r * Math.sin(a * D), r * Math.cos(a * D)];
  return svg(
    `<path d="M${px} ${py}L${px - R * Math.sin(30 * D)} ${py + R * Math.cos(30 * D)}A${R} ${R} 0 0 0 ${px + R * Math.sin(30 * D)} ${py + R * Math.cos(30 * D)}Z" stroke-width="1.6" fill="#f3eee2"/>` +
    ticks(px, py, R, -30, 30, 2, a => (a % 10 === 0 ? 14 : 7), pt) +
    `<path d="M${px} ${py}L${px + 70} ${py + R - 8}" stroke-width="3"/>` +
    `<rect x="${px - 9}" y="${py - 14}" width="18" height="22" fill="#cfd8e6" stroke-width="1.2"/>` +
    `<rect x="${px - 92}" y="${py + 64}" width="16" height="26" fill="#cfd8e6" stroke-width="1.2" transform="rotate(-20 ${px - 84} ${py + 77})"/>` +
    `<path d="M${px - 30} ${py + 120}L${px - 150} ${py + 60}" stroke-width="5"/><circle cx="${px + 68}" cy="${py + R - 18}" r="9" stroke-width="1.2"/>`,
    'Line drawing of a sextant with its mirrors and index arm');
}

function armillary(): string {
  const cx = 200, cy = 140, R = 105;
  const ring = (rx: number, ry: number, rot: number, col = INK, w = 1.4) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" stroke="${col}" stroke-width="${w}"/>`;
  return svg(
    ring(R, R, 0) + ring(R, 26, 0, '#3e6346', 2) + ring(R, 34, -42, '#2f5687') + ring(R, 40, -18, RED) +
    ring(R * 0.92, 22, -42, INK, 0.7) + ring(R * 0.73, 17, -42, INK, 0.7) + ring(30, R, -42, INK, 0.8) +
    `<path d="M${cx - 78} ${cy + 70}L${cx + 78} ${cy - 70}" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="7" fill="${INK}"/>` +
    `<path d="M${cx} ${cy + R}V${cy + R + 28}M${cx - 50} ${cy + R + 40}H${cx + 50}M${cx - 30} ${cy + R + 28}H${cx + 30}V${cy + R + 40}H${cx - 30}Z" stroke-width="1.4"/>`,
    'Line drawing of an armillary sphere');
}

function crossStaff(): string {
  let marks = '';
  for (let i = 0; i <= 26; i++) marks += `M${40 + i * 12.5} 168V${i % 5 === 0 ? 158 : 163}`;
  return svg(
    `<rect x="30" y="160" width="340" height="16" fill="#f3eee2" stroke-width="1.4"/><path d="${marks}" stroke-width="0.7"/>` +
    `<rect x="236" y="70" width="12" height="196" fill="#f3eee2" stroke-width="1.4"/>` +
    `<path d="M30 168L242 74M30 168L242 262" stroke="${RED}" stroke-width="0.9" stroke-dasharray="4 3"/>` +
    `<path d="M290 50l3 7 7 3-7 3-3 7-3-7-7-3 7-3z M285 276l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z" fill="${INK}" stroke="none"/>` +
    `<circle cx="22" cy="168" r="6" stroke-width="1.2"/>`,
    'Line drawing of a cross-staff with its sliding transom');
}

export const PLATE_ART: Record<string, () => string> = {
  quadrant, astrolabe, sextant, armillary, 'cross-staff': crossStaff,
};
