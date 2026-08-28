import { describe, it, expect } from "vitest";
import versionHandler from "../api/paragon/version.js";
import healthHandler  from "../api/health.js";
import { PARAGONS as API_PARAGONS } from "../api/_lib/shared.js";
import { PARAGONS as UI_PARAGONS } from "../src/constants/paragons.js";
import { getBasePrice } from "../src/utils/calculator.js";
import { makeReqRes } from "./helpers.js";

// ─── GET /api/paragon/version ─────────────────────────────────────────────────

describe("GET /api/paragon/version", () => {
  it("returns 200 with success:true", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.success).toBe(true);
  });

  it("includes api_version, formula_version, formula_revision", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    expect(res._body.api_version).toBeTypeOf("string");
    expect(res._body.formula_version).toBeTypeOf("string");
    expect(res._body.formula_revision).toBeTypeOf("string");
  });

  it("includes status: 'ok'", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    expect(res._body.status).toBe("ok");
  });

  it("includes valid_towers array with 13 entries each having id, tower, paragon", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    const towers = res._body.valid_towers;
    expect(Array.isArray(towers)).toBe(true);
    expect(towers.length).toBe(13);
    for (const t of towers) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("tower");
      expect(t).toHaveProperty("paragon");
    }
  });

  // Medium Paragon upgrade costs as of BTD6 v56.1. Version 55.0 swapped the two
  // that used to be easy to mix up: B.O.M.B. went $600,000 -> $650,000 and
  // Master Builder went $650,000 -> $600,000.
  it("uses the current medium Paragon prices", () => {
    const prices = {
      apex_plasma_master: 150000,
      glaive_dominus: 375000,
      ascended_shadow: 500000,
      navarch_of_the_seas: 550000,
      nautic_siege_core: 400000,
      master_builder: 600000,
      magus_perfectus: 800000,
      goliath_doomship: 900000,
      crucible_of_steel_and_flame: 200000,
      mega_massive_munitions_factory: 750000,
      ballistic_obliteration_missile_bunker: 650000,
      herald_of_everfrost: 300000,
      root_of_all_nature: 475000,
    };

    expect(Object.keys(prices).sort()).toEqual(Object.keys(UI_PARAGONS).sort());

    for (const [id, price] of Object.entries(prices)) {
      expect(API_PARAGONS[id].mediumCost, id).toBe(price);
      expect(UI_PARAGONS[id].mediumCost, id).toBe(price);
    }
  });

  // The other three difficulties are derived from the Medium price rather than
  // stored, so pin them against the published per-difficulty figures. Every
  // Paragon's scaled price is already a multiple of $5, so getBasePrice's
  // rounding never has to correct anything.
  it("derives the other three difficulty prices exactly", () => {
    const byDifficulty = {
      apex_plasma_master:                    [127500, 150000, 162000, 180000],
      glaive_dominus:                        [318750, 375000, 405000, 450000],
      ascended_shadow:                       [425000, 500000, 540000, 600000],
      navarch_of_the_seas:                   [467500, 550000, 594000, 660000],
      nautic_siege_core:                     [340000, 400000, 432000, 480000],
      master_builder:                        [510000, 600000, 648000, 720000],
      magus_perfectus:                       [680000, 800000, 864000, 960000],
      goliath_doomship:                      [765000, 900000, 972000, 1080000],
      crucible_of_steel_and_flame:           [170000, 200000, 216000, 240000],
      mega_massive_munitions_factory:        [637500, 750000, 810000, 900000],
      ballistic_obliteration_missile_bunker: [552500, 650000, 702000, 780000],
      herald_of_everfrost:                   [255000, 300000, 324000, 360000],
      root_of_all_nature:                    [403750, 475000, 513000, 570000],
    };

    for (const [id, prices] of Object.entries(byDifficulty)) {
      ["easy", "medium", "hard", "impoppable"].forEach((difficulty, i) => {
        expect(getBasePrice(UI_PARAGONS[id].mediumCost, difficulty), `${id} ${difficulty}`)
          .toBe(prices[i]);
      });
    }
  });

  it("includes valid_difficulties array", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    const diffs = res._body.valid_difficulties;
    expect(Array.isArray(diffs)).toBe(true);
    expect(diffs).toContain("easy");
    expect(diffs).toContain("medium");
    expect(diffs).toContain("hard");
    expect(diffs).toContain("impoppable");
  });

  it("includes rate_limits with default and api_key tiers", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    const rl = res._body.rate_limits;
    expect(rl).toBeDefined();
    expect(rl.default.requests_per_minute).toBe(60);
    expect(rl.api_key.requests_per_minute).toBe(300);
  });

  it("sets X-Request-ID header", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    versionHandler(req, res);
    expect(res._headers["x-request-id"]).toBeDefined();
    expect(res._headers["x-request-id"].length).toBeGreaterThan(0);
  });

  it("echoes client-supplied X-Request-ID", () => {
    const clientId = "discord-bot-req-42";
    const { req, res } = makeReqRes({
      method:  "GET",
      headers: { "x-request-id": clientId },
    });
    versionHandler(req, res);
    expect(res._headers["x-request-id"]).toBe(clientId);
  });

  it("OPTIONS returns 204", () => {
    const { req, res } = makeReqRes({ method: "OPTIONS" });
    versionHandler(req, res);
    expect(res.statusCode).toBe(204);
  });

  it("POST returns 405 METHOD_NOT_ALLOWED", () => {
    const { req, res } = makeReqRes({ method: "POST" });
    versionHandler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res._body.error.code).toBe("METHOD_NOT_ALLOWED");
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with success:true and status:ok", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    healthHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.status).toBe("ok");
  });

  it("includes api_version, formula_version, formula_revision", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    healthHandler(req, res);
    expect(res._body.api_version).toBeTypeOf("string");
    expect(res._body.formula_version).toBeTypeOf("string");
    expect(res._body.formula_revision).toBeTypeOf("string");
  });

  it("sets X-Request-ID header", () => {
    const { req, res } = makeReqRes({ method: "GET" });
    healthHandler(req, res);
    expect(res._headers["x-request-id"]).toBeDefined();
  });

  it("OPTIONS returns 204", () => {
    const { req, res } = makeReqRes({ method: "OPTIONS" });
    healthHandler(req, res);
    expect(res.statusCode).toBe(204);
  });

  it("POST returns 405", () => {
    const { req, res } = makeReqRes({ method: "POST" });
    healthHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
