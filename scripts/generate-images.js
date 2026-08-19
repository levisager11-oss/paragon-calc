/**
 * Renders the site's generated raster assets into public/:
 *
 *   og-image.png   1200x630 social-share card (og:image / twitter:image)
 *   icon-192.png   PWA manifest icon
 *   icon-512.png   PWA manifest icon (install eligibility needs a real 512)
 *
 * These are dev-time outputs, not part of the Vercel build: they only change
 * when the branding or the power caps do, so the PNGs are committed and the
 * production build stays dependency-free.
 *
 * Usage:  npm run gen:images
 *
 * Rasterising needs a Chromium binary. It looks in $CHROME_BIN first, then the
 * usual Playwright and system locations. The intermediate HTML is written next
 * to the PNG output so the card can also be opened and tweaked by hand.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POWER_LIMITS } from "../src/constants/paragons.js";
import { MAX_POWER } from "../src/utils/calculator.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const n = (v) => v.toLocaleString("en-US");

const CAPS = [
  { label: "Pops & Income", value: POWER_LIMITS.pops.maxPower, color: "#0ea5e9" },
  { label: "Cash Invested", value: POWER_LIMITS.cash.maxPower, color: "#f59e0b" },
  { label: "Extra Tier 5s", value: POWER_LIMITS.t5.maxPower, color: "#a855f7" },
  { label: "Upgrade Tiers", value: POWER_LIMITS.upgrades.maxPower, color: "#22c55e" },
];

const ogHtml = `<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{
    background:#070913;
    background-image:
      radial-gradient(circle at 88% 22%, rgba(6,182,212,.22), transparent 46%),
      radial-gradient(circle at 8% 88%, rgba(249,115,22,.14), transparent 44%);
    color:#f8fafc;font-family:'Outfit',system-ui,sans-serif;
    display:flex;flex-direction:column;justify-content:space-between;
    padding:64px 72px;position:relative;
  }
  body::after{content:"";position:absolute;inset:26px;border:2px solid rgba(255,255,255,.08);border-radius:30px;pointer-events:none}
  .eyebrow{font-size:23px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#06b6d4}
  h1{font-family:'Fredoka',sans-serif;font-weight:700;font-size:82px;line-height:1.02;letter-spacing:-.02em;margin:16px 0 0;
     background:linear-gradient(135deg,#ffffff 42%,#7dd3fc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .lede{font-size:29px;color:#94a3b8;margin-top:18px;max-width:900px;line-height:1.4}
  .lede b{color:#e2e8f0;font-weight:600}
  .caps{display:flex;gap:18px;margin-top:8px}
  .cap{flex:1;background:rgba(18,20,28,.72);border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:20px 22px}
  .cap-label{font-size:19px;color:#94a3b8;font-weight:500}
  .cap-value{font-family:'Fredoka',sans-serif;font-size:35px;font-weight:700;margin-top:6px}
  .cap-bar{height:7px;border-radius:99px;margin-top:14px}
  .foot{display:flex;align-items:center;justify-content:space-between}
  .url{font-family:'Fredoka',sans-serif;font-size:30px;font-weight:600;color:#06b6d4}
  .badge{font-size:21px;font-weight:600;color:#94a3b8;border:1px solid rgba(255,255,255,.12);
         background:rgba(255,255,255,.04);border-radius:99px;padding:11px 24px}
</style></head>
<body>
  <div>
    <div class="eyebrow">Bloons TD 6 &bull; Update 54+</div>
    <h1>BTD6 Paragon Calculator</h1>
    <p class="lede">Find the exact <b>Degree 1&ndash;100</b> for all 13 Paragons. Plan pops, cash and Tier&nbsp;5 sacrifices before you commit &mdash; solo or co-op.</p>
  </div>

  <div class="caps">
    ${CAPS.map((c) => `<div class="cap">
      <div class="cap-label">${c.label}</div>
      <div class="cap-value">${n(c.value)}</div>
      <div class="cap-bar" style="background:${c.color}"></div>
    </div>`).join("\n    ")}
  </div>

  <div class="foot">
    <span class="url">paragon-calc.vercel.app</span>
    <span class="badge">${n(MAX_POWER)} power = Degree 100</span>
  </div>
</body></html>`;

// The manifest used to claim logo.png was both 192x192 and 512x512; it is
// actually 454x453, so Chrome rejected it for install eligibility. Render the
// real sizes instead, on the brand background so the icon is maskable-safe.
const iconHtml = (size) => {
  const logo = readFileSync(path.join(PUBLIC, "logo.png")).toString("base64");
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${size}px;height:${size}px;overflow:hidden}
  body{background:#070913;display:flex;align-items:center;justify-content:center}
  img{width:${Math.round(size * 0.72)}px;height:${Math.round(size * 0.72)}px;object-fit:contain}
</style></head>
<body><img src="data:image/png;base64,${logo}" alt="" /></body></html>`;
};

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error(
    "No Chromium binary found. Set CHROME_BIN to a Chrome/Chromium executable and re-run.\n" +
    "Looked in:\n  " + CHROME_CANDIDATES.join("\n  ")
  );
  process.exit(1);
}

const work = mkdtempSync(path.join(tmpdir(), "paragon-img-"));

function render(name, markup, width, height) {
  const page = path.join(work, `${name}.html`);
  const shot = path.join(work, `${name}.png`);
  const out = path.join(PUBLIC, `${name}.png`);
  writeFileSync(page, markup, "utf8");
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${shot}`,
    // Give the webfonts a moment to land before the shot is taken.
    "--virtual-time-budget=6000",
    `file://${page}`,
  ], { stdio: "ignore" });
  copyFileSync(shot, out);
  console.log(`Wrote ${path.relative(ROOT, out)} (${width}x${height})`);
}

try {
  render("og-image", ogHtml, 1200, 630);
  render("icon-192", iconHtml(192), 192, 192);
  render("icon-512", iconHtml(512), 512, 512);
} finally {
  rmSync(work, { recursive: true, force: true });
}
