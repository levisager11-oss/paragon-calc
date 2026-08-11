import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("layout contracts", () => {
  it("renders the classic calculator workspace before the first ad slot", () => {
    const app = read("src/App.jsx");
    const workspace = app.indexOf("{/* CORE WORKSPACE */}");
    const topAd = app.indexOf("{/* AD: Top Banner */}");

    expect(workspace).toBeGreaterThan(-1);
    expect(topAd).toBeGreaterThan(-1);
    expect(workspace).toBeLessThan(topAd);
  });

  it("keeps the paragon selector styling in CSS instead of inline spacing", () => {
    const app = read("src/App.jsx");
    const css = read("src/index.css");

    expect(app).toContain('className="paragon-selector-section"');
    expect(app).not.toContain('style={{ marginBottom: "2rem", padding: "2rem 0" }}');
    expect(css).toContain(".paragon-selector-section");
  });

  it("provides a compact mobile overflow menu for secondary build actions", () => {
    const toolbar = read("src/components/BuildToolbar.jsx");
    const css = read("src/components/BuildToolbar.css");

    expect(toolbar).toContain("bt-secondary-actions");
    expect(toolbar).toContain("bt-more-menu");
    expect(css).toMatch(/@media\s*\(max-width:\s*560px\)[\s\S]*\.bt-secondary-actions\s*\{[\s\S]*display:\s*none/);
    expect(css).toMatch(/@media\s*\(max-width:\s*560px\)[\s\S]*\.bt-more-menu\s*\{[\s\S]*display:\s*block/);
    expect(css).toMatch(/@media\s*\(max-width:\s*560px\)[\s\S]*grid-template-columns:\s*1fr/);
    expect(css).toMatch(/@media\s*\(max-width:\s*560px\)[\s\S]*\.bt-more-menu\s*\{[\s\S]*min-width:\s*0;[\s\S]*width:\s*100%/);
  });

  it("keeps the classic More menu above following UI", () => {
    const css = read("src/components/BuildToolbar.css");

    expect(css).toMatch(/\.build-toolbar\s*\{[\s\S]*position:\s*relative;[\s\S]*z-index:\s*20;[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.build-toolbar:has\(\.bt-more-menu\[open\]\)\s*\{[\s\S]*z-index:\s*200/);
    expect(css).toMatch(/\.bt-more-panel\s*\{[\s\S]*z-index:\s*210/);
  });

  it("defines light-mode surfaces for the classic More menu", () => {
    const css = read("src/components/BuildToolbar.css");

    expect(css).toMatch(/\[data-theme="light"\]\s+\.bt-more-panel\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\)/);
    expect(css).toMatch(/\[data-theme="light"\]\s+\.bt-more-panel\s+\.bt-btn\s*\{[\s\S]*background:\s*rgba\(15,\s*23,\s*42,\s*0\.04\)/);
    expect(css).toMatch(/\[data-theme="light"\]\s+\.bt-modal\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\)/);
  });

  it("uses a two-column mobile grid for classic difficulty controls", () => {
    const css = read("src/index.css");

    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)[\s\S]*\.controls-header\s+\.control-group:first-of-type\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });
});
