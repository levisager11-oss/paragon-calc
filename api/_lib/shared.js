// Shared constants imported by all /api/paragon/* handlers.
// Leading underscore on the directory prevents Vercel from treating this as a route.

export const API_VERSION      = "1.1";
export const FORMULA_VERSION  = "1.0";
export const FORMULA_REVISION = "2025-05";

export const VALID_DIFFICULTIES = ["easy", "medium", "hard", "impoppable"];

export const RATE_LIMITS = {
  default: { requests_per_minute: 60,  window: "60s", note: "Applied per IP address." },
  api_key: { requests_per_minute: 300, window: "60s", note: "Set X-API-Key header with a valid key to use the higher limit." },
};

export const POWER_LIMITS = {
  t5:       { maxPower: 50000, pointsPerExtra: 6000 },
  upgrades: { maxPower: 10000, pointsPerUpgrade: 100 },
  pops:     { maxPower: 90000, popDivisor: 180 },
  cash:     { maxPower: 60000 },
};

// Minimal paragon records (id / name / tower) used by health & version endpoints.
export const PARAGONS = {
  apex_plasma_master: {
    id: "apex_plasma_master", name: "Apex Plasma Master",
    tower: "Dart Monkey", mediumCost: 150000,
  },
  glaive_dominus: {
    id: "glaive_dominus", name: "Glaive Dominus",
    tower: "Boomerang Monkey", mediumCost: 375000,
  },
  ascended_shadow: {
    id: "ascended_shadow", name: "Ascended Shadow",
    tower: "Ninja Monkey", mediumCost: 500000,
  },
  navarch_of_the_seas: {
    id: "navarch_of_the_seas", name: "Navarch of the Seas",
    tower: "Monkey Buccaneer", mediumCost: 500000,
  },
  nautic_siege_core: {
    id: "nautic_siege_core", name: "Nautic Siege Core",
    tower: "Monkey Sub", mediumCost: 400000,
  },
  master_builder: {
    id: "master_builder", name: "Master Builder",
    tower: "Engineer Monkey", mediumCost: 650000,
  },
  magus_perfectus: {
    id: "magus_perfectus", name: "Magus Perfectus",
    tower: "Wizard Monkey", mediumCost: 800000,
  },
  goliath_doomship: {
    id: "goliath_doomship", name: "Goliath Doomship",
    tower: "Monkey Ace", mediumCost: 900000,
  },
  crucible_of_steel_and_flame: {
    id: "crucible_of_steel_and_flame", name: "Crucible of Steel and Flame",
    tower: "Tack Shooter", mediumCost: 200000,
  },
  mega_massive_munitions_factory: {
    id: "mega_massive_munitions_factory", name: "Mega Massive Munitions Factory",
    tower: "Spike Factory", mediumCost: 750000,
  },
  ballistic_obliteration_missile_bunker: {
    id: "ballistic_obliteration_missile_bunker",
    name: "Ballistic Obliteration Missile Bunker (B.O.M.B.)",
    tower: "Bomb Shooter", mediumCost: 600000,
  },
  herald_of_everfrost: {
    id: "herald_of_everfrost", name: "Herald of Everfrost",
    tower: "Ice Monkey", mediumCost: 300000,
  },
  root_of_all_nature: {
    id: "root_of_all_nature", name: "Root of all Nature",
    tower: "Druid", mediumCost: 475000,
  },
};

export function validTowerList() {
  return Object.values(PARAGONS).map((p) => ({
    id:      p.id,
    tower:   p.tower,
    paragon: p.name,
  }));
}
