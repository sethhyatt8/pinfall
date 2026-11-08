# Pinfall

Collect tee and basket GPS on the phone. Open a course, stand on the spot, and tap **TEE** or **BASKET**. There is no account and no server.

Seeded courses:

- **Brandywine Creek State Park** (Wilmington, DE) — 18 holes. A/B lengths and pars come from the course chart. Holes 2, 12, and 17 have S and ALT tees. Hole 17 has no B basket. The map opens on the course area (39.80437, -75.57828), which is not saved as a pin.
- **Tamanend Park** (Southampton, PA) — 9 holes, all par 3, about 1,785 ft total. Per-hole lengths are blank. The map opens near the approximate first tee (40.18016, -75.03501). That point is not saved as the tee.
- **Tyler State Park** (Newtown, PA) — East 1–18 and West 19–36. Pars and lengths are blank so you can copy the signs. The map opens at the upper plantation parking lot. That point is not a tee or a basket.

Tamanend ships with the 18 saved tee and basket visits in `public/data/tamanend-pins.json`, so a new phone can show live distance to those baskets. Brandywine and Tyler stay empty until real readings are merged and published. A course center is never used as a pin. Readings you take on the phone stay on the phone until you send them.

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
5. Pick a course. The course screen has **Map a course** and **Play a round**.
6. **Map a course** shows **HOLE 1** (or the hole you were on), **TEE**, and **BASKET**. Stand on the spot and tap it. Hold still while it counts down. A green **SAVED ✓** confirms it, then disappears. **✓ Saved (1)** stays under that button. **◀ Hole** and **Hole ▶** move between holes.
7. **Play a round** shows a huge **HOLE N** and the live distance to the basket in feet. The number appears only when the phone has a GPS fix and that basket was saved. Otherwise it stays **—** with **No location** or **No saved basket**. Stand next to the disc and tap **Mark drive landing**. That stores one GPS reading, the feet from the tee, and the feet left to the basket. **Mark again** replaces it. Enter strokes with **+** and **−**, then **Finish hole**. The last hole opens **Round done**. Leave the app and come back: the course button says **Resume hole N** until the round is finished. Finished rounds stay in the list.
8. **Add photo or video** is optional. The file is stored on the phone. **Remove** deletes it. If the phone is full, or the browser cannot store files, the message says so and the score stays.
9. On **Round done**, tap **Save round file**. The share sheet (or a download) gives you one zip with the scores and the photos. In the share sheet, choose Google Drive and the folder **Pinfall Readings**. Pinfall does not upload the file.
10. **Send readings** is on the course list and on the course screen. It shares a JSON file of every saved visit and every raw fix already on the phone. If the browser cannot share files, the same JSON downloads.
11. After the first online load, mapping, play, saved pins, and scores open offline. GPS still works offline. Satellite photos are loaded live from Esri and are not stored for offline use. Esri’s World Imagery layer is not licensed for offline export.

A phone cannot use your computer’s `localhost`. Location on the dev server only works in a browser on that same computer.

## How a pin is estimated

Each saved visit is one averaged GPS point. The pin is the inverse-variance mean of those visits: weight is `1 / accuracy²`, computed in a local east/north frame. The circle is the larger of the formal standard error and the scatter of the points.

A pin dragged on the photo is stored as ±50 m, so a GPS visit outweighs it. A stored point is left out when it is more than 8 m from the mean and more than 3× its own accuracy. Use **Basket moved** when a new visit keeps getting rejected.

Distances use the haversine formula on a sphere of radius 6,371,008.8 m. Feet are international feet (0.3048 m).

## Map tiles

Satellite imagery is [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer):

`Tiles © Esri — Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community`

The attribution stays on the map. Leaflet’s own credit stays too.

## Send readings back

1. On the phone, map the holes, then tap **Send readings** and save the JSON (Files, AirDrop, or mail).
2. On a computer, from this repo:

```bash
npm run merge-readings -- path/to/pinfall-readings.json
```

That reads the export, dedupes by reading id against `public/data/<course>-pins.json`, and writes the combined raw readings plus a pin for each tee and basket. The pin is the inverse-variance average. A sample farther than 8 m and farther than 3× its own accuracy is left out. A visit that already has raw fixes is not averaged a second time. Run the same file again and the ids already in the bundle are skipped.

3. Commit the updated `public/data/*-pins.json` and push to `main`. The next deploy publishes those coordinates. Tamanend already loads its published visits for live distance. A reading id that is both published and saved on the phone is counted once, and the phone’s copy is kept. New visits on the phone are included in the average. Brandywine and Tyler show a distance only after real pins are published the same way.

Photos and videos are stored in a separate IndexedDB database (`pinfall-media`). The round record keeps the file name and size, not the bytes, so a large photo is not copied into `localStorage`.

## Data

Pins, rounds, par/length edits, and settings are stored in IndexedDB (`pinfall`) and mirrored to `localStorage` (`pinfall.v1`). Photo and video bytes stay in IndexedDB (`pinfall-media`). **Data → Export JSON** downloads a version-1 backup of the small records. Import replaces what is on the phone. Erase clears saved data and leaves the three courses in place. The published Tamanend pins come back with the app.
