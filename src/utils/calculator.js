import { POWER_LIMITS } from "../constants/paragons.js";

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

  const maxT5s =
    !useExtraT5s ? 0
    : gameMode === "coop" ? 9
    : paragon.id === "apex_plasma_master" ? 1
    : 0;
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
  let popsPow = 0, upgPow, t5Pow, cashPow = 0, totemPow;
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
      const availPops = cashEnabled ? maxPopsPower : maxPopsPower;
      const availCash = cashEnabled ? maxCashPower : 0;
      const total     = availPops + availCash;

      if (!cashEnabled || total === 0) {
        popsPow = takePops(rem); rem -= popsPow;
      } else {
        // Proportional split: pops gets 90/(90+60)=60%, cash gets 40%
        const popsFrac = availPops / total;
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
  if (degree >= 100) return 200000;
  const d = degree;
  // Formula: P = Math.floor((50*D^3 + 5025*D^2 + 168324*D + 843000) / 600)
  return Math.floor((50 * Math.pow(d, 3) + 5025 * Math.pow(d, 2) + 168324 * d + 843000) / 600);
}

/**
 * Determines the Degree (1-100) based on accumulated Power.
 */
export function calculateDegreeFromPower(power) {
  if (power >= 200000) return 100;
  if (power <= 0) return 1;
  
  // Find the highest degree whose threshold is <= the current power
  for (let d = 99; d >= 1; d--) {
    if (power >= getPowerThreshold(d)) {
      return d;
    }
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
  // Max T5 power is 50,000 (pointsPerExtra = 6,000)
  const rawT5Power = extraT5s * POWER_LIMITS.t5.pointsPerExtra;
  const t5Power = Math.min(POWER_LIMITS.t5.maxPower, rawT5Power);

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
  
  const cashPower = Math.min(POWER_LIMITS.cash.maxPower, rawCashPower);
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

  // Recommendations for bridging the power gap (if degree < 100)
  const recommendations = [];
  if (degree < 100 && powerGap > 0) {
    // How many pops needed
    if (!popsCapped) {
      const totalEquivalentPopsNeeded = nextDegreeThreshold * POWER_LIMITS.pops.popDivisor;
      const remainingEquivalent = Math.max(0, totalEquivalentPopsNeeded - equivalentPops);
      recommendations.push({
        type: "pops",
        text: `Accumulate ${Math.ceil(remainingEquivalent).toLocaleString()} more Pops (or $${Math.ceil(remainingEquivalent / 4).toLocaleString()} in income) across sacrificed towers.`,
        value: Math.ceil(remainingEquivalent)
      });
    }

    // How many upgrades needed
    if (!upgradesCapped) {
      const remainingUpgrades = Math.max(0, 100 - upgrades);
      recommendations.push({
        type: "upgrades",
        text: `Sacrifice ${remainingUpgrades} more Upgrade Tiers (e.g., twenty 0-2-3 towers has 5 tiers each, so 20 towers total).`,
        value: remainingUpgrades
      });
    }

    // How much cash needed (Slider or Tower sacrifices)
    if (!cashCapped) {
      const cashPowerNeeded = Math.min(POWER_LIMITS.cash.maxPower - cashPower, powerGap);
      
      const sacrificeCashNeeded = Math.ceil(cashPowerNeeded / sacrificePowerRatio);
      const sliderCashNeeded = Math.ceil(cashPowerNeeded / sliderPowerRatio);

      recommendations.push({
        type: "cash_sacrifice",
        text: `Spend $${sacrificeCashNeeded.toLocaleString()} on non-T5 towers to sacrifice (100% efficient).`,
        value: sacrificeCashNeeded
      });
      recommendations.push({
        type: "cash_slider",
        text: `Inject $${sliderCashNeeded.toLocaleString()} directly via the Cash Slider (+5% premium cost).`,
        value: sliderCashNeeded
      });
    }

    // Geraldo's Totems option (always works, uncapped)
    const totemsNeeded = Math.ceil(powerGap / 2000);
    recommendations.push({
      type: "totems",
      text: `Absorb ${totemsNeeded} Geraldo Paragon Power Totems (+2,000 power each).`,
      value: totemsNeeded
    });
  }

  // Warning flags for capped contributions
  const warnings = [];
  if (popsCapped && equivalentPops > 16200000) {
    warnings.push({
      type: "pops",
      text: `Pops & Income power is fully maxed (90,000 pts). The extra ${(equivalentPops - 16200000).toLocaleString()} pops are wasted.`
    });
  }
  if (upgradesCapped && upgrades > 100) {
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
  if (extraT5s > 0 && gameMode === "solo" && paragon.id !== "apex_plasma_master") {
    warnings.push({
      type: "mode_restriction",
      text: `In Single Player (Solo), only the Dart Monkey can sacrifice an extra T5 (using Master Double Cross). Check your settings if this is a Co-op game!`
    });
  }

  return {
    basePrice,
    maxSliderAllowed,
    totalPower,
    degree,
    powerBreakdown: {
      t5: { power: t5Power, max: POWER_LIMITS.t5.maxPower, pct: (t5Power / POWER_LIMITS.t5.maxPower) * 100 },
      upgrades: { power: upgradesPower, max: POWER_LIMITS.upgrades.maxPower, pct: (upgradesPower / POWER_LIMITS.upgrades.maxPower) * 100 },
      pops: { power: popsPower, max: POWER_LIMITS.pops.maxPower, pct: (popsPower / POWER_LIMITS.pops.maxPower) * 100 },
      cash: { power: cashPower, max: POWER_LIMITS.cash.maxPower, pct: (cashPower / POWER_LIMITS.cash.maxPower) * 100 },
      totems: { power: totemsPower, max: null, pct: null }
    },
    powerGap,
    nextDegree,
    recommendations,
    warnings,
    wastedCash
  };
}
