// Page chrome shared by the site: the atlas header and, on instrument pages,
// the full-screen stage with a framed side panel (a bottom sheet on phones).
import { INSTRUMENTS } from '../instruments';
import { graduatedFrame } from './frame';
import { button, h } from './dom';

const NARROW = '(max-width: 760px)';

/** The site header. `root` is the relative path to the site root ('./' or '../'). */
export function siteHeader(root: string, currentId?: string): HTMLElement {
  const links = INSTRUMENTS.map(i => i.ready
    ? h('a', { href: `${root}${i.id}/`, class: i.id === currentId ? 'current' : undefined, 'aria-current': i.id === currentId ? 'page' : undefined }, i.name)
    : h('span', { class: 'soon', title: 'In preparation' }, i.name));
  return h('header', { class: 'site-header' },
    h('a', { class: 'brand', href: root }, 'Instrumentarium'),
    h('nav', { 'aria-label': 'Instruments' }, ...links));
}

export interface InstrumentShell {
  stage: HTMLElement;
  labels: HTMLElement;
  panel: HTMLElement;
  body: HTMLElement;
  /** Add a numbered step (or any titled section) to the panel. */
  section(title: string): HTMLElement;
  /** Show the sight overlay; `onExit` runs from its "Step back" button. */
  showSight(on: boolean, onExit?: () => void): void;
  /** Collapse or expand the bottom sheet (phones only). */
  setSheetOpen(open: boolean): void;
  showError(message: string): void;
  /** Report the screen area the panel covers whenever it changes. */
  onInsetChange(fn: (left: number, bottom: number) => void): void;
}

export function instrumentShell(o: { id: string; kicker: string; title: string; lead: string }): InstrumentShell {
  document.body.classList.add('instrument-page');
  const stage = h('div', { class: 'stage', id: 'stage' });
  const labels = h('div', { class: 'sky-labels', 'aria-hidden': 'true' });
  const sight = h('div', { class: 'sight', 'aria-hidden': 'true' });
  const exitBtn = button('Step back', () => exitFn?.());
  const sightTip = h('div', { class: 'sight-tip' }, h('span', { class: 'keys-tip' }, 'Drag or use the arrow keys (Shift = fine) to aim'), h('span', { class: 'touch-tip' }, 'Drag to aim'), exitBtn);
  const err = h('div', { class: 'webgl-error', role: 'alert' });
  let exitFn: (() => void) | undefined;

  const body = h('div', { class: 'panel-body' },
    h('div', { class: 'kicker' }, o.kicker),
    h('h1', {}, o.title),
    h('p', { class: 'lead' }, o.lead),
    h('div', { class: 'double-rule' }));

  const handle = h('button', { type: 'button', class: 'sheet-handle', 'aria-expanded': 'true' },
    h('span', { class: 'grip', 'aria-hidden': 'true' }), h('span', {}, o.title));
  const inner = h('div', { class: 'panel-inner' }, handle, body);
  const panel = graduatedFrame(inner, { className: 'panel', corner: 12, band: 26 });
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', `${o.title} controls`);

  const setSheetOpen = (open: boolean) => {
    panel.classList.toggle('collapsed', !open);
    handle.setAttribute('aria-expanded', String(open));
  };
  handle.addEventListener('click', () => setSheetOpen(panel.classList.contains('collapsed')));

  document.body.append(stage, labels, sight, sightTip, err, siteHeader('../', o.id), panel);

  return {
    stage, labels, panel, body,
    section(title: string) {
      const sec = h('section', { class: 'step' }, h('h2', {}, title));
      body.append(sec);
      return sec;
    },
    showSight(on: boolean, onExit?: () => void) {
      exitFn = onExit;
      document.body.classList.toggle('in-sight', on);
      if (matchMedia(NARROW).matches) setSheetOpen(!on);
    },
    setSheetOpen,
    showError(message: string) { err.textContent = message; err.style.display = 'flex'; },
    onInsetChange(fn) {
      const report = () => {
        const r = panel.getBoundingClientRect();
        const narrow = matchMedia(NARROW).matches;
        const left = narrow ? 0 : Math.max(0, r.right);
        const bottom = narrow ? Math.max(0, innerHeight - r.top) : 0;
        // Centre of the free area, where the view and the sight circle are centred.
        const st = document.body.style;
        st.setProperty('--cx', `${(innerWidth + left) / 2}px`);
        st.setProperty('--cy', `${(innerHeight - bottom) / 2}px`);
        st.setProperty('--sr', `${Math.min(innerWidth - left, innerHeight - bottom, Math.min(innerWidth, innerHeight)) * 0.42}px`);
        fn(left, bottom);
      };
      new ResizeObserver(report).observe(panel);
      addEventListener('resize', report);
      report();
    },
  };
}
