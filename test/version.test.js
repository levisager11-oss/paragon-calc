import { describe, it, expect } from "vitest";
import versionHandler from "../api/paragon/version.js";
import healthHandler  from "../api/health.js";
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
