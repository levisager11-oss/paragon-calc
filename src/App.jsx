import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  User, Users, Wrench, Target, Star, Crown, DollarSign, Gem,
  RotateCcw, BarChart3, AlertTriangle, Lightbulb, ArrowRight,
  Trophy, BookOpen, Search, X, Plus, Calculator, Sun, Moon, CircleCheck,
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { PARAGONS, DIFFICULTY_MULTIPLIERS } from "./constants/paragons";
import {
  calculateParagonData, reverseCalculate, getBasePrice, getMaxT4Cost,
  splitIntoSacrificeTowers, maxT5sFor, soloCeilingFacts, MAX_POWER,
} from "./utils/calculator";
import AdUnit from "./components/AdUnit";
import ParagonIcon from "./components/ParagonIcon";
import BuildToolbar from "./components/BuildToolbar";
import { decodeState } from "./utils/shareState";

// Slider track fill, as a CSS percentage string for the --pct custom property.
const pct = (val, min, max) => `${Math.round(((val - min) / (max - min)) * 100)}%`;

// Solo ceilings quoted in the guide, derived from the engine so the prose can
// never contradict the calculator on the same page.
const SOLO = soloCeilingFacts(PARAGONS.ascended_shadow);
const SOLO_DART = soloCeilingFacts(PARAGONS.apex_plasma_master);

const ICON_SM = 14;
const ICON_MD = 16;
const ICON_LG = 20;

export default function App() {
  // 1. Core State — the initial build is read from the URL (?paragon=&diff=&pops=…)
  // so shared links and the /paragons deep links open with the build preloaded.
  const initialBuild = useMemo(() => decodeState(window.location.search), []);
  const [selectedParagonId, setSelectedParagonId] = useState(() => initialBuild.paragon);
  const [difficulty, setDifficulty] = useState(() => initialBuild.difficulty);
  const [gameMode, setGameMode] = useState(() => initialBuild.gameMode); // "solo" or "coop"
  const [lightMode, setLightMode] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "light";
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
    localStorage.setItem("theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  // The calculator lives at /classic. Canonicalise the bare "/" landing onto it
  // so the route is linkable and bookmarkable, keeping the query string that
  // carries a shared build.
  useEffect(() => {
    if (!window.location.pathname.startsWith("/classic")) {
      window.history.replaceState({}, "", "/classic" + window.location.search);
    }
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);

  // Goal Planner state
  const [targetDegree, setTargetDegree]       = useState(100);
  const [goalUseExtraT5s, setGoalUseExtraT5s] = useState(true);
  const [goalUseUpgrades, setGoalUseUpgrades] = useState(true);
  const [goalCashMode, setGoalCashMode]       = useState("sacrifice"); // "none" | "sacrifice" | "slider" | "both"
  const [goalUseTotems, setGoalUseTotems]     = useState(true);
  const [goalStrategy, setGoalStrategy]       = useState("leastCash");

  // 2. Input Fields State (seeded from the URL build, if present)
  const [pops, setPops] = useState(() => initialBuild.pops);
  const [income, setIncome] = useState(() => initialBuild.income);
  const [upgrades, setUpgrades] = useState(() => initialBuild.upgrades);
  const [extraT5s, setExtraT5s] = useState(() => initialBuild.extraT5s);
  const [sacrificedTowerCash, setSacrificedTowerCash] = useState(() => initialBuild.sacrificedTowerCash);
  const [sliderCash, setSliderCash] = useState(() => initialBuild.sliderCash);
  const [totems, setTotems] = useState(() => initialBuild.totems);

  // Snapshot of the current build for the share / save / embed / export toolbar.
  const currentState = useMemo(() => ({
    paragon: selectedParagonId, difficulty, gameMode, pops, income, upgrades,
    extraT5s, sacrificedTowerCash, sliderCash, totems,
  }), [selectedParagonId, difficulty, gameMode, pops, income, upgrades,
       extraT5s, sacrificedTowerCash, sliderCash, totems]);

  // Apply a saved or shared build (from the toolbar) to every input at once.
  const applyState = useCallback((s) => {
    setSelectedParagonId(s.paragon);
    setDifficulty(s.difficulty);
    setGameMode(s.gameMode);
    setPops(s.pops);
    setIncome(s.income);
    setUpgrades(s.upgrades);
    setExtraT5s(s.extraT5s);
    setSacrificedTowerCash(s.sacrificedTowerCash);
    setSliderCash(s.sliderCash);
    setTotems(s.totems);
  }, []);

  // Pop Count Adder state
  const [popAdderOpen, setPopAdderOpen] = useState(false);
  const [popAdderEntries, setPopAdderEntries] = useState([""]);
  const popAdderRefs = useRef([]);
  const popAdderTriggerRef = useRef(null);

  const popAdderTotal = useMemo(() => {
    return popAdderEntries.reduce((sum, v) => sum + (parseInt(v.replace(/,/g, "")) || 0), 0);
  }, [popAdderEntries]);

  const openPopAdder = useCallback(() => {
    setPopAdderEntries([""]);
    setPopAdderOpen(true);
  }, []);

  // Returning focus to the trigger keeps keyboard users where they left off.
  const closePopAdder = useCallback(() => {
    setPopAdderOpen(false);
    setPopAdderEntries([""]);
    popAdderTriggerRef.current?.focus();
  }, []);

  const applyPopAdder = useCallback(() => {
    setPops(popAdderTotal);
    closePopAdder();
  }, [popAdderTotal, closePopAdder]);

  const handlePopAdderChange = useCallback((idx, val) => {
    setPopAdderEntries(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const handlePopAdderKeyDown = useCallback((e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setPopAdderEntries(prev => [...prev.slice(0, idx + 1), "", ...prev.slice(idx + 1)]);
      setTimeout(() => popAdderRefs.current[idx + 1]?.focus(), 0);
    } else if (e.key === "Backspace" && popAdderEntries[idx] === "" && popAdderEntries.length > 1) {
      e.preventDefault();
      setPopAdderEntries(prev => prev.filter((_, i) => i !== idx));
      setTimeout(() => popAdderRefs.current[Math.max(0, idx - 1)]?.focus(), 0);
    }
  }, [popAdderEntries]);

  const removePopAdderEntry = useCallback((idx) => {
    setPopAdderEntries(prev => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx)));
  }, []);

  useEffect(() => {
    if (popAdderOpen) {
      setTimeout(() => popAdderRefs.current[0]?.focus(), 50);
    }
  }, [popAdderOpen]);

  useEffect(() => {
    if (!popAdderOpen) return;
    const handleKey = (e) => { if (e.key === "Escape") closePopAdder(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [popAdderOpen, closePopAdder]);

  // 3. Get Active Paragon Data
  const activeParagon = useMemo(() => PARAGONS[selectedParagonId], [selectedParagonId]);
  const currentBasePrice = useMemo(() => {
    return getBasePrice(activeParagon.mediumCost, difficulty);
  }, [activeParagon, difficulty]);

  const maxSliderLimit = useMemo(() => {
    return Math.round(currentBasePrice * 3.15);
  }, [currentBasePrice]);

  // Cost of the most expensive non-T5 tower you can sacrifice (a Tier-4 with a
  // +2 crosspath), scaled to the selected difficulty. This is the largest cash
  // chunk a single sacrifice tower can absorb at 100% efficiency.
  const maxT4Cost = useMemo(
    () => getMaxT4Cost(activeParagon, difficulty),
    [activeParagon, difficulty]
  );

  // How much of the current slider cash could be re-routed into whole sacrifice
  // towers (100% efficient) instead of staying on the 95%-efficient slider.
  const sliderTowerSplit = useMemo(
    () => splitIntoSacrificeTowers(sliderCash, maxT4Cost),
    [sliderCash, maxT4Cost]
  );

  // Paragon search
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(PARAGONS).filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.tower.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const suggestions = useMemo(() => {
    const all = Object.values(PARAGONS).filter(p => p.id !== selectedParagonId);
    const sameCategory = all.filter(p => p.category === activeParagon.category);
    const others = all.filter(p => p.category !== activeParagon.category);
    return [...sameCategory, ...others].slice(0, 3);
  }, [selectedParagonId, activeParagon]);

  // Goal Planner computed results
  const goalResults = useMemo(() => reverseCalculate({
    paragon:         activeParagon,
    difficulty,
    gameMode,
    targetDegree,
    useExtraT5s:      goalUseExtraT5s,
    useUpgrades:      goalUseUpgrades,
    useSacrificeCash: goalCashMode === "sacrifice" || goalCashMode === "both",
    useSliderCash:    goalCashMode === "slider"    || goalCashMode === "both",
    useTotems:        goalUseTotems,
    strategy:         goalStrategy,
  }), [activeParagon, difficulty, gameMode, targetDegree,
       goalUseExtraT5s, goalUseUpgrades, goalCashMode, goalUseTotems, goalStrategy]);

  const handleSelectParagon = (id) => {
    setSelectedParagonId(id);
    setSearchQuery("");
    setShowDropdown(false);
  };

  // 4. Enforce Game Constraints
  // These limits depend on the selected paragon, mode and difficulty, so clamp
  // during render rather than in an effect: the value is corrected before paint
  // instead of after a second, cascading render.
  const allowedT5s = maxT5sFor(activeParagon, gameMode);
  if (extraT5s > allowedT5s) setExtraT5s(allowedT5s);
  if (sliderCash > maxSliderLimit) setSliderCash(maxSliderLimit);

  // 5. Compute Calculations
  const results = useMemo(() => {
    return calculateParagonData({
      paragon: activeParagon,
      difficulty,
      gameMode,
      pops,
      income,
      upgrades,
      extraT5s,
      sacrificedTowerCash,
      sliderCash,
      totems
    });
  }, [activeParagon, difficulty, gameMode, pops, income, upgrades, extraT5s, sacrificedTowerCash, sliderCash, totems]);

  // 6. Helper Actions
  const setMaxPops = () => setPops(16200000);
  const setMaxIncome = () => setIncome(4050000);
  const setMaxUpgrades = () => setUpgrades(100);
  const resetInputs = () => {
    setPops(0);
    setIncome(0);
    setUpgrades(0);
    setExtraT5s(0);
    setSacrificedTowerCash(0);
    setSliderCash(0);
    setTotems(0);
  };

  const handleSliderCashText = (e) => {
    const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
    setSliderCash(Math.min(maxSliderLimit, Math.max(0, val)));
  };

  const handleSacrificeCashText = (e) => {
    const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
    setSacrificedTowerCash(Math.max(0, val));
  };

  // Move whole sacrifice-tower chunks off the (95% efficient) slider and onto
  // the (100% efficient) sacrifice total, leaving only the sub-one-tower
  // remainder on the slider so no money is wasted to the 5% premium.
  const optimizeCash = () => {
    const { sacrificeCash, remainder } = splitIntoSacrificeTowers(sliderCash, maxT4Cost);
    if (sacrificeCash <= 0) return;
    setSacrificedTowerCash(prev => prev + sacrificeCash);
    setSliderCash(remainder);
  };

  const handlePopsText = (e) => {
    const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
    setPops(Math.max(0, val));
  };

  const handleIncomeText = (e) => {
    const val = parseInt(e.target.value.replace(/,/g, "")) || 0;
    setIncome(Math.max(0, val));
  };

  const gaugePct = Math.min(100, (results.totalPower / MAX_POWER) * 100);

  // The four capped power sources, rendered as one list so every row shares the
  // same markup, bar and cap treatment.
  const breakdownRows = [
    { key: "pops",     label: "Pops & income",   Icon: Target },
    { key: "upgrades", label: "Upgrade tiers",   Icon: Star },
    { key: "cash",     label: "Cash invested",   Icon: DollarSign },
    { key: "t5",       label: "Extra Tier 5s",   Icon: Crown },
  ];

  return (
    <>
      <a className="skip-link" href="#calculator">Skip to the calculator</a>

      <div className="container">
        <header className="site-header">
          <div className="logo-section">
            <span className="logo-icon">
              <img src="/logo.png" alt="" width="24" height="24" />
            </span>
            <div className="logo-text">
              <h1>BTD6 Paragon Calculator</h1>
              <p>Bloons TD 6 · Update 56+</p>
            </div>
          </div>

          <nav className="site-nav" aria-label="Primary">
            <a href="/paragons">Paragons</a>
            <a href="/faq">FAQ</a>
            <a href="https://github.com/levisager11-oss/paragon-calc" target="_blank" rel="noopener noreferrer">Source</a>
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle-btn"
              onClick={() => setLightMode(prev => !prev)}
              aria-label={lightMode ? "Switch to dark theme" : "Switch to light theme"}
            >
              {lightMode ? <Moon size={ICON_MD} /> : <Sun size={ICON_MD} />}
            </button>
          </div>
        </header>

        <div className="page">
          {/* ── SETUP: which paragon, on what difficulty, in which mode ── */}
          <section className="setup" aria-label="Build setup" id="calculator">
            <div className="setup-row">
              <div className="paragon-search-wrapper">
                <div className="paragon-search-bar">
                  <Search size={ICON_MD} className="search-icon" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="paragon-search-input"
                    aria-label="Search paragons by name, tower or class"
                    placeholder="Search by name, tower or class"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      aria-label="Clear search"
                      onMouseDown={() => { setSearchQuery(""); setShowDropdown(false); searchInputRef.current?.focus(); }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {showDropdown && (
                  <div className="paragon-dropdown">
                    {searchResults.length > 0 ? searchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="paragon-dropdown-item"
                        onMouseDown={() => handleSelectParagon(p.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectParagon(p.id); } }}
                      >
                        <span className="dropdown-icon">
                          <ParagonIcon paragon={p} size={32} />
                        </span>
                        <span className="dropdown-info">
                          <span className="dropdown-name">{p.name}</span>
                          <span className="dropdown-sub">
                            {p.tower}
                            <span className={`dropdown-tag ${p.category}`}>{p.category}</span>
                          </span>
                        </span>
                        <span className="dropdown-price">${getBasePrice(p.mediumCost, difficulty).toLocaleString()}</span>
                      </button>
                    )) : (
                      <p className="dropdown-empty">No paragon matches “{searchQuery}”.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="setup-field">
                <span className="eyebrow" id="difficulty-label">Difficulty</span>
                <div className="control-group" role="group" aria-labelledby="difficulty-label">
                  {Object.keys(DIFFICULTY_MULTIPLIERS).map((key) => (
                    <button
                      key={key}
                      className={`control-btn ${difficulty === key ? "active" : ""}`}
                      aria-pressed={difficulty === key}
                      onClick={() => setDifficulty(key)}
                    >
                      {DIFFICULTY_MULTIPLIERS[key].name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-field">
                <span className="eyebrow" id="mode-label">Game mode</span>
                <div className="control-group" role="group" aria-labelledby="mode-label">
                  <button
                    className={`control-btn ${gameMode === "solo" ? "active" : ""}`}
                    aria-pressed={gameMode === "solo"}
                    onClick={() => setGameMode("solo")}
                  >
                    <User size={ICON_SM} aria-hidden="true" /> Solo
                  </button>
                  <button
                    className={`control-btn ${gameMode === "coop" ? "active" : ""}`}
                    aria-pressed={gameMode === "coop"}
                    onClick={() => setGameMode("coop")}
                  >
                    <Users size={ICON_SM} aria-hidden="true" /> Co-op
                  </button>
                </div>
              </div>
            </div>

            <div className="paragon-active-chip">
              <span className="active-chip-icon">
                <ParagonIcon paragon={activeParagon} size={32} />
              </span>
              <span className="active-chip-info">
                <span className="active-chip-name">{activeParagon.name}</span>
                <span className="active-chip-tower">{activeParagon.tower}</span>
              </span>
              <span className={`active-chip-tag ${activeParagon.category}`}>{activeParagon.category}</span>
              <span className="active-chip-price">${getBasePrice(activeParagon.mediumCost, difficulty).toLocaleString()}</span>
            </div>

            <div className="paragon-suggestions">
              <span className="suggestions-label">Switch to</span>
              {suggestions.map(p => (
                <button
                  key={p.id}
                  className="suggestion-chip"
                  onClick={() => handleSelectParagon(p.id)}
                >
                  <ParagonIcon paragon={p} size={16} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </section>

          <BuildToolbar
            state={currentState}
            results={results}
            paragon={activeParagon}
            onLoadState={applyState}
            sharePath="/classic"
          />

          <AdUnit slot="1234567890" format="horizontal" />

          {/* ── CORE WORKSPACE ── */}
          <main>
            <div className="dashboard-grid">
              {/* Left: inputs */}
              <section className="panel" aria-label="Sacrifice inputs">
                <div className="section-head">
                  <div className="section-head-text">
                    <h2 className="panel-title">Sacrifice inputs</h2>
                    <p className="section-lede">
                      Enter what you plan to feed the Paragon. The degree updates as you type.
                    </p>
                  </div>
                  <button className="quick-btn" onClick={resetInputs}>
                    <RotateCcw size={ICON_SM} aria-hidden="true" /> Reset all
                  </button>
                </div>

                {/* Pops & income */}
                <div className="input-section">
                  <div className="input-header">
                    <span className="input-label">
                      <Target size={ICON_MD} className="input-icon" aria-hidden="true" /> Pops &amp; income
                    </span>
                    <span className="input-badge">Caps at 90,000 power</span>
                  </div>
                  <div className="input-controls">
                    <div className="control-row">
                      <div>
                        <label className="control-label" htmlFor="pops-range">
                          Total pops across every sacrificed tower
                        </label>
                        <input
                          type="range"
                          min="0"
                          id="pops-range"
                          max="16200000"
                          step="50000"
                          className="range-slider"
                          value={pops}
                          style={{ '--pct': pct(pops, 0, 16200000) }}
                          onChange={(e) => setPops(parseInt(e.target.value))}
                        />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="number-input"
                        aria-label="Total tower pops"
                        value={pops.toLocaleString()}
                        onChange={handlePopsText}
                      />
                    </div>

                    <div className="control-row">
                      <div>
                        <label className="control-label" htmlFor="income-range">
                          Cash those towers generated — Buccaneers, Engineers, farms
                        </label>
                        <input
                          type="range"
                          min="0"
                          id="income-range"
                          max="4050000"
                          step="10000"
                          className="range-slider"
                          value={income}
                          style={{ '--pct': pct(income, 0, 4050000) }}
                          onChange={(e) => setIncome(parseInt(e.target.value))}
                        />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="number-input"
                        aria-label="Total cash generated"
                        value={income.toLocaleString()}
                        onChange={handleIncomeText}
                      />
                    </div>

                    <p className="input-note">
                      $1 of income counts as 4 pops, so 16,200,000 equivalent pops fills this category.
                    </p>

                    <div className="quick-buttons">
                      <button className="quick-btn" onClick={() => setPops(0)}>Clear pops</button>
                      <button className="quick-btn" onClick={setMaxPops}>Max pops (16.2M)</button>
                      <button className="quick-btn" onClick={() => setIncome(0)}>Clear income</button>
                      <button className="quick-btn" onClick={setMaxIncome}>Max income ($4.05M)</button>
                      <button className="quick-btn" ref={popAdderTriggerRef} onClick={openPopAdder}>
                        <Calculator size={ICON_SM} aria-hidden="true" /> Add up tower pops
                      </button>
                    </div>
                  </div>
                </div>

                {/* Upgrades */}
                <div className="input-section">
                  <div className="input-header">
                    <span className="input-label">
                      <Star size={ICON_MD} className="input-icon" aria-hidden="true" /> Sacrificed upgrade tiers
                    </span>
                    <span className="input-badge">Caps at 10,000 power</span>
                  </div>
                  <div className="input-controls">
                    <div className="control-row">
                      <div>
                        <label className="control-label" htmlFor="upgrades-range">
                          Count every tier on non-T5 sacrifices — four 0-2-4 towers is 24 tiers
                        </label>
                        <input
                          type="range"
                          id="upgrades-range"
                          min="0"
                          max="100"
                          className="range-slider"
                          value={upgrades}
                          style={{ '--pct': pct(upgrades, 0, 100) }}
                          onChange={(e) => setUpgrades(parseInt(e.target.value))}
                        />
                      </div>
                      <input
                        type="number"
                        className="number-input"
                        aria-label="Total sacrificed upgrade tiers"
                        min="0"
                        max="100"
                        value={upgrades}
                        onChange={(e) => setUpgrades(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    <div className="quick-buttons">
                      <button className="quick-btn" onClick={() => setUpgrades(0)}>None</button>
                      <button className="quick-btn" onClick={() => setUpgrades(50)}>50 tiers</button>
                      <button className="quick-btn" onClick={setMaxUpgrades}>Max (100 tiers)</button>
                    </div>
                  </div>
                </div>

                {/* Extra T5s */}
                <div className="input-section">
                  <div className="input-header">
                    <span className="input-label">
                      <Crown size={ICON_MD} className="input-icon" aria-hidden="true" /> Extra Tier 5s
                    </span>
                    <span className="input-badge">Caps at 50,000 power</span>
                  </div>
                  <div className="input-controls">
                    <div className="control-row">
                      <p className="input-note input-note-tight">
                        {gameMode === "solo" ? (
                          activeParagon.soloExtraT5Source ? (
                            `Solo, the ${activeParagon.tower} can sacrifice one extra T5 — ${activeParagon.soloExtraT5Source} allows a second copy of one Tier 5 upgrade.`
                          ) : (
                            `Solo, you cannot field a fourth ${activeParagon.tower} Tier 5 — the Paragon consumes all three. Switch to Co-op to plan multiplayer sacrifices.`
                          )
                        ) : (
                          `Co-op, each of the four players can place three Tier 5s of their own. Three go into the Paragon, leaving up to ${allowedT5s} extra${activeParagon.soloExtraT5Source ? ` — nine, plus one duplicate from ${activeParagon.soloExtraT5Source}` : ""}.`
                        )}
                      </p>
                      <div>
                        <input
                          type="number"
                          className="number-input"
                          min="0"
                          aria-label="Extra Tier 5 towers sacrificed"
                          max={allowedT5s}
                          value={allowedT5s === 0 ? 0 : extraT5s}
                          disabled={allowedT5s === 0}
                          onChange={(e) => setExtraT5s(Math.min(allowedT5s, Math.max(0, parseInt(e.target.value) || 0)))}
                        />
                      </div>
                    </div>
                    {gameMode === "coop" && (
                      <div className="quick-buttons">
                        <button className="quick-btn" onClick={() => setExtraT5s(0)}>None</button>
                        <button className="quick-btn" onClick={() => setExtraT5s(Math.floor(allowedT5s / 2))}>{Math.floor(allowedT5s / 2)} extra</button>
                        <button className="quick-btn" onClick={() => setExtraT5s(allowedT5s)}>Max ({allowedT5s} extra)</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cash */}
                <div className="input-section">
                  <div className="input-header">
                    <span className="input-label">
                      <DollarSign size={ICON_MD} className="input-icon" aria-hidden="true" /> Cash invested
                    </span>
                    <span className="input-badge">Caps at 60,000 power</span>
                  </div>
                  <div className="input-controls">
                    <div className="control-row">
                      <div>
                        <label className="control-label" htmlFor="sacrifice-cash-range">
                          Money spent on the towers you sacrifice — <strong>100% efficient</strong>
                        </label>
                        <input
                          type="range"
                          min="0"
                          id="sacrifice-cash-range"
                          max={currentBasePrice * 3}
                          step="5000"
                          className="range-slider"
                          value={sacrificedTowerCash}
                          style={{ '--pct': pct(sacrificedTowerCash, 0, currentBasePrice * 3) }}
                          onChange={(e) => setSacrificedTowerCash(parseInt(e.target.value))}
                        />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="number-input"
                        aria-label="Value of sacrificed non-T5 towers, in dollars"
                        value={sacrificedTowerCash.toLocaleString()}
                        onChange={handleSacrificeCashText}
                      />
                    </div>

                    <div className="control-row">
                      <div>
                        <label className="control-label" htmlFor="slider-cash-range">
                          Cash pushed in on the in-game slider — <strong>95% efficient</strong>
                        </label>
                        <input
                          type="range"
                          min="0"
                          id="slider-cash-range"
                          max={maxSliderLimit}
                          step="5000"
                          className="range-slider"
                          value={sliderCash}
                          style={{ '--pct': pct(sliderCash, 0, maxSliderLimit) }}
                          onChange={(e) => setSliderCash(parseInt(e.target.value))}
                        />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="number-input"
                        aria-label="Cash slider injection, in dollars"
                        value={sliderCash.toLocaleString()}
                        onChange={handleSliderCashText}
                      />
                    </div>

                    <p className="input-note">
                      The in-game slider stops at 3.15× the base price — <strong>${maxSliderLimit.toLocaleString()}</strong> for this build.
                    </p>

                    {maxT4Cost > 0 && (
                      <div className="cash-optimize">
                        <p className="cash-optimize-info">
                          Slider cash carries a 5% premium, so buying whole sacrifice towers with it is
                          always cheaper. The priciest single sacrifice here is a{" "}
                          <strong>{activeParagon.maxT4Build} {activeParagon.tower}</strong> at{" "}
                          <strong>${maxT4Cost.toLocaleString()}</strong>.
                        </p>
                        {sliderTowerSplit.towers > 0 ? (
                          <button className="quick-btn cash-optimize-btn" onClick={optimizeCash}>
                            <Lightbulb size={ICON_SM} aria-hidden="true" />
                            Move {sliderTowerSplit.towers} tower{sliderTowerSplit.towers > 1 ? "s" : ""} (${sliderTowerSplit.sacrificeCash.toLocaleString()}) off the slider
                          </button>
                        ) : sliderCash > 0 ? (
                          <p className="cash-optimize-note">
                            The slider holds less than one full tower — there is nothing to move.
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div className="quick-buttons">
                      <button
                        className="quick-btn"
                        onClick={() => { setSacrificedTowerCash(currentBasePrice * 3); setSliderCash(0); }}
                      >
                        Max via sacrifices (${(currentBasePrice * 3).toLocaleString()})
                      </button>
                      <button
                        className="quick-btn"
                        onClick={() => { setSliderCash(maxSliderLimit); setSacrificedTowerCash(0); }}
                      >
                        Max via slider (${maxSliderLimit.toLocaleString()})
                      </button>
                      <button
                        className="quick-btn"
                        onClick={() => { setSacrificedTowerCash(0); setSliderCash(0); }}
                      >
                        Clear cash
                      </button>
                    </div>
                  </div>
                </div>

                {/* Totems */}
                <div className="input-section">
                  <div className="input-header">
                    <span className="input-label">
                      <Gem size={ICON_MD} className="input-icon" aria-hidden="true" /> Geraldo&rsquo;s totems
                    </span>
                    <span className="input-badge is-uncapped">Uncapped · 2,000 power each</span>
                  </div>
                  <div className="input-controls">
                    <div className="control-row">
                      <p className="input-note input-note-tight">
                        Paragon Power Totems from Geraldo&rsquo;s shop add flat power that ignores every cap.
                        Solo, they are the only route to Degree 100: {SOLO.totems} totems on top of an
                        otherwise maxed build, or {SOLO_DART.totems} for a Dart Monkey or Ice Monkey.
                      </p>
                      <div>
                        <input
                          type="number"
                          className="number-input"
                          min="0"
                          aria-label="Geraldo Paragon Power Totems absorbed"
                          max="100"
                          value={totems}
                          onChange={(e) => setTotems(Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                    </div>
                    <div className="quick-buttons">
                      <button className="quick-btn" onClick={() => setTotems(0)}>None</button>
                      <button className="quick-btn" onClick={() => setTotems(10)}>10</button>
                      <button className="quick-btn" onClick={() => setTotems(SOLO_DART.totems)}>{SOLO_DART.totems} (solo, duplicate T5)</button>
                      <button className="quick-btn" onClick={() => setTotems(SOLO.totems)}>{SOLO.totems} (solo, any other)</button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right: results */}
              <aside className="sticky-results" aria-label="Results">
                <div className="panel">
                  <div className="gauge-container">
                    <div
                      className={`circular-gauge ${results.degree === 100 ? "is-complete" : ""}`}
                      style={{ '--pct': gaugePct }}
                      role="img"
                      aria-label={`Degree ${results.degree}. ${results.totalPower.toLocaleString()} of ${MAX_POWER.toLocaleString()} power points.`}
                    >
                      <span className="degree-label">Degree</span>
                      <span className="degree-number">{results.degree}</span>
                      <span className="power-total">
                        <span className="power-label-bold">{results.totalPower.toLocaleString()}</span> / {MAX_POWER.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="capabilities">
                    <h4>
                      <Trophy size={ICON_SM} aria-hidden="true" /> What this Paragon does
                    </h4>
                    <ul className="capabilities-list">
                      {activeParagon.abilities.map((ability, index) => (
                        <li key={index}>{ability}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {results.warnings.length > 0 && results.warnings.map((w, idx) => (
                  <div key={idx} className="waste-banner" role="status">
                    <AlertTriangle size={ICON_MD} className="waste-icon" aria-hidden="true" />
                    <p className="waste-text">{w.text}</p>
                  </div>
                ))}

                <div className="breakdown-card">
                  <h3 className="breakdown-title">
                    <BarChart3 size={ICON_MD} aria-hidden="true" /> Where the power comes from
                  </h3>

                  {breakdownRows.map(({ key, label, Icon }) => {
                    const row = results.powerBreakdown[key];
                    // Three states worth distinguishing: still has headroom,
                    // exactly at the ceiling, and past it — where the excess is
                    // being thrown away. `capped` from the engine means the
                    // third, not the second.
                    const state = row.capped ? "is-wasting"
                      : row.power >= row.max ? "is-capped"
                      : "";
                    return (
                      <div key={key} className={`breakdown-row ${state}`}>
                        <div className="breakdown-header">
                          <span className="breakdown-name">
                            <Icon size={ICON_SM} aria-hidden="true" /> {label}
                          </span>
                          <span className="breakdown-val">
                            {row.power.toLocaleString()} / {row.max.toLocaleString()}
                          </span>
                        </div>
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill" style={{ width: `${Math.min(100, row.pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Totems have no ceiling, so there is no denominator to
                      fill — a bar here would imply a cap that does not exist. */}
                  {results.powerBreakdown.totems.power > 0 && (
                    <div className="breakdown-row breakdown-row-flat">
                      <div className="breakdown-header">
                        <span className="breakdown-name">
                          <Gem size={ICON_SM} aria-hidden="true" /> Geraldo&rsquo;s totems
                        </span>
                        <span className="breakdown-val">
                          +{results.powerBreakdown.totems.power.toLocaleString()} · uncapped
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="breakdown-legend">
                    <span className="legend-item">
                      <span className="legend-swatch accent" aria-hidden="true" /> Room to grow
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch capped" aria-hidden="true" /> Exactly maxed
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch wasting" aria-hidden="true" /> Over-invested
                    </span>
                  </div>
                </div>

                {results.degree < 100 && results.recommendations.length > 0 && (
                  <div className="diagnostics-card recommendations">
                    <h3 className="diagnostics-title rec-title">
                      <Lightbulb size={ICON_MD} aria-hidden="true" /> Cheapest way to Degree {results.nextDegree}
                    </h3>
                    <ul className="diag-list">
                      {results.recommendations.map((rec, idx) => (
                        <li key={idx} className="diag-item">
                          <ArrowRight size={ICON_SM} className="diag-bullet" aria-hidden="true" />
                          <span>{rec.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.degree === 100 && (
                  <div className="diagnostics-card maxed">
                    <h3 className="diagnostics-title maxed-title">
                      <CircleCheck size={ICON_MD} aria-hidden="true" /> Degree 100 reached
                    </h3>
                    <p className="maxed-body">
                      This build hits the {MAX_POWER.toLocaleString()}-power ceiling. Anything you add
                      beyond it changes nothing in game.
                    </p>
                  </div>
                )}
              </aside>
            </div>

            <AdUnit slot="0987654321" format="auto" />

            {/* ── GOAL PLANNER ── */}
            <section className="panel goal-planner-panel" aria-label="Goal planner">
              <div className="section-head">
                <div className="section-head-text">
                  <h2 className="panel-title">Goal planner</h2>
                  <p className="section-lede">
                    Work backwards: pick the degree you want and the planner returns the smallest set of
                    inputs that reaches it.
                  </p>
                </div>
                <div className="control-group" role="group" aria-label="Planner strategy">
                  {[
                    { key: "leastCash", label: "Least cash" },
                    { key: "balanced",  label: "Balanced"   },
                    { key: "leastPops", label: "Least pops" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`control-btn ${goalStrategy === key ? "active" : ""}`}
                      aria-pressed={goalStrategy === key}
                      onClick={() => setGoalStrategy(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="goal-planner-body">
                <div className="goal-controls">
                  <div className="input-section">
                    <div className="input-header">
                      <span className="input-label">
                        <Trophy size={ICON_MD} className="input-icon" aria-hidden="true" /> Target degree
                      </span>
                      <span className="input-badge">{goalResults.targetPower.toLocaleString()} power</span>
                    </div>
                    <div className="control-row">
                      <input
                        type="range" min="2" max="100"
                        aria-label="Target degree"
                        className="range-slider"
                        value={targetDegree}
                        style={{ '--pct': pct(targetDegree, 2, 100) }}
                        onChange={(e) => setTargetDegree(parseInt(e.target.value))}
                      />
                      <input
                        type="number" min="2" max="100"
                        aria-label="Target degree"
                        className="number-input"
                        value={targetDegree}
                        onChange={(e) => setTargetDegree(Math.min(100, Math.max(2, parseInt(e.target.value) || 2)))}
                      />
                    </div>
                    <div className="quick-buttons">
                      {[50, 60, 70, 80, 90, 100].map(d => (
                        <button key={d} className="quick-btn" onClick={() => setTargetDegree(d)}>{d}</button>
                      ))}
                    </div>
                  </div>

                  <div className="input-section">
                    <div className="input-header">
                      <span className="input-label">
                        <Wrench size={ICON_MD} className="input-icon" aria-hidden="true" /> Sources you can use
                      </span>
                    </div>
                    <div className="goal-toggles">
                      {[
                        { id: "t5s",      label: "Extra Tier 5s",   sub: `up to ${allowedT5s} in ${gameMode === "coop" ? "co-op" : "solo"}`, state: goalUseExtraT5s, set: setGoalUseExtraT5s },
                        { id: "upgrades", label: "Upgrade tiers",   sub: "up to 100 tiers, 10,000 power",  state: goalUseUpgrades, set: setGoalUseUpgrades },
                        { id: "totems",   label: "Geraldo totems",  sub: "2,000 power each, uncapped",     state: goalUseTotems,   set: setGoalUseTotems },
                      ].map(({ id, label, sub, state, set }) => (
                        <div key={id} className="goal-toggle-row">
                          <span className="goal-toggle-text">
                            <span className="goal-toggle-label">{label}</span>
                            <span className="goal-toggle-sub">{sub}</span>
                          </span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              className="toggle-switch-input"
                              aria-label={`Use ${label} towards the target degree`}
                              checked={state}
                              onChange={(e) => set(e.target.checked)}
                            />
                            <span className="toggle-switch-label" />
                          </label>
                        </div>
                      ))}

                      <div className="goal-toggle-row">
                        <span className="goal-toggle-text">
                          <span className="goal-toggle-label">Cash investment</span>
                          <span className="goal-toggle-sub">
                            {goalCashMode === "sacrifice" ? "tower sacrifices only — 100% efficient"
                              : goalCashMode === "slider" ? "in-game slider only — 95% efficient"
                              : goalCashMode === "both"   ? "split evenly across both"
                              : "not used"}
                          </span>
                        </span>
                        <div className="control-group goal-cash-group" role="group" aria-label="Cash investment source">
                          {[
                            { key: "none",      label: "None"      },
                            { key: "sacrifice", label: "Sacrifice" },
                            { key: "slider",    label: "Slider"    },
                            { key: "both",      label: "Both"      },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              className={`control-btn ${goalCashMode === key ? "active" : ""}`}
                              aria-pressed={goalCashMode === key}
                              onClick={() => setGoalCashMode(key)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="goal-results">
                  {!goalResults.achievable ? (
                    <div className="goal-impossible">
                      <AlertTriangle size={ICON_MD} aria-hidden="true" />
                      <div className="goal-impossible-text">
                        <strong>Degree {targetDegree} is out of reach</strong> with the sources switched on.
                        <p>
                          You are {goalResults.remainingPower.toLocaleString()} power short. Turn on cash
                          investment or Geraldo totems to close the gap.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="goal-rows">
                      <div className="goal-row">
                        <Target size={ICON_SM} className="goal-row-icon" aria-hidden="true" />
                        <span className="goal-row-label">Pops &amp; income</span>
                        <span className="goal-row-value">{goalResults.popsNeeded.toLocaleString()}</span>
                        {goalResults.popsMaxed && <span className="goal-row-badge maxed">At cap</span>}
                      </div>
                      <div className={`goal-row ${!goalUseUpgrades ? "goal-row-disabled" : ""}`}>
                        <Star size={ICON_SM} className="goal-row-icon" aria-hidden="true" />
                        <span className="goal-row-label">Upgrade tiers</span>
                        <span className="goal-row-value">{goalResults.upgradesNeeded}</span>
                        {goalResults.upgradesMaxed && <span className="goal-row-badge maxed">At cap</span>}
                        {!goalUseUpgrades && <span className="goal-row-badge off">Off</span>}
                      </div>
                      <div className={`goal-row ${!goalUseExtraT5s ? "goal-row-disabled" : ""}`}>
                        <Crown size={ICON_SM} className="goal-row-icon" aria-hidden="true" />
                        <span className="goal-row-label">Extra Tier 5s</span>
                        <span className="goal-row-value">{goalResults.t5sNeeded}</span>
                        {goalResults.t5sMaxed && <span className="goal-row-badge maxed">At cap</span>}
                        {!goalUseExtraT5s && <span className="goal-row-badge off">Off</span>}
                      </div>
                      {goalResults.sacrificeCashNeeded > 0 && (
                        <div className="goal-row">
                          <DollarSign size={ICON_SM} className="goal-row-icon" aria-hidden="true" />
                          <span className="goal-row-label">Cash on sacrifices</span>
                          <span className="goal-row-value">${goalResults.sacrificeCashNeeded.toLocaleString()}</span>
                        </div>
                      )}
                      {goalResults.sliderCashNeeded > 0 && (
                        <div className="goal-row">
                          <DollarSign size={ICON_SM} className="goal-row-icon" aria-hidden="true" />
                          <span className="goal-row-label">Cash on the slider</span>
                          <span className="goal-row-value">${goalResults.sliderCashNeeded.toLocaleString()}</span>
                        </div>
                      )}
                      <div className={`goal-row ${!goalUseTotems ? "goal-row-disabled" : ""}`}>
                        <Gem size={ICON_SM} className="goal-row-icon" aria-hidden="true" />
                        <span className="goal-row-label">Geraldo totems</span>
                        <span className="goal-row-value">{goalResults.totemsNeeded}</span>
                        {!goalUseTotems && <span className="goal-row-badge off">Off</span>}
                      </div>

                      <div className={`goal-total-cash ${goalResults.totalCashNeeded === 0 ? "goal-free" : ""}`}>
                        <span>{goalResults.totalCashNeeded === 0 ? "No cash needed" : "Total cash"}</span>
                        <strong>${goalResults.totalCashNeeded.toLocaleString()}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── GUIDE ── */}
            <section className="guide-card" aria-label="How Paragon degrees are calculated">
              <h2 className="paragon-selector-title">
                <BookOpen size={ICON_LG} aria-hidden="true" /> How Paragon degrees are calculated
              </h2>
              <p className="section-lede">
                A Paragon&rsquo;s degree comes from Paragon Power Points, which top out at{" "}
                {MAX_POWER.toLocaleString()} at Degree 100. Four categories each have their own ceiling;
                Geraldo&rsquo;s totems sit outside all of them. These are the Update 56+ rates.
              </p>

              <div className="guide-grid">
                <div className="guide-column">
                  <h4><Target size={ICON_MD} aria-hidden="true" />Pops &amp; income — 90,000 max</h4>
                  <p>Damage dealt and cash earned by the towers you feed in.</p>
                  <ul className="guide-list">
                    <li>1 power per <strong>180 pops</strong>.</li>
                    <li>1 power per <strong>$45 of cash generated</strong>.</li>
                    <li>$1 of income counts as 4 pops.</li>
                    <li><strong>16,200,000 equivalent pops</strong> fills the category.</li>
                  </ul>
                </div>

                <div className="guide-column">
                  <h4><Star size={ICON_MD} aria-hidden="true" />Upgrade tiers — 10,000 max</h4>
                  <p>Every tier bought on a sacrificed non-T5 tower.</p>
                  <ul className="guide-list">
                    <li>100 power per <strong>upgrade tier</strong>.</li>
                    <li>A 0-2-4 monkey is 6 tiers.</li>
                    <li><strong>100 tiers</strong> fills the category.</li>
                    <li>The three T5s the Paragon consumes do not count.</li>
                  </ul>
                </div>

                <div className="guide-column">
                  <h4><DollarSign size={ICON_MD} aria-hidden="true" />Cash invested — 60,000 max</h4>
                  <p>Money spent on sacrifices, or pushed in on the slider.</p>
                  <ul className="guide-list">
                    <li>Sacrificed towers: 20,000 power per base price spent — <strong>100% efficient</strong>.</li>
                    <li>Cash slider: the same power costs 5% more — <strong>95% efficient</strong>.</li>
                    <li><strong>3.0× base price</strong> in sacrifices fills the category.</li>
                    <li><strong>3.15× base price</strong> is the slider&rsquo;s hard limit.</li>
                  </ul>
                </div>

                <div className="guide-column">
                  <h4><Gem size={ICON_MD} aria-hidden="true" />Geraldo&rsquo;s totems — uncapped</h4>
                  <p>Each Paragon Power Totem adds a flat 2,000 power.</p>
                  <ul className="guide-list">
                    <li>Solo, the four categories stop at <strong>{SOLO.power.toLocaleString()} power</strong> — Degree {SOLO.degree}.</li>
                    <li>A solo Dart Monkey or Ice Monkey reaches <strong>{SOLO_DART.power.toLocaleString()}</strong> — Degree {SOLO_DART.degree}.</li>
                    <li>Closing the gap takes <strong>{SOLO.totems} totems</strong>, or <strong>{SOLO_DART.totems}</strong> with that extra Tier 5.</li>
                    <li>In co-op, four players&rsquo; Tier 5s reach Degree 100 with no totems at all.</li>
                  </ul>
                </div>
              </div>
            </section>

            <AdUnit slot="1122334455" format="auto" />
          </main>

          {/* ── PRIVACY POLICY — required for AdSense ── */}
          <section className="privacy-policy-section" id="privacy-policy" aria-label="Privacy policy">
            <h2 className="paragon-selector-title">Privacy policy</h2>
            <div className="privacy-content">
              <p><strong>Last updated:</strong> May 27, 2026</p>

              <h3>What we collect</h3>
              <p>
                This site does not collect personal information directly. It serves ads through Google
                AdSense, which may use cookies and web beacons to select ads based on your prior visits
                to this and other sites.
              </p>

              <h3>Third-party advertising</h3>
              <p>
                Google may use cookies to personalise ads. You can opt out of personalised advertising in{" "}
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>,
                and read how Google uses this data in{" "}
                <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google&rsquo;s Privacy &amp; Terms</a>.
              </p>

              <h3>Analytics</h3>
              <p>
                Vercel Analytics records aggregated, anonymised page views. No personally identifiable
                information is stored.
              </p>

              <h3>Cookies and local storage</h3>
              <p>
                Your theme preference and any builds you save stay in your own browser&rsquo;s local
                storage — they are never sent anywhere. Google AdSense sets its own third-party cookies,
                which you can control in your browser settings.
              </p>

              <h3>Contact</h3>
              <p>
                Questions about this policy belong in an issue on the{" "}
                <a href="https://github.com/levisager11-oss/paragon-calc/issues" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
              </p>
            </div>
          </section>
        </div>

        <footer className="site-footer">
          <nav className="footer-nav" aria-label="Footer">
            <a href="/paragons">All 13 Paragons</a>
            <span className="footer-sep" aria-hidden="true">·</span>
            <a href="/faq">FAQ</a>
            <span className="footer-sep" aria-hidden="true">·</span>
            <a href="#privacy-policy">Privacy policy</a>
            <span className="footer-sep" aria-hidden="true">·</span>
            <a href="https://github.com/levisager11-oss/paragon-calc" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
            <span className="footer-sep" aria-hidden="true">·</span>
            <a href="https://github.com/levisager11-oss/paragon-calc#api" target="_blank" rel="noopener noreferrer">JSON API</a>
          </nav>
          <p>
            An open-source degree calculator for Bloons TD 6 Paragons. The degree curve and power caps
            are community-documented and pinned in the repository&rsquo;s test suite against four known
            in-game values.
          </p>
          <p>
            &copy; {new Date().getFullYear()} Paragon Calculator. Bloons TD 6 is a trademark of Ninja
            Kiwi. This project is not affiliated with or endorsed by Ninja Kiwi.
          </p>
        </footer>
      </div>

      {/* ── POP COUNT ADDER ── */}
      {popAdderOpen && (
        <div className="pop-adder-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePopAdder(); }}>
          <div className="pop-adder-modal" role="dialog" aria-modal="true" aria-labelledby="pop-adder-heading">
            <div className="pop-adder-header">
              <h2 className="pop-adder-title" id="pop-adder-heading">
                <Calculator size={ICON_MD} aria-hidden="true" />
                Add up tower pops
              </h2>
              <button className="pop-adder-close" onClick={closePopAdder} aria-label="Close">
                <X size={ICON_SM} />
              </button>
            </div>

            <p className="pop-adder-hint">
              One row per tower. <kbd>Enter</kbd> adds a row, <kbd>Backspace</kbd> on an empty row removes it.
            </p>

            <div className="pop-adder-entries">
              {popAdderEntries.map((val, idx) => (
                <div key={idx} className="pop-adder-row">
                  <span className="pop-adder-index" aria-hidden="true">{idx + 1}</span>
                  <input
                    ref={el => (popAdderRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    className="pop-adder-input"
                    aria-label={`Tower ${idx + 1} pop count`}
                    placeholder="350,000"
                    value={val}
                    onChange={(e) => handlePopAdderChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePopAdderKeyDown(e, idx)}
                  />
                  <button
                    className="pop-adder-remove"
                    onClick={() => removePopAdderEntry(idx)}
                    tabIndex={-1}
                    aria-label={`Remove tower ${idx + 1}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              <button
                className="pop-adder-add-row"
                onClick={() => {
                  setPopAdderEntries(prev => [...prev, ""]);
                  setTimeout(() => popAdderRefs.current[popAdderEntries.length]?.focus(), 0);
                }}
              >
                <Plus size={ICON_SM} aria-hidden="true" /> Add row
              </button>
            </div>

            <div className="pop-adder-footer">
              <p className="pop-adder-total">
                Total <strong>{popAdderTotal.toLocaleString()}</strong> pops
              </p>
              <div className="pop-adder-actions">
                <button className="quick-btn" onClick={closePopAdder}>Cancel</button>
                <button className="pop-adder-apply" onClick={applyPopAdder}>Use this total</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Analytics />
      <SpeedInsights />
    </>
  );
}
