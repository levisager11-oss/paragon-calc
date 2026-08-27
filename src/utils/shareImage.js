// Render a "result card" PNG of the current Paragon build and trigger a
// download. Drawn entirely on a <canvas> (no DOM capture) so the output is
// predictable. The only image loaded is the paragon's own artwork, served from
// this origin, so the canvas is never tainted.

import { getBasePrice } from "./calculator.js";
import { paragonArt } from "../constants/paragons.js";

const W = 1200;
const H = 630;

// The design system's dark palette (see the token block in src/index.css).
// Canvas cannot read CSS custom properties, so these are mirrored by hand —
// change them here when the tokens change.
const T = {
  canvas: "#0B0D12",
  surface: "#12151C",
  sunken: "#0E1116",
  border: "rgba(255, 255, 255, 0.08)",
  text: "#F5F7FA",
  muted: "#9BA3B4",
  subtle: "#7C8494",
  accent: "#2E7DF6",
  success: "#3DAE73",
  warn: "#E5A93C",
};

const FONT_DISPLAY = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const FONT_SANS = "'Inter', ui-sans-serif, system-ui, sans-serif";

// Same-origin artwork, so this never taints the canvas. Resolves to null when
// the file is absent and the caller falls back to the paragon's emoji.
function loadArt(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("700 64px 'Space Grotesk'"),
      document.fonts.load("600 24px 'Space Grotesk'"),
      document.fonts.load("600 20px Inter"),
      document.fonts.load("500 20px Inter"),
      document.fonts.load("400 22px Inter"),
    ]);
  } catch {
    // fall back to system fonts
  }
}

const numFmt = (n) => Math.round(n).toLocaleString("en-US");

export async function exportResultImage({ paragon, difficulty, gameMode, results }) {
  await ensureFonts();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  // The gauge turns green at Degree 100, matching the app's is-complete state.
  const accent = results.degree === 100 ? T.success : T.accent;

  ctx.fillStyle = T.canvas;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Paragon artwork in its tile, falling back to the emoji.
  const art = await loadArt(paragonArt(paragon));
  ctx.fillStyle = T.surface;
  roundRect(ctx, 64, 72, 88, 88, 16);
  ctx.fill();
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  roundRect(ctx, 64, 72, 88, 88, 16);
  ctx.stroke();
  if (art) {
    // Contain, so non-square art is letterboxed rather than stretched.
    const box = 64;
    const scale = Math.min(box / art.width, box / art.height);
    const dw = art.width * scale;
    const dh = art.height * scale;
    ctx.drawImage(art, 64 + (88 - dw) / 2, 72 + (88 - dh) / 2, dw, dh);
  } else {
    ctx.textAlign = "center";
    ctx.font = `56px ${FONT_SANS}`;
    ctx.fillStyle = T.text;
    ctx.fillText(paragon.icon, 108, 136);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = T.subtle;
  ctx.font = `600 20px ${FONT_SANS}`;
  ctx.fillText(`${paragon.category.toUpperCase()} • ${paragon.tower.toUpperCase()}`, 176, 108);

  // Auto-fit the name to a single line.
  let nameSize = 46;
  ctx.font = `700 ${nameSize}px ${FONT_DISPLAY}`;
  while (ctx.measureText(paragon.name).width > 952 && nameSize > 26) {
    nameSize -= 2;
    ctx.font = `700 ${nameSize}px ${FONT_DISPLAY}`;
  }
  let name = paragon.name;
  if (ctx.measureText(name).width > 952) {
    while (name.length > 4 && ctx.measureText(name + "…").width > 952) name = name.slice(0, -1);
    name += "…";
  }
  ctx.fillStyle = T.text;
  ctx.fillText(name, 176, 162);

  // Divider
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 198);
  ctx.lineTo(W - 64, 198);
  ctx.stroke();

  // Degree gauge (left)
  const cx = 264;
  const cy = 380;
  const r = 128;
  ctx.lineWidth = 22;
  ctx.strokeStyle = T.sunken;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const frac = Math.max(0, Math.min(1, results.degree / 100));
  ctx.strokeStyle = accent;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.textAlign = "center";
  ctx.fillStyle = T.subtle;
  ctx.font = `600 22px ${FONT_SANS}`;
  ctx.fillText("DEGREE", cx, cy - 42);
  ctx.fillStyle = T.text;
  ctx.font = `700 104px ${FONT_DISPLAY}`;
  ctx.fillText(String(results.degree), cx, cy + 36);
  ctx.fillStyle = T.muted;
  ctx.font = `600 22px ${FONT_SANS}`;
  ctx.fillText(`${numFmt(results.totalPower)} / 200,000`, cx, cy + 78);
  ctx.textAlign = "left";

  // Power breakdown bars (right)
  const bx = 480;
  const bw = W - bx - 64;
  const bars = [
    { label: "Pops & income", key: "pops" },
    { label: "Upgrade tiers", key: "upgrades" },
    { label: "Cash invested", key: "cash" },
    { label: "Extra Tier 5s", key: "t5" },
  ];
  let by = 286;
  for (const b of bars) {
    const pb = results.powerBreakdown[b.key];
    const p = Math.max(0, Math.min(100, pb.pct || 0));
    // Same three states as the app: room to grow, exactly maxed, over-invested.
    const barColor = pb.capped ? T.warn : pb.power >= pb.max ? T.success : T.accent;
    ctx.fillStyle = T.muted;
    ctx.font = `500 20px ${FONT_SANS}`;
    ctx.fillText(b.label, bx, by);
    ctx.textAlign = "right";
    ctx.fillStyle = barColor;
    ctx.font = `600 20px ${FONT_SANS}`;
    ctx.fillText(`${numFmt(pb.power)} / ${numFmt(pb.max)}`, bx + bw, by);
    ctx.textAlign = "left";
    // The track needs to read against the canvas, so it sits a step above it.
    ctx.fillStyle = T.surface;
    roundRect(ctx, bx, by + 10, bw, 8, 4);
    ctx.fill();
    // A zero-value source draws nothing: a minimum-width stub would render as a
    // stray dot that looks like an artifact rather than a value.
    if (p > 0) {
      ctx.fillStyle = barColor;
      roundRect(ctx, bx, by + 10, Math.max(8, (bw * p) / 100), 8, 4);
      ctx.fill();
    }
    by += 58;
  }

  // Footer
  ctx.strokeStyle = T.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 540);
  ctx.lineTo(W - 64, 540);
  ctx.stroke();

  ctx.fillStyle = T.text;
  ctx.font = `600 24px ${FONT_DISPLAY}`;
  ctx.fillText("paragon-calc.vercel.app", 64, 584);

  const basePrice = getBasePrice(paragon.mediumCost, difficulty);
  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const modeLabel = gameMode === "coop" ? "Co-op" : "Solo";
  ctx.fillStyle = T.muted;
  ctx.font = `400 22px ${FONT_SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(`Base $${numFmt(basePrice)}  •  ${diffLabel}  •  ${modeLabel}`, W - 64, 584);
  ctx.textAlign = "left";

  const slug = paragon.id.replace(/_/g, "-");
  await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-degree-${results.degree}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    }, "image/png");
  });
}
