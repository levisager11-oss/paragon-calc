import { useState, useEffect, useMemo } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { PARAGONS } from "../constants/paragons";
import { calculateParagonData, getBasePrice } from "../utils/calculator";
import "./TicketCalculator.css";

/* ────────────────────────────────────────────────────────────────────────
 * Neo-brutalist "arcade ticket" alternate design.
 *
 * Reuses the exact same calculation engine as the classic UI
 * (src/utils/calculator.js) — only the presentation differs.
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

// ── the alternate calculator ────────────────────────────────────────────
export default function TicketCalculator({ designMode, onSetDesign }) {
  const [st, setSt] = useState(loadState);
  const set = (patch) => setSt((s) => ({ ...s, ...patch }));

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
    <div className="ticket-design">
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
            Choose Paragon <span className="rail-base">base ${fmtNum(basePrice)} on {st.difficulty}</span>
          </div>
          <div className="rail">
            {PARAGON_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                className={"ptile" + (p.id === st.paragonId ? " on" : "")}
                onClick={() => set({ paragonId: p.id })}
              >
                <div className="ptile-mono">{p.mono}</div>
                <div className="ptile-info">
                  <div className="ptile-name">{p.name}</div>
                  <div className="ptile-tower">{p.tower}</div>
                </div>
                <div className="ptile-cat">{p.category}</div>
              </button>
            ))}
          </div>
        </div>

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

        <footer className="foot">
          Power caps — Pops 90k · Upgrades 10k · Cash 60k · Extra T5s 50k · Totems uncapped. Degree 100 at 200,000 power.
          <br />
          <a href="https://github.com/levisager11-oss/paragon-calc" target="_blank" rel="noopener noreferrer">GitHub</a>
          {" · "}
          BTD6 is a trademark of Ninja Kiwi. Not affiliated.
        </footer>
      </div>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
