// Corrections a navigator applies to a sextant altitude.
import { D2R } from './astro';

/**
 * Dip of the sea horizon below the true horizontal, in arcminutes, for an eye
 * `h` metres above the sea: 1.76′ × √h (the standard almanac formula, which
 * includes ordinary terrestrial refraction).
 */
export function dipMinutes(h: number): number {
  return 1.76 * Math.sqrt(h);
}

/**
 * Atmospheric refraction for an apparent altitude, in arcminutes (Bennett 1982,
 * standard conditions). For explanation only: this site's sky has none.
 */
export function refractionMinutes(alt: number): number {
  return 1 / Math.tan((alt + 7.31 / (alt + 4.4)) * D2R);
}

/** "34°36.2′" */
export function degMin(v: number, digits = 1): string {
  const sign = v < 0 ? '−' : '';
  let a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  if (Number(m.toFixed(digits)) >= 60) { d += 1; m = 0; }
  return `${sign}${d}°${m.toFixed(digits).padStart(digits ? digits + 3 : 2, '0')}′`;
}
