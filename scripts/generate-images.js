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
 *
 * Webfonts are fetched once and inlined as data: URIs before the markup reaches
 * Chrome. That keeps the render byte-identical whether or not the browser can
 * reach fonts.gstatic.com, which headless Chrome often cannot behind a proxy.
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

// Design tokens — the same values as src/index.css. Keep them in step.
const T = {
  canvas: "#0B0D12",
  surface: "#12151C",
  sunken: "#0E1116",
  border: "rgba(255,255,255,.08)",
  text: "#F5F7FA",
  muted: "#9BA3B4",
  subtle: "#7C8494",
  accent: "#2E7DF6",
};

const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap";

// A modern Chrome UA makes Google Fonts serve woff2 rather than legacy formats.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const n = (v) => v.toLocaleString("en-US");

/** Fetch a URL as a Buffer, falling back to curl so a proxied environment still works. */
async function get(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return execFileSync("curl", ["-sSL", "-A", UA, url], { maxBuffer: 32 * 1024 * 1024 });
  }
}

/** Resolve the Google Fonts stylesheet and inline every font binary as a data: URI. */
async function inlineFonts() {
  let css;
  try {
    css = (await get(FONT_CSS_URL)).toString("utf8");
  } catch {
    console.warn("! Could not reach Google Fonts — rendering with system fonts instead.");
    return "";
  }
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
  for (const url of urls) {
    try {
      const buf = await get(url);
      const mime = url.endsWith(".woff2") ? "font/woff2" : url.endsWith(".woff") ? "font/woff" : "font/ttf";
      css = css.split(url).join(`data:${mime};base64,${buf.toString("base64")}`);
    } catch {
      console.warn(`! Could not inline ${url}`);
    }
  }
  console.log(`Inlined ${urls.length} font file(s).`);
  return css;
}

// Bar width encodes each ceiling's share of the largest one, so the row reads as
// a comparison rather than four decorative stripes in four arbitrary colours.
const CAPS = [
  { label: "Pops & income", value: POWER_LIMITS.pops.maxPower },
  { label: "Cash invested", value: POWER_LIMITS.cash.maxPower },
  { label: "Extra Tier 5s", value: POWER_LIMITS.t5.maxPower },
  { label: "Upgrade tiers", value: POWER_LIMITS.upgrades.maxPower },
];
const CAP_MAX = Math.max(...CAPS.map((c) => c.value));

const ogHtml = (fontCss) => `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
${fontCss}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{
    background:${T.canvas};color:${T.text};
    font-family:'Inter',ui-sans-serif,system-ui,sans-serif;
    display:flex;flex-direction:column;justify-content:space-between;
    padding:64px 72px;
  }
  .eyebrow{font-size:20px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${T.subtle}}
  h1{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;font-weight:700;
     font-size:76px;line-height:80px;letter-spacing:-.03em;margin-top:20px;color:${T.text}}
  .lede{font-size:26px;line-height:36px;color:${T.muted};margin-top:20px;max-width:860px}
  .lede b{color:${T.text};font-weight:600}
  .caps{display:flex;gap:16px}
  .cap{flex:1;background:${T.surface};border:1px solid ${T.border};border-radius:16px;padding:20px 24px}
  .cap-label{font-size:18px;line-height:24px;color:${T.muted};font-weight:500}
  .cap-value{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;
             font-size:34px;line-height:40px;font-weight:700;margin-top:4px;color:${T.text}}
  .cap-track{height:6px;border-radius:9999px;background:${T.sunken};margin-top:16px;overflow:hidden}
  .cap-bar{height:100%;border-radius:9999px;background:${T.accent}}
  .foot{display:flex;align-items:center;justify-content:space-between}
  .url{font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;
       font-size:26px;line-height:32px;font-weight:600;color:${T.text}}
  .badge{font-size:19px;line-height:24px;font-weight:500;color:${T.muted};
         border:1px solid ${T.border};background:${T.surface};border-radius:9999px;padding:10px 20px}
</style></head>
<body>
  <div>
    <div class="eyebrow">Bloons TD 6 &bull; Update 54+</div>
    <h1>BTD6 Paragon Calculator</h1>
    <p class="lede">Enter what you plan to sacrifice and get the exact <b>Degree 1&ndash;100</b> for any of the 13 Paragons &mdash; plus what is being wasted.</p>
  </div>

  <div class="caps">
    ${CAPS.map((c) => `<div class="cap">
      <div class="cap-label">${c.label}</div>
      <div class="cap-value">${n(c.value)}</div>
      <div class="cap-track"><div class="cap-bar" style="width:${Math.round((c.value / CAP_MAX) * 100)}%"></div></div>
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
  body{background:${T.canvas};display:flex;align-items:center;justify-content:center}
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
    // Fonts are inlined, so this only needs to cover layout and paint.
    "--virtual-time-budget=3000",
    `file://${page}`,
  ], { stdio: "ignore" });
  copyFileSync(shot, out);
  console.log(`Wrote ${path.relative(ROOT, out)} (${width}x${height})`);
}

const fontCss = await inlineFonts();

try {
  render("og-image", ogHtml(fontCss), 1200, 630);
  render("icon-192", iconHtml(192), 192, 192);
  render("icon-512", iconHtml(512), 512, 512);
} finally {
  rmSync(work, { recursive: true, force: true });
}
