import { describe, it, expect, beforeEach } from "vitest";
import handler, { _resetRateLimitForTesting } from "../api/paragon/calculate.js";
import { makeReqRes } from "./helpers.js";

const VALID_BODY = { tower: "Dart Monkey" };

// Use a unique IP prefix per suite so rate-limit state from one describe block
// cannot bleed into another even if test files share a process.
function ip(suffix) {
  return `10.0.0.${suffix}`;
}

beforeEach(() => {
  _resetRateLimitForTesting();
});

// ─── Success ──────────────────────────────────────────────────────────────────

describe("success", () => {
  it("returns 200 with the full result structure for a valid request", () => {
    const { req, res } = makeReqRes({ body: VALID_BODY });
    handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.success).toBe(true);

    const b = res._body;
    expect(b.api_version).toBeDefined();
    expect(b.formula_version).toBeDefined();
    expect(b.formula_revision).toBeDefined();
    expect(b.result).toBeDefined();
    expect(b.result.degree).toBeTypeOf("number");
    expect(b.result.total_power).toBeTypeOf("number");
    expect(b.result.breakdown).toBeDefined();
    expect(b.rate_limit).toBeDefined();
  });

  it("includes formula_version and formula_revision in every success response", () => {
    const { req, res } = makeReqRes({ body: { tower: "Ninja Monkey" } });
    handler(req, res);
    expect(res._body.formula_version).toBeTypeOf("string");
    expect(res._body.formula_revision).toBeTypeOf("string");
  });

  it("sets X-Request-ID header on every response", () => {
    const { req, res } = makeReqRes({ body: VALID_BODY });
    handler(req, res);
    expect(res._headers["x-request-id"]).toBeDefined();
    expect(res._headers["x-request-id"].length).toBeGreaterThan(0);
  });

  it("echoes a client-supplied X-Request-ID", () => {
    const clientId = "my-trace-abc-123";
    const { req, res } = makeReqRes({
      body: VALID_BODY,
      headers: { "x-request-id": clientId },
    });
    handler(req, res);
    expect(res._headers["x-request-id"]).toBe(clientId);
  });

  it("sets X-RateLimit-* headers on successful responses", () => {
    const { req, res } = makeReqRes({ body: VALID_BODY });
    handler(req, res);
    expect(res._headers["x-ratelimit-limit"]).toBeDefined();
    expect(res._headers["x-ratelimit-remaining"]).toBeDefined();
    expect(res._headers["x-ratelimit-reset"]).toBeDefined();
  });

  it("accepts all optional fields and returns correct degree", () => {
    const { req, res } = makeReqRes({
      body: {
        tower:          "Dart Monkey",
        pops:           1000000,
        cash_spent:     50000,
        tier5_count:    1,
        upgrade_count:  50,
        geraldo_totems: 3,
        player_count:   2,
        difficulty:     "hard",
        income:         5000,
        slider_cash:    10000,
      },
    });
    handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.result.degree).toBeGreaterThanOrEqual(1);
  });

  it("accepts paragon ID as tower identifier", () => {
    const { req, res } = makeReqRes({ body: { tower: "apex_plasma_master" } });
    handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.result.paragon.id).toBe("apex_plasma_master");
  });

  it("accepts paragon name as tower identifier", () => {
    const { req, res } = makeReqRes({ body: { tower: "Apex Plasma Master" } });
    handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("accepts 'paragon' as an alias for 'tower'", () => {
    const { req, res } = makeReqRes({ body: { paragon: "Dart Monkey" } });
    handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

// ─── OPTIONS / method guard ───────────────────────────────────────────────────

describe("method handling", () => {
  it("OPTIONS returns 204 with no body", () => {
    const { req, res } = makeReqRes({ method: "OPTIONS", body: {} });
    handler(req, res);
    expect(res.statusCode).toBe(204);
  });

  it("GET returns 405 METHOD_NOT_ALLOWED", () => {
    const { req, res } = makeReqRes({ method: "GET", body: {} });
    handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res._body.success).toBe(false);
    expect(res._body.error.code).toBe("METHOD_NOT_ALLOWED");
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe("validation errors", () => {
  it("missing tower returns 400 MISSING_FIELD", () => {
    const { req, res } = makeReqRes({ body: {} });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.success).toBe(false);
    expect(res._body.error.code).toBe("MISSING_FIELD");
    expect(res._body.error.field).toBe("tower");
  });

  it("unknown tower returns 400 UNKNOWN_TOWER with valid_towers list", () => {
    const { req, res } = makeReqRes({ body: { tower: "Banana Monkey" } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("UNKNOWN_TOWER");
    expect(Array.isArray(res._body.error.valid_towers)).toBe(true);
    expect(res._body.error.valid_towers.length).toBe(13);
    expect(res._body.error.valid_towers[0]).toHaveProperty("id");
    expect(res._body.error.valid_towers[0]).toHaveProperty("tower");
    expect(res._body.error.valid_towers[0]).toHaveProperty("paragon");
  });

  it("negative pops returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", pops: -1 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("pops");
  });

  it("NaN pops returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", pops: "NaN" } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("pops");
  });

  it("Infinity cash_spent returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", cash_spent: Infinity } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("cash_spent");
  });

  it("string 'Infinity' cash_spent returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", cash_spent: "Infinity" } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
  });

  it("non-integer tier5_count returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", tier5_count: 1.5 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("tier5_count");
  });

  it("non-integer upgrade_count returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", upgrade_count: 3.7 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("upgrade_count");
  });

  it("non-integer geraldo_totems returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", geraldo_totems: 0.5 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("geraldo_totems");
  });

  it("invalid difficulty returns 400 INVALID_FIELD with valid_difficulties hint", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", difficulty: "extreme" } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("difficulty");
    expect(Array.isArray(res._body.error.valid_difficulties)).toBe(true);
  });

  it("player_count of 0 returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", player_count: 0 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("player_count");
  });

  it("player_count of 5 returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", player_count: 5 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("player_count");
  });

  it("non-integer player_count returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", player_count: 1.5 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("player_count");
  });

  it("negative income returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", income: -500 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("income");
  });

  it("negative slider_cash returns 400 INVALID_FIELD", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", slider_cash: -1 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error.code).toBe("INVALID_FIELD");
    expect(res._body.error.field).toBe("slider_cash");
  });

  it("error responses include X-Request-ID header", () => {
    const { req, res } = makeReqRes({ body: { tower: "Dart Monkey", pops: -1 } });
    handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._headers["x-request-id"]).toBeDefined();
  });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe("rate limiting", () => {
  it("allows 60 requests from the same IP within the window", () => {
    for (let i = 0; i < 60; i++) {
      const { req, res } = makeReqRes({
        body: VALID_BODY,
        headers: { "x-forwarded-for": ip(200) },
      });
      handler(req, res);
      expect(res.statusCode).toBe(200);
    }
  });

  it("returns 429 on the 61st request from the same IP", () => {
    for (let i = 0; i < 60; i++) {
      const { req, res } = makeReqRes({
        body: VALID_BODY,
        headers: { "x-forwarded-for": ip(201) },
      });
      handler(req, res);
    }
    const { req, res } = makeReqRes({
      body: VALID_BODY,
      headers: { "x-forwarded-for": ip(201) },
    });
    handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res._body.success).toBe(false);
    expect(res._body.error.code).toBe("RATE_LIMITED");
  });

  it("429 response includes Retry-After header", () => {
    for (let i = 0; i < 61; i++) {
      const { req, res } = makeReqRes({
        body: VALID_BODY,
        headers: { "x-forwarded-for": ip(202) },
      });
      handler(req, res);
    }
    const { req, res } = makeReqRes({
      body: VALID_BODY,
      headers: { "x-forwarded-for": ip(202) },
    });
    handler(req, res);
    expect(res._headers["retry-after"]).toBeDefined();
    expect(Number(res._headers["retry-after"])).toBeGreaterThan(0);
  });

  it("X-RateLimit-Remaining decrements on each request", () => {
    const makeCall = () => {
      const { req, res } = makeReqRes({
        body: VALID_BODY,
        headers: { "x-forwarded-for": ip(203) },
      });
      handler(req, res);
      return Number(res._headers["x-ratelimit-remaining"]);
    };

    const first  = makeCall();
    const second = makeCall();
    expect(second).toBe(first - 1);
  });

  it("different IPs have independent rate limit counters", () => {
    // Exhaust limit for IP 204
    for (let i = 0; i < 61; i++) {
      const { req, res } = makeReqRes({
        body: VALID_BODY,
        headers: { "x-forwarded-for": ip(204) },
      });
      handler(req, res);
    }
    // IP 205 should still be allowed
    const { req, res } = makeReqRes({
      body: VALID_BODY,
      headers: { "x-forwarded-for": ip(205) },
    });
    handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("429 body includes rate_limit object with retry_after", () => {
    for (let i = 0; i < 61; i++) {
      const { req, res } = makeReqRes({
        body: VALID_BODY,
        headers: { "x-forwarded-for": ip(206) },
      });
      handler(req, res);
    }
    const { req, res } = makeReqRes({
      body: VALID_BODY,
      headers: { "x-forwarded-for": ip(206) },
    });
    handler(req, res);
    expect(res._body.error.retry_after).toBeGreaterThan(0);
    expect(res._body.rate_limit.limit).toBe(60);
    expect(res._body.rate_limit.remaining).toBe(0);
  });
});
