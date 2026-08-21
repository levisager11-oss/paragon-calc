# Code audit — BTD6 Paragon Calculator

Full review of the calculation engine, both UIs, the public API, SEO and repo
hygiene. Findings are ordered by severity; every one listed as **Fixed** was
resolved in the commits on this branch.

**Headline:** the calculation engine is correct and current — every constant and
the degree curve check out against the documented in-game values. What was wrong
was almost everything built *on top* of it: the on-page prose contradicted the
calculator by 15 degrees, two of the four "next degree" recommendations were
computed against the wrong quantity, and the web engine and the public API
disagreed for the same input.

---

## Formula verification

Verified against community-documented BTD6 values. The wikis themselves are
unreachable from this environment, so each figure was confirmed from search
results and then cross-checked for internal consistency.

| Constant | Implemented | Verdict |
| --- | --- | --- |
| Degree 100 total | 200,000 power | correct |
| Pops | 1 power / 180 pops, cap 90,000 | correct |
| Income | $1 = 4 pops ($45 = 1 power) | correct |
| Upgrade tiers | 100 power/tier, cap 10,000 | correct |
| Cash | 20,000 power per base price spent, cap 60,000 | correct |
| Cash slider | 5% premium, max 3.15× base price | correct |
| Extra T5s | 6,000 each, cap 50,000, max 9 in co-op | correct |
| Geraldo totem | 2,000 power, uncapped | correct |
| Difficulty | 0.85 / 1.00 / 1.08 / 1.20 | correct |
| Paragon roster | 13, including Root of all Nature (Druid, U54) | current |

The degree curve — `floor((50D³ + 5025D² + 168324D + 843000) / 600)` for D 2–99,
with D=1 at 0 and D=100 pinned to 200,000 — reproduces four independently
documented facts exactly:

- a maxed solo Paragon (160,000 power) is **Degree 91**
- a maxed solo Dart Monkey with Master Double Cross (166,000) is **Degree 92**
- **20** totems take the former to Degree 100
- **17** totems take the latter to Degree 100

The last two are the strongest check available: they only come out whole if
Degree 100 really is 200,000 rather than the 196,542 the cubic yields at D=100.
The hardcoded endpoint is therefore correct, not a rounding artefact. All four
are now regression tests in `test/calculator.test.js`.

**No change was needed to the maths.** It is now pinned so it cannot drift.

---

## P0 — Wrong numbers shown to users

| # | Finding | Status |
| --- | --- | --- |
| 1 | Guides and FAQ claimed a maxed solo Paragon reaches "Degree 76" (79 for Dart), contradicting the calculator on the same page by 15 degrees. The claim also sat in the `FAQPage` structured data, so it was being served to search engines. | Fixed |
| 2 | The pops recommendation was sized against the *whole* next-degree threshold rather than the remaining gap, ignoring power already banked elsewhere — quoting ~8.6M pops where ~300k was needed. The correct value was computed one line above and discarded. | Fixed |
| 3 | The upgrades recommendation was the constant `100 - upgrades` regardless of the gap, so it always read "sacrifice N more tiers" where N filled the entire category. Its example text was garbled too. | Fixed |
| 4 | `calculateParagonData` counted extra T5s the game disallows (solo, non-Dart) while simultaneously warning they were invalid. The API clamped them; the site did not. Same build, two answers. | Fixed |
| 5 | The web engine left cash power fractional, so totals rendered as `133.333 / 200,000`. The API floored it. | Fixed |
| 6 | Classic Goal Planner reported "max 1 extra T5" for a Dart Monkey in co-op — the ternary tested the paragon before the game mode, while the engine correctly used 9. | Fixed |

## P1 — User-visible UI defects

| # | Finding | Status |
| --- | --- | --- |
| 7 | The classic guide — the main on-page SEO content — rendered its source markdown literally: `**180 pops/damage**` with every bullet collapsed onto one line. | Fixed |
| 8 | Three inline `color: "#fff"` styles were invisible against the shipped light theme. | Fixed |
| 9 | Canonicalising `/` to `/classic` discarded the query string, so a shared build survived first paint but not a refresh or a copy-paste. Switching designs discarded it too. | Fixed |
| 10 | The two designs keep separate state, so switching between them silently threw away everything you had entered. | Fixed |
| 11 | Corrupt or stale `localStorage` crashed the Ticket header (`DIFFS.find(...).label` on `undefined`). | Fixed |
| 12 | The Ticket design's "Road to Degree N" cards had no mapping for the upgrades recommendation, so it was silently dropped. | Fixed |
| 13 | One `:focus-visible` rule across ~3,100 lines of CSS, and several inputs cleared their outline entirely — keyboard focus was effectively invisible. | Fixed |
| 14 | Range sliders had visual labels not associated with the input; toggles, steppers and the search-clear button had no accessible name. | Fixed |
| 15 | Paragon search results were click-only `div`s, unreachable by keyboard. | Fixed |
| 16 | No `prefers-reduced-motion` handling despite a continuously animating degree gauge and logo pulse. | Fixed |

## P2 — SEO

| # | Finding | Status |
| --- | --- | --- |
| 17 | `index.html` declared an `AggregateRating` of 4.8 stars from 150 reviews. No reviews exist; self-serving ratings breach Google's structured-data policy and risk a site-wide manual action. | Fixed — removed |
| 18 | "Update 39+ Certified" in the title, description, OG/Twitter tags, manifest, FAQ and both guides. BTD6 was on Update 54+ (the Druid Paragon shipped in U54). | Fixed — bumped to 54+ |
| 19 | `og:image`/`twitter:image` pointed at the 454×453 logo while declaring `summary_large_image`, which renders badly or gets rejected. | Fixed — real 1200×630 card |
| 20 | `manifest.json` declared `logo.png` as both 192×192 and 512×512 when it is 454×453, so Chrome rejected it for install eligibility. | Fixed — real icons |
| 21 | `FAQPage` JSON-LD was duplicated between `index.html` (4 hardcoded items) and `/faq` (10 generated) and had already drifted. Google also requires the marked-up Q&A to be visible on the page carrying it, which the SPA shell does not do. | Fixed — `/faq` owns it |
| 22 | The SPA catch-all rewrite excluded a hand-maintained list of five filenames — the reason `ads.txt` went missing once already. Any new static asset or generated route needed a pattern edit. | Fixed — excludes any path with a file extension, plus the generated routes |
| 23 | `public/sitemap.xml` listed only `/` with a hardcoded `lastmod`, and was silently overwritten at build; `/classic` and `/ticket` were absent. | Fixed — generator owns it |
| 24 | No `<noscript>` content: the SPA shell is an empty `<div id="root">`. | Fixed |

## P3 — Code quality and repo hygiene

| # | Finding | Status |
| --- | --- | --- |
| 25 | `npm run lint` failed with 11 errors: unused locals in the engine, identical ternary branches, `process` undefined in `api/` (Node globals were only configured for `scripts/`), an unused React import, and a `set-state-in-effect` violation. | Fixed — lint is clean |
| 26 | The API kept its own copy of the roster, the power limits, `getBasePrice`, `getPowerThreshold` and `calculateDegreeFromPower`. Two implementations of one formula; the next balance patch could update one and miss the other. | Fixed — `api/_lib/shared.js` re-exports the app's modules, with a parity test |
| 27 | 64 tests covered HTTP handling, rate limiting and share-state — **none** asserted a degree or a power threshold. The core product had no coverage. | Fixed — 43 new tests, 107 total |
| 28 | `calculateDegreeFromPower` re-evaluated a cubic up to 99 times per call, on every keystroke, in three components. | Fixed — precomputed table |
| 29 | 1.5 MB of unreferenced files committed, including a 1.3 MB saved-page export. | Fixed — deleted |
| 30 | `README.md` was still the stock "React + Vite" template, though the site footer links to the repo. | Fixed — real docs |

---

## Deliberately not changed

- **The degree curve and every power constant.** They verify against the
  documented in-game values; the bug was in the copy describing them.
- **The API's warning `type` codes.** External integrations may depend on the
  documented strings, so the codes were kept while their *conditions* now come
  from the shared engine.
- **In-memory rate limiting.** It is per-serverless-instance and keys on a
  spoofable `X-Forwarded-For`. Both limitations were already documented in the
  handler; the README now states them too. Making it robust means external state
  (Redis/KV), which is a bigger decision than an audit should make unilaterally.
- **The `<meta name="keywords">` tag.** Ignored by Google, harmless, not worth
  the churn.

## Verified on a real deploy

Item 22 changed the Vercel rewrite pattern, and item 26 made the serverless
functions import across directories into `src/` — both behave differently under
`vite preview` than on Vercel, so they were checked against the PR #25 preview
deployment. All pass:

| Route | Result |
| --- | --- |
| `/paragons/apex-plasma-master` | real generated HTML, not the SPA shell — and quoting the corrected "166,000 power — Degree 92 — 17 totems" |
| `/ads.txt` | served as `text/plain` (the regression that prompted the original exclusion list) |
| `/sitemap.xml` | 18 URLs including `/classic` and `/ticket` |
| `/manifest.json` | the corrected 192/512 icons |
| `/api/paragon/version` | 200, `api_version` 1.2, full 13-tower roster |
| `/api/paragon/calculate` | loads and responds (405 to GET, as documented) |

The API results confirm Vercel's dependency tracing follows `api/_lib/shared.js`
into `src/constants/paragons.js` and `src/utils/calculator.js`, so the
de-duplication in item 26 is safe in production and not just under test.
