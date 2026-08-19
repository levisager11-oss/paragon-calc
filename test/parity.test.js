import { describe, it, expect, beforeEach } from "vitest";
import handler, { _resetRateLimitForTesting } from "../api/paragon/calculate.js";
import { makeReqRes } from "./helpers.js";
import { calculateParagonData } from "../src/utils/calculator.js";
import { PARAGONS, POWER_LIMITS } from "../src/constants/paragons.js";
import { PARAGONS as API_PARAGONS, POWER_LIMITS as API_POWER_LIMITS } from "../api/_lib/shared.js";

beforeEach(() => {
  _resetRateLimitForTesting();
});

// The API used to keep its own copy of the paragon roster, the power limits and
// the degree maths. These tests exist to make sure it never drifts from the app
// again: the website and the public API must answer identically for the same build.

describe("API / web engine parity", () => {
  it("serves the same paragon roster as the app", () => {
    expect(API_PARAGONS).toBe(PARAGONS);
    expect(API_POWER_LIMITS).toBe(POWER_LIMITS);
  });

  const CASES = [
    { label: "empty build", body: { tower: "Ninja Monkey" } },
    {
      label: "mid-game solo build",
      body: { tower: "Ninja Monkey", pops: 2_400_000, income: 180_000, upgrade_count: 34, cash_spent: 420_000 },
    },
    {
      label: "co-op build with extra T5s",
      body: { tower: "Monkey Ace", player_count: 4, pops: 9_000_000, upgrade_count: 100, tier5_count: 6, cash_spent: 1_000_000, difficulty: "hard" },
    },
    {
      label: "solo build asking for illegal extra T5s",
      body: { tower: "Wizard Monkey", tier5_count: 4, pops: 500_000 },
    },
    {
      label: "solo Dart Monkey with Master Double Cross",
      body: { tower: "Dart Monkey", tier5_count: 1, pops: 16_200_000, upgrade_count: 100, cash_spent: 450_000, geraldo_totems: 17 },
    },
    {
      label: "over-capped build on impoppable",
      body: { tower: "Monkey Sub", difficulty: "impoppable", pops: 30_000_000, upgrade_count: 250, cash_spent: 9_000_000, slider_cash: 500_000 },
    },
    {
      label: "slider-only build on easy",
      body: { tower: "Druid", difficulty: "easy", slider_cash: 900_000, geraldo_totems: 5 },
    },
  ];

  for (const { label, body } of CASES) {
    it(`agrees with calculateParagonData for: ${label}`, () => {
      const { req, res } = makeReqRes({ body });
      handler(req, res);
      expect(res.statusCode).toBe(200);

      const api = res._body.result;
      const paragon = Object.values(PARAGONS).find(
        (p) => p.tower === body.tower || p.name === body.tower || p.id === body.tower
      );

      const web = calculateParagonData({
        paragon,
        difficulty: body.difficulty ?? "medium",
        gameMode: (body.player_count ?? 1) >= 2 ? "coop" : "solo",
        pops: body.pops ?? 0,
        income: body.income ?? 0,
        upgrades: body.upgrade_count ?? 0,
        extraT5s: body.tier5_count ?? 0,
        sacrificedTowerCash: body.cash_spent ?? 0,
        sliderCash: body.slider_cash ?? 0,
        totems: body.geraldo_totems ?? 0,
      });

      expect(api.degree).toBe(web.degree);
      expect(api.total_power).toBe(web.totalPower);
      expect(api.next_degree).toBe(web.nextDegree);
      expect(api.power_for_next_degree).toBe(web.powerGap);
      expect(api.wasted_cash).toBe(web.wastedCash);
      expect(api.paragon.base_price).toBe(web.basePrice);

      expect(api.breakdown.pops.power).toBe(web.powerBreakdown.pops.power);
      expect(api.breakdown.upgrades.power).toBe(web.powerBreakdown.upgrades.power);
      expect(api.breakdown.cash.power).toBe(web.powerBreakdown.cash.power);
      expect(api.breakdown.extra_t5s.power).toBe(web.powerBreakdown.t5.power);
      expect(api.breakdown.totems.power).toBe(web.powerBreakdown.totems.power);
    });
  }

  it("returns whole-number power for every documented case", () => {
    for (const { body } of CASES) {
      _resetRateLimitForTesting();
      const { req, res } = makeReqRes({ body });
      handler(req, res);
      expect(Number.isInteger(res._body.result.total_power)).toBe(true);
    }
  });
});
