import { useState, useMemo } from "react";
import { PARAGONS, DIFFICULTY_MULTIPLIERS } from "../constants/paragons.js";
import { calculateParagonData, getBasePrice } from "../utils/calculator.js";
import { decodeState, buildShareUrl } from "../utils/shareState.js";

const ACCENT = { primary: "#ff5722", military: "#4caf50", magic: "#9c27b0", support: "#ffb300" };

const BREAKDOWN = [
  { key: "pops", label: "Pops & Income", color: "#0ea5e9" },
  { key: "upgrades", label: "Upgrades", color: "#22c55e" },
  { key: "cash", label: "Cash", color: "#f59e0b" },
  { key: "t5", label: "Extra T5s", color: "#a855f7" },
];

const clampNum = (v, min, max) => {
  const n = parseInt(String(v).replace(/,/g, ""), 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

/**
 * Compact, ad-free calculator for embedding via <iframe> on other sites. Reads
 * its initial build from the URL (shared share-state), stays interactive, and
 * links back to the full calculator with the current build preserved.
 */
export default function EmbedCalculator() {
  const initial = useMemo(() => decodeState(window.location.search), []);
  const [paragonId, setParagonId] = useState(initial.paragon);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [gameMode, setGameMode] = useState(initial.gameMode);
  const [pops, setPops] = useState(initial.pops);
  const [income, setIncome] = useState(initial.income);
  const [upgrades, setUpgrades] = useState(initial.upgrades);
  const [extraT5s, setExtraT5s] = useState(initial.extraT5s);
  const [sacrificedTowerCash, setSacrificedTowerCash] = useState(initial.sacrificedTowerCash);
  const [sliderCash, setSliderCash] = useState(initial.sliderCash);
  const [totems, setTotems] = useState(initial.totems);

  const paragon = PARAGONS[paragonId] || PARAGONS.apex_plasma_master;
  const maxT5 = gameMode === "coop" ? 9 : paragonId === "apex_plasma_master" ? 1 : 0;
  const effT5 = Math.min(extraT5s, maxT5);
  const basePrice = getBasePrice(paragon.mediumCost, difficulty);
  const accent = ACCENT[paragon.category] || "#06b6d4";

  const results = useMemo(
    () => calculateParagonData({
      paragon, difficulty, gameMode, pops, income, upgrades,
      extraT5s: effT5, sacrificedTowerCash, sliderCash, totems,
    }),
    [paragon, difficulty, gameMode, pops, income, upgrades, effT5, sacrificedTowerCash, sliderCash, totems]
  );

  const fullUrl = buildShareUrl(
    { paragon: paragonId, difficulty, gameMode, pops, income, upgrades, extraT5s: effT5, sacrificedTowerCash, sliderCash, totems },
    { path: "/classic" }
  );

  return (
    <div className="embed" style={{ "--accent": accent }}>
      <div className="embed-top">
        <a className="embed-brand" href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img src="/logo.png" alt="" width="22" height="22" /> BTD6 Paragon Calculator
        </a>
        <span className="embed-deg">Degree {results.degree}</span>
      </div>

      <div className="embed-grid">
        <div className="embed-gauge">
          <div className="embed-ring" style={{ "--pct": `${results.degree}%` }}>
            <span className="embed-ring-deg">{results.degree}</span>
            <span className="embed-ring-pow">{results.totalPower.toLocaleString()}<br />/ 200,000</span>
          </div>
          <div className="embed-bars">
            {BREAKDOWN.map((b) => {
              const pb = results.powerBreakdown[b.key];
              return (
                <div key={b.key} className="embed-bar-row">
                  <span className="embed-bar-label">{b.label}</span>
                  <span className="embed-bar-track">
                    <span className="embed-bar-fill" style={{ width: `${Math.min(100, pb.pct || 0)}%`, background: b.color }} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="embed-controls">
          <select className="embed-select" value={paragonId} onChange={(e) => setParagonId(e.target.value)} aria-label="Paragon">
            {Object.values(PARAGONS).map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
            ))}
          </select>

          <div className="embed-row2">
            <select className="embed-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
              {Object.keys(DIFFICULTY_MULTIPLIERS).map((k) => (
                <option key={k} value={k}>{DIFFICULTY_MULTIPLIERS[k].name}</option>
              ))}
            </select>
            <div className="embed-toggle">
              <button className={gameMode === "solo" ? "on" : ""} onClick={() => setGameMode("solo")}>Solo</button>
              <button className={gameMode === "coop" ? "on" : ""} onClick={() => setGameMode("coop")}>Co-op</button>
            </div>
          </div>

          <div className="embed-fields">
            <Field label="Pops" value={pops} onChange={(v) => setPops(clampNum(v, 0, 16200000))} />
            <Field label="Income $" value={income} onChange={(v) => setIncome(clampNum(v, 0, 4050000))} />
            <Field label="Upgrades" value={upgrades} onChange={(v) => setUpgrades(clampNum(v, 0, 100))} />
            <Field label="Extra T5s" value={effT5} onChange={(v) => setExtraT5s(clampNum(v, 0, maxT5))} disabled={maxT5 === 0} />
            <Field label="Sacrifice $" value={sacrificedTowerCash} onChange={(v) => setSacrificedTowerCash(clampNum(v, 0, 100000000))} />
            <Field label="Slider $" value={sliderCash} onChange={(v) => setSliderCash(clampNum(v, 0, Math.round(basePrice * 3.15)))} />
            <Field label="Totems" value={totems} onChange={(v) => setTotems(clampNum(v, 0, 1000))} />
          </div>
        </div>
      </div>

      <a className="embed-cta" href={fullUrl} target="_blank" rel="noopener noreferrer">Open full calculator ↗</a>
    </div>
  );
}

function Field({ label, value, onChange, disabled }) {
  return (
    <label className={`embed-field ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={value.toLocaleString()}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
