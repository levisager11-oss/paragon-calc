// Single source of truth for the FAQ. Consumed by the static FAQ page generator
// (scripts/generate-pages.js) for both the visible Q&A list and the FAQPage
// JSON-LD structured data, so the two can never drift apart.
//
// Answers are plain text (no HTML) so they can be embedded directly in
// schema.org markup. They describe the live Update 39+ formula implemented in
// src/utils/calculator.js.

export const FAQ_ITEMS = [
  {
    q: "How are Paragon degrees calculated in BTD6?",
    a: "A Paragon's degree comes from Paragon Power Points, capped at 200,000 for Degree 100. Power is earned in four categories — Pops & Income (max 90,000), Sacrificed Upgrades (max 10,000), Cash Investment (max 60,000) and Extra Tier 5s (max 50,000) — plus Geraldo's Paragon Power Totems, which add 2,000 points each and are uncapped. The exact degree for a given power total follows a fixed cubic threshold curve.",
  },
  {
    q: "How do I get a Degree 100 Paragon in solo play?",
    a: "In a solo game the standard categories top out at about 160,000 power (around Degree 76), because you normally can't sacrifice extra Tier 5s. The Dart Monkey is the exception — Master Double Cross lets it add one extra Tier 5 for roughly 166,000 power (Degree 79). To reach the full 200,000 (Degree 100) solo, you must absorb Geraldo's Paragon Power Totems, which add 2,000 uncapped power each — about 20 of them after maxing everything else.",
  },
  {
    q: "What is the cash slider and is it worth using?",
    a: "The cash slider, added in Update 39, lets you pour money straight into the Paragon instead of sacrificing whole towers. It's 95% efficient (a 5% convenience premium) and is capped at 3.15x the Paragon's base price. Sacrificing real towers is 100% efficient, but you can only sacrifice whole towers, so the best approach is to sacrifice as many full towers as possible and use the slider only for the leftover. The calculator's cash optimizer does this split for you.",
  },
  {
    q: "How many Paragons are in Bloons TD 6?",
    a: "As of Update 39+ there are 13 Paragons: Apex Plasma Master (Dart), Glaive Dominus (Boomerang), Crucible of Steel and Flame (Tack), Ballistic Obliteration Missile Bunker / B.O.M.B. (Bomb), Herald of Everfrost (Ice), Ascended Shadow (Ninja), Magus Perfectus (Wizard), Root of all Nature (Druid), Navarch of the Seas (Buccaneer), Nautic Siege Core (Sub), Goliath Doomship (Ace), Master Builder (Engineer) and Mega Massive Munitions Factory (Spike Factory).",
  },
  {
    q: "Which Paragon is the cheapest and which is the most expensive?",
    a: "On Medium difficulty the cheapest Paragon to build is the Apex Plasma Master (Dart Monkey) at a $150,000 base, and the most expensive is the Goliath Doomship (Monkey Ace) at $900,000. Prices scale with difficulty: about 0.85x on Easy, 1.08x on Hard and 1.20x on Impoppable.",
  },
  {
    q: "Do extra Tier 5 sacrifices increase a Paragon's degree?",
    a: "Yes. Each Tier 5 sacrificed beyond the three required adds 6,000 power, up to a 50,000 cap (roughly nine extra). In solo you usually can't place more than the base three — the Dart Monkey can add one via Master Double Cross — but in co-op each player can contribute Tier 5s, which is why co-op reaches high degrees far more cheaply.",
  },
  {
    q: "What are Geraldo's Paragon Power Totems?",
    a: "Paragon Power Totems are an item sold by the hero Geraldo. Each totem absorbed into a Paragon adds a flat 2,000 power points and, unlike the other categories, has no cap. They are the only way to push a solo Paragon all the way to Degree 100.",
  },
  {
    q: "Can I over-sacrifice and waste resources?",
    a: "Yes — every category except totems is capped, so anything past the cap is wasted. Pops & Income maxes at 16.2M equivalent pops (90,000 power), upgrades at 100 sacrificed tiers (10,000 power) and cash at 3x the base price (60,000 power). The calculator flags wasted cash and pops so you don't over-invest.",
  },
  {
    q: "How do I count my pops for the calculator?",
    a: "Add up the pop totals shown on each non-Tier-5 tower you plan to sacrifice. One power is earned per 180 pops, and cash generated counts as four pops per $1 (so $45 of income equals one power). The built-in pop counter lets you enter each tower's pops and sums them for you.",
  },
  {
    q: "Is this calculator accurate and up to date?",
    a: "It models the current Update 39+ Paragon formula, including the cash slider and Geraldo totems, and is open-source so the math can be checked. Use the Goal Planner to work backwards from a target degree, or enter your sacrifices directly to see the exact degree you will get.",
  },
];
