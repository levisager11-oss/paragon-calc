import { describe, it, expect } from "vitest";
import {
  DEGREE_THRESHOLDS,
  MAX_POWER,
  calculateDegreeFromPower,
  calculateParagonData,
  getBasePrice,
  getPowerThreshold,
  maxT5sFor,
  powerCeilingWithoutTotems,
  reverseCalculate,
} from "../src/utils/calculator.js";
import { PARAGONS, POWER_LIMITS } from "../src/constants/paragons.js";

const DART = PARAGONS.apex_plasma_master;   // solo extra T5 via Master Double Cross
const ICE = PARAGONS.herald_of_everfrost;   // solo extra T5 via a level 13+ Silas
const NINJA = PARAGONS.ascended_shadow;     // representative "normal" paragon

const build = (over = {}) => calculateParagonData({
  paragon: NINJA,
  difficulty: "medium",
  gameMode: "solo",
  pops: 0, income: 0, upgrades: 0, extraT5s: 0,
  sacrificedTowerCash: 0, sliderCash: 0, totems: 0,
  ...over,
});

// ─── Degree thresholds ────────────────────────────────────────────────────────
//
// Golden values pinned so a refactor of the threshold curve can never silently
// change every published degree on the site. Degrees 2-99 come from the
// documented cubic; 1 and 100 are the fixed endpoints.

describe("getPowerThreshold", () => {
  it("matches the golden threshold table", () => {
    const golden = {
      1: 0,
      2: 2000,
      3: 2324,
      5: 3027,
      10: 5131,
      20: 11032,
      50: 46786,
      75: 104711,
      90: 155241,
      91: 159085,
      92: 162991,
      99: 192120,
      100: 200000,
      // Degrees whose cubic value has a fractional part above .5. The published
      // table rounds, so these are exactly the thresholds a floor() would put
      // one power too low — the difference between reporting Degree 6 and
      // Degree 5 for a build sitting on 3,407 power.
      6: 3408,
      7: 3808,
      9: 4669,
      17: 9004,
      57: 60039,
      97: 183474,
    };
    for (const [degree, power] of Object.entries(golden)) {
      expect(getPowerThreshold(Number(degree)), `degree ${degree}`).toBe(power);
    }
  });

  it("rounds the cubic rather than flooring or ceiling it", () => {
    for (let d = 2; d <= 99; d++) {
      const exact = (50 * d ** 3 + 5025 * d ** 2 + 168324 * d + 843000) / 600;
      expect(getPowerThreshold(d), `degree ${d}`).toBe(Math.round(exact));
      // The cubic never lands on a whole number or on exactly .5, so rounding
      // is unambiguous and always differs from one of floor/ceil.
      expect(Number.isInteger(exact), `degree ${d}`).toBe(false);
      expect(exact % 1, `degree ${d}`).not.toBe(0.5);
    }
  });

  it("caps degree 100 at the 200,000 power ceiling", () => {
    expect(getPowerThreshold(100)).toBe(MAX_POWER);
    expect(getPowerThreshold(150)).toBe(MAX_POWER);
  });

  it("treats degree 1 (and below) as free", () => {
    expect(getPowerThreshold(1)).toBe(0);
    expect(getPowerThreshold(0)).toBe(0);
    expect(getPowerThreshold(-5)).toBe(0);
  });

  it("increases strictly with degree", () => {
    for (let d = 2; d <= 100; d++) {
      expect(getPowerThreshold(d), `degree ${d}`).toBeGreaterThan(getPowerThreshold(d - 1));
    }
  });

  it("exposes a 101-entry precomputed table", () => {
    expect(DEGREE_THRESHOLDS).toHaveLength(101);
    expect(DEGREE_THRESHOLDS[100]).toBe(MAX_POWER);
  });
});

describe("calculateDegreeFromPower", () => {
  it("is the exact inverse of getPowerThreshold at every boundary", () => {
    for (let d = 2; d <= 100; d++) {
      expect(calculateDegreeFromPower(getPowerThreshold(d)), `at degree ${d}`).toBe(d);
      expect(calculateDegreeFromPower(getPowerThreshold(d) - 1), `just below degree ${d}`).toBe(d - 1);
    }
  });

  it("clamps to the 1-100 range", () => {
    expect(calculateDegreeFromPower(0)).toBe(1);
    expect(calculateDegreeFromPower(-1000)).toBe(1);
    expect(calculateDegreeFromPower(MAX_POWER)).toBe(100);
    expect(calculateDegreeFromPower(999999)).toBe(100);
  });
});

// ─── Documented in-game anchor points ─────────────────────────────────────────
//
// These four facts are independently documented by the BTD6 community and are
// what validate the whole threshold curve. If any of them breaks, the formula
// (not the test) is wrong.

describe("documented BTD6 anchor points", () => {
  it("caps a maxed solo Paragon at 160,000 power = Degree 91", () => {
    expect(powerCeilingWithoutTotems(NINJA, "solo")).toBe(160000);
    expect(calculateDegreeFromPower(160000)).toBe(91);
  });

  it("caps a maxed solo Dart Monkey (Master Double Cross) at 166,000 power = Degree 92", () => {
    expect(powerCeilingWithoutTotems(DART, "solo")).toBe(166000);
    expect(calculateDegreeFromPower(166000)).toBe(92);
  });

  it("caps a maxed solo Ice Monkey (Silas 13+) at 166,000 power = Degree 92", () => {
    expect(powerCeilingWithoutTotems(ICE, "solo")).toBe(166000);
  });

  it("caps a maxed two-player co-op Paragon at Degree 95 (3 extra Tier 5s)", () => {
    const power = powerCeilingWithoutTotems(NINJA, "coop", 2);
    expect(power).toBe(178000);
    expect(calculateDegreeFromPower(power)).toBe(95);
  });

  it("needs exactly 20 totems to take a maxed solo Paragon to Degree 100", () => {
    const gap = MAX_POWER - powerCeilingWithoutTotems(NINJA, "solo");
    expect(Math.ceil(gap / 2000)).toBe(20);
  });

  it("needs exactly 17 totems to take a maxed solo Dart Monkey to Degree 100", () => {
    const gap = MAX_POWER - powerCeilingWithoutTotems(DART, "solo");
    expect(Math.ceil(gap / 2000)).toBe(17);
  });

  it("reaches Degree 100 in co-op without any totems", () => {
    expect(powerCeilingWithoutTotems(NINJA, "coop")).toBeGreaterThanOrEqual(MAX_POWER);
  });
});

// ─── Extra T5 rules ───────────────────────────────────────────────────────────

describe("maxT5sFor", () => {
  // Every player fields three Tier 5s of the tower and the Paragon eats three,
  // so the limit is 3 x players - 3. The documented degree table pins the
  // two-player case: co-op with 3 extra Tier 5s tops out at Degree 95.
  it("scales the co-op limit with the number of players", () => {
    expect(maxT5sFor(NINJA, "coop", 2)).toBe(3);
    expect(maxT5sFor(NINJA, "coop", 3)).toBe(6);
    expect(maxT5sFor(NINJA, "coop", 4)).toBe(9);
  });

  it("assumes a full four-player lobby when no player count is given", () => {
    for (const p of Object.values(PARAGONS)) {
      const duplicate = p.soloExtraT5Source ? 1 : 0;
      expect(maxT5sFor(p, "coop"), p.id).toBe(9 + duplicate);
    }
  });

  it("clamps a nonsensical co-op player count into the 2-4 range", () => {
    expect(maxT5sFor(NINJA, "coop", 1)).toBe(3);
    expect(maxT5sFor(NINJA, "coop", 99)).toBe(9);
    expect(maxT5sFor(NINJA, "coop", "not a number")).toBe(9);
  });

  it("allows exactly 1 extra T5 solo for the two towers that may duplicate one", () => {
    // Dart Monkey via Master Double Cross, Ice Monkey via a level 13+ Silas.
    expect(maxT5sFor(DART, "solo")).toBe(1);
    expect(maxT5sFor(ICE, "solo")).toBe(1);
    for (const p of Object.values(PARAGONS)) {
      if (p.soloExtraT5Source) continue;
      expect(maxT5sFor(p, "solo"), p.id).toBe(0);
    }
    expect(Object.values(PARAGONS).filter((p) => p.soloExtraT5Source)).toHaveLength(2);
  });
});

describe("calculateParagonData — extra T5 clamping", () => {
  it("ignores extra T5s that solo play does not allow, and warns", () => {
    const r = build({ extraT5s: 5 });
    expect(r.powerBreakdown.t5.power).toBe(0);
    expect(r.warnings.map((w) => w.type)).toContain("mode_restriction");
  });

  it("counts the one extra T5 a solo Dart Monkey may sacrifice", () => {
    const r = build({ paragon: DART, extraT5s: 1 });
    expect(r.powerBreakdown.t5.power).toBe(POWER_LIMITS.t5.pointsPerExtra);
    expect(r.warnings.map((w) => w.type)).not.toContain("mode_restriction");
  });

  it("counts up to 9 extra T5s in co-op and caps the power at 50,000", () => {
    const r = build({ gameMode: "coop", extraT5s: 9 });
    expect(r.powerBreakdown.t5.power).toBe(POWER_LIMITS.t5.maxPower);
    expect(r.warnings.map((w) => w.type)).toContain("t5");
  });
});

// ─── Power arithmetic ─────────────────────────────────────────────────────────

describe("calculateParagonData — power totals", () => {
  it("always reports whole-number power (never fractional cash)", () => {
    for (const cash of [1, 1000, 12345, 99999]) {
      const r = build({ sacrificedTowerCash: cash });
      expect(Number.isInteger(r.totalPower), `cash ${cash}`).toBe(true);
      expect(Number.isInteger(r.powerBreakdown.cash.power), `cash ${cash}`).toBe(true);
    }
  });

  it("awards 60,000 cash power for exactly 3x the base price in sacrifices", () => {
    const basePrice = getBasePrice(NINJA.mediumCost, "medium");
    const r = build({ sacrificedTowerCash: basePrice * 3 });
    expect(r.powerBreakdown.cash.power).toBe(POWER_LIMITS.cash.maxPower);
  });

  it("charges the slider a 5% premium for the same power", () => {
    const basePrice = getBasePrice(NINJA.mediumCost, "medium");
    const viaSlider = build({ sliderCash: basePrice * 3 });
    expect(viaSlider.powerBreakdown.cash.power).toBe(
      Math.floor(POWER_LIMITS.cash.maxPower / 1.05)
    );
  });

  it("treats $1 of income as 4 pops", () => {
    const viaPops = build({ pops: 180000 });
    const viaIncome = build({ income: 45000 });
    expect(viaIncome.powerBreakdown.pops.power).toBe(viaPops.powerBreakdown.pops.power);
  });

  it("gives 2,000 uncapped power per totem", () => {
    const r = build({ totems: 25 });
    expect(r.powerBreakdown.totems.power).toBe(50000);
    expect(r.totalPower).toBe(50000);
  });

  it("reaches Degree 100 from a fully maxed solo build plus 20 totems", () => {
    const basePrice = getBasePrice(NINJA.mediumCost, "medium");
    const r = build({
      pops: 16200000,
      upgrades: 100,
      sacrificedTowerCash: basePrice * 3,
      totems: 20,
    });
    expect(r.totalPower).toBe(MAX_POWER);
    expect(r.degree).toBe(100);
  });

  it("reaches Degree 91 from a fully maxed solo build with no totems", () => {
    const basePrice = getBasePrice(NINJA.mediumCost, "medium");
    const r = build({ pops: 16200000, upgrades: 100, sacrificedTowerCash: basePrice * 3 });
    expect(r.totalPower).toBe(160000);
    expect(r.degree).toBe(91);
  });
});

// ─── Recommendations ──────────────────────────────────────────────────────────

describe("calculateParagonData — recommendations", () => {
  it("sizes every recommendation to the remaining gap, not the whole category", () => {
    // A cash-only build sitting just inside Degree 50: the gap is ~1.8k power,
    // so the pops hint must ask for ~300k pops, not the 8.6M needed to fund the
    // entire degree from pops alone.
    const basePrice = getBasePrice(DART.mediumCost, "medium");
    const r = build({
      paragon: DART,
      sacrificedTowerCash: Math.round((getPowerThreshold(50) * basePrice) / 20000),
    });
    expect(r.degree).toBe(50);

    const pops = r.recommendations.find((x) => x.type === "pops");
    expect(pops.value).toBe(r.powerGap * POWER_LIMITS.pops.popDivisor);

    const upgrades = r.recommendations.find((x) => x.type === "upgrades");
    expect(upgrades.value).toBe(Math.ceil(r.powerGap / POWER_LIMITS.upgrades.pointsPerUpgrade));

    const totems = r.recommendations.find((x) => x.type === "totems");
    expect(totems.value).toBe(Math.ceil(r.powerGap / 2000));
  });

  it("each single-source recommendation actually reaches the next degree", () => {
    const r = build({ pops: 900000, upgrades: 12, totems: 3 });
    const nextThreshold = getPowerThreshold(r.nextDegree);

    const pops = r.recommendations.find((x) => x.type === "pops");
    const withPops = build({ pops: 900000 + pops.value, upgrades: 12, totems: 3 });
    expect(withPops.totalPower).toBeGreaterThanOrEqual(nextThreshold);
    expect(withPops.degree).toBe(r.nextDegree);

    // Upgrades (100 power each) and totems (2,000 each) are chunky, so the
    // smallest whole number that closes the gap may overshoot a degree or two.
    const upgrades = r.recommendations.find((x) => x.type === "upgrades");
    const withUpgrades = build({ pops: 900000, upgrades: 12 + upgrades.value, totems: 3 });
    expect(withUpgrades.degree).toBeGreaterThanOrEqual(r.nextDegree);

    const sac = r.recommendations.find((x) => x.type === "cash_sacrifice");
    const withCash = build({ pops: 900000, upgrades: 12, totems: 3, sacrificedTowerCash: sac.value });
    expect(withCash.degree).toBeGreaterThanOrEqual(r.nextDegree);

    const totems = r.recommendations.find((x) => x.type === "totems");
    const withTotems = build({ pops: 900000, upgrades: 12, totems: 3 + totems.value });
    expect(withTotems.degree).toBeGreaterThanOrEqual(r.nextDegree);
  });

  it("omits a source that is already maxed out", () => {
    const r = build({ pops: 16200000, upgrades: 100, totems: 5 });
    const types = r.recommendations.map((x) => x.type);
    expect(types).not.toContain("pops");
    expect(types).not.toContain("upgrades");
    expect(types).toContain("totems");
  });

  it("flags when a capped source cannot close the gap on its own", () => {
    // Nothing invested: closing a 2,000-power gap from upgrades alone is fine,
    // but from a near-full category it is not. Upgrades cap at 10,000 power, so
    // aiming at Degree 100 from scratch leaves a shortfall note.
    const r = build({ totems: 90 }); // 180,000 power → Degree 95-ish, gap < 10k
    const upgrades = r.recommendations.find((x) => x.type === "upgrades");
    expect(upgrades.text).not.toMatch(/leaves/);

    const low = build({ pops: 100 });
    const lowUpgrades = low.recommendations.find((x) => x.type === "upgrades");
    expect(lowUpgrades.text).not.toMatch(/leaves/); // early degrees are cheap
  });

  it("produces no recommendations at Degree 100", () => {
    const r = build({ totems: 100 });
    expect(r.degree).toBe(100);
    expect(r.recommendations).toEqual([]);
    expect(r.powerGap).toBe(0);
  });
});

// ─── Reverse calculator (Goal Planner) ────────────────────────────────────────

describe("reverseCalculate", () => {
  const plan = (over = {}) => reverseCalculate({
    paragon: NINJA, difficulty: "medium", gameMode: "solo", targetDegree: 100, ...over,
  });

  it("plans a solo Degree 100 as maxed categories plus 20 totems", () => {
    const r = plan();
    expect(r.achievable).toBe(true);
    expect(r.popsNeeded).toBe(16200000);
    expect(r.upgradesNeeded).toBe(100);
    expect(r.totemsNeeded).toBe(20);
  });

  it("plans a solo Dart Monkey Degree 100 with one extra T5 and 17 totems", () => {
    const r = plan({ paragon: DART });
    expect(r.t5sNeeded).toBe(1);
    expect(r.totemsNeeded).toBe(17);
  });

  it("allows 9 extra T5s in a full co-op lobby, and fewer with fewer players", () => {
    expect(plan({ gameMode: "coop" }).maxT5s).toBe(9);
    expect(plan({ gameMode: "coop", playerCount: 2 }).maxT5s).toBe(3);
    expect(plan({ gameMode: "coop", playerCount: 3 }).maxT5s).toBe(6);
    expect(plan({ paragon: DART, gameMode: "coop", playerCount: 4 }).maxT5s).toBe(10);
  });

  it("reports a target as unachievable when every source is switched off", () => {
    const r = plan({
      useExtraT5s: false, useUpgrades: false,
      useSacrificeCash: false, useSliderCash: false, useTotems: false,
    });
    expect(r.achievable).toBe(false);
    expect(r.remainingPower).toBeGreaterThan(0);
  });

  it("produces a plan that the forward calculator agrees reaches the target", () => {
    for (const targetDegree of [25, 50, 75, 91, 100]) {
      const r = plan({ targetDegree });
      const forward = build({
        pops: r.popsNeeded,
        upgrades: r.upgradesNeeded,
        sacrificedTowerCash: r.sacrificeCashNeeded,
        sliderCash: r.sliderCashNeeded,
        totems: r.totemsNeeded,
      });
      expect(forward.degree, `target ${targetDegree}`).toBeGreaterThanOrEqual(targetDegree);
    }
  });
});
