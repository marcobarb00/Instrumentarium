// Ecliptic coordinates: longitude counted along the ecliptic from the vernal
// equinox, latitude north or south of it (Meeus, Astronomical Algorithms, 13.1–13.4).
// Ptolemy's catalogue and his armillary work in these.
import { D2R, R2D, wrap360, type Equatorial } from './astro';

export interface Ecliptic {
  lon: number;
  lat: number;
}

export function eclipticFromEquatorial(ra: number, dec: number, eps: number): Ecliptic {
  const a = ra * D2R, d = dec * D2R, e = eps * D2R;
  return {
    lon: wrap360(Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a)) * R2D),
    lat: Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a)) * R2D,
  };
}

export function equatorialFromEcliptic(lon: number, lat: number, eps: number): Equatorial {
  const l = lon * D2R, b = lat * D2R, e = eps * D2R;
  return {
    ra: wrap360(Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) * R2D),
    dec: Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)) * R2D,
  };
}
