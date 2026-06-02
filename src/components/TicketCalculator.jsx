import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { PARAGONS } from "../constants/paragons";
import {
  calculateParagonData,
  getBasePrice,
  reverseCalculate,
  splitIntoSacrificeTowers,
} from "../utils/calculator";
import AdUnit from "./AdUnit";
import "./TicketCalculator.css";

/* ────────────────────────────────────────────────────────────────────────
 * Neo-brutalist "arcade ticket" alternate design.
 *
 * Reuses the exact same calculation engine as the classic UI
 * (src/utils/calculator.js) — only the presentation differs. This layout has
 * full feature parity with the classic design: paragon search, related
 * suggestions, key capabilities, a tower-pop adder, the slider→sacrifice cash
 * optimizer, the Goal Planner, the formulas guide and the privacy policy.
 * ──────────────────────────────────────────────────────────────────────── */

// Short monograms for the paragon rail tiles.
const MONO = {
  apex_plasma_master: "AP",
  glaive_dominus: "GD",
  crucible_of_steel_and_flame: "CR",
  ballistic_obliteration_missile_bunker: "BO",
  herald_of_everfrost: "HE",
  ascended_shadow: "AS",
  magus_perfectus: "MP",
  root_of_all_nature: "RN",
  navarch_of_the_seas: "NS",
  nautic_siege_core: "NC",
  goliath_doomship: "GO",
  master_builder: "MB",
  mega_massive_munitions_factory: "MM",
};

// Display order grouped by category, matching the original concept's rail.
const RAIL_ORDER = [
  "apex_plasma_master", "glaive_dominus", "crucible_of_steel_and_flame",
  "ballistic_obliteration_missile_bunker", "herald_of_everfrost",
  "ascended_shadow", "magus_perfectus", "root_of_all_nature",
  "navarch_of_the_seas", "nautic_siege_core", "goliath_doomship",
  "master_builder", "mega_massive_munitions_factory",
];

const PARAGON_LIST = RAIL_ORDER
  .filter((id) => PARAGONS[id])
  .map((id) => ({ ...PARAGONS[id], mono: MONO[id] || PARAGONS[id].name.slice(0, 2).toUpperCase() }));

const DIFFS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "impoppable", label: "Impop" },
];
const MODES = [
  { value: "solo", label: "Solo" },
  { value: "coop", label: "Co-op" },
];
const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const STRATEGIES = [
  { value: "leastCash", label: "Least Cash" },
  { value: "balanced", label: "Balanced" },
  { value: "leastPops", label: "Least Pops" },
];
const CASH_MODES = [
  { value: "none", label: "None" },
  { value: "sacrifice", label: "Sacrifice" },
  { value: "slider", label: "Slider" },
  { value: "both", label: "Both" },
];

const DEFAULTS = {
  paragonId: "apex_plasma_master",
  difficulty: "medium",
  mode: "solo",
  pops: 0,
  income: 0,
  upgrades: 0,
  extraT5s: 0,
  sacrificeCash: 0,
  sliderCash: 0,
  totems: 0,
};

const STORAGE_KEY = "paragon-calc-ticket-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function maxT5sFor(paragon, gameMode) {
  if (gameMode === "coop") return 9;
  if (paragon.id === "apex_plasma_master") return 1;
  return 0;
}

// ── formatting helpers ──────────────────────────────────────────────────
const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
const fmtCash = (n) => "$" + Math.round(n).toLocaleString("en-US");
function fmtCompact(n) {
  if (n >= 1e6) { const v = n / 1e6; return (Number.isInteger(v) ? v : +v.toFixed(2)) + "M"; }
  if (n >= 1e3) { const v = n / 1e3; return (Number.isInteger(v) ? v : +v.toFixed(1)) + "k"; }
  return String(Math.round(n));
}

// ── small controls ──────────────────────────────────────────────────────
function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={"seg-btn" + (value === o.value ? " on" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, onChange, min = 0, max = 999, suffix }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      <button type="button" className="step-btn" onClick={() => set(value - 1)} disabled={value <= min}>–</button>
      <div className="step-val">{value}{suffix ? <span className="step-suffix">{suffix}</span> : null}</div>
      <button type="button" className="step-btn" onClick={() => set(value + 1)} disabled={value >= max}>+</button>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={"tsw" + (checked ? " on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span className="tsw-knob" />
    </button>
  );
}

function NumberSlider({ value, onChange, max, step = 1, money = false, quick = [] }) {
  const [text, setText] = useState(fmtNum(value));
  // Re-sync the editable text when the value changes from the outside (slider,
  // quick buttons, reset) using React's "adjust state during render" pattern.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(fmtNum(value));
  }

  const commit = (raw) => {
    const cleaned = String(raw).replace(/[^0-9.]/g, "");
    let n = parseFloat(cleaned);
    if (isNaN(n)) n = 0;
    n = Math.max(0, Math.min(max, n));
    onChange(n);
  };

  return (
    <div className="nslider">
      <div className="nslider-top">
        <div className="nfield">
          {money ? <span className="nfield-prefix">$</span> : null}
          <input
            className="nfield-input"
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          />
        </div>
        {quick.length ? (
          <div className="quick">
            {quick.map((q) => (
              <button key={q.label} type="button" className="quick-btn" onClick={() => commit(q.value)}>{q.label}</button>
            ))}
          </div>
        ) : null}
      </div>
      <input
        type="range"
        className="range"
        min={0}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function Field({ label, hint, badge, badgeMax, children }) {
  return (
    <div className="field">
      <div className="field-head">
        <div className="field-headl">
          <div className="field-label">{label}</div>
          {hint ? <div className="field-hint">{hint}</div> : null}
        </div>
        <div className={"field-badge" + (badgeMax ? " max" : "")}>{badge}</div>
      </div>
      <div className="field-body">{children}</div>
    </div>
  );
}

// ── the live result "ticket" ────────────────────────────────────────────
function Ticket({ data, paragon, difficulty, mode }) {
  const bk = data.powerBreakdown;
  const CH = [
    { key: "pops", label: "Pops & Income", accent: "var(--accent)" },
    { key: "upgrades", label: "Upgrade Tiers", accent: "var(--accent)" },
    { key: "cash", label: "Cash Invested", accent: "var(--accent)" },
    { key: "t5", label: "Extra T5s", accent: "var(--accent)" },
    { key: "totems", label: "Geraldo Totems", accent: "var(--blue)" },
  ];

  const degree = data.degree;
  const atMax = degree >= 100;
  const totalPct = Math.min(100, (data.totalPower / 200000) * 100);
  const isMaxed = (b) => b.max != null && b.power >= b.max;

  const BreakBar = ({ ch }) => {
    const b = bk[ch.key];
    const maxed = isMaxed(b);
    const pct = b.max ? Math.min(100, (b.power / b.max) * 100) : (b.power > 0 ? 100 : 0);
    return (
      <div className="bk-row">
        <div className="bk-label">{ch.label}</div>
        <div className="bk-track">
          <div className="bk-fill" style={{ width: pct + "%", background: maxed ? "var(--green)" : ch.accent, borderRight: pct > 0 && pct < 100 ? "2.5px solid var(--ink)" : "none" }}></div>
        </div>
        <div className="bk-val">
          {maxed ? <span className="bk-max">MAX ✓</span>
            : b.max ? <span><b>{fmtCompact(b.power)}</b><span className="bk-cap"> / {fmtCompact(b.max)}</span></span>
            : b.power > 0 ? <span><b>+{fmtCompact(b.power)}</b></span>
            : <span className="bk-cap">—</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="ticket">
      {/* HERO */}
      <div className="ticket-hero">
        <div className="hero-top">
          <div>
            <div className="hero-cap">Resulting Degree</div>
            <div className="hero-sub">{paragon.name}</div>
          </div>
          <div className="hero-config">
            <span>{difficulty}</span><span className="dot">•</span><span>{mode}</span>
          </div>
        </div>
        <div className="hero-degree">{degree}<span className="hero-of">/100</span></div>

        <div className="hero-power">
          <div className="hp-row">
            <span className="hp-val">{fmtNum(data.totalPower)}</span>
            <span className="hp-cap">/ 200,000 power</span>
          </div>
          <div className="hp-track">
            <div className="hp-fill" style={{ width: totalPct + "%" }}></div>
          </div>
        </div>

        <div className="hero-gap">
          {atMax ? (
            <span className="gap-max">★ MAXED — Degree 100 reached</span>
          ) : (
            <span><b>{fmtNum(data.powerGap)}</b> power from Degree {data.nextDegree} →</span>
          )}
        </div>
      </div>

      {/* BREAKDOWN */}
      <div className="ticket-body">
        <span className="notch-l"></span><span className="notch-r"></span>
        <div className="body-head">Power Breakdown</div>
        <div className="bk-list">
          {CH.map((ch) => <BreakBar key={ch.key} ch={ch} />)}
        </div>

        {/* ROAD */}
        {!atMax && data.recommendations.length > 0 && (
          <div className="road">
            <div className="road-head">
              <span className="road-title">Road to Degree {data.nextDegree}</span>
              <span className="road-pick">pick one</span>
            </div>
            <div className="road-cards">
              {data.recommendations.map((r, i) => {
                const map = {
                  pops: { unit: "More pops", big: fmtNum(r.value), note: "or " + fmtCash(Math.ceil(r.value / 4)) + " income" },
                  cash_sacrifice: { unit: "Tower sacrifice", big: fmtCash(r.value), note: "100% efficient" },
                  cash_slider: { unit: "Cash slider", big: fmtCash(r.value), note: "+5% premium" },
                  totems: { unit: "Geraldo totems", big: r.value + (r.value === 1 ? " totem" : " totems"), note: "+2,000 power each" },
                }[r.type];
                if (!map) return null;
                const primary = r.type === "totems";
                return (
                  <div key={i} className={"road-card" + (primary ? " primary" : "")}>
                    <div className="rc-unit">{map.unit}</div>
                    <div className="rc-big">{map.big}</div>
                    <div className="rc-note">{map.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WARNINGS */}
        {data.warnings.length > 0 && (
          <div className="warns">
            {data.warnings.map((w, i) => (
              <div key={i} className="warn">
                <span className="warn-bang">!</span>
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── selected-paragon detail: key capabilities + related paragons ─────────
function ParagonDetail({ paragon, basePrice, related, onSelect }) {
  return (
    <div className="pdetail">
      <div className="pd-main">
        <div className="pd-head">
          <div className="pd-mono">{paragon.mono}</div>
          <div className="pd-headinfo">
            <div className="pd-name">{paragon.name}</div>
            <div className="pd-tower">{paragon.tower} · <span className="pd-cat">{paragon.category}</span></div>
          </div>
          <div className="pd-price">{fmtCash(basePrice)}</div>
        </div>
        <div className="pd-ab-title">Key Capabilities</div>
        <ul className="pd-abilities">
          {paragon.abilities.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
      <div className="pd-related">
        <div className="pd-rel-title">Related</div>
        <div className="pd-rel-list">
          {related.map((p) => (
            <button key={p.id} type="button" className="rel-chip" onClick={() => onSelect(p.id)}>
              <span className="rel-mono">{p.mono}</span>
              <span className="rel-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── tower-pop adder modal ─────────────────────────────────────────────────
function PopAdder({ onClose, onApply }) {
  const [entries, setEntries] = useState([""]);
  const refs = useRef([]);

  const total = useMemo(
    () => entries.reduce((sum, v) => sum + (parseInt(v.replace(/,/g, "")) || 0), 0),
    [entries]
  );

  useEffect(() => {
    setTimeout(() => { if (refs.current[0]) refs.current[0].focus(); }, 50);
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleChange = (idx, val) => {
    setEntries((prev) => { const next = [...prev]; next[idx] = val; return next; });
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setEntries((prev) => [...prev.slice(0, idx + 1), "", ...prev.slice(idx + 1)]);
      setTimeout(() => { const r = refs.current[idx + 1]; if (r) r.focus(); }, 0);
    } else if (e.key === "Backspace" && entries[idx] === "" && entries.length > 1) {
      e.preventDefault();
      setEntries((prev) => prev.filter((_, i) => i !== idx));
      setTimeout(() => { const r = refs.current[Math.max(0, idx - 1)]; if (r) r.focus(); }, 0);
    }
  };

  const removeEntry = (idx) => {
    setEntries((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx)));
  };

  return (
    <div className="padder-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="padder-modal">
        <div className="padder-head">
          <span className="padder-title">▦ Tower Pop Counter</span>
          <button type="button" className="padder-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="padder-hint">
          Enter each tower's pop count. Press <kbd>Enter</kbd> to add a row, <kbd>Backspace</kbd> on an empty row to remove it.
        </p>
        <div className="padder-list">
          {entries.map((val, idx) => (
            <div key={idx} className="padder-row">
              <span className="padder-idx">{idx + 1}</span>
              <input
                ref={(el) => (refs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                className="padder-input"
                placeholder="e.g. 350,000"
                value={val}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
              />
              <button type="button" className="padder-remove" tabIndex={-1} aria-label="Remove" onClick={() => removeEntry(idx)}>✕</button>
            </div>
          ))}
          <button
            type="button"
            className="padder-addrow"
            onClick={() => {
              setEntries((prev) => [...prev, ""]);
              setTimeout(() => { const r = refs.current[entries.length]; if (r) r.focus(); }, 0);
            }}
          >
            + Add row
          </button>
        </div>
        <div className="padder-foot">
          <div className="padder-total">Total: <strong>{total.toLocaleString()}</strong> pops</div>
          <div className="padder-actions">
            <button type="button" className="padder-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="padder-apply" onClick={() => onApply(total)}>Apply to Pops</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Goal Planner ──────────────────────────────────────────────────────────
function GoalPlanner({ paragon, difficulty, mode, maxT5s }) {
  const [targetDegree, setTargetDegree] = useState(100);
  const [useExtraT5s, setUseExtraT5s] = useState(true);
  const [useUpgrades, setUseUpgrades] = useState(true);
  const [cashMode, setCashMode] = useState("sacrifice");
  const [useTotems, setUseTotems] = useState(true);
  const [strategy, setStrategy] = useState("leastCash");

  const res = useMemo(() => reverseCalculate({
    paragon,
    difficulty,
    gameMode: mode,
    targetDegree,
    useExtraT5s,
    useUpgrades,
    useSacrificeCash: cashMode === "sacrifice" || cashMode === "both",
    useSliderCash: cashMode === "slider" || cashMode === "both",
    useTotems,
    strategy,
  }), [paragon, difficulty, mode, targetDegree, useExtraT5s, useUpgrades, cashMode, useTotems, strategy]);

  const cashSub = cashMode === "sacrifice" ? "100% efficient — tower sacrifices"
    : cashMode === "slider" ? "95% efficient — in-game slider"
    : cashMode === "both" ? "50/50 split — sacrifice + slider"
    : "disabled";

  const toggles = [
    { label: "Extra T5s", sub: `max ${maxT5s} in ${mode}`, state: useExtraT5s, set: setUseExtraT5s },
    { label: "Upgrade Tiers", sub: "max 100 upgrades (10,000 pts)", state: useUpgrades, set: setUseUpgrades },
    { label: "Geraldo Totems", sub: "+2,000 pts each", state: useTotems, set: setUseTotems },
  ];

  return (
    <section className="goal">
      <div className="goal-top">
        <div>
          <div className="goal-title">Goal Planner</div>
          <div className="goal-sub">Set a target degree — the calculator finds the optimal path.</div>
        </div>
        <Segmented value={strategy} onChange={setStrategy} options={STRATEGIES} />
      </div>

      <div className="goal-body">
        {/* CONTROLS */}
        <div className="goal-controls">
          <div className="goal-block">
            <div className="goal-block-head">
              <span className="goal-block-label">Target Degree</span>
              <span className="goal-block-badge">{res.targetPower.toLocaleString()} pts</span>
            </div>
            <div className="goal-degree">
              <Stepper value={targetDegree} onChange={setTargetDegree} min={2} max={100} />
              <input
                type="range" min={2} max={100}
                className="range"
                value={targetDegree}
                onChange={(e) => setTargetDegree(parseInt(e.target.value))}
              />
            </div>
            <div className="goal-quick">
              {[50, 60, 70, 80, 90, 100].map((d) => (
                <button key={d} type="button" className="goal-qbtn" onClick={() => setTargetDegree(d)}>Deg {d}</button>
              ))}
            </div>
          </div>

          <div className="goal-block">
            <div className="goal-block-head">
              <span className="goal-block-label">Available Sources</span>
            </div>
            <div className="goal-toggles">
              {toggles.map(({ label, sub, state, set }) => (
                <div key={label} className="gtoggle">
                  <div className="gtoggle-text">
                    <span className="gtoggle-label">{label}</span>
                    <span className="gtoggle-sub">{sub}</span>
                  </div>
                  <Toggle checked={state} onChange={set} />
                </div>
              ))}
              <div className="gtoggle gtoggle-cash">
                <div className="gtoggle-text">
                  <span className="gtoggle-label">Cash Investment</span>
                  <span className="gtoggle-sub">{cashSub}</span>
                </div>
                <Segmented value={cashMode} onChange={setCashMode} options={CASH_MODES} />
              </div>
            </div>
          </div>
        </div>

        {/* RESULTS */}
        <div className="goal-results">
          {!res.achievable ? (
            <div className="goal-impossible">
              <span className="gi-bang">!</span>
              <div>
                <strong>Not achievable</strong> with these sources.
                <p>Still need <strong>{res.remainingPower.toLocaleString()} more power</strong>. Enable Cash or Totems to fill the gap.</p>
              </div>
            </div>
          ) : (
            <div className="goal-rows">
              <div className="goal-row">
                <span className="goal-row-label">Pops &amp; Income</span>
                <span className="goal-row-value">{res.popsNeeded.toLocaleString()}</span>
                {res.popsMaxed && <span className="goal-badge maxed">MAXED</span>}
              </div>
              <div className={"goal-row" + (!useUpgrades ? " off" : "")}>
                <span className="goal-row-label">Upgrade Tiers</span>
                <span className="goal-row-value">{res.upgradesNeeded}</span>
                {res.upgradesMaxed && <span className="goal-badge maxed">MAXED</span>}
                {!useUpgrades && <span className="goal-badge offb">OFF</span>}
              </div>
              <div className={"goal-row" + (!useExtraT5s ? " off" : "")}>
                <span className="goal-row-label">Extra T5s</span>
                <span className="goal-row-value">{res.t5sNeeded}</span>
                {res.t5sMaxed && <span className="goal-badge maxed">MAXED</span>}
                {!useExtraT5s && <span className="goal-badge offb">OFF</span>}
              </div>
              {res.sacrificeCashNeeded > 0 && (
                <div className="goal-row">
                  <span className="goal-row-label">Cash Sacrifice</span>
                  <span className="goal-row-value">{fmtCash(res.sacrificeCashNeeded)}</span>
                </div>
              )}
              {res.sliderCashNeeded > 0 && (
                <div className="goal-row">
                  <span className="goal-row-label">Cash Slider</span>
                  <span className="goal-row-value">{fmtCash(res.sliderCashNeeded)}</span>
                </div>
              )}
              <div className={"goal-row" + (!useTotems ? " off" : "")}>
                <span className="goal-row-label">Geraldo Totems</span>
                <span className="goal-row-value">{res.totemsNeeded}</span>
                {!useTotems && <span className="goal-badge offb">OFF</span>}
              </div>

              <div className={"goal-total" + (res.totalCashNeeded === 0 ? " free" : "")}>
                <span>{res.totalCashNeeded > 0 ? "Total cash investment" : "No cash investment needed"}</span>
                <strong>{fmtCash(res.totalCashNeeded)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── the alternate calculator ────────────────────────────────────────────
export default function TicketCalculator({ designMode, onSetDesign, lightMode, onSetTheme }) {
  const [st, setSt] = useState(loadState);
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));

  const [search, setSearch] = useState("");
  const [popAdderOpen, setPopAdderOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch { /* ignore */ }
  }, [st]);

  const paragon = useMemo(
    () => PARAGON_LIST.find((p) => p.id === st.paragonId) || PARAGON_LIST[0],
    [st.paragonId]
  );
  const maxT5s = maxT5sFor(paragon, st.mode);

  // Clamp extra T5s when the mode/paragon changes (adjust during render so the
  // result stays consistent before paint, no cascading effect).
  if (st.extraT5s > maxT5s) {
    setSt((s) => (s.extraT5s > maxT5s ? { ...s, extraT5s: maxT5s } : s));
  }

  const basePrice = getBasePrice(paragon.mediumCost, st.difficulty);
  const maxSlider = Math.round(basePrice * 3.15);
  const capSacrifice = Math.round(basePrice * 3);

  // Cost of the most expensive sacrificeable non-T5 tower (a T4 + crosspath),
  // scaled to difficulty. Drives the slider→sacrifice optimizer.
  const maxT4Cost = paragon.maxT4MediumCost ? getBasePrice(paragon.maxT4MediumCost, st.difficulty) : 0;
  const sliderTowerSplit = useMemo(
    () => splitIntoSacrificeTowers(st.sliderCash, maxT4Cost),
    [st.sliderCash, maxT4Cost]
  );

  // Move whole sacrifice-tower chunks off the (95% efficient) slider onto the
  // (100% efficient) sacrifice total, leaving only the sub-tower remainder.
  const optimizeCash = () => {
    const { sacrificeCash, remainder } = splitIntoSacrificeTowers(st.sliderCash, maxT4Cost);
    if (sacrificeCash <= 0) return;
    set({ sacrificeCash: st.sacrificeCash + sacrificeCash, sliderCash: remainder });
  };

  // Live search over the paragon rail (name / tower / category).
  const visibleParagons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PARAGON_LIST;
    return PARAGON_LIST.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.tower.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [search]);

  // Related suggestions: same-category paragons first, then the rest.
  const related = useMemo(() => {
    const all = PARAGON_LIST.filter((p) => p.id !== st.paragonId);
    const same = all.filter((p) => p.category === paragon.category);
    const others = all.filter((p) => p.category !== paragon.category);
    return [...same, ...others].slice(0, 3);
  }, [st.paragonId, paragon]);

  const selectParagon = useCallback((id) => {
    set({ paragonId: id });
    setSearch("");
  }, []);

  const data = useMemo(() => calculateParagonData({
    paragon,
    difficulty: st.difficulty,
    gameMode: st.mode,
    pops: st.pops,
    income: st.income,
    upgrades: st.upgrades,
    extraT5s: st.extraT5s,
    sacrificedTowerCash: st.sacrificeCash,
    sliderCash: st.sliderCash,
    totems: st.totems,
  }), [st, paragon]);

  const bk = data.powerBreakdown;
  const isMax = (b) => b.max != null && b.power >= b.max;
  const badge = (b) => isMax(b) ? "MAX" : b.power > 0 ? "+" + fmtCompact(b.power) : "—";

  const t5Hint = st.mode === "coop" ? "Co-op — up to 9 · 6,000 pwr each"
    : paragon.id === "apex_plasma_master" ? "Solo — Dart Monkey only, 1 max"
    : "Solo — none (Co-op only)";

  return (
    <div className={"ticket-design" + (lightMode ? "" : " dark")}>
      <div className="app">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark"><span className="bm-dot"></span></div>
            <div>
              <div className="brand-title">PARAGON CALC</div>
              <div className="brand-sub">Bloons TD 6 · Degree Engine</div>
            </div>
          </div>
          <div className="config">
            <div className="config-group">
              <span className="config-label">Difficulty</span>
              <Segmented value={st.difficulty} onChange={(v) => set({ difficulty: v })} options={DIFFS} />
            </div>
            <div className="config-group">
              <span className="config-label">Mode</span>
              <Segmented value={st.mode} onChange={(v) => set({ mode: v })} options={MODES} />
            </div>
            <div className="config-group">
              <span className="config-label">Theme</span>
              <Segmented
                value={lightMode ? "light" : "dark"}
                onChange={(v) => onSetTheme(v === "light")}
                options={THEMES}
              />
            </div>
            <div className="config-group">
              <span className="config-label">View</span>
              <Segmented
                value={designMode}
                onChange={onSetDesign}
                options={[{ value: "classic", label: "Classic" }, { value: "ticket", label: "Ticket" }]}
              />
            </div>
          </div>
        </header>

        {/* PARAGON RAIL */}
        <div className="rail-wrap">
          <div className="rail-head">
            <span>Choose Paragon <span className="rail-base">base ${fmtNum(basePrice)} on {st.difficulty}</span></span>
            <div className="rail-search">
              <span className="rs-icon">⌕</span>
              <input
                type="text"
                className="rs-input"
                placeholder="Search name, tower or class…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="rs-clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
              )}
            </div>
          </div>
          <div className="rail">
            {visibleParagons.length > 0 ? visibleParagons.map((p) => (
              <button
                key={p.id}
                type="button"
                className={"ptile" + (p.id === st.paragonId ? " on" : "")}
                onClick={() => selectParagon(p.id)}
              >
                <div className="ptile-mono">{p.mono}</div>
                <div className="ptile-info">
                  <div className="ptile-name">{p.name}</div>
                  <div className="ptile-tower">{p.tower}</div>
                </div>
                <div className="ptile-cat">{p.category}</div>
              </button>
            )) : (
              <div className="rail-empty">No paragons match "{search}"</div>
            )}
          </div>

          {/* SELECTED PARAGON DETAIL — key capabilities + related */}
          <ParagonDetail paragon={paragon} basePrice={basePrice} related={related} onSelect={selectParagon} />
        </div>

        {/* AD: Top banner */}
        <AdUnit slot="1234567890" format="horizontal" style={{ margin: "0 0 20px" }} />

        {/* MAIN */}
        <div className="main">
          {/* INPUTS */}
          <section className="inputs">
            <div className="inputs-head">Your Sacrifice</div>

            <Field label="Pops & Income" hint="1 power / 180 pops · $1 income = 4 pops" badge={badge(bk.pops)} badgeMax={isMax(bk.pops)}>
              <div className="subfield">
                <span className="sub-label">Total pops</span>
                <NumberSlider value={st.pops} onChange={(v) => set({ pops: v })} max={18000000} step={10000} quick={[{ label: "Cap", value: 16200000 }]} />
              </div>
              <div className="subfield">
                <span className="sub-label">Income earned</span>
                <NumberSlider value={st.income} onChange={(v) => set({ income: v })} max={4500000} step={5000} money quick={[{ label: "Cap", value: 4050000 }]} />
              </div>
              <button type="button" className="padder-trigger" onClick={() => setPopAdderOpen(true)}>
                ▦ Add up tower pops
              </button>
            </Field>

            <Field label="Upgrade Tiers" hint="Non-T5 tiers on sacrifices · 100 pwr each, caps at 100" badge={badge(bk.upgrades)} badgeMax={isMax(bk.upgrades)}>
              <NumberSlider value={st.upgrades} onChange={(v) => set({ upgrades: Math.round(v) })} max={120} step={1} quick={[{ label: "100", value: 100 }]} />
            </Field>

            <Field label="Extra T5s" hint={t5Hint} badge={badge(bk.t5)} badgeMax={isMax(bk.t5)}>
              {maxT5s > 0 ? (
                <Stepper value={st.extraT5s} onChange={(v) => set({ extraT5s: v })} min={0} max={maxT5s} suffix={" / " + maxT5s} />
              ) : (
                <div className="locked">Locked in Solo — switch to Co-op to sacrifice extra T5s</div>
              )}
            </Field>

            <Field label="Cash Invested" hint="Sacrifice = 100% · Slider = +5% premium" badge={badge(bk.cash)} badgeMax={isMax(bk.cash)}>
              <div className="subfield">
                <span className="sub-label">Tower sacrifice $</span>
                <NumberSlider value={st.sacrificeCash} onChange={(v) => set({ sacrificeCash: v })} max={capSacrifice} step={1000} money quick={[{ label: "Cap", value: capSacrifice }]} />
              </div>
              <div className="subfield">
                <span className="sub-label">Cash slider $ <span className="sub-max">(max ${fmtNum(maxSlider)})</span></span>
                <NumberSlider value={st.sliderCash} onChange={(v) => set({ sliderCash: v })} max={maxSlider} step={1000} money />
              </div>

              {/* Slider → Sacrifice optimizer */}
              {maxT4Cost > 0 && (
                <div className="optim">
                  <div className="optim-info">
                    Most expensive sacrificeable tower: <strong>{paragon.tower} ({paragon.maxT4Build})</strong> = <strong>{fmtCash(maxT4Cost)}</strong>. Slider cash carries a 5% premium, so building whole sacrifice towers with it is always cheaper.
                  </div>
                  {sliderTowerSplit.towers > 0 ? (
                    <button type="button" className="optim-btn" onClick={optimizeCash}>
                      ⚡ Optimize: move {sliderTowerSplit.towers} tower{sliderTowerSplit.towers > 1 ? "s" : ""} ({fmtCash(sliderTowerSplit.sacrificeCash)}) from slider → sacrifices
                    </button>
                  ) : st.sliderCash > 0 ? (
                    <div className="optim-note">Slider holds less than one full tower — nothing to move.</div>
                  ) : null}
                </div>
              )}
            </Field>

            <Field label="Geraldo Totems" hint="Paragon Power Totems · +2,000 power each, uncapped" badge={badge(bk.totems)} badgeMax={false}>
              <Stepper value={st.totems} onChange={(v) => set({ totems: v })} min={0} max={60} />
            </Field>

            <button type="button" className="reset" onClick={() => setSt({ ...DEFAULTS })}>↺ Reset fields</button>
          </section>

          {/* TICKET */}
          <section className="ticket-col">
            <Ticket
              data={data}
              paragon={paragon}
              difficulty={DIFFS.find((d) => d.value === st.difficulty).label}
              mode={MODES.find((m) => m.value === st.mode).label}
            />
          </section>
        </div>

        {/* AD: Mid-page */}
        <AdUnit slot="0987654321" format="auto" style={{ margin: "22px 0", textAlign: "center" }} />

        {/* GOAL PLANNER */}
        <GoalPlanner paragon={paragon} difficulty={st.difficulty} mode={st.mode} maxT5s={maxT5s} />

        {/* GUIDE — how calculations work */}
        <section className="guide">
          <h2 className="guide-title">▤ How Paragon Calculations Work</h2>
          <p className="guide-intro">
            In Bloons TD 6, a Paragon's Degree is calculated using Paragon Power Points (capped at 200,000). The
            power points are distributed across four main caps (plus Geraldo's totems which bypass standard limits).
            Here is a detailed breakdown of the official mathematical ratios used in-game (Update 39+):
          </p>
          <div className="guide-grid">
            <div className="guide-col">
              <h4>Pops &amp; Income (Max 90,000 pts)</h4>
              <p>
                Towers deal damage and generate cash throughout the game. 1 Power is awarded per 180 pops/damage,
                and 1 Power per $45 of cash generated ($1 generated acts as 4 pops). 16,200,000 equivalent pops max
                this category.
              </p>
            </div>
            <div className="guide-col">
              <h4>Sacrificed Upgrades (Max 10,000 pts)</h4>
              <p>
                Upgrades on sacrificed non-T5 towers supply power — 100 Power per upgrade tier (excluding the baseline
                three T5s). A 0-2-4 monkey has 6 upgrade tiers. 100 total upgrade tiers max this category.
              </p>
            </div>
            <div className="guide-col">
              <h4>Cash Investment (Max 60,000 pts)</h4>
              <p>
                Money spent on sacrificed towers or injected via the Cash Slider adds power. Sacrificed towers: 1 Power
                per $(Base Price / 20,000) — 100% efficient. Cash Slider: 1 Power per $(Base Price × 1.05 / 20,000) —
                95% efficient. 3.0× base price in sacrifices or 3.15× in slider cash maxes this category.
              </p>
            </div>
            <div className="guide-col">
              <h4>Geraldo's Totems (Uncapped)</h4>
              <p>
                Each Paragon Power Totem contributes 2,000 flat power points. In Solo play, standard contributions cap
                at 160,000 power (Degree 76) or 166,000 (Degree 79 for Dart Monkey). To reach Degree 100 in Solo, you
                must absorb Geraldo Totems to make up the missing power.
              </p>
            </div>
          </div>
        </section>

        {/* AD: Before footer */}
        <AdUnit slot="1122334455" format="auto" style={{ margin: "22px 0", textAlign: "center" }} />

        {/* PRIVACY POLICY — Required for AdSense */}
        <section className="privacy" id="privacy-policy" aria-label="Privacy Policy">
          <h2 className="guide-title">Privacy Policy</h2>
          <div className="privacy-content">
            <p><strong>Last updated:</strong> May 27, 2026</p>
            <h3>Information We Collect</h3>
            <p>
              This website does not collect personal information directly. We use Google AdSense to display
              advertisements, which may use cookies and web beacons to serve ads based on your prior visits to this or
              other websites. Google's use of advertising cookies enables it and its partners to serve ads based on
              your visit to this site and/or other sites on the Internet.
            </p>
            <h3>Third-Party Advertising</h3>
            <p>
              We use Google AdSense to serve ads. Google may use cookies to personalize ads. You may opt out of
              personalized advertising by visiting{" "}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
              For more information about how Google uses data, visit{" "}
              <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google's Privacy &amp; Terms</a>.
            </p>
            <h3>Analytics</h3>
            <p>
              We use Vercel Analytics to understand how visitors interact with this site. This data is aggregated and
              anonymized. No personally identifiable information is stored.
            </p>
            <h3>Cookies</h3>
            <p>
              This site uses cookies for theme preference (light/dark mode) stored locally in your browser, and
              third-party cookies from Google AdSense for ad personalization. You can control cookie settings through
              your browser preferences.
            </p>
            <h3>Contact</h3>
            <p>If you have questions about this privacy policy, please open an issue on our GitHub repository.</p>
          </div>
        </section>

        <footer className="foot">
          <nav className="foot-nav">
            <a href="#privacy-policy">Privacy Policy</a>
            <span className="foot-sep">•</span>
            <a href="https://github.com/levisager11-oss/paragon-calc" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
          Power caps — Pops 90k · Upgrades 10k · Cash 60k · Extra T5s 50k · Totems uncapped. Degree 100 at 200,000 power.
          <br />
          BTD6 is a trademark of Ninja Kiwi. Not affiliated.
        </footer>
      </div>

      {/* TOWER-POP ADDER MODAL */}
      {popAdderOpen && (
        <PopAdder
          onClose={() => setPopAdderOpen(false)}
          onApply={(total) => { set({ pops: total }); setPopAdderOpen(false); }}
        />
      )}

      <Analytics />
      <SpeedInsights />
    </div>
  );
}
