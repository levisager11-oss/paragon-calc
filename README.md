# BTD6 Paragon Calculator

A free, open-source Paragon degree calculator for **Bloons TD 6** — live at
[paragon-calc.vercel.app](https://paragon-calc.vercel.app/).

Enter what you plan to sacrifice and it tells you the exact Degree (1–100) you
will get, what is being wasted, and the cheapest way to reach the next degree.
Or work backwards: set a target degree and the Goal Planner returns the minimum
inputs to hit it.

- **One design system** — a 4pt spacing scale, three radii and a single accent, shared by the app, the embed widget and the static pages
- **Goal Planner** — reverse-solves a target degree under `leastCash`, `balanced` or `leastPops`
- **Cash optimiser** — moves whole tower sacrifices off the 95%-efficient cash slider
- **Shareable builds** — every build round-trips through the URL; save, embed or export a PNG
- **Public JSON API** — `POST /api/paragon/calculate`, for Discord bots and integrations
- **Static SEO pages** — `/paragons`, `/paragons/<slug>` and `/faq` are pre-rendered HTML

## The formula

A Paragon's degree comes from **Paragon Power Points**, capped at **200,000** at
Degree 100.

| Source | Rate | Cap |
| --- | --- | --- |
| Pops & Income | 1 power per 180 pops; $1 income = 4 pops (so $45 = 1 power) | 90,000 |
| Sacrificed upgrade tiers | 100 power per tier on non-T5 sacrifices | 10,000 |
| Cash invested | 20,000 power per base price spent (slider costs 5% more) | 60,000 |
| Extra Tier 5s | 6,000 power each, beyond the three the Paragon consumes | 50,000 |
| Geraldo's Paragon Power Totems | 2,000 power each | uncapped |

Extra Tier 5s are limited by game mode: **9** in co-op (four players × three T5s,
minus the three consumed), **0** in solo — except the Dart Monkey, which may add
one via the *Master Double Cross* Monkey Knowledge.

Degrees 2–99 sit on the community-documented cubic:

```
power(D) = floor((50·D³ + 5025·D² + 168324·D + 843000) / 600)
```

Degree 1 is 0 power and Degree 100 is a flat 200,000 — the cubic only reaches
196,542 at D=100, so the last step is larger than the curve implies. That is
real in-game behaviour, and `test/calculator.test.js` pins it against four
independently documented values:

| Fact | Value |
| --- | --- |
| Maxed solo Paragon | 160,000 power → **Degree 91** |
| Maxed solo Dart Monkey (Master Double Cross) | 166,000 power → **Degree 92** |
| Totems to take a maxed solo Paragon to Degree 100 | **20** |
| Totems to take a maxed solo Dart Monkey to Degree 100 | **17** |

If a balance patch moves any of these, that test file is the place to start —
and `src/utils/calculator.js` is the single implementation. The API imports it
rather than keeping its own copy, and `test/parity.test.js` enforces that.

Difficulty scales the base price by 0.85× (Easy), 1.00× (Medium), 1.08× (Hard)
and 1.20× (Impoppable), rounded to the nearest $5.

## Design system

Every visual value lives in the token block at the top of `src/index.css`.
Nothing below that block invents its own.

| | |
| --- | --- |
| Spacing | 4pt scale, `--s-1` (4px) to `--s-20` (80px). Everything that separates two elements is a token; the only literals are optical icon alignment and slider-thumb geometry. |
| Radii | `--r-sm` 6px, `--r-md` 10px, `--r-lg` 16px, plus `--r-pill` for capsules and circles |
| Type | Space Grotesk for headings, Inter for body; seven steps, every line-height on the 4pt grid |
| Colour | Flat `#0B0D12` canvas, three text weights, one accent (`#2E7DF6`); amber/green/red carry state only |
| Tower classes | BTD6's Primary/Military/Magic/Support colours, used on 12px chips only |
| Elevation | One neutral shadow, for surfaces that float (dropdowns, dialogs). Everything else separates with a border. |
| Motion | 120ms and 200ms on one curve, on hover and focus only |

Light mode flips the tokens; no component carries a light-mode override. The
theme is applied before first paint by an inline script in `index.html`, and the
static pages read the same `localStorage` key so they match the app.

Two surfaces keep their own copy of the tokens because they build as separate
documents: `src/components/EmbedCalculator.css` (the `/embed` widget) and the
`BASE_CSS` block in `scripts/generate-pages.js` (the static pages). The values
are identical — change one, change all three.

`/ticket`, a second neo-brutalist design that used to live alongside the
calculator, was retired: two design languages in one product is a consistency
problem, and `vercel.json` now redirects the route to `/classic`.

### Paragon artwork

Drop one PNG per Paragon into `public/paragon-art/` and it is picked up
everywhere — the search dropdown, the active build chip, the related-paragon
chips, saved builds, the exported result card and the static Paragon pages.
Nothing else needs editing; commit the files and redeploy.

Name each file for the Paragon's slug — the same slug as its `/paragons/<slug>`
page:

```
apex-plasma-master.png                    magus-perfectus.png
glaive-dominus.png                        goliath-doomship.png
ascended-shadow.png                       crucible-of-steel-and-flame.png
navarch-of-the-seas.png                   mega-massive-munitions-factory.png
nautic-siege-core.png                     ballistic-obliteration-missile-bunker.png
master-builder.png                        herald-of-everfrost.png
root-of-all-nature.png
```

**128×128 PNG, transparent, square.** That covers every size the app renders at:
the 32px tiles at 2x, and the 64px hero on a Paragon page at 2x. Art is drawn
with `object-fit: contain`, so a non-square source is letterboxed in its tile
rather than cropped.

Artwork is optional and resolves per Paragon, so a partial set is fine — any
Paragon without a file keeps its emoji. `vite.config.js` reads the folder at
build time and injects the list of slugs that have art, so the app never
requests a file that isn't there; `scripts/generate-pages.js` does the same
check on disk, so the static pages never emit a broken image.

Bloons TD 6 artwork is Ninja Kiwi's. Whatever lands here is redistributed from a
site that serves ads, so confirm you have the right to use it before shipping.

## Development

```bash
npm install
npm run dev        # vite dev server
npm run lint       # eslint
npm test           # vitest
npm run build      # vite build + static page generation into dist/
npm run preview    # serve dist/
```

Two generators are dev-time only; their output is committed so production builds
stay dependency-free:

```bash
npm run gen:pages    # /paragons, /paragons/<slug>, /faq and sitemap.xml (also run by `build`)
npm run gen:images   # public/og-image.png and the PWA icons — needs Chromium (see CHROME_BIN)
```

### Layout

```
src/utils/calculator.js      the engine — degree curve, power caps, reverse solver
src/constants/paragons.js    paragon roster, costs and power limits (single source of truth)
src/constants/faq.js         FAQ copy; numbers are computed from the engine, not typed
src/index.css                design tokens + every component style
src/App.jsx                  the calculator
src/components/              embed widget, build toolbar, ad slot
api/                         serverless handlers; api/_lib/shared.js re-exports the engine
scripts/generate-pages.js    static SEO pages + sitemap
scripts/generate-images.js   social card + PWA icons
```

## API

```bash
curl -X POST https://paragon-calc.vercel.app/api/paragon/calculate \
  -H 'Content-Type: application/json' \
  -d '{"tower":"Ninja Monkey","pops":2400000,"upgrade_count":34,"cash_spent":420000}'
```

`tower` accepts a tower name, a Paragon name or a Paragon id. Everything else is
optional: `pops`, `income`, `cash_spent`, `slider_cash`, `tier5_count`,
`upgrade_count`, `geraldo_totems`, `player_count` (1–4), `difficulty`.

The response carries the degree, total power, a per-source breakdown with cap
flags, warnings for anything wasted or disallowed, and the rate-limit state.

`GET /api/paragon/version` lists the valid towers, difficulties and limits.
`GET /api/health` is a liveness check.

**Rate limits:** 60 requests/minute per IP, or 300 with a valid `X-API-Key` when
`PARAGON_API_KEYS` is set. Limits are per serverless instance and therefore
best-effort — use the `X-RateLimit-*` response headers to self-throttle. The
limiter keys on `X-Forwarded-For`, which a determined caller can spoof; it is
abuse-dampening, not a security control.

## License & attribution

Not affiliated with Ninja Kiwi. Bloons TD 6 is a trademark of Ninja Kiwi.
Game data is community-documented; see the anchor values above for how the
formula is verified.
