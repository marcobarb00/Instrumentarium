// Small helpers for the explanation diagrams: inline SVG in the atlas palette.

export const C = {
  ink: '#1d2a44', rubric: '#7a5718', red: '#8d2f24', blue: '#2f5687', green: '#3e6346',
  soft: '#c9bc9c', paper: '#fbf8f1', sun: '#d9a227', moon: '#e9dcb4', muted: '#4a5568',
};

let uid = 0;
/** A fresh id for clip paths and markers, unique on the page. */
export const fid = (p: string): string => `${p}-${++uid}`;

/** An SVG figure `h` units tall, 300 wide. */
export function svg(h: number, body: string): string {
  return `<svg viewBox="0 0 300 ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" font-family="Spectral, Georgia, serif">${body}</svg>`;
}

/** A label. */
export function t(x: number, y: number, s: string, o: { anchor?: 'start' | 'middle' | 'end'; color?: string; size?: number; italic?: boolean } = {}): string {
  return `<text x="${x}" y="${y}" text-anchor="${o.anchor ?? 'middle'}" font-size="${o.size ?? 12}" fill="${o.color ?? C.ink}"${o.italic === false ? '' : ' font-style="italic"'}>${s}</text>`;
}

export const dot = (x: number, y: number, r = 2.5, fill = C.ink): string => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
export const line = (x1: number, y1: number, x2: number, y2: number, stroke = C.ink, w = 1, dash = ''): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
export const circle = (x: number, y: number, r: number, stroke = C.ink, w = 1, dash = '', fill = 'none'): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
export const path = (d: string, stroke = C.ink, w = 1, dash = '', fill = 'none'): string =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
/** A small four-pointed star. */
export const star = (x: number, y: number, r = 5, fill = C.red): string =>
  `<path d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z" fill="${fill}"/>`;
/** An arrowhead marker, for paths that show a turning. */
export function arrowMarker(id: string, color = C.ink): string {
  return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L8 5L1 9" fill="none" stroke="${color}" stroke-width="1.6"/></marker></defs>`;
}
