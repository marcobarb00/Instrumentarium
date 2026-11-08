// Local civil time for an observer.
//
// Places with a known IANA time zone use the browser's Intl database (so summer
// time is handled). Custom places use the nominal zone of their longitude,
// UTC + round(lon / 15) hours, which is what a navigator would assume.

export interface Zone {
  /** IANA zone name, e.g. "Europe/Rome". Undefined means a fixed offset. */
  tz?: string;
  /** Fixed offset in hours, used when tz is undefined. */
  fixedOffsetHours?: number;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Offset of the zone from UTC, in minutes, at the given instant. */
export function zoneOffsetMinutes(zone: Zone, at: Date): number {
  if (!zone.tz) return Math.round((zone.fixedOffsetHours ?? 0) * 60);
  const parts = Object.fromEntries(formatter(zone.tz).formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant at which the wall clock in `zone` shows the given local time. */
export function zonedToUtc(zone: Zone, y: number, m: number, d: number, minutesOfDay: number): Date {
  const naive = Date.UTC(y, m - 1, d) + minutesOfDay * 60000;
  // Two passes settle the offset, including across a summer-time change.
  let t = naive - zoneOffsetMinutes(zone, new Date(naive)) * 60000;
  t = naive - zoneOffsetMinutes(zone, new Date(t)) * 60000;
  return new Date(t);
}

/** Calendar date (YYYY-MM-DD) and minutes past midnight of an instant, in `zone`. */
export function utcToZoned(zone: Zone, at: Date): { date: string; minutes: number } {
  const local = new Date(at.getTime() + zoneOffsetMinutes(zone, at) * 60000);
  const date = local.toISOString().slice(0, 10);
  return { date, minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** "UTC+1", "UTC−5:30" style label. */
export function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const a = Math.abs(minutes), h = Math.floor(a / 60), mm = a % 60;
  return `UTC${sign}${h}${mm ? ':' + String(mm).padStart(2, '0') : ''}`;
}

export function hhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
