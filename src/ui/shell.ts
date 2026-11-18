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
  /** Add a numbered step (or any titled section) to the panel; `why` links it to a section of the explanation. */
  section(title: string, o?: { why?: string }): HTMLElement;
  /** Fill a "How it works" tab beside the steps with these sections. */
  explain(sections: ExplainSection[]): void;
  /** A "Why?" link that opens the explanation at a section. */
  why(id: string): HTMLElement;
  /** Show the sight-view controls: zoom buttons and "Step back". */
  showSight(on: boolean, actions?: { exit: () => void; zoom: (dir: 1 | -1) => void }): void;
  /** Collapse or expand the bottom sheet (phones only). */
  setSheetOpen(open: boolean): void;
  showError(message: string): void;
  /** Report the screen area the panel covers whenever it changes. */
  onInsetChange(fn: (left: number, bottom: number) => void): void;
}

/** One section of the "How it works" tab. */
export interface ExplainSection {
  /** Used by "Why?" links. */
  id: string;
  title: string;
  /** Paragraphs (strings) or ready-made nodes. */
  body: (string | Node)[];
  /** Inline SVG markup for a small diagram. */
  figure?: string;
  /** Accessible description of the figure. */
  figureLabel?: string;
  /** "Show me": fly to the part on the instrument and light it up. */
  show?: { label: string; run: () => void };
}

export function instrumentShell(o: { id: string; kicker: string; title: string; lead: string }): InstrumentShell {
  document.body.classList.add('instrument-page');
  const stage = h('div', { class: 'stage', id: 'stage' });
  const labels = h('div', { class: 'sky-labels', 'aria-hidden': 'true' });
  const exitBtn = button('Step back', () => sightActions?.exit());
  const zoomOut = button('−', () => sightActions?.zoom(-1));
  const zoomIn = button('+', () => sightActions?.zoom(1));
  zoomOut.setAttribute('aria-label', 'Zoom out'); zoomIn.setAttribute('aria-label', 'Zoom in');
  const sightTip = h('div', { class: 'sight-tip' },
    h('span', { class: 'keys-tip' }, 'Arrow keys or drag to aim (Shift = fine) · + / − or wheel to zoom'),
    h('span', { class: 'touch-tip' }, 'Drag to aim'), zoomOut, zoomIn, exitBtn);
  const err = h('div', { class: 'webgl-error', role: 'alert' });
  let sightActions: { exit: () => void; zoom: (dir: 1 | -1) => void } | undefined;

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

  document.body.append(stage, labels, sightTip, err, siteHeader('../', o.id), panel);

  // Steps go in `useBox`. With an explanation, two tabs switch between it and `howBox`.
  const useBox = h('div', { class: 'tab-panel', id: `${o.id}-use`, role: 'tabpanel' });
  const howBox = h('div', { class: 'tab-panel how', id: `${o.id}-how`, role: 'tabpanel' });
  body.append(useBox);
  const useTab = h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-controls': useBox.id, 'aria-selected': 'true' }, 'Use it');
  const howTab = h('button', { type: 'button', role: 'tab', class: 'tab', 'aria-controls': howBox.id, 'aria-selected': 'false' }, 'How it works');
  const scrollOf = { use: 0, how: 0 };
  let tabsReady = false;
  const showTab = (which: 'use' | 'how') => {
    const how = which === 'how';
    if (how === !howBox.hidden) return;
    scrollOf[how ? 'use' : 'how'] = body.scrollTop;
    useBox.hidden = how; howBox.hidden = !how;
    useTab.setAttribute('aria-selected', String(!how)); howTab.setAttribute('aria-selected', String(how));
    body.scrollTop = scrollOf[which];
  };
  // Each tab keeps its own scroll position, so "Use it" returns the reader to the step they left.
  useTab.addEventListener('click', () => showTab('use'));
  howTab.addEventListener('click', () => showTab('how'));
  /** Open the explanation at a section. */
  const openWhy = (id: string) => {
    const target = howBox.querySelector<HTMLElement>(`[data-how="${id}"]`);
    if (!target) return;
    setSheetOpen(true);
    showTab('how');
    target.scrollIntoView({ block: 'start' });
    target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
  };
  const whyLink = (id: string) => {
    const b = h('button', { type: 'button', class: 'why' }, 'Why?');
    b.addEventListener('click', () => openWhy(id));
    return b;
  };

  return {
    stage, labels, panel, body,
    section(title: string, so?: { why?: string }) {
      const sec = h('section', { class: 'step' }, h('h2', {}, title, so?.why ? whyLink(so.why) : null));
      useBox.append(sec);
      return sec;
    },
    why: whyLink,
    explain(sections: ExplainSection[]) {
      if (!tabsReady) {
        tabsReady = true;
        howBox.hidden = true;
        body.insertBefore(h('div', { class: 'tabs', role: 'tablist', 'aria-label': `${o.title}: steps or explanation` }, useTab, howTab), useBox);
        body.append(howBox);
      }
      howBox.replaceChildren(...sections.map(sec => {
        const el = h('section', { class: 'how-section', 'data-how': sec.id }, h('h2', {}, sec.title),
          ...sec.body.map(b => (typeof b === 'string' ? h('p', {}, b) : b)));
        if (sec.figure) {
          const fig = h('figure', { class: 'how-figure', role: 'img', 'aria-label': sec.figureLabel ?? sec.title });
          fig.innerHTML = sec.figure;
          el.append(fig);
        }
        if (sec.show) el.append(button(sec.show.label, sec.show.run));
        return el;
      }));
    },
    showSight(on, actions) {
      sightActions = actions;
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
        // Centre of the free area, where the view is centred.
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
