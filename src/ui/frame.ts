// The atlas "graduated frame": a border of alternating ink and blank bands with
// solid ink corners, like the neat line of an old map. Each edge has an odd number
// of bands, close to `band` px long, so it starts and ends with a blank band
// next to a dark corner.

export interface FrameOptions {
  /** Border thickness, px. */
  corner?: number;
  /** Target band length, px. */
  band?: number;
  className?: string;
}

export function bandCount(length: number, target: number): number {
  const k = Math.round((length / target - 1) / 2);
  return Math.max(3, 2 * k + 1);
}

/**
 * Wrap `content` in a graduated frame. Returns the outer element; `content`
 * sits in the middle cell and may scroll.
 */
export function graduatedFrame(content: HTMLElement, opts: FrameOptions = {}): HTMLElement {
  const corner = opts.corner ?? 14, target = opts.band ?? 28;
  const frame = document.createElement('div');
  frame.className = 'gframe' + (opts.className ? ' ' + opts.className : '');
  frame.style.setProperty('--gf', corner + 'px');

  const edge = (cls: string) => { const e = document.createElement('div'); e.className = 'gf-edge ' + cls; return e; };
  const cornerEl = () => { const c = document.createElement('div'); c.className = 'gf-corner'; return c; };
  const top = edge('gf-h gf-top'), bottom = edge('gf-h gf-bottom');
  const left = edge('gf-v gf-left'), right = edge('gf-v gf-right');
  content.classList.add('gf-content');
  frame.append(cornerEl(), top, cornerEl(), left, content, right, cornerEl(), bottom, cornerEl());

  const fill = (el: HTMLElement, n: number) => {
    if (el.childElementCount === n) return;
    el.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const b = document.createElement('span');
      if (i % 2 === 1) b.className = 'dark';
      return b;
    }));
  };
  const measure = () => {
    const w = Math.max(0, frame.clientWidth - 2 * corner), h = Math.max(0, frame.clientHeight - 2 * corner);
    const nh = bandCount(w, target), nv = bandCount(h, target);
    fill(top, nh); fill(bottom, nh); fill(left, nv); fill(right, nv);
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(frame);
  measure();
  return frame;
}
