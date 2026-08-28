import { describe, it, expect } from "vitest";
import { splitIntoSacrificeTowers, getMaxT4Cost } from "../src/utils/calculator.js";
import { PARAGONS } from "../src/constants/paragons.js";

// ─── splitIntoSacrificeTowers ──────────────────────────────────────────────────

describe("splitIntoSacrificeTowers", () => {
  it("splits an amount into whole tower chunks plus remainder", () => {
    // $25,000 budget, $9,300 per tower → 2 towers ($18,600), $6,400 remainder
    const r = splitIntoSacrificeTowers(25000, 9300);
    expect(r.towers).toBe(2);
    expect(r.sacrificeCash).toBe(18600);
    expect(r.remainder).toBe(6400);
  });

  it("conserves the total cash (sacrifice + remainder === amount)", () => {
    const amount = 137500;
    const r = splitIntoSacrificeTowers(amount, 16875);
    expect(r.sacrificeCash + r.remainder).toBe(amount);
  });

  it("returns zero towers when the amount is below one tower cost", () => {
    const r = splitIntoSacrificeTowers(5000, 9300);
    expect(r.towers).toBe(0);
    expect(r.sacrificeCash).toBe(0);
    expect(r.remainder).toBe(5000);
  });

  it("handles an exact multiple with no remainder", () => {
    const r = splitIntoSacrificeTowers(27900, 9300);
    expect(r.towers).toBe(3);
    expect(r.sacrificeCash).toBe(27900);
    expect(r.remainder).toBe(0);
  });

  it("treats a missing/zero tower cost as nothing to move", () => {
    const r = splitIntoSacrificeTowers(10000, 0);
    expect(r.towers).toBe(0);
    expect(r.sacrificeCash).toBe(0);
    expect(r.remainder).toBe(10000);
  });

  it("clamps negative or non-numeric amounts to zero", () => {
    expect(splitIntoSacrificeTowers(-500, 9300).remainder).toBe(0);
    expect(splitIntoSacrificeTowers(undefined, 9300).remainder).toBe(0);
  });
});

// ─── Paragon T4 cost data integrity ─────────────────────────────────────────────

describe("paragon maxT4 data", () => {
  const DIFFICULTIES = ["easy", "medium", "hard", "impoppable"];

  it("every paragon prices its priciest T4 sacrifice on all four difficulties", () => {
    for (const p of Object.values(PARAGONS)) {
      expect(p.maxT4Build, p.id).toMatch(/^\d-\d-\d$/);
      for (const d of DIFFICULTIES) {
        expect(p.maxT4Cost[d], `${p.id} ${d}`).toBeTypeOf("number");
        expect(p.maxT4Cost[d], `${p.id} ${d}`).toBeGreaterThan(0);
      }
    }
  });

  it("names a legal non-Tier-5 build: one path at 4, at most one other at 2", () => {
    for (const p of Object.values(PARAGONS)) {
      const tiers = p.maxT4Build.split("-").map(Number).sort((a, b) => b - a);
      expect(tiers, p.id).toEqual([4, 2, 0]);
    }
  });

  it("a single T4 tower never costs more than the paragon base price", () => {
    // Sanity: the most expensive sacrifice tower should be a fraction of the
    // full paragon, otherwise the data is almost certainly wrong.
    for (const p of Object.values(PARAGONS)) {
      expect(p.maxT4Cost.medium, p.id).toBeLessThan(p.mediumCost);
    }
  });

  it("rises monotonically with difficulty", () => {
    for (const p of Object.values(PARAGONS)) {
      const [easy, medium, hard, impoppable] = DIFFICULTIES.map((d) => p.maxT4Cost[d]);
      expect(easy, p.id).toBeLessThan(medium);
      expect(medium, p.id).toBeLessThan(hard);
      expect(hard, p.id).toBeLessThan(impoppable);
    }
  });

  it("reads the per-difficulty price rather than scaling the medium one", () => {
    // BTD6 applies the difficulty multiplier to each upgrade and rounds it
    // individually, so scaling the total lands off by a few dollars: a 2-4-0
    // Dart Monkey is $7,205 on Easy, not the $7,210 that 8,480 x 0.85 suggests.
    const p = PARAGONS.apex_plasma_master;
    expect(getMaxT4Cost(p, "easy")).toBe(7205);
    expect(getMaxT4Cost(p, "medium")).toBe(8480);
    expect(getMaxT4Cost(p, "hard")).toBe(9155);
    expect(getMaxT4Cost(p, "impoppable")).toBe(10180);
    expect(getMaxT4Cost(p, "easy")).not.toBe(Math.round((8480 * 0.85) / 5) * 5);
  });

  it("falls back to no tower cost when the paragon has no T4 data", () => {
    expect(getMaxT4Cost(undefined, "medium")).toBe(0);
    expect(getMaxT4Cost({}, "medium")).toBe(0);
  });
});
