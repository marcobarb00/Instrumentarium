# Instrumentarium

A static website where you explore interactive 3D models of historical astronomical
instruments and use them to measure real stars in a computed night sky.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # astronomy and instrument tests (Vitest)
npm run build      # type-check, then build the static site into dist/
npm run preview    # serve dist/ locally
```

The built site uses relative paths, so `dist/` can be served from any folder. It must be
served over HTTP: opening `index.html` straight from disk shows a blank page, because
browsers block module scripts on `file://` pages.

## Publish on GitHub Pages

`.github/workflows/deploy-pages.yml` tests, builds and publishes `dist/` on every push to
`main` (or by hand from the Actions tab). One-time setup on GitHub: **Settings → Pages →
Build and deployment → Source: GitHub Actions**. The site then appears at
`https://<user>.github.io/<repo>/`.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `src/pages/home.ts` | Home page: gallery of instruments and the observer's sky |
| `quadrant/index.html`, `src/pages/quadrant.ts` | Quadrant page |
| `astrolabe/index.html`, `src/pages/astrolabe.ts` | Astrolabe page |
| `sextant/index.html`, `src/pages/sextant.ts` | Sextant page (split telescope view) |
| `armillary/index.html`, `src/pages/armillary.ts` | Ptolemy’s armillary page (set from the moon or a star, measure ecliptic longitude and latitude) |
| `src/core/astro.ts` | Sidereal time, precession, RA/Dec ↔ alt/az, separations |
| `src/core/nav.ts` | Dip of the sea horizon, refraction (for explanation), degrees-and-minutes |
| `src/core/sun.ts` | The sun's place, sundial time and the equation of time (Meeus ch. 22, 25) |
| `src/core/rising.ts` | When a star rises through the geometric horizon (not used by any page at present) |
| `src/core/moon.ts`, `src/core/ecliptic.ts` | The moon's place seen from the observer (Meeus ch. 47, with parallax); ecliptic ↔ equatorial |
| `src/core/catalogue.ts`, `src/data/stars.json` | Star catalogue (HYG, mag < 4.5) |
| `src/core/observer.ts`, `src/core/time.ts` | Place, date and local time (with time zones) |
| `src/three/` | Shared 3D: stage and sight mode, sky renderer, materials, engraving textures |
| `src/ui/` | Atlas-style UI: graduated frames, panel, controls, measurement check |
| `src/instruments/<id>/model.ts` | Each instrument's procedural model and how its scales are read |
| `src/instruments/astrolabe/geometry.ts`, `drawings.ts` | Astrolabe: stereographic projection, and the engraved plate, rete, limb and back |
| `src/instruments/armillary/drawings.ts` | Ptolemy’s armillary: the engraved meridian, ecliptic and latitude rings, and their inverses |
| `tests/` | Vitest tests |
| `scripts/build-catalogue.mjs` | Rebuilds `stars.json` from the HYG CSV |
| `references/` | The quadrant prototype and the UI style reference (unchanged) |

## Moon data

`src/core/moon.ts` uses the periodic terms of Meeus, *Astronomical Algorithms*, Tables 47.A
and 47.B, as encoded in the [astronomia](https://github.com/commenthol/astronomia) library
(MIT licence, © 2013 Sonia Keys, © 2016 commenthol), checked against Meeus's example 47.a.

## Conventions

- Angles in degrees; right ascension in degrees; longitude positive east.
- Azimuth from north toward east. World axes: north = +Z, east = −X, up = +Y.
- Altitudes are geometric: no atmospheric refraction.

## Star data

`src/data/stars.json` is derived from the [HYG Database](https://github.com/astronexus/HYG-Database)
v4.1 by David Nash (astronexus), licensed CC BY-SA 4.0, and keeps every star brighter
than magnitude 4.5. J2000 positions are precessed to the date being observed. To
rebuild it, download `hyg/CURRENT/hygdata_v41.csv` from that repository and run:

```bash
npm run catalogue -- path/to/hygdata_v41.csv
```
