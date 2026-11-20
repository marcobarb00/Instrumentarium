# Instrumentarium

**Measure the real night sky with the instruments astronomers used before the telescope.**

**[Open the site →](https://marcobarb00.github.io/Instrumentarium/)**

Instrumentarium is a small museum of historical astronomical instruments that you can
pick up and use. Each one is built in 3D from its historical design and set under the
sky as it really is tonight, or on any date, from your city or anywhere else. You use it
the way its owners did: you sight a real star, set the moving parts, and read the answer
off the engraved brass. Then the site checks your reading against the star's true
position and shows where any error came from.

Nothing needs installing. It runs in the browser, on a computer or a phone.

## The instruments

| | Instrument | What you measure | What it teaches |
| --- | --- | --- | --- |
| I | **Quadrant** | A star's altitude above the horizon, and its compass direction | How a plumb line and two sights turn a quarter circle into a measuring tool |
| II | **Astrolabe** | The time of night, from the height of a single star | How the whole sky was flattened onto a brass disc you could hold in one hand |
| III | **Sextant** | A star's height above the sea horizon, from the deck of a rolling ship | How two mirrors let a navigator see the star and the horizon at once |
| IV | **Ptolemy's armillary** | A star's position along the sun's path (its ecliptic longitude and latitude) | How the stars of Ptolemy's catalogue, in the *Almagest*, were measured: set against the moon or a known star |
| V | **Cross-staff** | The angle between two stars | How a sliding cross-piece and a little geometry measure the sky |

## What a visit looks like

1. **Choose where and when.** The sky starts tonight at 22:00 in Rome. You can pick
   another city (London, Alexandria, Samarkand, Tycho Brahe's Uraniborg, Sydney), type
   your own coordinates, or change the date and the hour.
2. **Follow the steps.** Each instrument has a few numbered steps: pick a star, aim,
   set the parts, read the scale. You can drag the instrument, look through its sights,
   and zoom in on the engraving to read it.
3. **Check your measurement.** Type in what you read. The site compares it with the
   computed truth and tells you how close you came, and, where it can, whether the error
   came from aiming, from setting the instrument up, or from reading the scale.
4. **Ask why.** Every step has a *Why?* link to a "How it works" tab that explains the
   idea behind it, with diagrams. *Show me* buttons fly the camera to the part being
   explained and light it up.

## How true to life it is

**The sky is computed, not drawn.** It holds every star brighter than magnitude 4.5,
just over 900 of them, from the HYG star catalogue, carried forward to the date you choose.
The positions of the sun and moon come from the standard formulas in Jean Meeus's
*Astronomical Algorithms*, checked against his worked examples. The moon is drawn where
it appears from your place, lit by the sun.

**The instruments are measured, not faked.** The scales you read are the engraved
drawings themselves, and the site's own checks read them the same way. Automated tests
aim every instrument exactly at real stars and confirm that its scale gives the right
answer: to a hundredth of a degree for the quadrant, armillary and cross-staff, to a
fraction of a minute of time for the astrolabe, and to a twentieth of a minute of arc
for the sextant.

**Some things are simplified.**

- The air does not bend starlight here (no atmospheric refraction), so stars near the
  horizon sit a little lower than in the real sky. The sextant page explains the
  correction a navigator would make.
- The sky is always dark: there is no daylight or twilight, and only the armillary page
  shows the moon.
- Where the historical sources leave details open, the reconstruction makes a choice. The
  stand, the latitude scale and the mounting of the sights on Ptolemy's armillary are
  plausible guesses built around his description in *Almagest* V.1. So are the cross-staff's
  three transoms, of 6, 18 and 50 cm. Your eye also sits exactly at the end of the staff,
  which real observers could never quite manage.

## Credits

- **Star positions:** the [HYG Database](https://github.com/astronexus/HYG-Database) v4.1
  by David Nash, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **The moon's motion:** the periodic terms of Meeus's *Astronomical Algorithms*, ch. 47,
  as encoded in the [astronomia](https://github.com/commenthol/astronomia) library by
  Sonia Keys and commenthol (MIT licence).
- **3D graphics:** [three.js](https://threejs.org) (MIT licence).
- **Typefaces:** Cormorant Garamond, Cormorant SC and Spectral, from Google Fonts.

## Licence

You are free to reuse this work. The site, its code, texts and diagrams, is released
under the [MIT licence](LICENSE). The star catalogue derived from HYG stays under
CC BY-SA 4.0, and the moon's periodic terms under astronomia's MIT licence. The full
notices are in [`public/licenses.txt`](public/licenses.txt), which is also published
on the site.

---

## For developers

Instrumentarium is a static site built with [Vite](https://vite.dev), TypeScript and
three.js. Every instrument is modelled in code, and its scales are drawn on canvases at
run time; there are no 3D model files or image textures. It needs Node.js 20.19 or
newer (or 22.12 and up).

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm test           # astronomy and instrument tests (Vitest)
npm run build      # type-check, then build the static site into dist/
npm run preview    # serve the built site locally
```

The built site uses relative paths, so `dist/` can be served from any folder of any web
server. It has to be served over HTTP: opened straight from disk (`file://`), the pages
stay blank, because browsers block module scripts there.

**Publishing.** `.github/workflows/deploy-pages.yml` tests, builds and publishes the site
to GitHub Pages on every push to `main`. In a fork, turn it on once under
*Settings → Pages → Build and deployment → Source: GitHub Actions*.

### Where things are

| Path | What it holds |
| --- | --- |
| `index.html`, `<instrument>/index.html` | One HTML entry per page |
| `src/pages/` | Each page: its steps, views and measurement check |
| `src/pages/explain/` | Each instrument's "How it works" tab: text, diagrams and *Show me* actions |
| `src/instruments/<instrument>/` | Each instrument's model, its engraved scales, and how they are read |
| `src/core/` | The astronomy: time, sidereal time, precession, coordinates, sun, moon, star catalogue, observer |
| `src/three/` | Shared 3D: the stage and sight views, the sky, materials, engraving helpers |
| `src/ui/` | The atlas-style interface: panel, controls, tabs, measurement check, diagram helpers |
| `src/data/stars.json` | The star catalogue (HYG, brighter than magnitude 4.5) |
| `tests/` | Tests that check the astronomy and read each instrument's scales |
| `scripts/build-catalogue.mjs` | Rebuilds `stars.json` from the HYG catalogue |
| `references/` | The original quadrant prototype and the style reference |

### Conventions

- Angles are in degrees, right ascension included; longitude is positive east.
- Azimuth is counted from north toward east. Scene axes: north = +Z, east = −X, up = +Y.
- Altitudes are geometric: no atmospheric refraction.

### Rebuilding the star catalogue

Download `hyg/CURRENT/hygdata_v41.csv` from the
[HYG repository](https://github.com/astronexus/HYG-Database), then run:

```bash
npm run catalogue -- path/to/hygdata_v41.csv
```
