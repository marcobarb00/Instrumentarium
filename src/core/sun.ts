// The sun's place, for instruments that tell the time from it (the astrolabe).
// Low-precision formulas from Meeus, Astronomical Algorithms, ch. 22 and 25:
// good to about 0.01°, far finer than any engraved scale.
import { centuriesSinceJ2000, D2R, lstDeg, R2D, wrap360, type Equatorial } from './astro';

/** Mean obliquity of the ecliptic, degrees (Meeus eq. 22.2). */
export function meanObliquity(date: Date): number {
  const T = centuriesSinceJ2000(date);
  return 23 + 26 / 60 + (21.448 - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T) / 3600;
}

/** The sun's apparent ecliptic longitude of date, degrees (Meeus ch. 25, low accuracy). */
export function sunLongitude(date: Date): number {
  const T = centuriesSinceJ2000(date);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * D2R;
  return wrap360(L0 + C - 0.00569 - 0.00478 * Math.sin(omega));
}

/** Right ascension and declination of a point on the ecliptic (latitude 0). */
export function eclipticToEquatorial(lon: number, eps: number): Equatorial {
  const l = lon * D2R, e = eps * D2R;
  return {
    ra: wrap360(Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) * R2D),
    dec: Math.asin(Math.sin(e) * Math.sin(l)) * R2D,
  };
}

export function sunEquatorial(date: Date): Equatorial {
  return eclipticToEquatorial(sunLongitude(date), meanObliquity(date));
}

/**
 * Local apparent solar time (sundial time) in hours, 0–24: 12 h plus the sun's
 * hour angle. This is the time an astrolabe gives.
 */
export function apparentSolarTime(date: Date, lonDeg: number): number {
  return wrap360(lstDeg(date, lonDeg) - sunEquatorial(date).ra + 180) / 15;
}

/** Equation of time in minutes: sundial time minus mean solar time (positive = sundial ahead). */
export function equationOfTime(date: Date): number {
  const ut = (date.getTime() / 3600e3) % 24;
  let e = (apparentSolarTime(date, 0) - ut) * 60;
  if (e > 720) e -= 1440;
  if (e < -720) e += 1440;
  return e;
}

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

/** "15°24′ of Scorpio" for an ecliptic longitude. */
export function zodiacPlace(lon: number): string {
  const l = wrap360(lon);
  let sign = Math.floor(l / 30), deg = Math.floor(l - sign * 30), min = Math.round((l - sign * 30 - deg) * 60);
  if (min === 60) { min = 0; deg += 1; }
  if (deg === 30) { deg = 0; sign += 1; }
  return `${deg}°${String(min).padStart(2, '0')}′ of ${SIGNS[sign % 12]}`;
}
