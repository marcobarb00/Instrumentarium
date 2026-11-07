// Tiny DOM helpers and the form controls used in every panel.

type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<Record<string, string>> & { class?: string } = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'class') el.className = v; else el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

let uid = 0;
const nextId = (p: string) => `${p}-${++uid}`;

export interface SliderControl {
  el: HTMLElement;
  input: HTMLInputElement;
  set(v: number): void;
  setLabel(text: string): void;
}

/** A labelled range input with its current value shown on the right. */
export function slider(o: {
  label: string | Node; min: number; max: number; step: number; value: number;
  format?: (v: number) => string; onInput?: (v: number) => void;
}): SliderControl {
  const id = nextId('sl');
  const val = h('span', { class: 'val' });
  const input = h('input', { type: 'range', id, min: String(o.min), max: String(o.max), step: String(o.step) });
  input.value = String(o.value);
  const fmt = o.format ?? (v => String(v));
  const show = () => { val.textContent = fmt(+input.value); };
  input.addEventListener('input', () => { show(); o.onInput?.(+input.value); });
  show();
  const el = h('div', { class: 'field' }, h('label', { for: id, class: 'field-row' }, h('span', {}, o.label), val), input);
  return {
    el, input,
    set(v: number) { input.value = String(v); show(); },
    setLabel(text: string) { val.textContent = text; },
  };
}

export function button(text: string, onClick: () => void, variant: 'plain' | 'primary' = 'plain'): HTMLButtonElement {
  const b = h('button', { type: 'button', class: 'btn' + (variant === 'primary' ? ' primary' : '') }, text);
  b.addEventListener('click', onClick);
  return b;
}

export function numberField(label: string, o: { step?: number; placeholder?: string; min?: number; max?: number } = {}): { el: HTMLElement; input: HTMLInputElement } {
  const id = nextId('num');
  const input = h('input', {
    type: 'number', id, inputmode: 'decimal', step: String(o.step ?? 'any'),
    placeholder: o.placeholder, min: o.min?.toString(), max: o.max?.toString(),
  });
  return { el: h('div', { class: 'field' }, h('label', { for: id, class: 'field-row' }, h('span', {}, label)), input), input };
}

export function selectField(label: string): { el: HTMLElement; select: HTMLSelectElement } {
  const id = nextId('sel');
  const select = h('select', { id });
  return { el: h('div', { class: 'field' }, h('label', { for: id, class: 'field-row' }, h('span', {}, label)), select), select };
}

export function checkbox(label: string, onChange?: (on: boolean) => void): { el: HTMLElement; input: HTMLInputElement } {
  const input = h('input', { type: 'checkbox' });
  input.addEventListener('change', () => onChange?.(input.checked));
  return { el: h('label', { class: 'chk' }, input, h('span', {}, label)), input };
}

/** Italic symbol for labels, e.g. sym('φ'). */
export function sym(s: string): HTMLElement { return h('i', {}, s); }

export function fmtDeg(v: number, digits = 1): string {
  return `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}°`;
}
