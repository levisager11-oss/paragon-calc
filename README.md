# BTD6 Paragon Calculator

Free, open-source Bloons TD 6 Paragon degree calculator. The app lets players enter pops, income, sacrificed upgrades, cash, extra Tier 5s, and Geraldo totems to calculate the resulting Paragon degree. It also includes a reverse Goal Planner, shareable builds, saved builds, embeddable widgets, image export, and static SEO pages for Paragon reference content.

## App Surfaces

- `/classic` - dark dashboard calculator layout.
- `/ticket` - arcade ticket-style calculator layout.
- `/embed.html` - embeddable calculator widget.
- `/paragons` and `/paragons/<slug>` - generated static reference pages.
- `/faq` - generated static FAQ page.
- `/api/paragon/calculate` - serverless calculation endpoint.
- `/api/paragon/version` and `/api/health` - version and health metadata.

## Development

```bash
npm install
npm run dev
```

The dev server defaults to Vite's local URL. Use `/classic` or `/ticket` once it starts.

## Verification

```bash
npm test
npm run lint
npm run build
```

`npm run build` runs the Vite build and then `scripts/generate-pages.js`, which emits the static Paragon, FAQ, and sitemap pages into `dist/`.

## Project Structure

- `src/utils/calculator.js` - core Paragon math and reverse Goal Planner.
- `src/constants/paragons.js` - Paragon data, pricing, categories, and power limits.
- `src/utils/shareState.js` - share-link and embed-state encoding.
- `src/components/TicketCalculator.jsx` - alternate ticket-style UI.
- `src/components/BuildToolbar.jsx` - share, save, embed, and image-export actions.
- `api/` - Vercel serverless API handlers.
- `scripts/generate-pages.js` - static SEO page generator.
- `test/` - Vitest coverage for calculator behavior, sharing, API metadata, and layout contracts.

## Formula Notes

The calculator models the Update 39+ Paragon formula:

- Pops and income cap at 90,000 power.
- Sacrificed upgrade tiers cap at 10,000 power.
- Cash investment caps at 60,000 power.
- Extra Tier 5s cap at 50,000 power.
- Geraldo Paragon Power Totems add 2,000 uncapped power each.
- Degree 100 requires 200,000 total power.

When changing formula data or Paragon metadata, update the constants first, then run the full test and build commands above so generated pages stay aligned with the live calculator.
