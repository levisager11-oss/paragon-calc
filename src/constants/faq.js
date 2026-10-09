// Single source of truth for the FAQ. Consumed by the static FAQ page generator
// (scripts/generate-pages.js) for both the visible Q&A list and the FAQPage
// JSON-LD structured data, so the two can never drift apart.
//
// Answers are plain text (no HTML) so they can be embedded directly in
// schema.org markup. Every number below is computed from the live engine in
// src/utils/calculator.js rather than typed by hand — an earlier revision of
// this file claimed a maxed solo Paragon reached "Degree 76" when the
// calculator on the same page said 91.

import { MAX_POWER, soloCeilingFacts } from "../utils/calculator.js";
import {
  PARAGONS, POWER_LIMITS, GAME_VERSION,
  MAX_EQUIVALENT_POPS, CASH_CAP_MULTIPLE, SLIDER_CAP_MULTIPLE,
} from "./paragons.js";

const TOTEM_POWER = 2000;

// A representative paragon whose tower has no duplicate-T5 route: solo play
// grants it no extra Tier 5s at all.
const STANDARD = PARAGONS.ascended_shadow;
const DART = PARAGONS.apex_plasma_master;

// The Paragons that can absorb one extra Tier 5 in solo play, listed from the
// roster so a new one is picked up without editing this copy.
const DUPLICATE_T5 = Object.values(PARAGONS).filter((p) => p.soloExtraT5Source);
const duplicateT5Towers = DUPLICATE_T5.map((p) => p.tower).join(" and the ");

export const SOLO_CEILING = soloCeilingFacts(STANDARD);  // 205,000 power · Degree 100 · 0 totems
export const DART_CEILING = soloCeilingFacts(DART);      // 211,000 power · Degree 100 · 0 totems

// With cash maxed, the pops & income still needed to close the rest of the gap
// to Degree 100 (21.6M as of v57.0).
const POPS_FOR_100_WITH_MAX_CASH =
  (MAX_POWER - POWER_LIMITS.cash.maxPower) * POWER_LIMITS.pops.popDivisor;
const millions = (v) => `${+(v / 1e6).toFixed(2)}M`;

const byCost = Object.values(PARAGONS).sort((a, b) => a.mediumCost - b.mediumCost);
const CHEAPEST = byCost[0];
const PRICIEST = byCost[byCost.length - 1];

const PARAGON_COUNT = Object.keys(PARAGONS).length;
const n = (v) => v.toLocaleString("en-US");

// "Ballistic Obliteration Missile Bunker (B.O.M.B.) (Bomb Shooter)" reads badly,
// so drop any trailing parenthetical from the name and shorten the tower.
const paragonSummary = (p) =>
  `${p.name.replace(/\s*\([^)]*\)\s*$/, "")} (${p.tower.replace(/^Monkey /, "").replace(/ Monkey$/, "")})`;

export const FAQ_ITEMS = [
  {
    q: "How are Paragon degrees calculated in BTD6?",
    a: `A Paragon's degree comes from Paragon Power Points, capped at ${n(MAX_POWER)} for Degree 100. Power is earned in three categories — Pops & Income (max ${n(POWER_LIMITS.pops.maxPower)}), Cash Investment (max ${n(POWER_LIMITS.cash.maxPower)}) and Extra Tier 5s (max ${n(POWER_LIMITS.t5.maxPower)}) — plus Geraldo's Paragon Power Totems, which add ${n(TOTEM_POWER)} points each and are uncapped. Update ${GAME_VERSION} removed the old fourth category, upgrade tiers on sacrificed towers, and raised the Pops & Income and Cash caps to make up for it. The exact degree for a given power total follows a fixed cubic threshold curve.`,
  },
  {
    q: "How do I get a Degree 100 Paragon in solo play?",
    a: `Since Update ${GAME_VERSION} you no longer need totems or extra Tier 5s for it. Maxed Pops & Income (${n(POWER_LIMITS.pops.maxPower)}) plus maxed Cash (${n(POWER_LIMITS.cash.maxPower)}) comes to ${n(SOLO_CEILING.power)} power, which is Degree ${SOLO_CEILING.degree}. With cash maxed at ${CASH_CAP_MULTIPLE}x the base price, ${millions(POPS_FOR_100_WITH_MAX_CASH)} equivalent pops is enough for the full ${n(MAX_POWER)}. Every Geraldo Paragon Power Totem (${n(TOTEM_POWER)} power) or extra Tier 5 (${n(POWER_LIMITS.t5.pointsPerExtra)}; the ${duplicateT5Towers} can absorb one solo) lowers the pops or cash you still need.`,
  },
  {
    q: "What is the cash slider and is it worth using?",
    a: `The cash slider, added in Update 39, lets you pour money straight into the Paragon instead of sacrificing whole towers. It's 95% efficient (a 5% convenience premium) and is capped at ${SLIDER_CAP_MULTIPLE}x the Paragon's base price. Sacrificing real towers is 100% efficient, but you can only sacrifice whole towers, so the best approach is to sacrifice as many full towers as possible and use the slider only for the leftover. The calculator's cash optimizer does this split for you.`,
  },
  {
    q: "How many Paragons are in Bloons TD 6?",
    a: `As of Update ${GAME_VERSION} there are ${PARAGON_COUNT} Paragons: ${Object.values(PARAGONS).map(paragonSummary).join(", ")}.`,
  },
  {
    q: "Which Paragon is the cheapest and which is the most expensive?",
    a: `On Medium difficulty the cheapest Paragon to build is the ${CHEAPEST.name} (${CHEAPEST.tower}) at a $${n(CHEAPEST.mediumCost)} base, and the most expensive is the ${PRICIEST.name} (${PRICIEST.tower}) at $${n(PRICIEST.mediumCost)}. Prices scale with difficulty: about 0.85x on Easy, 1.08x on Hard and 1.20x on Impoppable.`,
  },
  {
    q: "Do extra Tier 5 sacrifices increase a Paragon's degree?",
    a: `Yes. Each Tier 5 sacrificed beyond the three required adds ${n(POWER_LIMITS.t5.pointsPerExtra)} power, up to a ${n(POWER_LIMITS.t5.maxPower)} cap. In solo you usually can't place more than the base three — the ${duplicateT5Towers} can each add one, via Master Double Cross and a level 13+ Silas — but in co-op every player contributes three Tier 5s, so a two-player game allows 3 extra and a full four-player game allows 9. That is why co-op reaches high degrees far more cheaply.`,
  },
  {
    q: "What are Geraldo's Paragon Power Totems?",
    a: `Paragon Power Totems are an item sold by the hero Geraldo. Each totem absorbed into a Paragon adds a flat ${n(TOTEM_POWER)} power points and, unlike the other categories, has no cap. They stand in for pops or cash you have not banked yet, which makes them the quickest way to a high degree before the late rounds.`,
  },
  {
    q: "Can I over-sacrifice and waste resources?",
    a: `Yes — every category except totems is capped, so anything past the cap is wasted. Pops & Income maxes at ${millions(MAX_EQUIVALENT_POPS)} equivalent pops (${n(POWER_LIMITS.pops.maxPower)} power) and cash at ${CASH_CAP_MULTIPLE}x the base price (${n(POWER_LIMITS.cash.maxPower)} power). Upgrade tiers no longer count at all, though the money spent on those towers still counts as cash. The calculator flags wasted cash and pops so you don't over-invest.`,
  },
  {
    q: "How do I count my pops for the calculator?",
    a: `Add up the pop totals shown on each non-Tier-5 tower you plan to sacrifice. One power is earned per ${POWER_LIMITS.pops.popDivisor} pops, and cash generated counts as four pops per $1 (so $${POWER_LIMITS.pops.popDivisor / 4} of income equals one power). The built-in pop counter lets you enter each tower's pops and sums them for you.`,
  },
  {
    q: "Is this calculator accurate and up to date?",
    a: `It models the current Update ${GAME_VERSION} Paragon formula, including the cash slider and Geraldo totems, and is open-source so the math can be checked. The degree curve is pinned by a regression test against the documented in-game values. Use the Goal Planner to work backwards from a target degree, or enter your sacrifices directly to see the exact degree you will get.`,
  },
];
