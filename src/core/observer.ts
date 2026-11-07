// The observer: where and when the sky is seen from. Shared by every page.
import { lstDeg } from './astro';
import { hhmm, offsetLabel, utcToZoned, zonedToUtc, zoneOffsetMinutes, type Zone } from './time';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  tz?: string;
}

export const PLACES: Place[] = [
  { id: 'rome', name: 'Rome', lat: 41.9, lon: 12.5, tz: 'Europe/Rome' },
  { id: 'london', name: 'London', lat: 51.5, lon: -0.13, tz: 'Europe/London' },
  { id: 'alexandria', name: 'Alexandria', lat: 31.2, lon: 29.92, tz: 'Africa/Cairo' },
  { id: 'samarkand', name: 'Samarkand', lat: 39.65, lon: 66.96, tz: 'Asia/Samarkand' },
  { id: 'uraniborg', name: 'Uraniborg (Hven)', lat: 55.91, lon: 12.7, tz: 'Europe/Stockholm' },
  { id: 'sydney', name: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
];

export const DEFAULT_PLACE = PLACES[0];
/** Default evening time, as minutes after local noon (600 = 22:00). */
export const DEFAULT_MINUTES = 600;

export interface ObserverSnapshot {
  place: Place;
  /** Calendar date of the evening (YYYY-MM-DD, local). */
  date: string;
  /** Minutes after local noon on `date`, 0–1440. The night is in the middle of the range. */
  minutes: number;
}

const PLACE_KEY = 'instrumentarium.place';
const WHEN_KEY = 'instrumentarium.when';

function safeGet(store: () => Storage, key: string): string | null {
  try { return store().getItem(key); } catch { return null; }
}
function safeSet(store: () => Storage, key: string, value: string): void {
  try { store().setItem(key, value); } catch { /* storage unavailable: nothing to remember */ }
}

export function customPlace(lat: number, lon: number): Place {
  return { id: 'custom', name: 'Custom place', lat, lon };
}

export class Observer {
  place: Place;
  date: string;
  minutes: number;
  private listeners = new Set<() => void>();

  constructor(init?: Partial<ObserverSnapshot>, private persist = true) {
    this.place = init?.place ?? (persist ? loadPlace() : undefined) ?? DEFAULT_PLACE;
    const when = persist ? loadWhen() : undefined;
    this.date = init?.date ?? when?.date ?? tonight(this.place);
    this.minutes = init?.minutes ?? when?.minutes ?? DEFAULT_MINUTES;
  }

  get zone(): Zone {
    return this.place.tz ? { tz: this.place.tz } : { fixedOffsetHours: Math.round(this.place.lon / 15) };
  }
  get lat(): number { return this.place.lat; }
  get lon(): number { return this.place.lon; }

  /** The instant being observed. */
  get utc(): Date {
    const [y, m, d] = this.date.split('-').map(Number);
    return zonedToUtc(this.zone, y, m, d, 720 + this.minutes);
  }
  /** Local sidereal time, degrees. */
  get lst(): number { return lstDeg(this.utc, this.lon); }

  /** "22:00" */
  get clockLabel(): string { return hhmm(720 + this.minutes); }
  /** "UTC+1" for the observed instant. */
  get zoneLabel(): string { return offsetLabel(zoneOffsetMinutes(this.zone, this.utc)); }
  /** Local calendar date at the observed instant (rolls over after midnight). */
  get localDate(): string { return utcToZoned(this.zone, this.utc).date; }

  setPlace(p: Place): void { this.place = p; this.save(); this.emit(); }
  setDate(d: string): void { if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { this.date = d; this.save(); this.emit(); } }
  setMinutes(m: number): void { this.minutes = Math.max(0, Math.min(1440, m)); this.save(); this.emit(); }

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { this.listeners.forEach(fn => fn()); }

  private save(): void {
    if (!this.persist) return;
    const p = this.place;
    safeSet(() => localStorage, PLACE_KEY, JSON.stringify(p.id === 'custom' ? { id: 'custom', lat: p.lat, lon: p.lon } : { id: p.id }));
    safeSet(() => sessionStorage, WHEN_KEY, JSON.stringify({ date: this.date, minutes: this.minutes }));
  }
}

/** Today's date in the place's own time zone. */
export function tonight(place: Place, now = new Date()): string {
  const zone: Zone = place.tz ? { tz: place.tz } : { fixedOffsetHours: Math.round(place.lon / 15) };
  return utcToZoned(zone, now).date;
}

function loadPlace(): Place | undefined {
  const raw = safeGet(() => localStorage, PLACE_KEY);
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    if (v.id === 'custom' && Number.isFinite(v.lat) && Number.isFinite(v.lon)) return customPlace(v.lat, v.lon);
    return PLACES.find(p => p.id === v.id);
  } catch { return undefined; }
}

function loadWhen(): { date: string; minutes: number } | undefined {
  const raw = safeGet(() => sessionStorage, WHEN_KEY);
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    if (typeof v.date === 'string' && Number.isFinite(v.minutes)) return v;
  } catch { /* ignore */ }
  return undefined;
}
