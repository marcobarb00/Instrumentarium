// The "check my measurement" step: compare the user's reading with the computed truth.
import { wrap180 } from '../core/astro';
import { fmtDeg, h } from './dom';

export interface Reading {
  /** e.g. "Altitude" */
  quantity: string;
  yours: number;
  truth: number;
  /** Compare as directions on a circle (azimuths, hour angles). */
  circular?: boolean;
  /** Length of the circle for `circular` readings (default 360, e.g. 1440 for minutes of a day). */
  period?: number;
  /** How to show a value and an error (default: degrees). */
  format?: (v: number) => string;
  formatError?: (e: number) => string;
}

export interface Verdict {
  /** Error below this is as good as the scale allows. */
  fine: number;
  /** Error below this is close. */
  close: number;
  fineText?: string;
  closeText?: string;
  farText?: string;
}

export function readingError(r: Reading): number {
  if (!r.circular) return r.yours - r.truth;
  const p = r.period ?? 360;
  return (wrap180(((r.yours - r.truth) * 360) / p) * p) / 360;
}

const fmtValue = (r: Reading, v: number, digits: number) => (r.format ? r.format(v) : fmtDeg(v, digits));
const fmtError = (r: Reading, e: number) => (r.formatError ? r.formatError(e) : signed(e));

const signed = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}°`;

export class MeasurementCheck {
  readonly el: HTMLElement;
  private readonly result = h('div', { class: 'result', 'aria-live': 'polite' });
  private readonly logBody = h('tbody');
  private readonly log = h('table', { class: 'log' },
    h('caption', {}, 'Your measurements'),
    h('thead', {}, h('tr', {}, h('th', {}, 'Object'), h('th', {}, 'You'), h('th', {}, 'True'), h('th', {}, 'Error'))),
    this.logBody);

  constructor() {
    this.log.hidden = true;
    this.el = h('div', { class: 'check' }, this.result, this.log);
  }

  message(text: string): void {
    this.result.replaceChildren(h('p', { class: 'warn' }, text));
  }

  /** Show the comparison for one sighting and add the first reading to the log. */
  show(subject: string, readings: Reading[], verdict: Verdict, footnote?: string): void {
    const rows = readings.map(r => {
      const e = readingError(r);
      return h('tr', {},
        h('td', {}, r.quantity), h('td', {}, fmtValue(r, r.yours, 2)), h('td', {}, fmtValue(r, r.truth, 2)), h('td', {}, fmtError(r, e)));
    });
    const main = Math.abs(readingError(readings[0]));
    const text = main < verdict.fine ? (verdict.fineText ?? 'Excellent: about as fine as this scale allows.')
      : main < verdict.close ? (verdict.closeText ?? 'Close. Check your aim and read the scale more carefully.')
        : (verdict.farText ?? 'Quite far off. Is the star centred in the sights?');
    this.result.replaceChildren(...([
      h('p', { class: 'subject' }, subject),
      h('table', { class: 'compare' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'You'), h('th', {}, 'True'), h('th', {}, 'Error'))),
        h('tbody', {}, ...rows)),
      h('p', { class: main < verdict.fine ? 'verdict good' : main < verdict.close ? 'verdict' : 'verdict far' }, text),
      footnote ? h('p', { class: 'note' }, footnote) : null,
    ] as (HTMLElement | null)[]).filter((n): n is HTMLElement => n !== null));

    const r = readings[0];
    this.logBody.prepend(h('tr', {},
      h('td', {}, subject), h('td', {}, fmtValue(r, r.yours, 1)), h('td', {}, fmtValue(r, r.truth, 1)),
      h('td', {}, r.formatError ? r.formatError(Math.abs(readingError(r))).replace(/^\+/, '') : Math.abs(readingError(r)).toFixed(2) + '°')));
    this.log.hidden = false;
  }
}
