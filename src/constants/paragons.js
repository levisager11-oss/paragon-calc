export const PARAGONS = {
  apex_plasma_master: {
    id: "apex_plasma_master",
    name: "Apex Plasma Master",
    tower: "Dart Monkey",
    mediumCost: 150000,
    maxT4Cost: { easy: 7210, medium: 8480, hard: 9155, impoppable: 10180 },
    maxT4Build: "2-4-0",
    // Master Double Cross lets one player own a second Crossbow Master, so this
    // Paragon can absorb one extra Tier 5 even in solo play.
    soloExtraT5Source: "the Master Double Cross Monkey Knowledge",
    category: "primary",
    description: "Combines the speed of Ultra-Juggernaut, the pierce of Plasma Monkey Fan Club, and the raw power of Crossbow Master. Shoots volleys of three bouncing plasma juggernaut balls that each split into smaller juggernauts.",
    icon: "🎯",
    color: "#ff5722",
    abilities: [
      "Triple Plasma Juggernaut balls that bounce off walls and obstacles.",
      "Deals massive bonus damage to Boss Bloons and Ceramic Bloons.",
      "High pierce and extremely fast attack speed."
    ]
  },
  glaive_dominus: {
    id: "glaive_dominus",
    name: "Glaive Dominus",
    tower: "Boomerang Monkey",
    mediumCost: 375000,
    maxT4Cost: { easy: 5680, medium: 6670, hard: 7200, impoppable: 8005 },
    maxT4Build: "2-4-0",
    category: "primary",
    description: "The ultimate defensive tower. Possesses high-speed homing glaives, a permanent orbital glaive ring, and an explosive press attack that pushes back massive Bloons.",
    icon: "🪃",
    color: "#ff9800",
    abilities: [
      "Permanent ring of orbital glaives that shred anything nearby.",
      "Ricocheting glaives that seek targets across the whole map and leave a shredding damage-over-time effect.",
      "MOAB Press glaive pushes back MOAB-class Bloons, then explodes for heavy damage and a burn."
    ]
  },
  ascended_shadow: {
    id: "ascended_shadow",
    name: "Ascended Shadow",
    tower: "Ninja Monkey",
    mediumCost: 500000,
    maxT4Cost: { easy: 7745, medium: 9100, hard: 9830, impoppable: 10920 },
    maxT4Build: "2-0-4",
    category: "magic",
    description: "An absolute assassin that floods the map with seeking shurikens, flash bombs and sticky bombs, under a permanent Grand Saboteur debuff. Cloaked in shadow, nothing escapes.",
    icon: "🥷",
    color: "#e040fb",
    abilities: [
      "Throws 8 tracking shurikens at once with immense speed.",
      "Throws stunning Flash Bombs that burst into mini-shurikens, and attaches Sticky Bombs that deal huge damage to MOABs.",
      "Global permanent Grand Saboteur: slows all Bloons except BADs and Bosses by 50% and cuts MOAB-class health by 25% (not Bosses)."
    ]
  },
  navarch_of_the_seas: {
    id: "navarch_of_the_seas",
    name: "Navarch of the Seas",
    tower: "Monkey Buccaneer",
    mediumCost: 550000,
    maxT4Cost: { easy: 11480, medium: 13500, hard: 14580, impoppable: 16200 },
    maxT4Build: "4-2-0",
    category: "military",
    description: "The ruler of the waters. Features three fighter planes, six triple-barreled cannon-and-grape turrets, and the legendary ability to hook and instantly destroy BADs.",
    icon: "🚢",
    color: "#4caf50",
    abilities: [
      "Dual active hooks per round to pull in and instantly shred any MOAB-class Bloon (including BADs).",
      "Spawns three permanent fighter planes that patrol the map, firing darts and anti-MOAB missile volleys.",
      "Passively generates cash at the end of each round and boosts other water towers."
    ]
  },
  nautic_siege_core: {
    id: "nautic_siege_core",
    name: "Nautic Siege Core",
    tower: "Monkey Sub",
    mediumCost: 400000,
    maxT4Cost: { easy: 14350, medium: 16875, hard: 18225, impoppable: 20250 },
    maxT4Build: "0-4-2",
    category: "military",
    description: "A nuclear submarine that submerges to buff Heroes, Subs and other towers, fires pre-emptive missiles at every Bloon entering the map, and emits radioactive pulses.",
    icon: "⚓",
    color: "#2196f3",
    abilities: [
      "Submerging cuts ability cooldowns map-wide, hugely boosts nearby Heroes' and Subs' damage and pierce, and strips Camo.",
      "Launches automatic Pre-emptive Strike missiles at any Bloon entering the screen.",
      "Final Strike ability: after a 15-second countdown, three missiles deal heavy damage, stun Bloons and leave radioactive fallout."
    ]
  },
  master_builder: {
    id: "master_builder",
    name: "Master Builder",
    tower: "Engineer Monkey",
    mediumCost: 600000,
    maxT4Cost: { easy: 13820, medium: 16250, hard: 17550, impoppable: 19500 },
    maxT4Build: "2-4-0",
    category: "support",
    description: "The pinnacle of support. Deploys three Mega Sentries (Green, Red, Blue) that build their own sentries and can be detonated, and can Overclock other towers and Paragons.",
    icon: "🔧",
    color: "#9e9e9e",
    abilities: [
      "Places three Mega Sentries anywhere: a Green laser, Red plasma streams and Blue anti-MOAB missiles.",
      "Selling or replacing a Mega Sentry detonates it and its child sentries for massive damage, especially to Bosses.",
      "Power Glove ability Overclocks any tower, even other Paragons; a passive Ultraboost speeds itself up every round."
    ]
  },
  magus_perfectus: {
    id: "magus_perfectus",
    name: "Magus Perfectus",
    tower: "Wizard Monkey",
    mediumCost: 800000,
    maxT4Cost: { easy: 11420, medium: 13425, hard: 14500, impoppable: 16110 },
    maxT4Build: "4-2-0",
    category: "magic",
    description: "Master of arcane, fire, and necromancy. Uses a unique mana system, switching between mana-hungry Arcane Spike and Dark Phoenix attacks and a weak Draining Beam that restores mana.",
    icon: "🧙",
    color: "#9c27b0",
    abilities: [
      "Alternates between an attack mode that spends mana and a Draining Beam that restores it.",
      "Necromancy: pops raise Undead Bloons, and Phoenix Explosion spends all mana to summon up to 10 Undead ZOMGs.",
      "Arcane Metamorphosis drains mana to annihilate whole screens of Bloons."
    ]
  },
  goliath_doomship: {
    id: "goliath_doomship",
    name: "Goliath Doomship",
    tower: "Monkey Ace",
    mediumCost: 900000,
    maxT4Cost: { easy: 24490, medium: 28800, hard: 31105, impoppable: 34560 },
    maxT4Build: "2-0-4",
    category: "military",
    description: "A massive flying fortress that commands the skies. Constantly fires rings of piercing missiles and seeking missiles, with a Carpet Bomb ability that devastates the field.",
    icon: "🛩️",
    color: "#00bcd4",
    abilities: [
      "Carpet Bomb ability sends three bombers to drop 8 stunning bombs along a line you set.",
      "Constantly fires volleys of 12 radial missiles and 8 homing missiles, plus twin streams of forward darts.",
      "Covers the whole map from the air, but rewards steering its flight path over the Bloons."
    ]
  },
  crucible_of_steel_and_flame: {
    id: "crucible_of_steel_and_flame",
    name: "Crucible of Steel and Flame",
    tower: "Tack Shooter",
    mediumCost: 200000,
    maxT4Cost: { easy: 4300, medium: 5055, hard: 5460, impoppable: 6065 },
    maxT4Build: "4-2-0",
    category: "primary",
    description: "Spinning blades of Bloon immolation! Combines the ultra-fast shooting Tack Zone, high-speed Super Maelstrom, and fire-spewing Inferno Ring.",
    icon: "🌋",
    color: "#f44336",
    abilities: [
      "Fires extremely fast rotating white-hot blades that burst into tacks.",
      "Maelstrom ability greatly extends blade and tack reach and adds a ring of fire for 9 seconds.",
      "Activated Meteor Impact payload that unleashes heavy damage explosions.",
      "Innate Camo: None (requires external detection to hit Camo)."
    ]
  },
  mega_massive_munitions_factory: {
    id: "mega_massive_munitions_factory",
    name: "Mega Massive Munitions Factory",
    tower: "Spike Factory",
    mediumCost: 750000,
    maxT4Cost: { easy: 13260, medium: 15600, hard: 16855, impoppable: 18720 },
    maxT4Build: "4-2-0",
    category: "support",
    description: "A mega factory of explosive spike Bloon annihilation. Combines the giant mines of Super Mines, the track carpet coverage of Carpet of Spikes, and the durability of Perma-Spike.",
    icon: "🏭",
    color: "#795548",
    abilities: [
      "Deploys massive spiked mines that explode on contact and split into smaller spike piles.",
      "Passively covers the entire track with a persistent, damaging carpet of spikes.",
      "Activated ability that boosts the factory's attack speed to extreme levels for a short duration.",
      "Spikeageddon ability lays high-explosive land mines at intervals along every path; re-activate to detonate them."
    ]
  },
  ballistic_obliteration_missile_bunker: {
    id: "ballistic_obliteration_missile_bunker",
    name: "Ballistic Obliteration Missile Bunker (B.O.M.B.)",
    tower: "Bomb Shooter",
    mediumCost: 650000,
    maxT4Cost: { easy: 5430, medium: 6375, hard: 6880, impoppable: 7650 },
    maxT4Build: "2-4-0",
    category: "primary",
    description: "The ultimate artillery fortress. Combines the cluster impact of Bomb Blitz, the Moab-destroying power of MOAB Eliminator, and the stun capability of Bloon Crush.",
    icon: "💣",
    color: "#37474f",
    abilities: [
      "Slowly fires heavy homing missiles that stun, push back and burst into two layers of cluster bombs.",
      "Indomitable Surface-to-Air Ballistic Missile ability: a seeking missile that trails pushback explosions and ends in a huge blast.",
      "Passive Blitz Tactical Storm wipes the screen when a Bloon tries to leak, with reduced damage to BADs and Bosses.",
      "Innate Camo: None (requires external detection to hit Camo)."
    ]
  },
  herald_of_everfrost: {
    id: "herald_of_everfrost",
    name: "Herald of Everfrost",
    tower: "Ice Monkey",
    mediumCost: 300000,
    maxT4Cost: { easy: 7575, medium: 8900, hard: 9610, impoppable: 10680 },
    maxT4Build: "2-4-0",
    // Silas at level 13+ lets one player own two Ice Monkeys with the same Tier 5
    // upgrade, which is the Ice Monkey's equivalent of Master Double Cross.
    soloExtraT5Source: "a level 13+ Silas",
    category: "primary",
    description: "As the eternal frost descends and cold reigns supreme, even the baddest of Bloons are helpless against its icy grasp. Combines the heavy debuffs of Super Brittle, the global freezes of Absolute Zero, and the slowdown/damage of Icicle Impale.",
    icon: "❄️",
    color: "#00d2ff",
    abilities: [
      "Fires Ice Lance Beams and unleashes Snowstorm Roar map-wide freezes.",
      "Creates ice platforms on water surfaces so land-based towers can be placed.",
      "Snowstorm Roar makes all Bloons, even BADs and Bosses, take extra damage from every attack.",
      "Activated ability 'Eclipse of Fimbulwinter' that freezes all incoming Bloons and slows down Bosses."
    ]
  },
  root_of_all_nature: {
    id: "root_of_all_nature",
    name: "Root of all Nature",
    tower: "Druid",
    mediumCost: 475000,
    maxT4Cost: { easy: 7150, medium: 8400, hard: 9075, impoppable: 10080 },
    maxT4Build: "4-2-0",
    category: "magic",
    description: "The absolute embodiment of natural fury. Combines the lightning storm control of Monarch of Storms, the global vine coverage of Spirit of the Forest, and the escalating speed/power of Avatar of Wrath.",
    icon: "🌿",
    color: "#4caf50",
    abilities: [
      "Fires volleys of seven Electrified Thorns that ricochet between Bloons.",
      "Passively wraps the entire track in sentient vines that deal heavy continuous damage.",
      "Periodically grows Storm Trees that count as Banana Farms for its income bonus and blow Bloons back with Vineados.",
      "Toggleable ability 'Primordial Wrath' that grants immense combat power in exchange for draining cash."
    ]
  },
  spider_monkey: {
    id: "spider_monkey",
    name: "S.P.I.D.E.R. Monkey",
    tower: "Sniper Monkey",
    mediumCost: 800000,
    maxT4Cost: { easy: 10550, medium: 12400, hard: 13400, impoppable: 14880 },
    maxT4Build: "2-4-0",
    category: "military",
    description: "Watches over the whole battlefield from an elevated platform. Combines the crippling shots of Cripple MOAB, the cash drops of Elite Sniper and the escalating fire rate of Elite Defender.",
    icon: "🕷️",
    color: "#607d8b",
    abilities: [
      "Heavy-calibre shots that bounce to a second target and burst into seeking, stunning shrapnel.",
      "Sees the entire map through any line-of-sight blocker, and other Snipers can share its target.",
      "Fires faster as Bloons advance, when lives are lost, and while it stays on the same target.",
      "Drops $20,000 of cash crates every round; Ammo Swap and Single Out abilities."
    ]
  }
};

export const DIFFICULTY_MULTIPLIERS = {
  easy: { name: "Easy", value: 0.85 },
  medium: { name: "Medium", value: 1.00 },
  hard: { name: "Hard", value: 1.08 },
  impoppable: { name: "Impoppable", value: 1.20 }
};

// Paragon Power caps as of BTD6 v57.0, which removed the old Upgrade Tiers
// category (100 power per tier, up to 10,000) and raised the other two caps:
// cash from 3x to 4x the Paragon's price (60,000 -> 80,000 power), and pops &
// income from 16.2M to 22.5M equivalent pops (90,000 -> 125,000 power).
export const POWER_LIMITS = {
  t5: { maxPower: 50000, pointsPerExtra: 6000 },
  pops: { maxPower: 125000, popDivisor: 180, incomeDivisor: 45 },
  cash: { maxPower: 80000 }
};

// Every base price spent on sacrifices is worth 20,000 power; the slider charges
// a 5% premium on the same power.
export const CASH_POWER_PER_BASE_PRICE = 20000;
export const SLIDER_PREMIUM = 1.05;

// Equivalent pops ($1 income = 4 pops) that fill the Pops & Income category.
export const MAX_EQUIVALENT_POPS = POWER_LIMITS.pops.maxPower * POWER_LIMITS.pops.popDivisor;
// Cash investment caps at this multiple of the base price (4x), so the in-game
// slider stops at that multiple plus its premium (4.2x).
export const CASH_CAP_MULTIPLE = POWER_LIMITS.cash.maxPower / CASH_POWER_PER_BASE_PRICE;
export const SLIDER_CAP_MULTIPLE = Math.round(CASH_CAP_MULTIPLE * SLIDER_PREMIUM * 100) / 100;

// The Paragon Boost perk (v56.0): the first Paragon bought in a game gains this
// many degrees on top of whatever its power earned, up to the Degree 100 ceiling.
export const PARAGON_BOOST_DEGREES = 25;

// The game version the roster, prices and power rules above were verified against.
export const GAME_VERSION = "57.0";

// Paragon artwork lives in public/paragon-art/<slug>.png, keyed by the same
// slug the /paragons/<slug> routes use so the two never drift. Files are
// optional: every consumer falls back to the paragon's emoji when one is
// missing, so the roster works with partial or no art.
export const paragonSlug = (p) => p.id.replace(/_/g, "-");
export const paragonArt = (p) => `/paragon-art/${paragonSlug(p)}.png`;
