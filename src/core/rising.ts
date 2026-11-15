// When a star crosses the horizon. Geometric horizon (altitude 0), no
// refraction: the same sky the pages draw.
import { horizontalFromEquatorial, lstDeg } from './astro';

/**
 * First moment between `t0` and `t1` when an object at right ascension `ra`,
 * declination `dec` rises through altitude 0 for an observer at `lat`, `lon`.
 * Null if it does not rise in that span.
 */
export function riseTime(ra: number, dec: number, lat: number, lon: number, t0: Date, t1: Date): Date | null {
  const alt = (ms: number) => horizontalFromEquatorial(ra, dec, lstDeg(new Date(ms), lon), lat).alt;
  const step = 5 * 60e3, end = t1.getTime();
  let a = t0.getTime(), fa = alt(a);
  while (a < end) {
    const b = Math.min(a + step, end), fb = alt(b);
    if (fa < 0 && fb >= 0) {
      let lo = a, hi = b;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (alt(mid) < 0) lo = mid; else hi = mid;
      }
      return new Date((lo + hi) / 2);
    }
    a = b; fa = fb;
  }
  return null;
}
