// Serialize / deserialize a calculator build to URL query parameters.
//
// This is the shared foundation for shareable build links, the saved-build
// store and the embeddable widget — they all describe a build with the same
// shape and encode it the same way. Keys are short but readable so shared URLs
// stay legible (e.g. /classic?paragon=ascended-shadow&diff=hard&pops=1200000).

import { PARAGONS, DIFFICULTY_MULTIPLIERS } from "../constants/paragons.js";

export const DEFAULT_STATE = {
  paragon: "apex_plasma_master",
  difficulty: "medium",
  gameMode: "solo",
  pops: 0,
  income: 0,
  upgrades: 0,
  extraT5s: 0,
  sacrificedTowerCash: 0,
  sliderCash: 0,
  totems: 0,
};

// Paragon ids only contain [a-z_], so swapping _ <-> - is a clean, reversible
// slug (matching the static /paragons/<slug> routes).
export const slugForId = (id) => String(id).replace(/_/g, "-");
export const idForSlug = (slug) => {
  const id = String(slug || "").toLowerCase().replace(/-/g, "_");
  return PARAGONS[id] ? id : null;
};

const clampInt = (v, min, max) => {
  const n = Math.floor(Number(String(v).replace(/,/g, "")));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

// [stateKey, urlParam, min, max]
const NUM_FIELDS = [
  ["pops", "pops", 0, 16200000],
  ["income", "income", 0, 4050000],
  ["upgrades", "upg", 0, 100],
  ["extraT5s", "t5", 0, 9],
  ["sacrificedTowerCash", "sac", 0, 100000000],
  ["sliderCash", "slider", 0, 100000000],
  ["totems", "totems", 0, 1000],
];

// Encode a build to a query string (no leading "?"). Numeric fields are clamped
// to their valid range and omitted when zero so links stay short; an omitted
// field decodes back to its zero default, so the round-trip is lossless.
export function encodeState(state) {
  const s = { ...DEFAULT_STATE, ...state };
  const params = new URLSearchParams();
  params.set("paragon", slugForId(s.paragon));
  params.set("diff", s.difficulty);
  params.set("mode", s.gameMode);
  for (const [key, param, min, max] of NUM_FIELDS) {
    const v = clampInt(s[key], min, max);
    if (v > 0) params.set(param, String(v));
  }
  return params.toString();
}

// Decode a query string (with or without a leading "?") into a fully-populated,
// validated build. Unknown / invalid values fall back to defaults.
export function decodeState(search) {
  const params = new URLSearchParams(search || "");
  const out = { ...DEFAULT_STATE };

  const id = idForSlug(params.get("paragon"));
  if (id) out.paragon = id;

  const diff = params.get("diff");
  if (diff && DIFFICULTY_MULTIPLIERS[diff]) out.difficulty = diff;

  const mode = params.get("mode");
  if (mode === "solo" || mode === "coop") out.gameMode = mode;

  for (const [key, param, min, max] of NUM_FIELDS) {
    if (params.has(param)) out[key] = clampInt(params.get(param), min, max);
  }
  return out;
}

// True when the query string carries any recognised build parameter, so the app
// can tell an intentional shared/deep link apart from a bare visit.
export function hasBuildParams(search) {
  const params = new URLSearchParams(search || "");
  return (
    params.has("paragon") ||
    params.has("diff") ||
    params.has("mode") ||
    NUM_FIELDS.some(([, param]) => params.has(param))
  );
}

const resolveOrigin = (origin) =>
  origin || (typeof window !== "undefined" ? window.location.origin : "");

export function buildShareUrl(state, { origin, path = "/classic" } = {}) {
  return `${resolveOrigin(origin)}${path}?${encodeState(state)}`;
}

// Clean URL used inside the iframe snippet (Vercel rewrites /embed -> /embed.html).
export function buildEmbedUrl(state, { origin } = {}) {
  return `${resolveOrigin(origin)}/embed?${encodeState(state)}`;
}

// Direct file URL that works in dev (vite) and prod without the rewrite — used
// for the "open preview" link in the embed dialog.
export function buildEmbedPreviewUrl(state, { origin } = {}) {
  return `${resolveOrigin(origin)}/embed.html?${encodeState(state)}`;
}

export function buildEmbedSnippet(state, { origin, height = 720 } = {}) {
  const src = buildEmbedUrl(state, { origin });
  return `<iframe src="${src}" title="BTD6 Paragon Calculator" width="100%" height="${height}" style="border:0;border-radius:14px;max-width:480px" loading="lazy"></iframe>`;
}
