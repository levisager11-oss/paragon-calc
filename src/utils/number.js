// Parse a whole number out of free-form text typed into a numeric field.
//
// The inputs display their value with toLocaleString(), so the grouping
// separator depends on the visitor's locale: "1,200,000" in en-US, "1.200.000"
// in de-DE, "1’200’000" in de-CH, "1 200 000" in fr-FR. Stripping only commas
// made parseInt stop at the first "." or space, so typing in any non-English
// locale collapsed the value to its leading digits. Every field here is a
// non-negative integer, so dropping everything that is not a digit is exact.
export function parseWholeNumber(text) {
  const digits = String(text ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}
