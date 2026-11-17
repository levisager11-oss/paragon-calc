import { describe, it, expect } from "vitest";
import { parseWholeNumber } from "../src/utils/number.js";

describe("parseWholeNumber", () => {
  it("reads a value however the visitor's locale groups it", () => {
    expect(parseWholeNumber("1,234,567")).toBe(1234567); // en-US
    expect(parseWholeNumber("1.234.567")).toBe(1234567); // de-DE
    expect(parseWholeNumber("1’234’567")).toBe(1234567); // de-CH
    expect(parseWholeNumber("1 234 567")).toBe(1234567); // fr-FR (narrow nbsp)
  });
  it("treats empty or non-numeric text as zero", () => {
    expect(parseWholeNumber("")).toBe(0);
    expect(parseWholeNumber("abc")).toBe(0);
    expect(parseWholeNumber(undefined)).toBe(0);
  });
});
