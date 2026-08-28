// Shared constants imported by all /api/paragon/* handlers.
// Leading underscore on the directory prevents Vercel from treating this as a route.
//
// The paragon roster, power limits and the calculation engine are re-exported
// straight from the app's own modules (src/constants, src/utils) rather than
// copied here. Both are dependency-free ESM with no browser APIs, so they load
// fine in a serverless function — and it means a balance patch only ever has to
// be applied in one place.

export {
  PARAGONS,
  POWER_LIMITS,
  DIFFICULTY_MULTIPLIERS,
} from "../../src/constants/paragons.js";

export {
  MAX_POWER,
  calculateParagonData,
  calculateDegreeFromPower,
  getBasePrice,
  getPowerThreshold,
  maxT5sFor,
} from "../../src/utils/calculator.js";

import { PARAGONS } from "../../src/constants/paragons.js";

export const API_VERSION      = "1.2";
export const FORMULA_VERSION  = "1.2";
// Tracks the BTD6 balance patch the roster, prices and rules are drawn from.
export const FORMULA_REVISION = "btd6-v56.1";

export const VALID_DIFFICULTIES = ["easy", "medium", "hard", "impoppable"];

export const RATE_LIMITS = {
  default: { requests_per_minute: 60,  window: "60s", note: "Applied per IP address." },
  api_key: { requests_per_minute: 300, window: "60s", note: "Set X-API-Key header with a valid key to use the higher limit." },
};

export function validTowerList() {
  return Object.values(PARAGONS).map((p) => ({
    id:      p.id,
    tower:   p.tower,
    paragon: p.name,
  }));
}
