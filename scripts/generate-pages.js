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
import { PARAGONS, DIFFICULTY_MULTIPLIERS } from "../src/constants/paragons.js";
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
  primary: { label: "Primary", color: "#ff5722" },
  military: { label: "Military", color: "#4caf50" },
  magic: { label: "Magic", color: "#9c27b0" },
  support: { label: "Support", color: "#ffb300" },
};

// Paragon ids contain only [a-z_], so swapping _ for - is a clean, reversible
// slug. App.jsx reverses it (- back to _) to resolve ?paragon=<slug> deep links.
const slugFor = (p) => p.id.replace(/_/g, "-");

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
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#070913;--panel:rgba(18,20,28,.55);--line:rgba(255,255,255,.08);
  --tp:#f8fafc;--ts:#94a3b8;--tm:#64748b;--cyan:#06b6d4;--blue:#0ea5e9;--gold:#f59e0b;
  --fh:'Fredoka',sans-serif;--fb:'Outfit',sans-serif;
}
body{
  background:var(--bg);
  background-image:radial-gradient(circle at 10% 20%,rgba(14,165,233,.06),transparent 40%),radial-gradient(circle at 90% 80%,rgba(249,115,22,.05),transparent 45%);
  background-attachment:fixed;color:var(--tp);font-family:var(--fb);line-height:1.6;
  -webkit-font-smoothing:antialiased;min-height:100vh;
}
a{color:var(--blue);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:880px;margin:0 auto;padding:1.5rem 1.25rem 4rem}
.site-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-bottom:1rem;border-bottom:1px solid var(--line);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:.6rem;color:var(--tp)}
.brand:hover{text-decoration:none}
.brand img{border-radius:9px}
.brand-text{font-family:var(--fh);font-weight:700;font-size:1.15rem}
.site-nav{display:flex;gap:1.1rem;font-weight:600}
.site-nav a{color:var(--ts)}
.site-nav a:hover{color:var(--tp)}
.crumbs{font-size:.85rem;color:var(--tm);margin:1.5rem 0 1rem;display:flex;gap:.45rem;flex-wrap:wrap}
.crumbs a{color:var(--ts)}
.crumb-sep{color:var(--tm)}
h1{font-family:var(--fh);font-size:2.1rem;line-height:1.15;margin:.3rem 0 .6rem;background:linear-gradient(135deg,#fff 40%,#7dd3fc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
h2{font-family:var(--fh);font-size:1.3rem;margin:0 0 .8rem}
.lede{color:var(--ts);font-size:1.02rem;margin-bottom:1rem}
.muted{color:var(--tm);font-size:.9rem}
.badge{display:inline-block;font-size:.78rem;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--cat,#06b6d4);border:1px solid color-mix(in srgb,var(--cat,#06b6d4) 45%,transparent);background:color-mix(in srgb,var(--cat,#06b6d4) 12%,transparent);padding:.25rem .6rem;border-radius:999px}
.cta{display:inline-block;margin-top:.5rem;background:linear-gradient(135deg,#0891b2,#06b6d4);color:#fff;font-weight:700;padding:.7rem 1.1rem;border-radius:12px;box-shadow:0 6px 18px rgba(6,182,212,.35)}
.cta:hover{text-decoration:none;filter:brightness(1.08)}
.p-hero{display:flex;gap:1.1rem;align-items:flex-start;margin-bottom:1.5rem}
.p-emoji{font-size:3rem;line-height:1;filter:drop-shadow(0 0 12px var(--cat,#06b6d4))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:1.25rem 1.4rem;margin:1rem 0}
.stat-table{width:100%;border-collapse:collapse;font-size:.95rem}
.stat-table th{text-align:left;color:var(--ts);font-weight:500;padding:.45rem 0;width:58%}
.stat-table td{text-align:right;font-weight:600;padding:.45rem 0;border-bottom:1px solid var(--line)}
.stat-table tr:last-child td,.stat-table tr:last-child th{border-bottom:none}
.reqs,.abilities{list-style:none;display:flex;flex-direction:column;gap:.5rem;margin-top:.3rem}
.reqs li,.abilities li{padding-left:1.4rem;position:relative;color:var(--ts)}
.reqs li::before{content:"\\25B8";position:absolute;left:0;color:var(--cyan)}
.abilities li::before{content:"\\2726";position:absolute;left:0;color:var(--gold)}
.reqs strong,.abilities strong{color:var(--tp)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.8rem;margin-top:.4rem}
.grid-wide{grid-template-columns:repeat(auto-fill,minmax(215px,1fr))}
.pcard{display:flex;flex-direction:column;gap:.2rem;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--cat,#06b6d4);border-radius:12px;padding:.9rem 1rem;color:var(--tp);transition:.15s}
.pcard:hover{text-decoration:none;border-color:var(--cat,#06b6d4);transform:translateY(-2px)}
.pcard-emoji{font-size:1.6rem}
.pcard-name{font-family:var(--fh);font-weight:600}
.pcard-sub{font-size:.8rem;color:var(--ts)}
.pcard-price{font-size:.85rem;color:var(--gold);font-weight:700}
.related{margin-top:1.5rem}
.textlink{font-weight:600}
.page-head{margin-bottom:1.5rem}
.faq-item{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:.2rem 1.1rem;margin-bottom:.7rem}
.faq-item summary{font-family:var(--fh);font-weight:600;font-size:1.05rem;cursor:pointer;padding:.8rem 0;list-style:none}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::before{content:"+";color:var(--cyan);font-weight:700;margin-right:.6rem}
.faq-item[open] summary::before{content:"\\2013"}
.faq-item p{color:var(--ts);padding:0 0 .9rem .1rem}
.site-footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--line);text-align:center;color:var(--tm);font-size:.85rem}
.foot-nav{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;margin-bottom:.8rem}
.foot-nav a{color:var(--ts)}
.foot-nav span{color:var(--tm)}
@media(max-width:560px){h1{font-size:1.7rem}.p-hero{flex-direction:column}.site-nav{gap:.8rem;font-size:.92rem}}
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
<meta name="theme-color" content="#070913" />
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
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
${jsonLdBlocks.join("\n")}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
<style>${BASE_CSS}</style>
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
  return `<a class="pcard" href="/paragons/${slugFor(p)}" style="--cat:${cat.color}">
      <span class="pcard-emoji" aria-hidden="true">${p.icon}</span>
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
    <div class="p-emoji" aria-hidden="true">${p.icon}</div>
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
    { loc: "/ticket", priority: "0.8", changefreq: "weekly" },
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
