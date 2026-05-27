/**
 * GET /api/health
 * Minimal liveness check.  Returns status + version info without the full tower list.
 * For the complete discovery response (towers, rate limits, etc.) use GET /api/paragon/version.
 */

import { randomUUID } from "node:crypto";
import { API_VERSION, FORMULA_VERSION, FORMULA_REVISION } from "./_lib/shared.js";

export default function handler(req, res) {
  const requestId = (req.headers["x-request-id"] || "").trim() || randomUUID();

  res.setHeader("Access-Control-Allow-Origin",   "*");
  res.setHeader("Access-Control-Allow-Methods",  "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",  "Content-Type, X-Request-ID");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-ID");
  res.setHeader("X-Request-ID", requestId);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: {
        code:    "METHOD_NOT_ALLOWED",
        message: "This endpoint only accepts GET requests.",
      },
    });
  }

  return res.status(200).json({
    success:          true,
    status:           "ok",
    api_version:      API_VERSION,
    formula_version:  FORMULA_VERSION,
    formula_revision: FORMULA_REVISION,
  });
}
