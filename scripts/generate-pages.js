/**
 * Static page generator for the BTD6 Paragon Calculator.
 *
 * Emits real, crawlable HTML for the SEO content pages that the single-page
 * calculator app can't serve well on its own:
 *
 *   /paragons                       — hub listing every Paragon
 *   /paragons/<slug>                — one landing page per Paragon
 *   /faq                            — FAQ page (matches the FAQPage JSON-LD)
 *   /degrees                        — what every degree costs and gives
 *   /about                          — about, contact and the privacy policy
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
import { PARAGONS, DIFFICULTY_MULTIPLIERS, GAME_VERSION, paragonSlug } from "../src/constants/paragons.js";
import { getBasePrice, getMaxT4Cost, getPowerThreshold, reverseCalculate, soloCeilingFacts } from "../src/utils/calculator.js";
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

.table-scroll{overflow-x:auto}
.deg-table{width:100%;border-collapse:collapse;font-size:var(--fs-sm);line-height:var(--lh-sm);font-variant-numeric:tabular-nums}
.deg-table th,.deg-table td{text-align:right;padding:var(--s-2) var(--s-3);border-bottom:1px solid var(--border);white-space:nowrap}
.deg-table thead th{color:var(--text-muted);font-weight:500;position:sticky;top:0;background:var(--surface)}
.deg-table tbody th{color:var(--text);font-weight:600}
.deg-table tr.is-step th,.deg-table tr.is-step td{background:var(--surface-sunken)}
.prose{display:flex;flex-direction:column;gap:var(--s-3);max-width:72ch}
.prose h2{margin:var(--s-4) 0 0}

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
<link rel="stylesheet" href="/fonts/fonts.css" />
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
      <a href="/degrees">Degrees</a>
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
      <a href="/degrees">Degree table</a><span>&bull;</span>
      <a href="/faq">FAQ</a><span>&bull;</span>
      <a href="/about">About &amp; privacy</a><span>&bull;</span>
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
  const maxT4 = getMaxT4Cost(p, "medium");

  const soloFacts = soloCeilingFacts(p);

  const solo = reverseCalculate({
    paragon: p,
    difficulty: "medium",
    gameMode: "solo",
    targetDegree: 100,
    useExtraT5s: true,
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
    <p>Since Update ${esc(GAME_VERSION)}, maxed pops and cash alone come to <strong>${num(
      soloFacts.power
    )} power</strong> &mdash; Degree ${soloFacts.degree} &mdash; so a solo ${esc(
      p.name
    )} needs no Geraldo totems to max out. The most cash-efficient solo path on Medium difficulty:</p>
    <ul class="reqs">
      <li><strong>${num(solo.popsNeeded)}</strong> equivalent pops/damage (income counts as 4 pops per $1)</li>
      ${solo.t5sNeeded ? `<li><strong>${solo.t5sNeeded}</strong> extra Tier 5 sacrifice (via ${esc(p.soloExtraT5Source)})</li>` : ""}
      ${solo.sacrificeCashNeeded ? `<li><strong>${money(solo.sacrificeCashNeeded)}</strong> spent on sacrificed towers</li>` : ""}
      ${solo.totemsNeeded ? `<li><strong>${solo.totemsNeeded}</strong> Geraldo Paragon Power Totems</li>` : ""}
    </ul>
    <p class="muted">Short on pops? Each Geraldo totem replaces 360,000 of them, and in co-op every extra Tier 5 replaces 1.08M. Adjust the target degree, difficulty and game mode in the calculator.</p>
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
    <p style="margin-top:1rem"><a class="textlink" href="/paragons">See all ${Object.keys(PARAGONS).length} Paragons &rarr;</a></p>
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

  const title = `All ${all.length} BTD6 Paragons — Costs, Stats & Degree Requirements`;
  const description =
    `Every Bloons TD 6 Paragon in one place: base costs, tower class and Degree 100 requirements for all ${all.length} Paragons. Pick one to open it in the free Paragon calculator.`;

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
  <h1>All ${all.length} BTD6 Paragons</h1>
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

// What a degree does to the Paragon's stats. These are the game's own scaling
// rules: +1% damage and pierce per degree above 1 (Degree 100 is a flat x2),
// a flat +1 damage per 10 degrees and +0.1 pierce per degree (+10 at 100), a
// cooldown divisor that grows with the square root of the degree, and a boss
// damage multiplier that steps up every 20 degrees.
function degreeStats(d) {
  const top = d === 100;
  return {
    damagePct: top ? 100 : d - 1,
    damageFlat: top ? 10 : Math.floor((d - 1) / 10),
    pierceFlat: top ? 10 : (d - 1) / 10,
    cooldownPct: 100 / (1 + 0.01 * Math.round(Math.sqrt(50 * (d - 1)) * 10) / 10),
    boss: 1 + 0.25 * Math.floor(d / 20),
  };
}

function degreesPage() {
  const canonicalPath = "/degrees";
  const { html: crumbHtml, ld: crumbLd } = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Degree table", path: canonicalPath },
  ]);

  const rows = [];
  for (let d = 1; d <= 100; d++) {
    const st = degreeStats(d);
    const power = getPowerThreshold(d);
    const step = d === 1 ? 0 : power - getPowerThreshold(d - 1);
    rows.push(`<tr${d % 20 === 0 ? ' class="is-step"' : ""}>
      <th scope="row">${d}</th>
      <td>${num(power)}</td>
      <td>${d === 1 ? "&mdash;" : "+" + num(step)}</td>
      <td>+${st.damagePct}%${st.damageFlat ? ` +${st.damageFlat}` : ""}</td>
      <td>+${st.damagePct}%${st.pierceFlat ? ` +${+st.pierceFlat.toFixed(1)}` : ""}</td>
      <td>${st.cooldownPct.toFixed(1)}%</td>
      <td>&times;${st.boss}</td>
    </tr>`);
  }

  const main = `${crumbHtml}
<header class="page-head">
  <h1>BTD6 Paragon degree table</h1>
  <p class="lede">The Paragon power every degree from 1 to 100 needs, and what that degree does to the Paragon's damage, pierce, attack cooldown and boss damage. Current for Update ${esc(GAME_VERSION)}.</p>
  <a class="cta" href="/classic">Open the Paragon Calculator &rarr;</a>
</header>
<section class="card prose">
  <h2>How to read it</h2>
  <p><strong>Power needed</strong> is the total Paragon power for that degree, and <strong>step</strong> is how much more it takes than the degree before. Steps grow steadily, then jump at the end: Degree 100 costs ${num(getPowerThreshold(100) - getPowerThreshold(99))} power more than Degree 99, about twice the step before it.</p>
  <p><strong>Boss damage</strong> is a multiplier on everything the Paragon deals to Boss Bloons, and it only moves every 20 degrees (highlighted rows). Degree 40 hits bosses as hard as Degree 59, so when cash is tight, stopping on a multiple of 20 is the efficient choice. Elite bosses take double these values.</p>
  <p><strong>Cooldown</strong> is the time between attacks compared with Degree 1 &mdash; lower is faster. Most of the speed arrives early: Degree 20 already attacks about 31% faster, while the last 20 degrees add only a few percent.</p>
</section>
<section class="card">
  <div class="table-scroll">
  <table class="deg-table">
    <thead><tr>
      <th scope="col">Degree</th><th scope="col">Power needed</th><th scope="col">Step</th>
      <th scope="col">Damage</th><th scope="col">Pierce</th><th scope="col">Cooldown</th><th scope="col">Boss damage</th>
    </tr></thead>
    <tbody>
    ${rows.join("\n    ")}
    </tbody>
  </table>
  </div>
</section>`;

  return shell({
    title: "BTD6 Paragon Degree Table — Power Needed and Stats for Degrees 1–100",
    description:
      "Every BTD6 Paragon degree from 1 to 100: the Paragon power it needs and its damage, pierce, attack cooldown and boss damage bonuses.",
    canonicalPath,
    keywords: "btd6 paragon degree table, paragon power requirements, paragon degree stats, boss damage multiplier",
    jsonLdBlocks: [jsonLd(crumbLd)],
    main,
  });
}

function aboutPage() {
  const canonicalPath = "/about";
  const { html: crumbHtml, ld: crumbLd } = breadcrumb([
    { name: "Home", path: "/" },
    { name: "About & privacy", path: canonicalPath },
  ]);
  const repo = "https://github.com/levisager11-oss/paragon-calc";

  const main = `${crumbHtml}
<header class="page-head">
  <h1>About this calculator</h1>
  <p class="lede">A free, open-source tool that works out the degree a Bloons TD 6 Paragon will reach before you commit the sacrifice.</p>
</header>
<section class="card prose">
  <h2>What it is</h2>
  <p>The calculator is a hobby project by a BTD6 player. It follows the game's Paragon power rules as of Update ${esc(GAME_VERSION)}, and every price and threshold is checked against community documentation and pinned by automated tests. The full source is on <a href="${repo}" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
  <p>It is not affiliated with or endorsed by Ninja Kiwi. Bloons TD 6 is a trademark of Ninja Kiwi.</p>
  <h2>Contact</h2>
  <p>Found a wrong number, or a balance patch the site has not caught up with? Please open an issue on the <a href="${repo}/issues" target="_blank" rel="noopener noreferrer">GitHub repository</a>.</p>
</section>
<section class="card prose" id="privacy">
  <h2>Privacy policy</h2>
  <p><strong>Last updated:</strong> ${esc(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}</p>
  <p><strong>What we collect.</strong> This site does not ask for or store personal information. Your theme preference and any builds you save stay in your own browser's local storage and are never sent anywhere.</p>
  <p><strong>Analytics.</strong> Vercel Analytics and Speed Insights record aggregated, anonymised page views and loading times. No personally identifiable information is stored.</p>
  <p><strong>Advertising.</strong> The site may show ads through Google AdSense. Google may use cookies and web beacons to select ads based on your prior visits to this and other sites. You can opt out of personalised advertising in <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>, and read how Google uses this data in <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google's Privacy &amp; Terms</a>.</p>
  <p><strong>Embedded content.</strong> The calculator page embeds a widget from <a href="https://itch.io/docs/legal/privacy-policy" target="_blank" rel="noopener noreferrer">itch.io</a>, which loads from itch.io's servers and is subject to its privacy policy.</p>
  <p><strong>Questions</strong> about this policy belong in an issue on the <a href="${repo}/issues" target="_blank" rel="noopener noreferrer">GitHub repository</a>.</p>
</section>`;

  return shell({
    title: "About the BTD6 Paragon Calculator — Contact and Privacy Policy",
    description:
      "Who makes the BTD6 Paragon Calculator, how its numbers are verified, how to report a mistake, and the site's privacy policy.",
    canonicalPath,
    jsonLdBlocks: [jsonLd(crumbLd)],
    main,
  });
}

function canonical(p) {
  return SITE_URL + p;
}

function sitemap() {
  const entries = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/paragons", priority: "0.9", changefreq: "weekly" },
    { loc: "/degrees", priority: "0.8", changefreq: "monthly" },
    { loc: "/faq", priority: "0.7", changefreq: "monthly" },
    { loc: "/about", priority: "0.3", changefreq: "yearly" },
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
  writePage("/degrees", degreesPage());
  writePage("/about", aboutPage());
  pages += 3;

  writeFileSync(path.join(OUT_DIR, "sitemap.xml"), sitemap(), "utf8");

  const rel = path.relative(ROOT, OUT_DIR) || ".";
  console.log(`Generated ${pages} static pages + sitemap.xml into ${rel}/`);
}

main();
