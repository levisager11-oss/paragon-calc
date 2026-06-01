import { describe, it, expect } from "vitest";
import { splitIntoSacrificeTowers, getBasePrice } from "../src/utils/calculator.js";
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
  it("every paragon defines a positive maxT4MediumCost and a crosspath build", () => {
    for (const p of Object.values(PARAGONS)) {
      expect(p.maxT4MediumCost, p.id).toBeTypeOf("number");
      expect(p.maxT4MediumCost, p.id).toBeGreaterThan(0);
      expect(p.maxT4Build, p.id).toMatch(/^\d-\d-\d$/);
    }
  });

  it("a single T4 tower never costs more than the paragon base price", () => {
    // Sanity: the most expensive sacrifice tower should be a fraction of the
    // full paragon, otherwise the data is almost certainly wrong.
    for (const p of Object.values(PARAGONS)) {
      expect(p.maxT4MediumCost, p.id).toBeLessThan(p.mediumCost);
    }
  });

  it("scales the T4 cost by difficulty just like the base price", () => {
    const p = PARAGONS.apex_plasma_master;
    expect(getBasePrice(p.maxT4MediumCost, "medium")).toBe(9300);
    expect(getBasePrice(p.maxT4MediumCost, "hard")).toBeGreaterThan(9300);
    expect(getBasePrice(p.maxT4MediumCost, "easy")).toBeLessThan(9300);
  });
});
