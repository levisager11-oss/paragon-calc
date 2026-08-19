import { POWER_LIMITS } from "../constants/paragons.js";

/**
 * Total Paragon Power that corresponds to Degree 100 — the hard ceiling in game.
 */
export const MAX_POWER = 200000;

/**
 * Degree thresholds, precomputed once at module load.
 *
 * Degrees 2-99 follow the community-documented cubic
 *   P(D) = floor((50·D³ + 5025·D² + 168324·D + 843000) / 600)
 * Degree 1 is the starting degree (0 power) and Degree 100 is a flat 200,000 —
 * the cubic itself only reaches 196,542 at D=100, so the final step is larger
 * than the curve suggests. That is the real in-game behaviour, not a rounding
 * artefact: it is what makes a fully-maxed solo Paragon (160,000 power,
 * Degree 91) need exactly 20 Geraldo totems to reach Degree 100, and a solo
 * Dart Monkey with Master Double Cross (166,000 power, Degree 92) need 17 —
 * both of which match the documented in-game minimums.
 *
 * Index i holds the power required for degree i; index 0 is unused.
 */
export const DEGREE_THRESHOLDS = (() => {
  const table = new Array(101).fill(0);
  for (let d = 2; d <= 99; d++) {
    table[d] = Math.floor(
      (50 * d ** 3 + 5025 * d ** 2 + 168324 * d + 843000) / 600
    );
  }
  table[100] = MAX_POWER;
  return table;
})();

/**
 * How many Tier 5s can be sacrificed *beyond* the three the Paragon requires.
 *
 * Co-op: four players contribute three T5s each, so 12 total − 3 required = 9.
 * Solo: none, except the Dart Monkey, whose "Master Double Cross" Monkey
 * Knowledge allows a second Crossbow Master.
 *
 * Shared by the forward calculator, the Goal Planner and both UIs so the limit
 * can never be stated differently in one place than it is applied in another.
 */
export function maxT5sFor(paragon, gameMode) {
  if (gameMode === "coop") return 9;
  if (paragon?.id === "apex_plasma_master") return 1;
  return 0;
}

/**
 * Highest total power reachable without Geraldo totems, for a given game mode.
 * Solo non-Dart = 160,000 (Degree 91); solo Dart = 166,000 (Degree 92).
 */
export function powerCeilingWithoutTotems(paragon, gameMode) {
  return (
    POWER_LIMITS.pops.maxPower +
    POWER_LIMITS.upgrades.maxPower +
    POWER_LIMITS.cash.maxPower +
    Math.min(
      POWER_LIMITS.t5.maxPower,
      maxT5sFor(paragon, gameMode) * POWER_LIMITS.t5.pointsPerExtra
    )
  );
}

/**
 * Reverse calculator: given a target degree, returns the minimum inputs
 * needed based on the chosen strategy.
 *
 * strategy = 'leastCash'  → fill Pops → Upgrades → T5s → Cash → Totems
 * strategy = 'leastPops'  → fill Upgrades → T5s → Cash → Totems → Pops
 * strategy = 'balanced'   → fill Upgrades → T5s → (Pops + Cash split proportionally) → Totems
 *
 * Within cash: Sacrifice is always preferred over Slider (more efficient per $).
 */
export function reverseCalculate({
  paragon,
  difficulty,
  gameMode,
  targetDegree,
  useExtraT5s      = true,
  useUpgrades      = true,
  useSacrificeCash = true,
  useSliderCash    = false,
  useTotems        = true,
  strategy         = 'leastCash',  // 'leastCash' | 'leastPops' | 'balanced'
}) {
  const basePrice          = getBasePrice(paragon.mediumCost, difficulty);
  const targetPower        = getPowerThreshold(targetDegree);
  const sacrificePowerRate = 20000 / basePrice;
  const sliderPowerRate    = 20000 / (basePrice * 1.05);

  const maxT5s = useExtraT5s ? maxT5sFor(paragon, gameMode) : 0;
  const maxT5Power = Math.min(
    POWER_LIMITS.t5.maxPower,
    maxT5s * POWER_LIMITS.t5.pointsPerExtra
  );
  const maxPopsPower    = POWER_LIMITS.pops.maxPower;                               // 90 000
  const maxUpgradePower = useUpgrades ? POWER_LIMITS.upgrades.maxPower : 0;          // 10 000 or 0
  const maxCashPower    = POWER_LIMITS.cash.maxPower;                                // 60 000
  const cashEnabled     = useSacrificeCash || useSliderCash;

  // ── helpers ──────────────────────────────────────────────────────────
  const takePops     = (r) => Math.min(maxPopsPower,    r);
  const takeUpgrades = (r) => Math.min(maxUpgradePower, r);
  const takeT5s      = (r) => Math.min(maxT5Power,      r);
  const takeCash     = (r) => cashEnabled ? Math.min(maxCashPower, r) : 0;
  const takeTotems   = (r) => useTotems && r > 0 ? Math.ceil(r / 2000) * 2000 : 0;

  // ── strategy dispatch ─────────────────────────────────────────────────
  let popsPow = 0, cashPow = 0;
  let upgPow, t5Pow, totemPow;
  let rem = targetPower;

  if (strategy === 'leastCash') {
    // Minimise cash → use pops first
    popsPow  = takePops(rem);     rem -= popsPow;
    upgPow   = takeUpgrades(rem); rem -= upgPow;
    t5Pow    = takeT5s(rem);      rem -= t5Pow;
    cashPow  = takeCash(rem);     rem -= cashPow;
    totemPow = takeTotems(rem);   rem -= totemPow;

  } else if (strategy === 'leastPops') {
    // Minimise pops → use everything else first
    upgPow   = takeUpgrades(rem); rem -= upgPow;
    t5Pow    = takeT5s(rem);      rem -= t5Pow;
    cashPow  = takeCash(rem);     rem -= cashPow;
    totemPow = takeTotems(rem);   rem -= totemPow;
    popsPow  = takePops(rem);     rem -= popsPow;

  } else {
    // Balanced → free sources first, then split pops / cash proportionally
    upgPow = takeUpgrades(rem); rem -= upgPow;
    t5Pow  = takeT5s(rem);      rem -= t5Pow;

    if (rem > 0) {
      const availCash = cashEnabled ? maxCashPower : 0;
      const total     = maxPopsPower + availCash;

      if (!cashEnabled) {
        popsPow = takePops(rem); rem -= popsPow;
      } else {
        // Proportional split: pops gets 90/(90+60)=60%, cash gets 40%
        const popsFrac = maxPopsPower / total;
        let tPops = Math.round(rem * popsFrac);
        let tCash = rem - tPops;

        // Clamp to caps, redistribute overflow
        if (tPops > maxPopsPower) { tCash += tPops - maxPopsPower; tPops = maxPopsPower; }
        if (tCash > maxCashPower)  { tPops += tCash - maxCashPower;  tCash = maxCashPower; }

        popsPow = Math.min(maxPopsPower, Math.max(0, tPops));
        cashPow = Math.min(maxCashPower,  Math.max(0, tCash));
        rem    -= popsPow + cashPow;
      }
    }
    totemPow = takeTotems(rem); rem -= totemPow;
  }

  // ── derive human-readable outputs ────────────────────────────────────
  const popsNeeded     = Math.round(popsPow * POWER_LIMITS.pops.popDivisor);
  const popsMaxed      = popsPow  >= maxPopsPower;
  const upgradesNeeded = Math.ceil(upgPow  / POWER_LIMITS.upgrades.pointsPerUpgrade);
  const upgradesMaxed  = upgPow   >= maxUpgradePower;
  const t5sNeeded      = t5Pow  > 0 ? Math.ceil(t5Pow / POWER_LIMITS.t5.pointsPerExtra) : 0;
  const t5sMaxed       = maxT5Power > 0 && t5Pow >= maxT5Power;
  const totemsNeeded   = totemPow > 0 ? Math.round(totemPow / 2000) : 0;

  // Cash split
  let sacrificeCashNeeded = 0, sliderCashNeeded = 0;
  if (cashPow > 0) {
    if (useSacrificeCash && useSliderCash) {
      // Both: split 50 / 50 by power so each source is visibly used
      const half = cashPow / 2;
      sacrificeCashNeeded = Math.ceil(half / sacrificePowerRate);
      sliderCashNeeded    = Math.ceil(half / sliderPowerRate);
    } else if (useSacrificeCash) {
      sacrificeCashNeeded = Math.ceil(cashPow / sacrificePowerRate);
    } else {
      sliderCashNeeded = Math.ceil(cashPow / sliderPowerRate);
    }
  }

  const remaining = rem;

  return {
    targetPower,
    basePrice,
    achievable:          remaining <= 0,
    remainingPower:      Math.max(0, Math.round(remaining)),
    popsNeeded,
    popsMaxed,
    upgradesNeeded,
    upgradesMaxed,
    t5sNeeded,
    t5sMaxed,
    maxT5s,
    sacrificeCashNeeded,
    sliderCashNeeded,
    totalCashNeeded:     sacrificeCashNeeded + sliderCashNeeded,
    totemsNeeded,
  };
}

/**
 * Splits a cash amount into whole sacrifice-tower "chunks" plus a remainder.
 *
 * Sacrifice cash is 100% efficient, while the in-game cash slider charges a 5%
 * premium. Since you can only sacrifice *whole* non-T5 towers, the most cash you
 * can route through sacrifices (per tower) is the value of the most expensive
 * legal non-T5 build — a Tier-4 tower with a +2 crosspath. This helper figures
 * out how many such towers fit inside `amount`, returning the cash that should
 * move to sacrifices and the sub-one-tower remainder that has to stay on the
 * slider.
 *
 * @param {number} amount     - cash to redistribute (e.g. the current slider value)
 * @param {number} maxT4Cost  - cost of the most expensive T4 (+2 crosspath) tower
 * @returns {{towers:number, sacrificeCash:number, remainder:number}}
 */
export function splitIntoSacrificeTowers(amount, maxT4Cost) {
  const safeAmount = Number(amount) > 0 ? Number(amount) : 0;
  if (!(Number(maxT4Cost) > 0)) {
    return { towers: 0, sacrificeCash: 0, remainder: safeAmount };
  }
  const towers = Math.floor(safeAmount / maxT4Cost);
  const sacrificeCash = towers * maxT4Cost;
  return { towers, sacrificeCash, remainder: safeAmount - sacrificeCash };
}

/**
 * Calculates the base price of a Paragon based on difficulty.
 * Standard BTD6 prices are rounded to the nearest multiple of 5.
 */
export function getBasePrice(mediumCost, difficulty) {
  let multiplier = 1.0;
  if (difficulty === "easy") multiplier = 0.85;
  if (difficulty === "hard") multiplier = 1.08;
  if (difficulty === "impoppable") multiplier = 1.20;

  const rawPrice = mediumCost * multiplier;
  // BTD6 rounds to the nearest $5 or $10. Standard rounding to nearest 5:
  return Math.round(rawPrice / 5) * 5;
}

/**
 * Returns the exact power threshold required to unlock a specific degree.
 */
export function getPowerThreshold(degree) {
  if (degree <= 1) return 0;
  if (degree >= 100) return MAX_POWER;
  return DEGREE_THRESHOLDS[degree];
}

/**
 * Determines the Degree (1-100) based on accumulated Power.
 */
export function calculateDegreeFromPower(power) {
  if (power >= MAX_POWER) return 100;
  if (power <= 0) return 1;

  // Find the highest degree whose threshold is <= the current power
  for (let d = 99; d >= 2; d--) {
    if (power >= DEGREE_THRESHOLDS[d]) return d;
  }
  return 1;
}

/**
 * Main calculation engine.
 */
export function calculateParagonData({
  paragon, // Object from PARAGONS
  difficulty, // "easy", "medium", "hard", "impoppable"
  gameMode, // "solo", "coop"
  pops, // number of pops
  income, // cash generated
  upgrades, // number of upgrade tiers on sacrificed non-T5 towers
  extraT5s, // number of additional T5s sacrificed (excluding the initial 3)
  sacrificedTowerCash, // cash spent on non-T5 towers
  sliderCash, // cash injected via the slider
  totems // Geraldo totems count
}) {
  const basePrice = getBasePrice(paragon.mediumCost, difficulty);

  // 1. Extra T5s Power
  // Only count T5s the game actually allows for this mode/paragon — solo play
  // permits none, except the Dart Monkey's Master Double Cross. (The API does
  // the same, so both surfaces agree for identical inputs.)
  const allowedT5s = maxT5sFor(paragon, gameMode);
  const effectiveExtraT5s = Math.min(extraT5s, allowedT5s);
  const rawT5Power = effectiveExtraT5s * POWER_LIMITS.t5.pointsPerExtra;
  const t5Power = Math.min(POWER_LIMITS.t5.maxPower, rawT5Power);
  const t5Capped = rawT5Power > POWER_LIMITS.t5.maxPower;

  // 2. Non-T5 Upgrades Power
  // Max upgrades power is 10,000 (100 power per upgrade)
  const rawUpgradesPower = upgrades * POWER_LIMITS.upgrades.pointsPerUpgrade;
  const upgradesPower = Math.min(POWER_LIMITS.upgrades.maxPower, rawUpgradesPower);
  const upgradesCapped = rawUpgradesPower > POWER_LIMITS.upgrades.maxPower;

  // 3. Pops / Income Power
  // Max pops power is 90,000 (1 power per 180 pops OR $45 income, which is 4 pop equivalents per $1)
  const equivalentPops = pops + (income * 4);
  const rawPopsPower = Math.floor(equivalentPops / POWER_LIMITS.pops.popDivisor);
  const popsPower = Math.min(POWER_LIMITS.pops.maxPower, rawPopsPower);
  const popsCapped = rawPopsPower > POWER_LIMITS.pops.maxPower;

  // 4. Cash Investment Power
  // Max cash power is 60,000.
  // Sacrifice cash: 1 power per (basePrice / 20000) spent.
  // Slider cash: 1 power per (basePrice * 1.05 / 20000) spent (5% premium).
  const sacrificePowerRatio = 20000 / basePrice;
  const sliderPowerRatio = 20000 / (basePrice * 1.05);

  const rawSacrificeCashPower = sacrificedTowerCash * sacrificePowerRatio;
  const rawSliderCashPower = sliderCash * sliderPowerRatio;
  const rawCashPower = rawSacrificeCashPower + rawSliderCashPower;

  // Power is a whole number in game — floor the fractional cash contribution
  // rather than letting it leak decimals into the total (and into every "/ 200,000"
  // readout). Matches api/paragon/calculate.js.
  const cashPower = Math.floor(Math.min(POWER_LIMITS.cash.maxPower, rawCashPower));
  const cashCapped = rawCashPower > POWER_LIMITS.cash.maxPower;

  // Calculate wasted cash if capped
  let wastedCash = 0;
  if (cashCapped) {
    // If sacrifice cash alone is enough to cap out
    if (rawSacrificeCashPower >= POWER_LIMITS.cash.maxPower) {
      const neededSacrificeCash = POWER_LIMITS.cash.maxPower / sacrificePowerRatio;
      wastedCash = (sacrificedTowerCash - neededSacrificeCash) + sliderCash;
    } else {
      // Sacrifice cash didn't cap it, but combined with slider it did.
      // The remaining power needed is 60,000 - rawSacrificeCashPower.
      const remainingPowerNeeded = POWER_LIMITS.cash.maxPower - rawSacrificeCashPower;
      const neededSliderCash = remainingPowerNeeded / sliderPowerRatio;
      wastedCash = sliderCash - neededSliderCash;
    }
    // Round to nearest dollar
    wastedCash = Math.max(0, Math.round(wastedCash));
  }

  // 5. Geraldo's Totems Power
  // 2,000 power per totem, uncapped
  const totemsPower = totems * 2000;

  // Total Power
  const totalPower = t5Power + upgradesPower + popsPower + cashPower + totemsPower;
  const degree = calculateDegreeFromPower(totalPower);

  // Next Degree calculations
  const nextDegree = Math.min(100, degree + 1);
  const nextDegreeThreshold = getPowerThreshold(nextDegree);
  const powerGap = nextDegree === degree ? 0 : nextDegreeThreshold - totalPower;

  // Max Slider allowed in-game (3.15x base price)
  const maxSliderAllowed = Math.round(basePrice * 3.15);

  // Recommendations for bridging the power gap (if degree < 100).
  //
  // Each entry answers "what would it take to close the *remaining gap* using
  // only this source?" — so every suggestion is capped by both the gap and the
  // category's own headroom, and says so when the source can't close it alone.
  const recommendations = [];
  if (degree < 100 && powerGap > 0) {
    const shortfallNote = (covered) =>
      covered < powerGap
        ? ` That maxes this category but still leaves ${(powerGap - covered).toLocaleString()} power to find elsewhere.`
        : "";

    // How many more pops (or income) are needed
    const popsHeadroom = POWER_LIMITS.pops.maxPower - popsPower;
    if (popsHeadroom > 0) {
      const popsPowerNeeded = Math.min(popsHeadroom, powerGap);
      // Power only ticks over on whole multiples of the divisor, so target the
      // exact equivalent-pop total for the power level we want and subtract
      // what has already been banked.
      const targetPopsPower = popsPower + popsPowerNeeded;
      const extraPopsNeeded = Math.max(
        0,
        Math.ceil(targetPopsPower * POWER_LIMITS.pops.popDivisor - equivalentPops)
      );
      recommendations.push({
        type: "pops",
        text: `Accumulate ${extraPopsNeeded.toLocaleString()} more pops (or $${Math.ceil(extraPopsNeeded / 4).toLocaleString()} more income) across sacrificed towers.${shortfallNote(popsPowerNeeded)}`,
        value: extraPopsNeeded
      });
    }

    // How many more upgrade tiers are needed
    const upgradesHeadroom = POWER_LIMITS.upgrades.maxPower - upgradesPower;
    if (upgradesHeadroom > 0) {
      const upgradesPowerNeeded = Math.min(upgradesHeadroom, powerGap);
      const extraUpgrades = Math.ceil(upgradesPowerNeeded / POWER_LIMITS.upgrades.pointsPerUpgrade);
      recommendations.push({
        type: "upgrades",
        text: `Sacrifice ${extraUpgrades} more upgrade tier${extraUpgrades === 1 ? "" : "s"} on non-T5 towers (a 0-2-4 tower is worth 6 tiers).${shortfallNote(upgradesPowerNeeded)}`,
        value: extraUpgrades
      });
    }

    // How much more cash is needed (Slider or Tower sacrifices)
    const cashHeadroom = POWER_LIMITS.cash.maxPower - cashPower;
    if (cashHeadroom > 0) {
      const cashPowerNeeded = Math.min(cashHeadroom, powerGap);

      const sacrificeCashNeeded = Math.ceil(cashPowerNeeded / sacrificePowerRatio);
      const sliderCashNeeded = Math.ceil(cashPowerNeeded / sliderPowerRatio);

      recommendations.push({
        type: "cash_sacrifice",
        text: `Spend $${sacrificeCashNeeded.toLocaleString()} more on non-T5 towers to sacrifice (100% efficient).${shortfallNote(cashPowerNeeded)}`,
        value: sacrificeCashNeeded
      });
      recommendations.push({
        type: "cash_slider",
        text: `Inject $${sliderCashNeeded.toLocaleString()} more via the Cash Slider (+5% premium cost).${shortfallNote(cashPowerNeeded)}`,
        value: sliderCashNeeded
      });
    }

    // Geraldo's Totems option (always works, uncapped)
    const totemsNeeded = Math.ceil(powerGap / 2000);
    recommendations.push({
      type: "totems",
      text: `Absorb ${totemsNeeded} Geraldo Paragon Power Totem${totemsNeeded === 1 ? "" : "s"} (+2,000 power each).`,
      value: totemsNeeded
    });
  }

  // Warning flags for capped contributions
  const warnings = [];
  if (popsCapped) {
    warnings.push({
      type: "pops",
      text: `Pops & Income power is fully maxed (90,000 pts). The extra ${Math.round(equivalentPops - 16200000).toLocaleString()} equivalent pops are wasted.`
    });
  }
  if (upgradesCapped) {
    warnings.push({
      type: "upgrades",
      text: `Upgrade tiers contribution is fully maxed (10,000 pts). The extra ${upgrades - 100} upgrades are wasted.`
    });
  }
  if (cashCapped && wastedCash > 0) {
    warnings.push({
      type: "cash",
      text: `Cash investment is fully maxed (60,000 pts). You are wasting $${wastedCash.toLocaleString()} which provides zero benefit! Reduce your cash slider or sacrifice less.`
    });
  }
  if (t5Capped) {
    const wastedT5s = Math.floor((rawT5Power - POWER_LIMITS.t5.maxPower) / POWER_LIMITS.t5.pointsPerExtra);
    warnings.push({
      type: "t5",
      text: `Extra T5 power is fully maxed (50,000 pts). ${wastedT5s} extra T5${wastedT5s === 1 ? "" : "s"} provide no benefit.`
    });
  }
  if (extraT5s > allowedT5s) {
    warnings.push({
      type: "mode_restriction",
      text: gameMode === "solo"
        ? `In Single Player (Solo), only the Dart Monkey can sacrifice an extra T5 (using Master Double Cross). ${extraT5s - allowedT5s} extra T5${extraT5s - allowedT5s === 1 ? " was" : "s were"} ignored — switch to Co-op if this is a multiplayer game.`
        : `Co-op allows at most 9 extra T5s (four players × three T5s, minus the three the Paragon consumes). ${extraT5s - allowedT5s} extra T5${extraT5s - allowedT5s === 1 ? " was" : "s were"} ignored.`
    });
  }

  return {
    basePrice,
    maxSliderAllowed,
    totalPower,
    degree,
    powerBreakdown: {
      t5:       { power: t5Power,       max: POWER_LIMITS.t5.maxPower,       pct: (t5Power / POWER_LIMITS.t5.maxPower) * 100,             capped: t5Capped },
      upgrades: { power: upgradesPower, max: POWER_LIMITS.upgrades.maxPower, pct: (upgradesPower / POWER_LIMITS.upgrades.maxPower) * 100, capped: upgradesCapped },
      pops:     { power: popsPower,     max: POWER_LIMITS.pops.maxPower,     pct: (popsPower / POWER_LIMITS.pops.maxPower) * 100,         capped: popsCapped },
      cash:     { power: cashPower,     max: POWER_LIMITS.cash.maxPower,     pct: (cashPower / POWER_LIMITS.cash.maxPower) * 100,         capped: cashCapped },
      totems:   { power: totemsPower,   max: null,                           pct: null,                                                   capped: false }
    },
    // Extra T5s the caller asked for but the game would not allow in this mode.
    ignoredExtraT5s: Math.max(0, extraT5s - allowedT5s),
    powerGap,
    nextDegree,
    recommendations,
    warnings,
    wastedCash
  };
}
