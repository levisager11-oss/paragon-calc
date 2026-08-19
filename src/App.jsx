import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  User, Users, Wrench, Target, Star, Crown, DollarSign, Sparkles,
  RotateCcw, BarChart3, AlertTriangle, Key, Lightbulb, ArrowRight,
  Trophy, BookOpen, Search, X, Plus, Calculator, Sun, Moon,
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { PARAGONS, DIFFICULTY_MULTIPLIERS } from "./constants/paragons";
import {
  calculateParagonData, reverseCalculate, getBasePrice, splitIntoSacrificeTowers,
  maxT5sFor, soloCeilingFacts, MAX_POWER,
} from "./utils/calculator";
import AdUnit from "./components/AdUnit";
import TicketCalculator from "./components/TicketCalculator";
import BuildToolbar from "./components/BuildToolbar";
import { decodeState, encodeState } from "./utils/shareState";

const pct = (val, min, max) => `${Math.round(((val - min) / (max - min)) * 100)}%`;

// Derive which design the current URL is pointing at. Each design now lives at
// its own route (/classic and /ticket) so the two layouts are effectively
// separate sites that can be linked and bookmarked independently. Returns null
// when the path doesn't name a design (e.g. the bare "/" landing).
const designFromPath = () => {
  const p = window.location.pathname;
  if (p.startsWith("/ticket")) return "ticket";
  if (p.startsWith("/classic")) return "classic";
  return null;
};

const pathForDesign = (mode) => (mode === "ticket" ? "/ticket" : "/classic");

// Solo ceilings quoted in the guide, derived from the engine so the prose can
// never contradict the calculator on the same page.
const SOLO = soloCeilingFacts(PARAGONS.ascended_shadow);
const SOLO_DART = soloCeilingFacts(PARAGONS.apex_plasma_master);

const ICON_SM = 16;
const ICON_MD = 18;
const ICON_LG = 20;

export default function App() {
  // 1. Core State — the initial build is read from the URL (?paragon=&diff=&pops=…)
  // so shared links and the /paragons deep links open with the build preloaded.
  const initialBuild = useMemo(() => decodeState(window.location.search), []);
  const [selectedParagonId, setSelectedParagonId] = useState(() => initialBuild.paragon);
  const [difficulty, setDifficulty] = useState(() => initialBuild.difficulty);
  const [gameMode, setGameMode] = useState(() => initialBuild.gameMode); // "solo" or "coop"
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("theme") === "light");
  // Which visual design to render: "classic" (default dark UI) or "ticket"
  // (neo-brutalist arcade ticket). The active design is driven by the URL route
  // (/classic vs /ticket); we fall back to the last-used design (persisted) for
  // the bare "/" landing so returning visitors keep their preference.
  const [designMode, setDesignMode] = useState(() => {
    const fromPath = designFromPath();
    if (fromPath) return fromPath;
    return localStorage.getItem("design") === "ticket" ? "ticket" : "classic";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
    localStorage.setItem("theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  useEffect(() => {
    localStorage.setItem("design", designMode);
  }, [designMode]);

  // Keep the design in sync with the URL: canonicalise the bare "/" landing to
  // the active design's route, and react to browser back/forward navigation.
  useEffect(() => {
    if (!designFromPath()) {
      // Keep the search string: it carries the shared build.
      window.history.replaceState({}, "", pathForDesign(designMode) + window.location.search);
    }
    const onPop = () => {
      const fromPath = designFromPath();
      if (fromPath) setDesignMode(fromPath);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Run once on mount; designMode is only read for the initial canonicalise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchInputRef = useRef(null);

  // Goal Planner state
  const [targetDegree, setTargetDegree]         = useState(100);
  const [goalUseExtraT5s, setGoalUseExtraT5s] = useState(true);
  const [goalUseUpgrades, setGoalUseUpgrades] = useState(true);
  const [goalCashMode, setGoalCashMode]       = useState("sacrifice"); // "none" | "sacrifice" | "slider"
  const [goalUseTotems, setGoalUseTotems]     = useState(true);
  const [goalStrategy, setGoalStrategy]         = useState("leastCash");

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

  // Navigate between the two designs by changing the route. This updates the
  // rendered design, pushes a real browser history entry so /classic and /ticket
  // are linkable and work with back/forward, and — importantly — carries the
  // current build along in the query string. The two designs keep separate
  // internal state, so without that the inputs would be lost on every switch,
  // and a shared /?paragon=…&pops=… link would be stripped on arrival.
  //
  // `build` is supplied by the Ticket design when it hands control back, so its
  // inputs flow into the classic UI too.
  const selectDesign = useCallback((mode, build) => {
    window.history.pushState({}, "", `${pathForDesign(mode)}?${encodeState(build ?? currentState)}`);
    if (build) applyState(build);
    setDesignMode(mode);
  }, [currentState, applyState]);

  // Pop Count Adder state
  const [popAdderOpen, setPopAdderOpen] = useState(false);
  const [popAdderEntries, setPopAdderEntries] = useState([""]);
  const popAdderRefs = useRef([]);
  const popAdderModalRef = useRef(null);

  const popAdderTotal = useMemo(() => {
    return popAdderEntries.reduce((sum, v) => sum + (parseInt(v.replace(/,/g, "")) || 0), 0);
  }, [popAdderEntries]);

  const openPopAdder = useCallback(() => {
    setPopAdderEntries([""]);
    setPopAdderOpen(true);
  }, []);

  const closePopAdder = useCallback(() => {
    setPopAdderOpen(false);
    setPopAdderEntries([""]);
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
      setPopAdderEntries(prev => {
        const next = [...prev.slice(0, idx + 1), "", ...prev.slice(idx + 1)];
        return next;
      });
      setTimeout(() => {
        const nextRef = popAdderRefs.current[idx + 1];
        if (nextRef) nextRef.focus();
      }, 0);
    } else if (e.key === "Backspace" && popAdderEntries[idx] === "" && popAdderEntries.length > 1) {
      e.preventDefault();
      setPopAdderEntries(prev => {
        const next = prev.filter((_, i) => i !== idx);
        return next;
      });
      setTimeout(() => {
        const prevRef = popAdderRefs.current[Math.max(0, idx - 1)];
        if (prevRef) prevRef.focus();
      }, 0);
    }
  }, [popAdderEntries]);

  const removePopAdderEntry = useCallback((idx) => {
    setPopAdderEntries(prev => {
      if (prev.length === 1) return [""];
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  useEffect(() => {
    if (popAdderOpen) {
      setTimeout(() => {
        if (popAdderRefs.current[0]) popAdderRefs.current[0].focus();
      }, 50);
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
  const maxT4Cost = useMemo(() => {
    if (!activeParagon.maxT4MediumCost) return 0;
    return getBasePrice(activeParagon.maxT4MediumCost, difficulty);
  }, [activeParagon, difficulty]);

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

  // Render the alternate "ticket" design instead of the classic UI when selected.
  // All hooks above run unconditionally, so this early return is hook-safe.
  if (designMode === "ticket") {
    return (
      <TicketCalculator
        designMode={designMode}
        onSetDesign={selectDesign}
        lightMode={lightMode}
        onSetTheme={setLightMode}
      />
    );
  }

  return (
    <div className="container">
      {/* HEADER SECTION */}
      <header>
        <div className="logo-section">
          <div className="logo-icon">
            <img src="/logo.png" alt="BTD6 Paragon Calculator Logo" width="40" height="40" style={{ objectFit: "contain" }} />
          </div>
          <div className="logo-text">
            <h1>BTD6 Paragon Calculator</h1>
            <p>Bloons TD 6 • Update 54+ Certified</p>
          </div>
        </div>

        <div className="controls-header">
          {/* Difficulty Selector */}
          <div className="control-group">
            {Object.keys(DIFFICULTY_MULTIPLIERS).map((key) => (
              <button
                key={key}
                className={`control-btn ${difficulty === key ? "active" : ""}`}
                onClick={() => setDifficulty(key)}
              >
                {DIFFICULTY_MULTIPLIERS[key].name} ({DIFFICULTY_MULTIPLIERS[key].value}x)
              </button>
            ))}
          </div>

          {/* Game Mode Selector */}
          <div className="control-group">
            <button
              className={`control-btn ${gameMode === "solo" ? "active" : ""}`}
              onClick={() => setGameMode("solo")}
            >
              <User size={ICON_SM} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Solo
            </button>
            <button
              className={`control-btn ${gameMode === "coop" ? "active" : ""}`}
              onClick={() => setGameMode("coop")}
            >
              <Users size={ICON_SM} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Co-op
            </button>
          </div>

          {/* Design Selector — switch between the Classic and Ticket layouts */}
          <div className="control-group">
            <button
              className={`control-btn ${designMode === "classic" ? "active" : ""}`}
              onClick={() => selectDesign("classic")}
            >
              Classic
            </button>
            <button
              className={`control-btn ${designMode === "ticket" ? "active" : ""}`}
              onClick={() => selectDesign("ticket")}
            >
              Ticket
            </button>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={() => setLightMode(prev => !prev)}
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={lightMode ? "Switch to dark mode" : "Switch to light mode"}
          >
            {lightMode ? <Moon size={ICON_MD} /> : <Sun size={ICON_MD} />}
          </button>
        </div>
      </header>

      {/* BUILD ACTIONS — share / save / embed / export (top of page) */}
      <BuildToolbar state={currentState} results={results} paragon={activeParagon} onLoadState={applyState} sharePath="/classic" />

      {/* AD: Top Banner */}
      <AdUnit slot="1234567890" format="horizontal" style={{ marginBottom: "1.5rem", textAlign: "center" }} />

      {/* PARAGON SELECTOR — SEARCH */}
      <section style={{ marginBottom: "2rem", padding: "2rem 0" }} aria-label="Paragon selector">
        {/* Search bar + dropdown */}
        <div className="paragon-search-wrapper">
          <div className="paragon-search-bar">
            <Search size={ICON_MD} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="paragon-search-input"
              placeholder="Search by name, tower or class…"
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
                <X size={13} />
              </button>
            )}
          </div>

          {showDropdown && (
            <div className="paragon-dropdown">
              {searchResults.length > 0 ? searchResults.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`paragon-dropdown-item ${p.category}`}
                  onMouseDown={() => handleSelectParagon(p.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectParagon(p.id); } }}
                >
                  <span className="dropdown-icon">{p.icon}</span>
                  <div className="dropdown-info">
                    <span className="dropdown-name">{p.name}</span>
                    <span className="dropdown-sub">
                      {p.tower} · <span className={`dropdown-tag ${p.category}`}>{p.category}</span>
                    </span>
                  </div>
                  <span className="dropdown-price">${getBasePrice(p.mediumCost, difficulty).toLocaleString()}</span>
                </button>
              )) : (
                <div className="dropdown-empty">No paragons match "{searchQuery}"</div>
              )}
            </div>
          )}
        </div>

        {/* Active selection chip */}
        <div className={`paragon-active-chip ${activeParagon.category}`}>
          <span className="active-chip-icon">{activeParagon.icon}</span>
          <div className="active-chip-info">
            <span className="active-chip-name">{activeParagon.name}</span>
            <span className="active-chip-tower">{activeParagon.tower}</span>
          </div>
          <span className={`active-chip-tag ${activeParagon.category}`}>{activeParagon.category}</span>
          <span className="active-chip-price">${getBasePrice(activeParagon.mediumCost, difficulty).toLocaleString()}</span>
        </div>

        {/* Related suggestions */}
        <div className="paragon-suggestions">
          <span className="suggestions-label">Related</span>
          {suggestions.map(p => (
            <button
              key={p.id}
              className={`suggestion-chip ${p.category}`}
              onClick={() => handleSelectParagon(p.id)}
            >
              <span>{p.icon}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* CORE WORKSPACE */}
      <main>
      <div className={`dashboard-grid ${activeParagon.category}-accent`}>
        {/* Left Side: Inputs */}
        <section className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 className="panel-title" style={{ border: "none", margin: 0, padding: 0 }}>
              Sacrifice Dashboard
            </h2>
            <button className="quick-btn" onClick={resetInputs} style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
              <RotateCcw size={ICON_SM} style={{ verticalAlign: "-3px", marginRight: 4 }} /> Reset Fields
            </button>
          </div>

          <div className="input-section">
            <div className="input-header">
              <span className="input-label">
                <Target size={ICON_MD} className="input-icon" /> Pops & Income
              </span>
              <span className="input-badge">Max: 16.2M Equiv. Pops</span>
            </div>
            <div className="input-controls">
              {/* Pops Input */}
              <div className="control-row">
                <div>
                  <label htmlFor="pops-range" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Total Tower Pops (Damage)
                  </label>
                  <input
                    type="range"
                    min="0"
                    id="pops-range"
                    max="16200000"
                    step="50000"
                    className={`range-slider ${activeParagon.category}-accent`}
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

              {/* Income Input */}
              <div className="control-row" style={{ marginTop: "0.5rem" }}>
                <div>
                  <label htmlFor="income-range" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Total Cash Generated (e.g. Buccaneer/Engi)
                  </label>
                  <input
                    type="range"
                    min="0"
                    id="income-range"
                    max="4050000"
                    step="10000"
                    className={`range-slider ${activeParagon.category}-accent`}
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

              <div className="quick-buttons">
                <button className="quick-btn" onClick={() => setPops(0)}>Reset Pops</button>
                <button className="quick-btn" onClick={setMaxPops}>Max Pops (16.2M)</button>
                <button className="quick-btn" onClick={() => setIncome(0)}>Reset Income</button>
                <button className="quick-btn" onClick={setMaxIncome}>Max Income ($4.05M)</button>
                <button className="quick-btn pop-adder-trigger-btn" onClick={openPopAdder}>
                  <Calculator size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Add up tower pops
                </button>
              </div>
            </div>
          </div>

          {/* Upgrades Section */}
          <div className="input-section">
            <div className="input-header">
              <span className="input-label">
                <Star size={ICON_MD} className="input-icon" /> Sacrificed Non-T5 Upgrades
              </span>
              <span className="input-badge">Max: 100 Upgrades</span>
            </div>
            <div className="input-controls">
              <div className="control-row">
                <div>
                  <label htmlFor="upgrades-range" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Total upgrade tiers (e.g. four 0-2-4 towers = 4 * 6 = 24 upgrades)
                  </label>
                  <input
                    type="range"
                    id="upgrades-range"
                    min="0"
                    max="100"
                    className={`range-slider ${activeParagon.category}-accent`}
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
                <button className="quick-btn" onClick={() => setUpgrades(0)}>0 Upgrades</button>
                <button className="quick-btn" onClick={() => setUpgrades(50)}>50 Upgrades</button>
                <button className="quick-btn" onClick={setMaxUpgrades}>Max effective (100)</button>
              </div>
            </div>
          </div>

          {/* Extra T5s Section */}
          <div className="input-section">
            <div className="input-header">
              <span className="input-label">
                <Crown size={ICON_MD} className="input-icon" /> Extra T5s Sacrificed
              </span>
              <span className="input-badge">Max: 50,000 Power</span>
            </div>
            <div className="input-controls">
              <div className="control-row">
                <div style={{ paddingRight: "1rem" }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    {gameMode === "solo" ? (
                      selectedParagonId === "apex_plasma_master" ? (
                        "In Solo mode, Dart Monkey gets 1 extra T5 sacrifice due to the 'Master Double Cross' Monkey Knowledge (allows 2 Crossbow Masters)."
                      ) : (
                        `In Solo mode, you cannot sacrifice extra T5s of ${activeParagon.tower}s. Toggle Co-op mode at the top right to simulate multiplayer sacrifices!`
                      )
                    ) : (
                      "In Co-op mode, each player can place their own Tier 5s. You can sacrifice up to 9 extra T5s total."
                    )}
                  </p>
                </div>
                <div>
                  {gameMode === "solo" && selectedParagonId !== "apex_plasma_master" ? (
                    <input
                      type="number"
                      className="number-input"
                      value={0}
                      disabled
                      style={{ opacity: 0.5, cursor: "not-allowed" }}
                    />
                  ) : (
                    <input
                      type="number"
                      className="number-input"
                      min="0"
                      aria-label="Extra Tier 5 towers sacrificed"
                      max={gameMode === "solo" ? 1 : 9}
                      value={extraT5s}
                      onChange={(e) => {
                        const maxVal = gameMode === "solo" ? 1 : 9;
                        setExtraT5s(Math.min(maxVal, Math.max(0, parseInt(e.target.value) || 0)));
                      }}
                    />
                  )}
                </div>
              </div>
              {gameMode === "coop" && (
                <div className="quick-buttons">
                  <button className="quick-btn" onClick={() => setExtraT5s(0)}>0 extra T5s</button>
                  <button className="quick-btn" onClick={() => setExtraT5s(4)}>4 extra T5s</button>
                  <button className="quick-btn" onClick={() => setExtraT5s(9)}>Max power (9 extra T5s)</button>
                </div>
              )}
            </div>
          </div>

          {/* Cash Investment Section */}
          <div className="input-section">
            <div className="input-header">
              <span className="input-label">
                <DollarSign size={ICON_MD} className="input-icon" /> Cash Investment
              </span>
              <span className="input-badge">Max: 60,000 Power</span>
            </div>
            <div className="input-controls">
              {/* Sacrifice Tower Cash */}
              <div className="control-row">
                <div>
                  <label htmlFor="sacrifice-cash-range" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    Value of Sacrificed Non-T5 Towers (<strong>100% efficient</strong>)
                  </label>
                  <input
                    type="range"
                    min="0"
                    id="sacrifice-cash-range"
                    max={currentBasePrice * 3}
                    step="5000"
                    className={`range-slider ${activeParagon.category}-accent`}
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

              {/* Slider Cash */}
              <div className="control-row" style={{ marginTop: "0.5rem" }}>
                <div>
                  <label htmlFor="slider-cash-range" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>
                    In-Game Cash Slider Injection (<strong>95% efficient</strong>)
                  </label>
                  <input
                    type="range"
                    min="0"
                    id="slider-cash-range"
                    max={maxSliderLimit}
                    step="5000"
                    className={`range-slider ${activeParagon.category}-accent`}
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

              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                * Max cash slider injection in-game is 3.15x the base price:{" "}
                <strong style={{ color: "var(--text-primary)" }}>${maxSliderLimit.toLocaleString()}</strong>.
              </div>

              {/* Slider → Sacrifice optimizer */}
              {maxT4Cost > 0 && (
                <div className="cash-optimize">
                  <div className="cash-optimize-info">
                    Most expensive sacrificeable tower:{" "}
                    <strong>{activeParagon.tower} ({activeParagon.maxT4Build})</strong> ={" "}
                    <strong style={{ color: "var(--text-primary)" }}>${maxT4Cost.toLocaleString()}</strong>.
                    {" "}Slider cash carries a 5% premium, so building whole sacrifice
                    towers with it is always cheaper.
                  </div>
                  {sliderTowerSplit.towers > 0 ? (
                    <button className="quick-btn cash-optimize-btn" onClick={optimizeCash}>
                      <Lightbulb size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                      Optimize: move {sliderTowerSplit.towers} tower{sliderTowerSplit.towers > 1 ? "s" : ""} ($
                      {sliderTowerSplit.sacrificeCash.toLocaleString()}) from slider → sacrifices
                    </button>
                  ) : sliderCash > 0 ? (
                    <div className="cash-optimize-note">
                      Slider holds less than one full tower — nothing to move.
                    </div>
                  ) : null}
                </div>
              )}

              <div className="quick-buttons">
                <button
                  className="quick-btn"
                  onClick={() => {
                    setSacrificedTowerCash(currentBasePrice * 3);
                    setSliderCash(0);
                  }}
                >
                  Max via Sacrifices (${(currentBasePrice * 3).toLocaleString()})
                </button>
                <button
                  className="quick-btn"
                  onClick={() => {
                    setSliderCash(maxSliderLimit);
                    setSacrificedTowerCash(0);
                  }}
                >
                  Max via Slider (${maxSliderLimit.toLocaleString()})
                </button>
                <button
                  className="quick-btn"
                  onClick={() => {
                    setSacrificedTowerCash(0);
                    setSliderCash(0);
                  }}
                >
                  Clear Cash
                </button>
              </div>
            </div>
          </div>

          {/* Geraldo's Totems */}
          <div className="input-section" style={{ marginBottom: 0 }}>
            <div className="input-header">
              <span className="input-label">
                <Sparkles size={ICON_MD} className="input-icon" /> Geraldo's Totems
              </span>
              <span className="input-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fcd34d" }}>
                Uncapped Contribution (+2k pts each)
              </span>
            </div>
            <div className="input-controls">
              <div className="control-row">
                <div style={{ paddingRight: "1rem" }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    Each Paragon Power Totem purchased from Geraldo adds 2,000 flat power. In Solo
                    games this is the only way to bypass the power caps and reach <strong>Degree 100</strong> —
                    {SOLO.totems} totems on top of a maxed build, or {SOLO_DART.totems} for a Dart Monkey.
                  </p>
                </div>
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
                <button className="quick-btn" onClick={() => setTotems(0)}>0 Totems</button>
                <button className="quick-btn" onClick={() => setTotems(10)}>10 Totems</button>
                <button className="quick-btn" onClick={() => setTotems(20)}>20 Totems</button>
                <button className="quick-btn" onClick={() => setTotems(45)}>45 Totems</button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Sticky Results & Diagnostics */}
        <section className="sticky-results">
          {/* Circular Gauge Card */}
          <div className="panel" style={{ padding: "1.5rem" }}>
            <div className="gauge-container">
              <div className={`circular-gauge ${results.degree === 100 ? "perfect-glow" : ""}`}>
                <div className="gauge-glow-ring"></div>
                <span className="degree-label">Degree</span>
                <span className="degree-number">{results.degree}</span>
                <span className="power-total">
                  <span className="power-label-bold">{results.totalPower.toLocaleString()}</span> / 200,000
                </span>
              </div>
            </div>

            {/* In-Game Abilities highlight */}
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
              <h4 style={{ fontSize: "0.95rem", fontFamily: "var(--font-heading)", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                <Key size={ICON_SM} style={{ verticalAlign: "-3px", marginRight: 4 }} /> Key Capabilities:
              </h4>
              <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {activeParagon.abilities.map((ability, index) => (
                  <li key={index}>{ability}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Warnings Banner */}
          {results.warnings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {results.warnings.map((w, idx) => (
                <div key={idx} className="waste-banner">
                  <AlertTriangle size={ICON_LG} className="waste-icon" />
                  <div className="waste-text">
                    {w.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Power Contributors Breakdown */}
          <div className="breakdown-card">
            <h3 className="breakdown-title">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BarChart3 size={ICON_LG} /> Power Breakdown</span>
            </h3>

            {/* Pops */}
            <div className="breakdown-row">
              <div className="breakdown-header">
                <span className="breakdown-name">
                  <Target size={ICON_SM} /> Pops & Income
                </span>
                <span className="breakdown-val">
                  {results.powerBreakdown.pops.power.toLocaleString()} / {results.powerBreakdown.pops.max.toLocaleString()} pts
                </span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill pops-bar" style={{ width: `${results.powerBreakdown.pops.pct}%` }}></div>
              </div>
            </div>

            {/* Upgrades */}
            <div className="breakdown-row">
              <div className="breakdown-header">
                <span className="breakdown-name">
                  <Star size={ICON_SM} /> Upgrades Value
                </span>
                <span className="breakdown-val">
                  {results.powerBreakdown.upgrades.power.toLocaleString()} / {results.powerBreakdown.upgrades.max.toLocaleString()} pts
                </span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill upgrades-bar" style={{ width: `${results.powerBreakdown.upgrades.pct}%` }}></div>
              </div>
            </div>

            {/* Cash */}
            <div className="breakdown-row">
              <div className="breakdown-header">
                <span className="breakdown-name">
                  <DollarSign size={ICON_SM} /> Cash Investment
                </span>
                <span className="breakdown-val">
                  {results.powerBreakdown.cash.power.toLocaleString()} / {results.powerBreakdown.cash.max.toLocaleString()} pts
                </span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill cash-bar" style={{ width: `${results.powerBreakdown.cash.pct}%` }}></div>
              </div>
            </div>

            {/* Extra T5s */}
            <div className="breakdown-row">
              <div className="breakdown-header">
                <span className="breakdown-name">
                  <Crown size={ICON_SM} /> Extra T5s
                </span>
                <span className="breakdown-val">
                  {results.powerBreakdown.t5.power.toLocaleString()} / {results.powerBreakdown.t5.max.toLocaleString()} pts
                </span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill t5-bar" style={{ width: `${results.powerBreakdown.t5.pct}%` }}></div>
              </div>
            </div>

            {/* Geraldo Totems */}
            {results.powerBreakdown.totems.power > 0 && (
              <div className="breakdown-row">
                <div className="breakdown-header">
                  <span className="breakdown-name" style={{ color: "#fcd34d" }}>
                    <Sparkles size={ICON_SM} /> Geraldo's Totems
                  </span>
                  <span className="breakdown-val" style={{ color: "#fcd34d" }}>
                    +{results.powerBreakdown.totems.power.toLocaleString()} pts
                  </span>
                </div>
                <div className="progress-bar-container" style={{ background: "rgba(245, 158, 11, 0.12)" }}>
                  <div className="progress-bar-fill totems-bar" style={{ width: "100%" }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations Card */}
          {results.degree < 100 && results.recommendations.length > 0 && (
            <div className="diagnostics-card recommendations">
              <h3 className="diagnostics-title rec-title">
                <Lightbulb size={ICON_LG} /> Road to Degree {results.nextDegree}
              </h3>
              <ul className="diag-list">
                {results.recommendations.map((rec, idx) => (
                  <li key={idx} className="diag-item rec-item">
                    <ArrowRight size={ICON_SM} className="diag-bullet rec-bullet" />
                    <span>{rec.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Maxed Banner */}
          {results.degree === 100 && (
            <div className="diagnostics-card maxed">
              <h3 className="diagnostics-title maxed-title" style={{ margin: 0 }}>
                <Trophy size={ICON_LG} /> Perfect Paragon Achieved!
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#a7f3d0", marginTop: "0.5rem", lineHeight: "1.4" }}>
                You have reached Degree 100 (200,000 points). This is the absolute peak performance for a Paragon! Any further upgrades or investments are purely cosmetic.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* AD: Mid-page */}
      <AdUnit slot="0987654321" format="auto" style={{ margin: "2rem 0", textAlign: "center" }} />

      {/* GOAL PLANNER */}
      <div className="panel goal-planner-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h2 className="panel-title" style={{ marginBottom: "0.2rem" }}>Goal Planner</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
              Set a target degree — the calculator finds the optimal path.
            </p>
          </div>
          <div className="control-group">
            {[
              { key: "leastCash", label: "Least Cash" },
              { key: "balanced",  label: "Balanced"   },
              { key: "leastPops", label: "Least Pops" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`control-btn ${goalStrategy === key ? "active" : ""}`}
                onClick={() => setGoalStrategy(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="goal-planner-body">
          {/* LEFT: Controls */}
          <div className="goal-controls">
            {/* Degree selector */}
            <div className="input-section" style={{ marginBottom: "1.25rem" }}>
              <div className="input-header">
                <span className="input-label"><Trophy size={ICON_MD} className="input-icon" /> Target Degree</span>
                <span className="input-badge">{goalResults.targetPower.toLocaleString()} pts</span>
              </div>
              <div className="control-row">
                <input
                  type="range" min="2" max="100"
                  aria-label="Target degree"
                  className={`range-slider ${activeParagon.category}-accent`}
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
              <div className="quick-buttons" style={{ marginTop: "0.6rem" }}>
                {[50, 60, 70, 80, 90, 100].map(d => (
                  <button key={d} className="quick-btn" onClick={() => setTargetDegree(d)}>Deg {d}</button>
                ))}
              </div>
            </div>

            {/* Source toggles */}
            <div className="input-section" style={{ marginBottom: 0 }}>
              <div className="input-header">
                <span className="input-label"><Wrench size={ICON_MD} className="input-icon" /> Available Sources</span>
              </div>
              <div className="goal-toggles">
                {[
                  { label: "Extra T5s",       sub: `max ${maxT5sFor(activeParagon, gameMode)} in ${gameMode}`, state: goalUseExtraT5s, set: setGoalUseExtraT5s },
                  { label: "Upgrade Tiers",   sub: "max 100 upgrades (10,000 pts)", state: goalUseUpgrades, set: setGoalUseUpgrades },
                  { label: "Geraldo Totems", sub: "+2,000 pts each", state: goalUseTotems, set: setGoalUseTotems },
                ].map(({ label, sub, state, set }) => (
                  <div key={label} className="goal-toggle-row">
                    <div className="goal-toggle-text">
                      <span className="goal-toggle-label">{label}</span>
                      <span className="goal-toggle-sub">{sub}</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        className="toggle-switch-input"
                        aria-label={`Use ${label} towards the target degree`}
                        checked={state}
                        onChange={(e) => set(e.target.checked)}
                      />
                      <span className="toggle-switch-label"></span>
                    </label>
                  </div>
                ))}

                {/* Cash investment — 3-way segmented control */}
                <div className="goal-toggle-row">
                  <div className="goal-toggle-text">
                    <span className="goal-toggle-label">Cash Investment</span>
                    <span className="goal-toggle-sub">
                      {goalCashMode === "sacrifice" ? "100% efficient — tower sacrifices" : goalCashMode === "slider" ? "95% efficient — in-game slider" : goalCashMode === "both" ? "50/50 split — sacrifice + slider" : "disabled"}
                    </span>
                  </div>
                  <div className="control-group goal-cash-group">
                    {[
                      { key: "none",     label: "None"     },
                      { key: "sacrifice",label: "Sacrifice" },
                      { key: "slider",   label: "Slider"   },
                      { key: "both",     label: "Both"     },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        className={`control-btn ${goalCashMode === key ? "active" : ""}`}
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

          {/* RIGHT: Results */}
          <div className="goal-results">
            {!goalResults.achievable ? (
              <div className="goal-impossible">
                <AlertTriangle size={22} />
                <div>
                  <strong>Not achievable</strong> with these sources.
                  <p>Still need <strong>{goalResults.remainingPower.toLocaleString()} more power</strong>. Enable Cash or Totems to fill the gap.</p>
                </div>
              </div>
            ) : (
              <div className="goal-rows">
                <div className="goal-row">
                  <Target size={ICON_MD} className="goal-row-icon" />
                  <span className="goal-row-label">Pops &amp; Income</span>
                  <span className="goal-row-value">{goalResults.popsNeeded.toLocaleString()}</span>
                  {goalResults.popsMaxed && <span className="goal-row-badge maxed">MAXED</span>}
                </div>
                <div className={`goal-row ${!goalUseUpgrades ? "goal-row-disabled" : ""}`}>
                  <Star size={ICON_MD} className="goal-row-icon" />
                  <span className="goal-row-label">Upgrade Tiers</span>
                  <span className="goal-row-value">{goalResults.upgradesNeeded}</span>
                  {goalResults.upgradesMaxed && <span className="goal-row-badge maxed">MAXED</span>}
                  {!goalUseUpgrades && <span className="goal-row-badge off">OFF</span>}
                </div>
                <div className={`goal-row ${!goalUseExtraT5s ? "goal-row-disabled" : ""}`}>
                  <Crown size={ICON_MD} className="goal-row-icon" />
                  <span className="goal-row-label">Extra T5s</span>
                  <span className="goal-row-value">{goalResults.t5sNeeded}</span>
                  {goalResults.t5sMaxed && <span className="goal-row-badge maxed">MAXED</span>}
                  {!goalUseExtraT5s && <span className="goal-row-badge off">OFF</span>}
                </div>
                {goalResults.sacrificeCashNeeded > 0 && (
                  <div className="goal-row">
                    <DollarSign size={ICON_MD} className="goal-row-icon" />
                    <span className="goal-row-label">Cash Sacrifice</span>
                    <span className="goal-row-value">${goalResults.sacrificeCashNeeded.toLocaleString()}</span>
                  </div>
                )}
                {goalResults.sliderCashNeeded > 0 && (
                  <div className="goal-row">
                    <DollarSign size={ICON_MD} className="goal-row-icon" />
                    <span className="goal-row-label">Cash Slider</span>
                    <span className="goal-row-value">${goalResults.sliderCashNeeded.toLocaleString()}</span>
                  </div>
                )}
                <div className={`goal-row ${!goalUseTotems ? "goal-row-disabled" : ""}`}>
                  <Sparkles size={ICON_MD} className="goal-row-icon" />
                  <span className="goal-row-label">Geraldo Totems</span>
                  <span className="goal-row-value">{goalResults.totemsNeeded}</span>
                  {!goalUseTotems && <span className="goal-row-badge off">OFF</span>}
                </div>

                {goalResults.totalCashNeeded > 0 && (
                  <div className="goal-total-cash">
                    <span>Total cash investment</span>
                    <strong>${goalResults.totalCashNeeded.toLocaleString()}</strong>
                  </div>
                )}
                {goalResults.totalCashNeeded === 0 && (
                  <div className="goal-total-cash goal-free">
                    <span>No cash investment needed</span>
                    <strong>$0</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED FORMULAS AND GUIDE SECTION */}
      <section className="guide-card">
        <h2 className="paragon-selector-title">
          <BookOpen size={ICON_LG} /> How Paragon Calculations Work
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6" }}>
          In Bloons TD 6, a Paragon's Degree is calculated using <strong>Paragon Power Points</strong>,
          capped at {MAX_POWER.toLocaleString()} for Degree 100. Those points are distributed across
          four capped categories, plus Geraldo's Totems which bypass the standard limits. Here is the
          breakdown of the mathematical ratios used in-game (Update 54+):
        </p>

        <div className="guide-grid">
          <div className="guide-column">
            <h4><Target size={ICON_MD} style={{ verticalAlign: "-3px", marginRight: 6 }} />Pops &amp; Income (Max 90,000 pts)</h4>
            <p>Towers deal damage and generate cash throughout the game.</p>
            <ul className="guide-list">
              <li>1 Power per <strong>180 pops/damage</strong>.</li>
              <li>1 Power per <strong>$45 of cash generated</strong> (e.g. Buccaneer ships, Engineer traps).</li>
              <li>$1 generated counts as 4 pops.</li>
              <li><strong>16,200,000 equivalent pops</strong> fully max this category.</li>
            </ul>
          </div>

          <div className="guide-column">
            <h4><Star size={ICON_MD} style={{ verticalAlign: "-3px", marginRight: 6 }} />Sacrificed Upgrades (Max 10,000 pts)</h4>
            <p>Upgrades on sacrificed non-T5 towers supply power.</p>
            <ul className="guide-list">
              <li>100 Power per <strong>upgrade tier</strong> of sacrificed towers (excluding the baseline three T5s).</li>
              <li>A 0-2-4 monkey is worth 6 upgrade tiers (0 + 2 + 4).</li>
              <li><strong>100 total upgrade tiers</strong> max this category.</li>
            </ul>
          </div>

          <div className="guide-column">
            <h4><DollarSign size={ICON_MD} style={{ verticalAlign: "-3px", marginRight: 6 }} />Cash Investment (Max 60,000 pts)</h4>
            <p>Money spent buying sacrificed towers, or injected directly via the <strong>Cash Slider</strong>, adds power.</p>
            <ul className="guide-list">
              <li>Sacrificed towers: 1 Power per <strong>$(Base Price / 20,000)</strong> spent — 100% efficient.</li>
              <li>Cash Slider: 1 Power per <strong>$(Base Price × 1.05 / 20,000)</strong> — 95% efficient, a 5% convenience fee.</li>
              <li><strong>3.0× base price</strong> in sacrifices, or <strong>3.15× base price</strong> on the slider, maxes this category.</li>
            </ul>
          </div>

          <div className="guide-column">
            <h4><Sparkles size={ICON_MD} style={{ verticalAlign: "-3px", marginRight: 6 }} />Geraldo's Totems (Uncapped)</h4>
            <p>Each <strong>Paragon Power Totem</strong> from Geraldo's shop contributes a flat <strong>2,000 power points</strong>.</p>
            <ul className="guide-list">
              <li>In Solo play the standard categories cap out at <strong>{SOLO.power.toLocaleString()} power</strong> — Degree {SOLO.degree}.</li>
              <li>A solo Dart Monkey reaches <strong>{SOLO_DART.power.toLocaleString()} power</strong> (Degree {SOLO_DART.degree}) thanks to Master Double Cross.</li>
              <li>Closing the gap to Degree 100 takes <strong>{SOLO.totems} totems</strong>, or <strong>{SOLO_DART.totems}</strong> for a Dart Monkey.</li>
              <li>In Co-op, four players' Tier 5s reach Degree 100 with no totems at all.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* AD: Before footer */}
      <AdUnit slot="1122334455" format="auto" style={{ margin: "2rem 0", textAlign: "center" }} />
      </main>

      {/* PRIVACY POLICY — Required for AdSense */}
      <section className="privacy-policy-section" id="privacy-policy" aria-label="Privacy Policy">
        <h2 className="paragon-selector-title">
          Privacy Policy
        </h2>
        <div className="privacy-content">
          <p><strong>Last updated:</strong> May 27, 2026</p>
          <h3>Information We Collect</h3>
          <p>
            This website does not collect personal information directly. We use Google AdSense
            to display advertisements, which may use cookies and web beacons to serve ads based on
            your prior visits to this or other websites. Google's use of advertising cookies enables
            it and its partners to serve ads based on your visit to this site and/or other sites on
            the Internet.
          </p>
          <h3>Third-Party Advertising</h3>
          <p>
            We use Google AdSense to serve ads. Google may use cookies to personalize ads.
            You may opt out of personalized advertising by visiting{" "}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
            For more information about how Google uses data, visit{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google's Privacy & Terms</a>.
          </p>
          <h3>Analytics</h3>
          <p>
            We use Vercel Analytics to understand how visitors interact with this site. This data is
            aggregated and anonymized. No personally identifiable information is stored.
          </p>
          <h3>Cookies</h3>
          <p>
            This site uses cookies for theme preference (light/dark mode) stored locally in your browser,
            and third-party cookies from Google AdSense for ad personalization. You can control cookie
            settings through your browser preferences.
          </p>
          <h3>Contact</h3>
          <p>
            If you have questions about this privacy policy, please open an issue on our GitHub repository.
          </p>
        </div>
      </section>

      {/* POP COUNT ADDER MODAL */}
      {popAdderOpen && (
        <div className="pop-adder-overlay" onClick={(e) => { if (e.target === e.currentTarget) closePopAdder(); }}>
          <div className="pop-adder-modal" ref={popAdderModalRef}>
            <div className="pop-adder-header">
              <span className="pop-adder-title">
                <Calculator size={18} style={{ verticalAlign: "-3px", marginRight: 8 }} />
                Tower Pop Counter
              </span>
              <button className="pop-adder-close" onClick={closePopAdder}>
                <X size={16} />
              </button>
            </div>

            <p className="pop-adder-hint">
              Enter each tower's pop count. Press <kbd>Enter</kbd> to add a new row, <kbd>Backspace</kbd> on an empty row to remove it.
            </p>

            <div className="pop-adder-entries">
              {popAdderEntries.map((val, idx) => (
                <div key={idx} className="pop-adder-row">
                  <span className="pop-adder-index">{idx + 1}</span>
                  <input
                    ref={el => (popAdderRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    className="pop-adder-input"
                    placeholder="e.g. 350,000"
                    value={val}
                    onChange={(e) => handlePopAdderChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePopAdderKeyDown(e, idx)}
                  />
                  <button
                    className="pop-adder-remove"
                    onClick={() => removePopAdderEntry(idx)}
                    tabIndex={-1}
                    aria-label="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              <button
                className="pop-adder-add-row"
                onClick={() => {
                  setPopAdderEntries(prev => [...prev, ""]);
                  setTimeout(() => {
                    const lastRef = popAdderRefs.current[popAdderEntries.length];
                    if (lastRef) lastRef.focus();
                  }, 0);
                }}
              >
                <Plus size={14} style={{ marginRight: 5 }} /> Add row
              </button>
            </div>

            <div className="pop-adder-footer">
              <div className="pop-adder-total">
                Total: <strong>{popAdderTotal.toLocaleString()}</strong> pops
              </div>
              <div className="pop-adder-actions">
                <button className="quick-btn" onClick={closePopAdder}>Cancel</button>
                <button className="pop-adder-apply" onClick={applyPopAdder}>
                  Apply to Pops
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="/paragons">All Paragons</a>
          <span className="footer-sep">•</span>
          <a href="/faq">FAQ</a>
          <span className="footer-sep">•</span>
          <a href="#privacy-policy">Privacy Policy</a>
          <span className="footer-sep">•</span>
          <a href="https://github.com/levisager11-oss/paragon-calc" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <p>
          BTD6 Paragon Calculator — the free, open-source Paragon degree calculator for Bloons TD 6.
          Calculate degrees 1-100 for all 13 Paragons including Apex Plasma Master, Ascended Shadow,
          Navarch of the Seas, and more. Bloons TD 6 is a registered trademark of Ninja Kiwi.
        </p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.78rem" }}>
          &copy; {new Date().getFullYear()} Paragon Calculator. Not affiliated with Ninja Kiwi.
        </p>
      </footer>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
