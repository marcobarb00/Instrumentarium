// Location, date and time controls, bound to an Observer. Used on every page.
import { customPlace, DEFAULT_MINUTES, PLACES, tonight, type Observer } from '../core/observer';
import { button, h, numberField, selectField, slider } from './dom';

export function observerControls(obs: Observer): HTMLElement {
  const loc = selectField('Place');
  for (const p of PLACES) loc.select.append(h('option', { value: p.id }, p.name));
  loc.select.append(h('option', { value: 'custom' }, 'Custom latitude & longitude'));

  const lat = numberField('Latitude °N', { step: 0.1, min: -89.9, max: 89.9 });
  const lon = numberField('Longitude °E', { step: 0.1, min: -180, max: 180 });
  const coords = h('div', { class: 'row' }, lat.el, lon.el);

  const dateId = 'obs-date';
  const date = h('input', { type: 'date', id: dateId });
  const dateField = h('div', { class: 'field' }, h('label', { for: dateId, class: 'field-row' }, h('span', {}, 'Evening of')), date);

  const time = slider({
    label: 'Local time', min: 0, max: 1440, step: 1, value: obs.minutes,
    onInput: v => obs.setMinutes(v),
  });
  const zoneNote = h('div', { class: 'note' });
  const reset = button('Tonight at 22:00', () => {
    obs.setDate(tonight(obs.place));
    obs.setMinutes(DEFAULT_MINUTES);
  });

  const sync = () => {
    loc.select.value = obs.place.id;
    lat.input.value = obs.lat.toFixed(2);
    lon.input.value = obs.lon.toFixed(2);
    date.value = obs.date;
    time.set(obs.minutes);
    time.setLabel(`${obs.clockLabel} · ${obs.zoneLabel}`);
    zoneNote.textContent = obs.place.tz
      ? `Clock time in ${obs.place.tz.replace('_', ' ')}.`
      : `Clock time of the nominal zone for longitude ${obs.lon.toFixed(1)}°.`;
  };

  loc.select.addEventListener('change', () => {
    const p = PLACES.find(x => x.id === loc.select.value);
    obs.setPlace(p ?? customPlace(obs.lat, obs.lon));
  });
  const fromInputs = () => {
    const a = parseFloat(lat.input.value), b = parseFloat(lon.input.value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) >= 90 || Math.abs(b) > 180) return;
    obs.setPlace(customPlace(a, b));
  };
  lat.input.addEventListener('change', fromInputs);
  lon.input.addEventListener('change', fromInputs);
  date.addEventListener('change', () => obs.setDate(date.value));

  obs.onChange(sync);
  sync();
  return h('div', { class: 'observer' }, loc.el, coords, dateField, time.el, zoneNote, reset);
}
