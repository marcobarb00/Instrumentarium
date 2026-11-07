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

The built site uses relative paths, so `dist/` can be served from any folder.

## Layout

| Path | What it is |
| --- | --- |
| `index.html`, `src/pages/home.ts` | Home page: gallery of instruments and the observer's sky |
| `quadrant/index.html`, `src/pages/quadrant.ts` | Quadrant page |
| `src/core/astro.ts` | Sidereal time, precession, RA/Dec ↔ alt/az, separations |
| `src/core/catalogue.ts`, `src/data/stars.json` | Star catalogue (HYG, mag < 4.5) |
| `src/core/observer.ts`, `src/core/time.ts` | Place, date and local time (with time zones) |
| `src/three/` | Shared 3D: stage and sight mode, sky renderer, materials, engraving textures |
| `src/ui/` | Atlas-style UI: graduated frames, panel, controls, measurement check |
| `src/instruments/<id>/model.ts` | Each instrument's procedural model and how its scales are read |
| `tests/` | Vitest tests |
| `scripts/build-catalogue.mjs` | Rebuilds `stars.json` from the HYG CSV |
| `references/` | The quadrant prototype and the UI style reference (unchanged) |

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
