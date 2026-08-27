/**
 * Static page generator for the BTD6 Paragon Calculator.
 *
 * Emits real, crawlable HTML for the SEO content pages that the single-page
 * calculator app can't serve well on its own:
 *
 *   /paragons                       — hub listing all 13 Paragons
 *   /paragons/<slug>                — one landing page per Paragon
 *   /faq                            — FAQ page (matches the FAQPage JSON-LD)
 *   /sitemap.xml                    — full sitemap including the above
 *
 * Run after `vite build` (see package.json). Output defaults to ./dist so the
 * files sit alongside Vite's bundle; Vercel serves these real files before the
 * SPA catch-all rewrite in vercel.json, so each route resolves to static HTML.
 *
 * The per-Paragon numbers (costs, Degree 100 path) are computed with the same
 * engine the app uses (src/utils/calculator.js), so they never drift from the
 * live calculator.
 *
 * Usage:  node scripts/generate-pages.js [outDir]   (outDir defaults to dist)
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { PARAGONS, DIFFICULTY_MULTIPLIERS, paragonSlug } from "../src/constants/paragons.js";
import { getBasePrice, reverseCalculate, soloCeilingFacts } from "../src/utils/calculator.js";
import { FAQ_ITEMS } from "../src/constants/faq.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = process.argv[2]
  ? path.resolve(ROOT, process.argv[2])
  : path.resolve(ROOT, "dist");

const SITE_URL = "https://paragon-calc.vercel.app";
const ADSENSE_CLIENT = "ca-pub-9156198299199380";
const TODAY = new Date().toISOString().slice(0, 10);

const CATEGORY_META = {
  primary:  { label: "Primary",  color: "var(--class-primary)" },
  military: { label: "Military", color: "var(--class-military)" },
  magic:    { label: "Magic",    color: "var(--class-magic)" },
  support:  { label: "Support",  color: "var(--class-support)" },
};

// Paragon ids contain only [a-z_], so swapping _ for - is a clean, reversible
// slug. App.jsx reverses it (- back to _) to resolve ?paragon=<slug> deep links.
// Shared with the app via the roster so the two can never drift.
const slugFor = paragonSlug;

// These pages are static HTML with no client JS, so there is no onerror to fall
// back on: resolve the artwork at build time and emit the emoji when a file is
// absent. That way a missing PNG is simply the old icon, never a broken image.
const artPath = (p) => `/paragon-art/${slugFor(p)}.png`;
const hasArt = (p) => existsSync(path.join(ROOT, "public", "paragon-art", `${slugFor(p)}.png`));
const paragonIcon = (p, cls, size) =>
  hasArt(p)
    ? `<img class="${cls}" src="${artPath(p)}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async" />`
    : `<span class="${cls}" aria-hidden="true">${p.icon}</span>`;

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const num = (n) => Math.round(n).toLocaleString("en-US");

// Serialize JSON-LD, escaping "<" so a stray "</script>" in data can't break out.
const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

const BASE_CSS = `
/* Token layer — the same 4pt scale, three radii, type ramp and accent as the
   app (src/index.css). Inlined because these pages ship as standalone HTML. */
:root{
  --s-1:4px;--s-2:8px;--s-3:12px;--s-4:16px;--s-5:20px;--s-6:24px;--s-8:32px;--s-10:40px;--s-12:48px;--s-16:64px;
  --r-sm:6px;--r-md:10px;--r-lg:16px;--r-pill:9999px;
  --canvas:#0B0D12;--surface:#12151C;--surface-sunken:#0E1116;--surface-hover:#1C212B;
  --border:rgba(255,255,255,.08);--border-strong:rgba(255,255,255,.14);
  --text:#F5F7FA;--text-muted:#9BA3B4;--text-subtle:#7C8494;
  --accent:#2E7DF6;--accent-fill:#2665CC;--accent-fill-hover:#2A6FDD;--accent-ink:#fff;
  --success:#3DAE73;
  --class-primary:#E4643C;--class-military:#4F9E5F;--class-magic:#A27AD9;--class-support:#D19A2E;
  --shadow:0 12px 32px rgba(0,0,0,.44);
  --font-display:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;
  --font-sans:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;
  --fs-h1:32px;--lh-h1:40px;--fs-h2:24px;--lh-h2:32px;--fs-h3:16px;--lh-h3:24px;
  --fs-body:15px;--lh-body:24px;--fs-sm:13px;--lh-sm:20px;--fs-xs:12px;--lh-xs:16px;
  --dur-fast:120ms;--ease:cubic-bezier(.2,0,0,1);
  --container:880px;--gutter:var(--s-6);
}
[data-theme="light"]{
  --canvas:#F7F8FA;--surface:#fff;--surface-sunken:#F1F3F6;--surface-hover:#EDF0F4;
  --border:rgba(16,20,28,.10);--border-strong:rgba(16,20,28,.18);
  --text:#10141C;--text-muted:#576073;--text-subtle:#676F7D;
  --accent:#1B62D6;--accent-fill:#1B62D6;--accent-fill-hover:#1550B4;--success:#1B6E45;
  --class-primary:#B4411E;--class-military:#2F7040;--class-magic:#6438A8;--class-support:#8A6110;
  --shadow:0 12px 32px rgba(16,20,28,.12);
}

*,*::before,*::after{box-sizing:border-box}
*{margin:0;padding:0}
img,svg{display:block;max-width:100%}
ul{list-style:none}
body{
  background:var(--canvas);color:var(--text);
  font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;min-height:100vh;
}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
strong{color:var(--text);font-weight:600}
h1,h2,h3{font-family:var(--font-display);font-weight:600;color:var(--text);letter-spacing:-.01em}
h1{font-size:var(--fs-h1);line-height:var(--lh-h1);letter-spacing:-.02em;margin-bottom:var(--s-3)}
h2{font-size:var(--fs-h2);line-height:var(--lh-h2);margin-bottom:var(--s-4)}
p{color:var(--text-muted)}

.wrap{max-width:var(--container);margin:0 auto;padding:0 var(--gutter)}

.site-header{
  display:flex;align-items:center;justify-content:space-between;gap:var(--s-6);
  height:64px;border-bottom:1px solid var(--border);flex-wrap:wrap;
}
.brand{display:flex;align-items:center;gap:var(--s-3);color:var(--text)}
.brand:hover{text-decoration:none}
.brand img{
  width:36px;height:36px;border-radius:var(--r-md);
  background:var(--surface);border:1px solid var(--border);padding:var(--s-1);
}
.brand-text{font-family:var(--font-display);font-weight:600;font-size:var(--fs-h3);line-height:var(--lh-h3)}
.site-nav{display:flex;gap:var(--s-6)}
.site-nav a{
  font-size:var(--fs-sm);line-height:var(--lh-sm);font-weight:500;color:var(--text-muted);
  transition:color var(--dur-fast) var(--ease);
}
.site-nav a:hover{color:var(--text);text-decoration:none}

main{padding:var(--s-10) 0 var(--s-16)}

.crumbs{
  display:flex;flex-wrap:wrap;gap:var(--s-2);margin-bottom:var(--s-6);
  font-size:var(--fs-sm);line-height:var(--lh-sm);color:var(--text-subtle);
}
.crumbs a{color:var(--text-muted)}
.crumb-sep{color:var(--text-subtle)}

.lede{color:var(--text-muted);margin-bottom:var(--s-5);max-width:66ch}
.muted{color:var(--text-subtle);font-size:var(--fs-sm);line-height:var(--lh-sm)}

.badge{
  display:inline-flex;align-items:center;height:20px;padding:0 var(--s-2);margin-bottom:var(--s-3);
  border-radius:var(--r-pill);font-size:var(--fs-xs);line-height:var(--lh-xs);font-weight:600;
  color:var(--cat,var(--text-muted));
  background:color-mix(in srgb,var(--cat,var(--text-muted)) 14%,transparent);
  border:1px solid color-mix(in srgb,var(--cat,var(--text-muted)) 34%,transparent);
}

.cta{
  display:inline-flex;align-items:center;padding:var(--s-3) var(--s-5);
  background:var(--accent-fill);color:var(--accent-ink);border-radius:var(--r-sm);
  font-size:var(--fs-sm);line-height:var(--lh-sm);font-weight:600;
  transition:background var(--dur-fast) var(--ease);
}
.cta:hover{background:var(--accent-fill-hover);text-decoration:none}

.p-hero{display:flex;gap:var(--s-5);align-items:flex-start;margin-bottom:var(--s-8)}
.p-emoji{
  flex-shrink:0;display:grid;place-items:center;width:64px;height:64px;
  font-size:32px;line-height:1;border-radius:var(--r-lg);
  background:var(--surface);border:1px solid var(--border);overflow:hidden;
}
img.p-emoji,img.pcard-emoji{object-fit:contain;padding:var(--s-1)}

.card{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);
  padding:var(--s-6);margin-bottom:var(--s-6);
}

.stat-table{width:100%;border-collapse:collapse;font-size:var(--fs-sm);line-height:var(--lh-sm)}
.stat-table th{
  text-align:left;font-weight:400;color:var(--text-muted);
  padding:var(--s-3) 0;border-bottom:1px solid var(--border);width:58%;
}
.stat-table td{
  text-align:right;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;
  padding:var(--s-3) 0;border-bottom:1px solid var(--border);
}
.stat-table tr:last-child th,.stat-table tr:last-child td{border-bottom:none}

.reqs,.abilities{display:flex;flex-direction:column;gap:var(--s-3);margin-top:var(--s-4)}
.reqs+p,.abilities+p{margin-top:var(--s-4)}
.reqs li,.abilities li{
  position:relative;padding-left:var(--s-4);
  font-size:var(--fs-sm);line-height:var(--lh-sm);color:var(--text-muted);
}
.reqs li::before,.abilities li::before{
  content:"";position:absolute;left:0;top:8px;width:var(--s-1);height:var(--s-1);
  border-radius:var(--r-pill);background:var(--text-subtle);
}

.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s-3);margin-top:var(--s-4)}
.grid-wide{grid-template-columns:repeat(4,minmax(0,1fr))}

.pcard{
  display:flex;flex-direction:column;gap:var(--s-1);padding:var(--s-4);
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);color:var(--text);
  transition:background var(--dur-fast) var(--ease),border-color var(--dur-fast) var(--ease);
}
.pcard:hover{background:var(--surface-hover);border-color:var(--border-strong);text-decoration:none}
.pcard-emoji{
  display:grid;place-items:center;width:32px;height:32px;margin-bottom:var(--s-2);
  font-size:var(--fs-h3);line-height:1;border-radius:var(--r-sm);
  background:var(--surface-sunken);border:1px solid var(--border);overflow:hidden;
}
.pcard-name{font-family:var(--font-display);font-weight:600;font-size:var(--fs-sm);line-height:var(--lh-sm)}
.pcard-sub{font-size:var(--fs-xs);line-height:var(--lh-xs);color:var(--text-subtle)}
/* Grid rows stretch to a common height, so pushing the price down aligns every
   price in a row regardless of how many lines the name above it takes. */
.pcard-price{
  margin-top:auto;padding-top:var(--s-2);
  font-size:var(--fs-sm);line-height:var(--lh-sm);font-weight:600;
  color:var(--text-muted);font-variant-numeric:tabular-nums;
}

.related{margin-top:var(--s-8)}
.textlink{font-weight:500;font-size:var(--fs-sm);line-height:var(--lh-sm)}
.page-head{margin-bottom:var(--s-8)}

.faq-item{
  background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);
  padding:0 var(--s-5);margin-bottom:var(--s-2);
}
.faq-item summary{
  display:flex;align-items:flex-start;gap:var(--s-3);cursor:pointer;list-style:none;
  padding:var(--s-4) 0;font-family:var(--font-display);font-weight:600;
  font-size:var(--fs-h3);line-height:var(--lh-h3);color:var(--text);
}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::before{
  content:"+";flex-shrink:0;width:var(--s-4);color:var(--accent);font-weight:700;
}
.faq-item[open] summary::before{content:"\\2212"}
.faq-item p{
  padding:0 0 var(--s-4) calc(var(--s-4) + var(--s-3));
  font-size:var(--fs-sm);line-height:var(--lh-sm);color:var(--text-muted);
}

.site-footer{
  border-top:1px solid var(--border);padding:var(--s-8) 0 var(--s-10);
  display:flex;flex-direction:column;gap:var(--s-4);
}
.foot-nav{
  display:flex;flex-wrap:wrap;align-items:center;gap:var(--s-3);
  font-size:var(--fs-sm);line-height:var(--lh-sm);
}
.foot-nav a{color:var(--text-muted);font-weight:500}
.foot-nav a:hover{color:var(--text);text-decoration:none}
.foot-nav span{color:var(--text-subtle)}
.site-footer p{font-size:var(--fs-sm);line-height:var(--lh-sm);color:var(--text-subtle);max-width:72ch}

a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:var(--r-sm)}

@media(max-width:900px){
  .grid,.grid-wide{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media(max-width:720px){
  :root{--gutter:var(--s-4);--fs-h1:26px;--lh-h1:32px;--fs-h2:20px;--lh-h2:28px}
  .grid,.grid-wide{grid-template-columns:repeat(2,minmax(0,1fr))}
  .site-header{height:auto;padding:var(--s-4) 0}
  .site-nav{order:3;width:100%;gap:var(--s-5)}
  main{padding:var(--s-6) 0 var(--s-12)}
  .card{padding:var(--s-5) var(--s-4)}
  .p-hero{flex-direction:column;gap:var(--s-4)}
}

@media(max-width:420px){
  .grid,.grid-wide{grid-template-columns:minmax(0,1fr)}
}

@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}
}
`.trim();

function shell({ title, description, canonicalPath, keywords, jsonLdBlocks = [], main }) {
  const canonical = SITE_URL + canonicalPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
${keywords ? `<meta name="keywords" content="${esc(keywords)}" />\n` : ""}<meta name="robots" content="index, follow, max-image-preview:large" />
<meta name="theme-color" content="#0B0D12" />
<link rel="canonical" href="${esc(canonical)}" />
<link rel="icon" type="image/png" href="/logo.png" />
<link rel="apple-touch-icon" href="/logo.png" />
<link rel="manifest" href="/manifest.json" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="BTD6 Paragon Calculator" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${SITE_URL}/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
${jsonLdBlocks.join("\n")}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
<style>${BASE_CSS}</style>
<script>
/* Match the theme the visitor picked in the calculator, before first paint. */
(function(){try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();
</script>
</head>
<body>
<div class="wrap">
  <header class="site-header">
    <a class="brand" href="/">
      <img src="/logo.png" alt="BTD6 Paragon Calculator logo" width="38" height="38" />
      <span class="brand-text">BTD6 Paragon Calculator</span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/classic">Calculator</a>
      <a href="/paragons">Paragons</a>
      <a href="/faq">FAQ</a>
    </nav>
  </header>
  <main>
${main}
  </main>
  <footer class="site-footer">
    <nav class="foot-nav" aria-label="Footer">
      <a href="/">Calculator</a><span>&bull;</span>
      <a href="/paragons">All Paragons</a><span>&bull;</span>
      <a href="/faq">FAQ</a><span>&bull;</span>
      <a href="https://github.com/levisager11-oss/paragon-calc" target="_blank" rel="noopener noreferrer">GitHub</a>
    </nav>
    <p>Free, open-source BTD6 Paragon degree calculator. Bloons TD 6 is a trademark of Ninja Kiwi. Not affiliated with Ninja Kiwi.</p>
    <p class="muted">&copy; ${new Date().getFullYear()} Paragon Calculator.</p>
  </footer>
</div>
</body>
</html>`;
}

function breadcrumb(items) {
  const html =
    `<nav class="crumbs" aria-label="Breadcrumb">` +
    items
      .map((it, i) =>
        i < items.length - 1
          ? `<a href="${esc(it.path)}">${esc(it.name)}</a><span class="crumb-sep">/</span>`
          : `<span aria-current="page">${esc(it.name)}</span>`
      )
      .join("") +
    `</nav>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: SITE_URL + it.path,
    })),
  };
  return { html, ld };
}

function paragonCard(p) {
  const cat = CATEGORY_META[p.category];
  return `<a class="pcard" href="/paragons/${slugFor(p)}">
      ${paragonIcon(p, "pcard-emoji", 32)}
      <span class="pcard-name">${esc(p.name)}</span>
      <span class="pcard-sub">${esc(p.tower)} &bull; ${esc(cat.label)}</span>
      <span class="pcard-price">${money(getBasePrice(p.mediumCost, "medium"))}</span>
    </a>`;
}

function paragonPage(p) {
  const slug = slugFor(p);
  const cat = CATEGORY_META[p.category];
  const canonicalPath = `/paragons/${slug}`;
  const mediumPrice = getBasePrice(p.mediumCost, "medium");
  const costs = Object.keys(DIFFICULTY_MULTIPLIERS).map((key) => ({
    label: DIFFICULTY_MULTIPLIERS[key].name,
    price: getBasePrice(p.mediumCost, key),
  }));
  const maxT4 = p.maxT4MediumCost ? getBasePrice(p.maxT4MediumCost, "medium") : 0;

  const soloFacts = soloCeilingFacts(p);

  const solo = reverseCalculate({
    paragon: p,
    difficulty: "medium",
    gameMode: "solo",
    targetDegree: 100,
    useExtraT5s: true,
    useUpgrades: true,
    useSacrificeCash: true,
    useSliderCash: false,
    useTotems: true,
    strategy: "leastCash",
  });

  const { html: crumbHtml, ld: crumbLd } = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Paragons", path: "/paragons" },
    { name: p.name, path: canonicalPath },
  ]);

  // Same category first, then the rest, capped at 4 suggestions.
  const related = Object.values(PARAGONS)
    .filter((o) => o.id !== p.id)
    .sort(
      (a, b) =>
        (b.category === p.category ? 1 : 0) - (a.category === p.category ? 1 : 0)
    )
    .slice(0, 4);

  const title = `${p.name} — BTD6 ${p.tower} Paragon | Degree Calculator`;
  const description = `${p.name} is the ${p.tower} Paragon in Bloons TD 6 (${money(
    mediumPrice
  )} base on Medium). See its Degree 100 requirements, sacrifice costs and abilities, then open it in the free Paragon calculator.`;

  const main = `${crumbHtml}
<article style="--cat:${cat.color}">
  <div class="p-hero">
    ${paragonIcon(p, "p-emoji", 64)}
    <div>
      <span class="badge" style="--cat:${cat.color}">${esc(cat.label)} &bull; ${esc(p.tower)}</span>
      <h1>${esc(p.name)}</h1>
      <p class="lede">${esc(p.description)}</p>
      <a class="cta" href="/classic?paragon=${slug}">Open in the Paragon Calculator &rarr;</a>
    </div>
  </div>

  <section class="card">
    <h2>Quick stats</h2>
    <table class="stat-table"><tbody>
      <tr><th>Tower</th><td>${esc(p.tower)}</td></tr>
      <tr><th>Class</th><td>${esc(cat.label)}</td></tr>
      ${costs
        .map((c) => `<tr><th>Base cost (${esc(c.label)})</th><td>${money(c.price)}</td></tr>`)
        .join("\n      ")}
      ${
        maxT4
          ? `<tr><th>Priciest single sacrifice (T4)</th><td>${esc(p.maxT4Build)} build &mdash; ${money(maxT4)}</td></tr>`
          : ""
      }
    </tbody></table>
  </section>

  <section class="card">
    <h2>How to reach Degree 100 (solo)</h2>
    <p>In solo play the four standard power categories top out at <strong>${num(
      soloFacts.power
    )} power</strong> &mdash; Degree ${soloFacts.degree} &mdash; so a maxed ${esc(
      p.name
    )} needs <strong>${soloFacts.totems} Geraldo Paragon Power Totems</strong> to close the gap to Degree 100. The most cash-efficient solo path on Medium difficulty:</p>
    <ul class="reqs">
      <li><strong>${num(solo.popsNeeded)}</strong> equivalent pops/damage (income counts as 4 pops per $1)</li>
      <li><strong>${solo.upgradesNeeded}</strong> sacrificed upgrade tiers</li>
      ${solo.t5sNeeded ? `<li><strong>${solo.t5sNeeded}</strong> extra Tier 5 sacrifice (Master Double Cross)</li>` : ""}
      ${solo.sacrificeCashNeeded ? `<li><strong>${money(solo.sacrificeCashNeeded)}</strong> spent on sacrificed towers</li>` : ""}
      <li><strong>${solo.totemsNeeded}</strong> Geraldo Paragon Power Totems</li>
    </ul>
    <p class="muted">Co-op is cheaper: each player can sacrifice extra Tier 5s, which cuts the totems you need. Adjust the target degree, difficulty and game mode in the calculator.</p>
  </section>

  <section class="card">
    <h2>Abilities</h2>
    <ul class="abilities">
      ${p.abilities.map((a) => `<li>${esc(a)}</li>`).join("\n      ")}
    </ul>
  </section>

  <section class="related">
    <h2>Other Paragons</h2>
    <div class="grid">
      ${related.map((o) => paragonCard(o)).join("\n      ")}
    </div>
    <p style="margin-top:1rem"><a class="textlink" href="/paragons">See all 13 Paragons &rarr;</a></p>
  </section>
</article>`;

  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: canonical(canonicalPath),
    description,
    isPartOf: { "@type": "WebSite", name: "BTD6 Paragon Calculator", url: SITE_URL + "/" },
    about: {
      "@type": "VideoGame",
      name: "Bloons TD 6",
      publisher: { "@type": "Organization", name: "Ninja Kiwi" },
    },
  };

  return shell({
    title,
    description,
    canonicalPath,
    keywords: `${p.name}, ${p.tower} paragon, btd6 ${p.name} degree, ${p.name} calculator, bloons td 6 paragon`,
    jsonLdBlocks: [jsonLd(crumbLd), jsonLd(pageLd)],
    main,
  });
}

function paragonsIndexPage() {
  const canonicalPath = "/paragons";
  const all = Object.values(PARAGONS);
  const { html: crumbHtml, ld: crumbLd } = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Paragons", path: "/paragons" },
  ]);

  const title = "All 13 BTD6 Paragons — Costs, Stats & Degree Requirements";
  const description =
    "Every Bloons TD 6 Paragon in one place: base costs, tower class and Degree 100 requirements for all 13 Paragons. Pick one to open it in the free Paragon calculator.";

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: all.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: `${SITE_URL}/paragons/${slugFor(p)}`,
    })),
  };

  const main = `${crumbHtml}
<header class="page-head">
  <h1>All 13 BTD6 Paragons</h1>
  <p class="lede">Bloons TD 6 has ${all.length} Paragons &mdash; one ultimate upgrade per tower path family. Browse costs and classes below, then jump into the calculator to plan your exact degree.</p>
  <a class="cta" href="/classic">Open the Paragon Calculator &rarr;</a>
</header>
<section class="grid grid-wide">
  ${all.map((p) => paragonCard(p)).join("\n  ")}
</section>`;

  return shell({
    title,
    description,
    canonicalPath,
    keywords: "btd6 paragons, all paragons bloons td 6, paragon list, paragon costs, paragon degree",
    jsonLdBlocks: [jsonLd(crumbLd), jsonLd(itemListLd)],
    main,
  });
}

function faqPage() {
  const canonicalPath = "/faq";
  const { html: crumbHtml, ld: crumbLd } = breadcrumb([
    { name: "Home", path: "/" },
    { name: "FAQ", path: "/faq" },
  ]);

  const title = "BTD6 Paragon Calculator — Frequently Asked Questions";
  const description =
    "Answers to common Bloons TD 6 Paragon questions: how degrees are calculated, reaching Degree 100 solo, the cash slider, Geraldo totems, sacrifice efficiency and more.";

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const main = `${crumbHtml}
<header class="page-head">
  <h1>Paragon Calculator FAQ</h1>
  <p class="lede">How BTD6 Paragon degrees work, and how to get the most out of this calculator.</p>
  <a class="cta" href="/classic">Open the Paragon Calculator &rarr;</a>
</header>
<section class="faq">
  ${FAQ_ITEMS.map(
    ({ q, a }) => `<details class="faq-item" open>
    <summary>${esc(q)}</summary>
    <p>${esc(a)}</p>
  </details>`
  ).join("\n  ")}
</section>`;

  return shell({
    title,
    description,
    canonicalPath,
    keywords:
      "btd6 paragon faq, how are paragon degrees calculated, degree 100 solo, cash slider, geraldo totems",
    jsonLdBlocks: [jsonLd(crumbLd), jsonLd(faqLd)],
    main,
  });
}

function canonical(p) {
  return SITE_URL + p;
}

function sitemap() {
  const entries = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/classic", priority: "0.9", changefreq: "weekly" },
    { loc: "/paragons", priority: "0.9", changefreq: "weekly" },
    { loc: "/faq", priority: "0.7", changefreq: "monthly" },
    ...Object.values(PARAGONS).map((p) => ({
      loc: `/paragons/${slugFor(p)}`,
      priority: "0.8",
      changefreq: "monthly",
    })),
  ];
  const body = entries
    .map(
      (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function writePage(routePath, html) {
  const dir = path.join(OUT_DIR, routePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  let pages = 0;
  writePage("/paragons", paragonsIndexPage());
  pages++;
  for (const p of Object.values(PARAGONS)) {
    writePage(`/paragons/${slugFor(p)}`, paragonPage(p));
    pages++;
  }
  writePage("/faq", faqPage());
  pages++;

  writeFileSync(path.join(OUT_DIR, "sitemap.xml"), sitemap(), "utf8");

  const rel = path.relative(ROOT, OUT_DIR) || ".";
  console.log(`Generated ${pages} static pages + sitemap.xml into ${rel}/`);
}

main();
