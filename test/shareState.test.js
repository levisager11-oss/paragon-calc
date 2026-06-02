import { describe, it, expect } from "vitest";
import {
  encodeState,
  decodeState,
  hasBuildParams,
  DEFAULT_STATE,
} from "../src/utils/shareState.js";

describe("shareState encode/decode", () => {
  it("round-trips a full build losslessly", () => {
    const s = {
      paragon: "ascended_shadow",
      difficulty: "hard",
      gameMode: "coop",
      pops: 1234567,
      income: 5000,
      upgrades: 42,
      extraT5s: 3,
      sacrificedTowerCash: 250000,
      sliderCash: 10000,
      totems: 7,
    };
    expect(decodeState(encodeState(s))).toEqual(s);
  });

  it("uses a readable paragon slug", () => {
    expect(encodeState({ ...DEFAULT_STATE, paragon: "ascended_shadow" })).toContain(
      "paragon=ascended-shadow"
    );
  });

  it("omits zero numeric fields, which decode back to defaults", () => {
    const q = encodeState({ ...DEFAULT_STATE, paragon: "glaive_dominus", pops: 500000 });
    expect(q).toContain("pops=500000");
    expect(q).not.toContain("totems=");
    expect(decodeState(q)).toEqual({ ...DEFAULT_STATE, paragon: "glaive_dominus", pops: 500000 });
  });

  it("falls back to defaults for empty or invalid input", () => {
    expect(decodeState("")).toEqual(DEFAULT_STATE);
    const bad = decodeState("?paragon=nope&diff=xxx&mode=zzz&pops=-50&t5=999");
    expect(bad.paragon).toBe("apex_plasma_master");
    expect(bad.difficulty).toBe("medium");
    expect(bad.gameMode).toBe("solo");
    expect(bad.pops).toBe(0); // negative clamped up to min
    expect(bad.extraT5s).toBe(9); // clamped down to max
  });

  it("accepts a query string with or without a leading '?'", () => {
    expect(decodeState("?mode=coop").gameMode).toBe("coop");
    expect(decodeState("mode=coop").gameMode).toBe("coop");
  });

  it("detects whether build params are present", () => {
    expect(hasBuildParams("")).toBe(false);
    expect(hasBuildParams("?foo=bar")).toBe(false);
    expect(hasBuildParams("?paragon=glaive-dominus")).toBe(true);
    expect(hasBuildParams("?pops=10")).toBe(true);
  });
});
