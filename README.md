# Pinfall

Mobile disc golf distances from the phone’s GPS. Tee and basket pins start empty and are learned on the device. There is no account and no server.

Seeded courses:

- **Brandywine Creek State Park** (Wilmington, DE) — 18 holes. A/B lengths and pars come from the course chart. Holes 2, 12, and 17 have S and ALT tees. Hole 17 has no B basket. The map opens on the course area (39.80437, -75.57828), which is not saved as a pin.
- **Tamanend Park** (Southampton, PA) — 9 holes, all par 3, about 1,785 ft total. Per-hole lengths are blank. The map opens near the approximate first tee (40.18016, -75.03501). That point is not saved as the tee.
- **Tyler State Park** (Newtown, PA) — East 1–18 and West 19–36. Pars and lengths are blank so you can copy the signs. The map opens at the upper plantation parking lot. That point is not a tee or a basket.

No tee or basket coordinate is shipped with the app.

## Run locally

```bash
npm install
npm run dev
```

The dev server is [http://127.0.0.1:43123/pinfall/](http://127.0.0.1:43123/pinfall/). The `/pinfall/` prefix matches the GitHub project Pages path. On the computer running it, `localhost` counts as a secure page, so the browser can ask for location.

```bash
npm test
npm run lint
npm run build
npm run preview
```

`npm test` covers haversine distance, the inverse-variance pin average (including outlier rejection and low-weight dragged guesses), GPS visit filtering, the Brandywine chart, and JSON backup round-trips.

## Build

```bash
npm run build
```

The static site is written to `dist/`. Routes use a hash (`/pinfall/#/c/brandywine/h/7`), so the host does not need a special rewrite. Vite’s `base` is `/pinfall/`, and the PWA manifest `start_url` and `scope` are the same path. A service worker at `/pinfall/sw.js` can only control `/pinfall/`.

## Deploy

**GitHub Pages (project site).** Push to `main` on a public repo named `pinfall`. `.github/workflows/pages.yml` runs the tests, builds, and deploys with GitHub Actions. In the repo settings, Pages → Build and deployment → Source must be **GitHub Actions**. The live site is `https://<user>.github.io/pinfall/`.

**Netlify or Cloudflare at a domain root.** Change `base` in `vite.config.ts` (and the manifest `start_url` / `scope`) to `'/'`, then rebuild. `netlify.toml` expects that root layout. Dragging this `dist` folder onto a root host will request assets under `/pinfall/` and the page will not load.

The deployed URL must be **HTTPS**. Geolocation does not work on a phone over plain `http://`.

## Try it on a phone

1. Open `https://<user>.github.io/pinfall/` (or any other HTTPS host that serves this build at `/pinfall/`).
2. On the phone, open that URL once while you have a connection. That installs the app shell.
3. **iPhone:** Safari → Share → **Add to Home Screen**. Open Pinfall from the icon, not from a normal tab. In Settings → Privacy & Security → Location Services, allow Safari (or the home-screen app) while using the app, and turn **Precise Location** on.
4. **Android:** Chrome → menu → **Install app** or **Add to Home screen**. Allow location when asked.
5. Stand in the open, open a hole, and tap **I’m at the basket** or **I’m at the tee**. Hold still for about 10–15 seconds. Fixes worse than 20 m are discarded. The visit is saved only when at least 3 fixes agree.
6. After that first load, the app, pins, distances, and scorecard open offline. GPS still works offline. Satellite photos are loaded live from Esri and are not stored for offline use — Esri’s World Imagery layer is not licensed for offline export. If you are offline, pins still plot on an empty map.

A phone cannot use your computer’s `localhost`. Location on the dev server only works in a browser on that same computer.

## How a pin is estimated

Each saved visit is one averaged GPS point. The pin is the inverse-variance mean of those visits: weight is `1 / accuracy²`, computed in a local east/north frame. The circle is the larger of the formal standard error and the scatter of the points.

A pin dragged on the photo is stored as ±50 m, so a GPS visit outweighs it. A stored point is left out when it is more than 8 m from the mean and more than 3× its own accuracy. Use **Basket moved** when a new visit keeps getting rejected.

Distances use the haversine formula on a sphere of radius 6,371,008.8 m. Feet are international feet (0.3048 m).

## Map tiles

Satellite imagery is [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer):

`Tiles © Esri — Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community`

The attribution stays on the map. Leaflet’s own credit stays too.

## Data

Pins, scorecards, par/length edits, and settings are stored in IndexedDB (`pinfall`) and mirrored to `localStorage` (`pinfall.v1`). **Data → Export JSON** downloads a version-1 backup. Import replaces what is on the phone. Erase clears saved data and leaves the three courses in place.
