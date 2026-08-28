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

---

# Follow-up audit — the maths and the prices

A second pass over the calculation engine and every price in the roster,
checked line by line against [Blooncyclopedia](https://www.bloonswiki.com)
(reachable from this environment, unlike the Fandom wiki) as of BTD6 **v56.1**.

**Headline:** the previous audit's conclusion that "no change was needed to the
maths" was wrong on one point, and the price data was wrong on thirteen. The
four anchor values it checked all still hold — but they are four points on a
100-row curve, and the four of them happen to sit on degrees where the rounding
error does not show. The engine's *structure* (caps, rates, the cubic itself)
was and is correct.

## Formula

| Constant | Implemented | Verdict |
| --- | --- | --- |
| Degree 100 total | 200,000 power | correct |
| Pops/damage | 1 power / 180, cap 90,000 | correct |
| Income | $45 = 1 power ($1 = 4 pops) | correct |
| Upgrade tiers | 100 power/tier, cap 10,000 | correct |
| Cash | 20,000 power per base price, cap 60,000 | correct |
| Cash slider | 5% premium, max 3.15× base price | correct |
| Extra T5s | 6,000 each, cap 50,000 | correct |
| Extra T5 ceiling | flat 9 in co-op, 1 for Dart solo | **wrong — fixed** |
| Geraldo totem | 2,000 power, uncapped | correct |
| Difficulty | 0.85 / 1.00 / 1.08 / 1.20 | correct |
| Degree curve | cubic, floored | **wrong rounding — fixed** |
| Paragon roster | 13, newest Root of all Nature (U54) | current |

The cash constants were verified against a source that states them
independently rather than restating the formula: a Glaive Dominus at $375,000
is documented as costing $18.75 per power via sacrifices and $19.6875 via the
slider, with the slider capped at $1,181,250 — exactly `basePrice / 20000`,
`× 1.05`, and `× 3.15`.

### 1. The degree curve was floored; it rounds

`P(D) = (50D³ + 5025D² + 168324D + 843000) / 600` never lands on a whole number.
On 48 of the 98 degrees in range its fractional part is above .5, so `floor`
produced a threshold one power below the published table — Degree 6 read 3,407
where the game wants 3,408. A build sitting exactly on such a boundary was
reported one degree too high, and the Goal Planner asked for exactly one power
too little. Switched to `Math.round`; the engine now reproduces all 100 rows of
the documented table, which is asserted directly rather than by four samples.

### 2. Extra Tier 5s ignored the lobby size

The ceiling is `3 × players − 3`, so two-player co-op allows 3 extra Tier 5s and
three-player allows 6. The engine returned 9 for any co-op game. The public API
documents `player_count` as 1–4 and validated it, then discarded everything but
"is it ≥ 2" — a two-player build was scored as if it had four players' towers.
The wiki's own degree table pins the case that was wrong: two-player co-op tops
out at Degree 95, which the engine now reproduces.

### 3. The solo duplicate-Tier-5 rule missed Silas

`Master Double Cross` is no longer the only route to a fourth Tier 5 in solo:
Silas at level 13+ lets one player hold two Ice Monkeys with the same Tier 5
upgrade, so the Herald of Everfrost also reaches 166,000 power / Degree 92 solo
on 17 totems, not 160,000 / Degree 91 on 20. The rule now lives on the paragon
as `soloExtraT5Source` instead of an `id === "apex_plasma_master"` check, so the
engine, both UIs, the API warnings and the FAQ copy all read the same field.

### 4. Six of thirteen Paragon prices were wrong

| Paragon | Was | Correct (Medium) |
| --- | --- | --- |
| Glaive Dominus | $275,000 | **$375,000** |
| Ascended Shadow | $600,000 | **$500,000** |
| Nautic Siege Core | $500,000 | **$400,000** |
| Master Builder | $650,000 | **$600,000** |
| Magus Perfectus | $750,000 | **$800,000** |
| B.O.M.B. | $600,000 | **$650,000** |

Four of these came from commit `936e26a`, "Update Paragon prices for latest
balance patch", which moved five prices and got four of them wrong — Glaive
Dominus, Ascended Shadow, Nautic Siege Core and Magus Perfectus were all changed
away from their correct values. The other two are the v55.0 balance patch, which
swapped the pair that is easiest to confuse: B.O.M.B. went $600,000 → $650,000
in the same update that took Master Builder $650,000 → $600,000, and neither
landed here.

Base price is the denominator of the cash-per-power rate, so these were not
cosmetic: a Glaive Dominus build was scored at $13.75 per power instead of
$18.75, inflating its cash contribution by 36%.

All 13 medium prices and all 52 difficulty-scaled prices are now pinned in
`test/version.test.js`.

### 5. Seven of thirteen max-T4 sacrifice costs were wrong

`maxT4MediumCost` — the priciest legal non-Tier-5 sacrifice, which the cash
optimiser uses to decide how much can come off the slider — was wrong for seven
Paragons, by as much as $1,100 (Navarch of the Seas: $12,400 → $13,500). The
Herald of Everfrost carried the Druid's number. The `maxT4Build` crosspaths were
all correct.

The other three difficulties were also being derived by multiplying the Medium
total. BTD6 applies the multiplier to each upgrade and rounds it individually,
so the derived figure is up to $5 off (a 2-4-0 Dart Monkey is $7,205 on Easy,
not $7,210). The field is now `maxT4Cost`, a stored value per difficulty, read
through `getMaxT4Cost`.

### 6. The embed widget had re-grown its own copy of the T5 rule

`EmbedCalculator.jsx` computed `gameMode === "coop" ? 9 : paragonId ===
"apex_plasma_master" ? 1 : 0` inline — the exact duplication item 26 removed
from the API. It calls `maxT5sFor` now.

## Not changed

- **The cubic itself, and every power constant and cap.** They verify against
  the published table and the per-source rates.
- **"Pops" as the input label.** The wiki now describes this source as damage
  dealt rather than pops, but it is the same counter and the same divisor, and
  "pops" is what the community calls it.
- **The API's warning `type` codes.** Their conditions changed; the documented
  strings did not.
