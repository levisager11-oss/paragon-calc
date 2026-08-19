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
import { PARAGONS, POWER_LIMITS } from "./paragons.js";

const TOTEM_POWER = 2000;

// A representative non-Dart paragon: solo play grants it no extra Tier 5s.
const STANDARD = PARAGONS.ascended_shadow;
const DART = PARAGONS.apex_plasma_master;

export const SOLO_CEILING = soloCeilingFacts(STANDARD);  // 160,000 power · Degree 91 · 20 totems
export const DART_CEILING = soloCeilingFacts(DART);      // 166,000 power · Degree 92 · 17 totems

const PARAGON_COUNT = Object.keys(PARAGONS).length;
const n = (v) => v.toLocaleString("en-US");

// "Ballistic Obliteration Missile Bunker (B.O.M.B.) (Bomb Shooter)" reads badly,
// so drop any trailing parenthetical from the name and shorten the tower.
const paragonSummary = (p) =>
  `${p.name.replace(/\s*\([^)]*\)\s*$/, "")} (${p.tower.replace(/^Monkey /, "").replace(/ Monkey$/, "")})`;

export const FAQ_ITEMS = [
  {
    q: "How are Paragon degrees calculated in BTD6?",
    a: `A Paragon's degree comes from Paragon Power Points, capped at ${n(MAX_POWER)} for Degree 100. Power is earned in four categories — Pops & Income (max ${n(POWER_LIMITS.pops.maxPower)}), Sacrificed Upgrades (max ${n(POWER_LIMITS.upgrades.maxPower)}), Cash Investment (max ${n(POWER_LIMITS.cash.maxPower)}) and Extra Tier 5s (max ${n(POWER_LIMITS.t5.maxPower)}) — plus Geraldo's Paragon Power Totems, which add ${n(TOTEM_POWER)} points each and are uncapped. The exact degree for a given power total follows a fixed cubic threshold curve.`,
  },
  {
    q: "How do I get a Degree 100 Paragon in solo play?",
    a: `In a solo game the standard categories top out at ${n(SOLO_CEILING.power)} power, which is Degree ${SOLO_CEILING.degree}, because you normally can't sacrifice extra Tier 5s. The Dart Monkey is the exception — Master Double Cross lets it add one extra Tier 5 for ${n(DART_CEILING.power)} power, or Degree ${DART_CEILING.degree}. To reach the full ${n(MAX_POWER)} (Degree 100) solo you must absorb Geraldo's Paragon Power Totems, which add ${n(TOTEM_POWER)} uncapped power each: ${SOLO_CEILING.totems} of them after maxing everything else, or ${DART_CEILING.totems} for a Dart Monkey.`,
  },
  {
    q: "What is the cash slider and is it worth using?",
    a: "The cash slider, added in Update 39, lets you pour money straight into the Paragon instead of sacrificing whole towers. It's 95% efficient (a 5% convenience premium) and is capped at 3.15x the Paragon's base price. Sacrificing real towers is 100% efficient, but you can only sacrifice whole towers, so the best approach is to sacrifice as many full towers as possible and use the slider only for the leftover. The calculator's cash optimizer does this split for you.",
  },
  {
    q: "How many Paragons are in Bloons TD 6?",
    a: `As of Update 54+ there are ${PARAGON_COUNT} Paragons: ${Object.values(PARAGONS).map(paragonSummary).join(", ")}.`,
  },
  {
    q: "Which Paragon is the cheapest and which is the most expensive?",
    a: "On Medium difficulty the cheapest Paragon to build is the Apex Plasma Master (Dart Monkey) at a $150,000 base, and the most expensive is the Goliath Doomship (Monkey Ace) at $900,000. Prices scale with difficulty: about 0.85x on Easy, 1.08x on Hard and 1.20x on Impoppable.",
  },
  {
    q: "Do extra Tier 5 sacrifices increase a Paragon's degree?",
    a: `Yes. Each Tier 5 sacrificed beyond the three required adds ${n(POWER_LIMITS.t5.pointsPerExtra)} power, up to a ${n(POWER_LIMITS.t5.maxPower)} cap. In solo you usually can't place more than the base three — the Dart Monkey can add one via Master Double Cross — but in co-op four players contribute three Tier 5s each, so up to 9 extra can be sacrificed. That is why co-op reaches high degrees far more cheaply, and why co-op can hit Degree 100 with no totems at all.`,
  },
  {
    q: "What are Geraldo's Paragon Power Totems?",
    a: `Paragon Power Totems are an item sold by the hero Geraldo. Each totem absorbed into a Paragon adds a flat ${n(TOTEM_POWER)} power points and, unlike the other categories, has no cap. They are the only way to push a solo Paragon all the way to Degree 100.`,
  },
  {
    q: "Can I over-sacrifice and waste resources?",
    a: `Yes — every category except totems is capped, so anything past the cap is wasted. Pops & Income maxes at 16.2M equivalent pops (${n(POWER_LIMITS.pops.maxPower)} power), upgrades at 100 sacrificed tiers (${n(POWER_LIMITS.upgrades.maxPower)} power) and cash at 3x the base price (${n(POWER_LIMITS.cash.maxPower)} power). The calculator flags wasted cash and pops so you don't over-invest.`,
  },
  {
    q: "How do I count my pops for the calculator?",
    a: `Add up the pop totals shown on each non-Tier-5 tower you plan to sacrifice. One power is earned per ${POWER_LIMITS.pops.popDivisor} pops, and cash generated counts as four pops per $1 (so $${POWER_LIMITS.pops.popDivisor / 4} of income equals one power). The built-in pop counter lets you enter each tower's pops and sums them for you.`,
  },
  {
    q: "Is this calculator accurate and up to date?",
    a: "It models the current Update 54+ Paragon formula, including the cash slider and Geraldo totems, and is open-source so the math can be checked. The degree curve is pinned by a regression test against the documented in-game values. Use the Goal Planner to work backwards from a target degree, or enter your sacrifices directly to see the exact degree you will get.",
  },
];
