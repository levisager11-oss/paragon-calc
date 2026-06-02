// Render a branded "result card" PNG of the current Paragon build and trigger a
// download. Drawn entirely on a <canvas> (no DOM capture, no external images) so
// the output is predictable and the canvas never gets tainted.

import { getBasePrice } from "./calculator.js";

const W = 1200;
const H = 630;

const CAT_COLOR = {
  primary: "#ff5722",
  military: "#4caf50",
  magic: "#9c27b0",
  support: "#ffb300",
};

const BAR_COLOR = {
  pops: "#0ea5e9",
  upgrades: "#22c55e",
  cash: "#f59e0b",
  t5: "#a855f7",
};

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

function hexA(hex, a) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load("700 64px Fredoka"),
      document.fonts.load("600 24px Outfit"),
      document.fonts.load("400 24px Outfit"),
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
  const accent = CAT_COLOR[paragon.category] || "#06b6d4";

  // Background + accent glow
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0d1a");
  bg.addColorStop(1, "#070913");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W - 240, 360, 0, W - 240, 360, 460);
  glow.addColorStop(0, hexA(accent, 0.18));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Frame
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  roundRect(ctx, 24, 24, W - 48, H - 48, 28);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Paragon emoji + badge + name (top)
  ctx.font = "84px 'Outfit', sans-serif";
  ctx.fillText(paragon.icon, 64, 150);

  ctx.fillStyle = accent;
  ctx.font = "700 24px 'Fredoka', sans-serif";
  ctx.fillText(`${paragon.category.toUpperCase()} • ${paragon.tower.toUpperCase()}`, 176, 108);

  // Auto-fit the name to a single line.
  let nameSize = 46;
  ctx.font = `700 ${nameSize}px 'Fredoka', sans-serif`;
  while (ctx.measureText(paragon.name).width > 952 && nameSize > 26) {
    nameSize -= 2;
    ctx.font = `700 ${nameSize}px 'Fredoka', sans-serif`;
  }
  let name = paragon.name;
  if (ctx.measureText(name).width > 952) {
    while (name.length > 4 && ctx.measureText(name + "…").width > 952) name = name.slice(0, -1);
    name += "…";
  }
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(name, 176, 162);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
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
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
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
  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 24px 'Outfit', sans-serif";
  ctx.fillText("DEGREE", cx, cy - 42);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 104px 'Fredoka', sans-serif";
  ctx.fillText(String(results.degree), cx, cy + 36);
  ctx.fillStyle = accent;
  ctx.font = "600 22px 'Outfit', sans-serif";
  ctx.fillText(`${numFmt(results.totalPower)} / 200,000`, cx, cy + 78);
  ctx.textAlign = "left";

  // Power breakdown bars (right)
  const bx = 480;
  const bw = W - bx - 64;
  const bars = [
    { label: "Pops & Income", key: "pops" },
    { label: "Upgrades", key: "upgrades" },
    { label: "Cash Investment", key: "cash" },
    { label: "Extra T5s", key: "t5" },
  ];
  let by = 286;
  for (const b of bars) {
    const pb = results.powerBreakdown[b.key];
    const p = Math.max(0, Math.min(100, pb.pct || 0));
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "600 20px 'Outfit', sans-serif";
    ctx.fillText(b.label, bx, by);
    ctx.textAlign = "right";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`${numFmt(pb.power)} / ${numFmt(pb.max)}`, bx + bw, by);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, bx, by + 10, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = BAR_COLOR[b.key];
    roundRect(ctx, bx, by + 10, Math.max(8, (bw * p) / 100), 12, 6);
    ctx.fill();
    by += 58;
  }

  // Footer
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 540);
  ctx.lineTo(W - 64, 540);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = "700 24px 'Fredoka', sans-serif";
  ctx.fillText("paragon-calc.vercel.app", 64, 584);

  const basePrice = getBasePrice(paragon.mediumCost, difficulty);
  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const modeLabel = gameMode === "coop" ? "Co-op" : "Solo";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "400 22px 'Outfit', sans-serif";
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
