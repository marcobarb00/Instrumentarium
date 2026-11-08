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
  return r.circular ? wrap180(r.yours - r.truth) : r.yours - r.truth;
}

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
  show(subject: string, readings: Reading[], verdict: Verdict): void {
    const rows = readings.map(r => {
      const e = readingError(r);
      return h('tr', {},
        h('td', {}, r.quantity), h('td', {}, fmtDeg(r.yours, 2)), h('td', {}, fmtDeg(r.truth, 2)), h('td', {}, signed(e)));
    });
    const main = Math.abs(readingError(readings[0]));
    const text = main < verdict.fine ? (verdict.fineText ?? 'Excellent: about as fine as this scale allows.')
      : main < verdict.close ? (verdict.closeText ?? 'Close. Check your aim and read the scale more carefully.')
        : (verdict.farText ?? 'Quite far off. Is the star centred in the sights?');
    this.result.replaceChildren(
      h('p', { class: 'subject' }, subject),
      h('table', { class: 'compare' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'You'), h('th', {}, 'True'), h('th', {}, 'Error'))),
        h('tbody', {}, ...rows)),
      h('p', { class: main < verdict.fine ? 'verdict good' : main < verdict.close ? 'verdict' : 'verdict far' }, text));

    const r = readings[0];
    this.logBody.prepend(h('tr', {},
      h('td', {}, subject), h('td', {}, fmtDeg(r.yours, 1)), h('td', {}, fmtDeg(r.truth, 1)), h('td', {}, Math.abs(readingError(r)).toFixed(2) + '°')));
    this.log.hidden = false;
  }
}
