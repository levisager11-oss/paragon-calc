// Renders scripts/og-image.svg -> public/og-image.png at 1200x630.
// The generated PNG is committed, so you only need this to regenerate it.
// Requires a one-off dev dependency (not in package.json to keep installs lean):
//   npm i -D @resvg/resvg-js && node scripts/render-og.mjs
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, "og-image.svg"), "utf8");

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { loadSystemFonts: true },
  background: "#070913",
});

const png = resvg.render().asPng();
const out = join(here, "..", "public", "og-image.png");
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
