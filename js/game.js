/* ============================================
   VENUE RIVALS - Core Game Engine
   ============================================ */

const Game = (() => {
  const DEFAULT_POINT_TARGET = 50;
  const BUST_PENALTY = 0;
  const TAGS = ["VIP", "Performer", "Scout", "Broker", "Outlaw"];

  let nextInstanceId = 1;

const GUESTS = {
  // === NEUTRAL / MAIN FLOOR ===
  familiarFace: {
    name: "Familiar Face", emoji: "🙂",
    heat: 0, money: 0, points: 1, cost: 2,
    venue: "Neutral", tags: ["VIP"],
    desc: "No ability.", tier: "common",
  },
  bottleBringer: {
    name: "Bottle Bringer", emoji: "🍾",
    heat: 0, money: 1, points: 0, cost: 2,
    venue: "Neutral", tags: ["Broker"],
    desc: "No ability.", tier: "common",
  },
  loudFriend: {
    name: "Loud Friend", emoji: "📢",
    heat: 1, money: 1, points: 1, cost: 3,
    venue: "Neutral", tags: ["Performer"],
    desc: "No ability.", tier: "common",
  },
    bigSpender: {
    name: "Big Spender",
    emoji: "🛍️",
    heat: 2,
    money: 2,
    points: 0,
    cost: 4,
    venue: "Neutral",
    tags: ["VIP"],
    desc: "No special move.",
    tier: "uncommon",
  },
  doorWatcher: {
    name: "Door Watcher", emoji: "👀",
    heat: 0, money: 1, points: 1, cost: 3,
    venue: "Neutral", tags: ["Scout"], tier: "common",
    ability: { name: "Check the Line", icon: "👀", desc: "Peek at the next guest.", trigger: "flash", type: "revealNext", value: 1 },
    desc: "CHECK THE LINE — A: PEEK 1.",
  },
  groupChatHost: {
    name: "Group Chat Host", emoji: "💬",
    heat: 1, money: 0, points: 2, cost: 5,
    venue: "Neutral", tags: ["Broker"], tier: "uncommon",
    ability: { name: "Guest List", icon: "📋", desc: "On arrival, Reveal the next 2 guests and choose their order.", trigger: "arrival", type: "stackChoice", value: 2 },
    desc: "GUEST LIST — When this guest enters, reveal the next 2 guests and choose their order.",
  },
  plusOnePrince: {
    name: "Plus-One Prince", emoji: "👑",
    heat: 1, money: 1, points: 1, cost: 3,
    venue: "Neutral", tags: ["VIP"], tier: "uncommon",
    ability: { name: "Plus One", icon: "➕", desc: "On arrival, Admit the next guest immediately.", trigger: "arrival", type: "plusOne" },
    desc: "PLUS ONE — When this guest enters, admit the next guest immediately.",
  },
  nameDropper: {
    name: "Name Dropper", emoji: "🗣️",
    heat: 1, money: 0, points: 2, cost: 7,
    venue: "Neutral", tags: ["VIP", "Broker"], tier: "rare",
    ability: { name: "Name Drop", icon: "📇", desc: "On arrival, Reveal the next 3 guests, then Admit 1. Put the rest back in any order.", trigger: "arrival", type: "nameDrop", value: 3 },
    desc: "NAME DROP — When this guest enters, reveal the next 3 guests. Admit 1 now. Put the rest back in any order.",
  },
  porchBuddy: {
    name: "Porch Buddy", emoji: "🪑",
    heat: 0, money: 0, points: 2, cost: 4,
    venue: "Neutral", tags: ["VIP"], tier: "common",
    ability: { name: "Bounce", icon: "🔄", desc: "Return a guest in your house to the top of your queue.", trigger: "flash", type: "bounce", targeting: "choice" },
    desc: "BOUNCE — A: Return a guest in your house to the top of your queue.",
  },
  fedUpRoommate: {
    name: "Fed-Up Roommate", emoji: "😤",
    heat: 1, money: 2, points: 1, cost: 6,
    venue: "Neutral", tags: ["Outlaw"], tier: "uncommon",
    ability: { name: "Boot", icon: "🥾", desc: "Remove a guest from your house.", trigger: "flash", type: "boot", targeting: "choice" },
    desc: "BOOT — A: Remove a guest from your house.",
  },
  resetHost: {
    name: "Reset Host", emoji: "🧹",
    heat: 1, money: 2, points: 0, cost: 6,
    venue: "Neutral", tags: ["Broker"], tier: "uncommon",
    ability: { name: "Last Call", icon: "🧹", desc: "Clear your house.", trigger: "flash", type: "clearHouse" },
    desc: "LAST CALL — A: Clear your house.",
  },
    wingMan: {
    name: "Wingman", emoji: "🤛",
    heat: 0, money: 1, points: 1, cost: 4,
    venue: "Neutral", tags: ["VIP"], tier: "common",
    ability: { name: "Distract", icon: "🔄", desc: "Nudge the guest on the Left.", trigger: "flash", type: "nudge", targeting: "leftOfSelf" },
    desc: "DISTRACT — A: Nudge the guest on the Left.",
  },
    stagehand: {
    name: "Stagehand", emoji: "👏",
    heat: 0, money: 2, points: 2, cost: 6,
    venue: "Neutral", tags: ["Performer"], tier: "uncommon",
    ability: { name: "Bump Into", icon: "🔄", desc: "Nudge a guest.", trigger: "flash", type: "nudge", targeting: "choice" },
    desc: "BUMP INTO — A: Nudge a guest.",
  },
    dealer: {
    name: "Dealer", emoji: "🤛",
    heat: 0, money: 3, points: 0, cost: 8,
    venue: "Neutral", tags: ["Outlaw"], tier: "Rare",
    ability: { name: "Annoy", icon: "🔄", desc: "Nudge the newest guest.", trigger: "flash", type: "nudge", targeting: "newest" },
    desc: "ANNOY — A: Nudge the newest guest.",
  },

  // === VELVET ROOM ===
  mainCharacter: {
    name: "Main Character", emoji: "⭐",
    heat: 2, money: 3, points: 3, cost: 8,
    venue: "Velvet Room", tags: ["VIP", "Performer"], tier: "uncommon",
    ability: { name: "Make an Entrance", icon: "✨", desc: "On arrival, Score 2.", trigger: "arrival", type: "scoreNow", value: 2 },
    desc: "MAKE AN ENTRANCE — On arrival, score 2.",
  },
  storyPoster: {
    name: "Story Poster", emoji: "📱",
    heat: 1, money: 0, points: 1, cost: 7,
    venue: "Velvet Room", tags: ["Performer"], tier: "uncommon",
    ability: { name: "Snapshot", icon: "📸", desc: "Score a guest now.", trigger: "flash", type: "scoreGuest" },
    desc: "SNAPSHOT — A: Score a guest now.",
  },
  danceCaptain: {
    name: "Dance Captain", emoji: "💃",
    heat: 1, money: 1, points: 2, cost: 9,
    venue: "Velvet Room", tags: ["Performer"], tier: "uncommon",
    ability: { name: "Second Wind", icon: "🔄", desc: "Refresh another guest’s action.", trigger: "flash", type: "refreshAction" },
    desc: "SECOND WIND — A: Refresh another guest’s action.",
  },
  afterpartyHost: {
    name: "Afterparty Host", emoji: "🌙",
    heat: 1, money: 0, points: 3, cost: 8,
    venue: "Velvet Room", tags: ["Performer"], tier: "uncommon",
    ability: { name: "Afterglow", icon: "🌅", desc: "Upon leaving, Score 2.", trigger: "departure", type: "scoreNow", value: 2 },
    desc: "AFTERGLOW — When this guest leaves, score 2.",
  },
  wallflower: {
    name: "Wallflower", emoji: "🌸",
    heat: 1, money: 3, points: 0, cost: 10,
    venue: "Velvet Room", tags: ["VIP"], tier: "common",
    ability: { name: "Wallflower", icon: "🌸", desc: "When scored, +1 Point for each empty slot.", trigger: "scoring", type: "wallflower" },
    desc: "WALLFLOWER — At scoring, +1 Point for each empty slot.",
  },
  linkUpFriend: {
    name: "Link-Up Friend", emoji: "🔗",
    heat: 1, money: 1, points: 1, cost: 5,
    venue: "Velvet Room", tags: ["VIP", "Broker"], tier: "uncommon",
    ability: { name: "Clique", icon: "🔗", desc: "When scored, +1 Point for each adjacent guest sharing a tag.", trigger: "scoring", type: "clique" },
    desc: "CLIQUE — At scoring, +1 Point for each adjacent guest sharing a tag with this guest.",
  },
  headliner: {
    name: "Headliner", emoji: "🌟",
    heat: 2, money: 3, points: 2, cost: 7,
    venue: "Velvet Room", tags: ["VIP", "Performer"], tier: "rare",
    ability: { name: "Center of Attention", icon: "🔦", desc: "When scored, +2 Points if this guest is Newest.", trigger: "scoring", type: "centerOfAttention", value: 2 },
    desc: "CENTER OF ATTENTION — At scoring, +2 Points if this guest is Newest.",
  },
  socialClimber: {
    name: "Social Climber", emoji: "📈",
    heat: 1, money: 0, points: 2, cost: 7,
    venue: "Velvet Room", tags: ["VIP"], tier: "rare",
    ability: { name: "Social Climber", icon: "📈", desc: "On arrival, Permanently gains +1 Point each time it enters, up to +9.", trigger: "arrival", type: "socialClimber", maxBonus: 9 },
    desc: "SOCIAL CLIMBER — Each time this guest enters for the first time in a round, it permanently gains +1 Point, up to +9.",
  },
  hypeSquad: {
    name: "Hype Squad", emoji: "🎉",
    heat: 1, money: 1, points: 2, cost: 8,
    venue: "Velvet Room", tags: ["Performer"], tier: "rare",
    ability: { name: "Hype Crew", icon: "🎊", desc: "Refresh all other actions.", trigger: "flash", type: "refreshAllActions" },
    desc: "HYPE CREW — A: Refresh all other actions.",
  },
  partyPhotographer: {
    name: "Party Photographer", emoji: "📸",
    heat: 1, money: 0, points: 1, cost: 6,
    venue: "Velvet Room", tags: ["Performer"], tier: "uncommon",
    ability: { name: "Photographer", icon: "📷", desc: "Score a guest now.", trigger: "flash", type: "scoreGuest" },
    desc: "PHOTOGRAPHER — A: Score a guest now.",
  },

  // === NIGHT MARKET ===
  windowWatcher: {
    name: "Window Watcher", emoji: "🔭",
    heat: 0, money: 1, points: 1, cost: 4,
    venue: "Night Market", tags: ["Scout"], tier: "common",
    ability: { name: "Curate", icon: "🧭", desc: "Reveal the next 2 guests and choose their order.", trigger: "flash", type: "stackChoice", value: 2 },
    desc: "CURATE — A: Reveal the next 2 guests and choose their order.",
  },
  vipWrangler: {
    name: "VIP Wrangler", emoji: "🎪",
    heat: 1, money: 1, points: 2, cost: 7,
    venue: "Night Market", tags: ["VIP", "Broker"], tier: "rare",
    ability: { name: "VIP List", icon: "📇", desc: "Reveal the next 3 guests. Admit 1 now. Put the rest back in any order.", trigger: "flash", type: "nameDrop", value: 3 },
    desc: "VIP LIST — A: Reveal the next 3 guests. Admit 1 now. Put the rest back in any order.",
  },
  tabRunner: {
    name: "Tab Runner", emoji: "💸",
    heat: 1, money: 0, points: 1, cost: 4,
    venue: "Night Market", tags: ["Broker"], tier: "common",
    ability: { name: "Parting Gift", icon: "💸", desc: "Upon leaving, Gain 2 Money.", trigger: "departure", type: "gainMoney", value: 2 },
    desc: "PARTING GIFT — When this guest leaves, gain 2 Money.",
  },
  coolOffSmoker: {
    name: "Cool-Off Smoker", emoji: "🚬",
    heat: 0, money: 1, points: 1, cost: 4,
    venue: "Night Market", tags: ["VIP"], tier: "common",
    ability: { name: "Cools Off", icon: "❄️", desc: "Upon leaving, Cool 1.", trigger: "departure", type: "coolHeat", value: 1 },
    desc: "COOLS OFF — When this guest leaves, cool 1.",
  },
  bottlePopper: {
    name: "Bottle Popper", emoji: "🥂",
    heat: 2, money: 3, points: 0, cost: 6,
    venue: "Night Market", tags: ["VIP"],
    desc: "No ability.", tier: "uncommon",
  },
  bigPlanner: {
    name: "Big Planner", emoji: "📋",
    heat: 1, money: 1, points: 2, cost: 6,
    venue: "Night Market", tags: ["Scout", "Broker"], tier: "uncommon",
    ability: { name: "Packed House", icon: "🏠", desc: "When scored, +4 Points if your house is full.", trigger: "scoring", type: "packedHouse", value: 4 },
    desc: "PACKED HOUSE — At scoring, +4 Points if your house is full.",
  },
  highRoller: {
    name: "High Roller", emoji: "🎰",
    heat: 0, money: 1, points: 2, cost: 5,
    venue: "Night Market", tags: ["Broker"], tier: "uncommon",
    ability: { name: "High Roller", icon: "💰", desc: "When scored, +1 Point for each 2 Money you have.", trigger: "scoring", type: "highRoller" },
    desc: "HIGH ROLLER — At scoring, +1 Point for each 2 Money you have.",
  },
  socialButterfly: {
    name: "Social Butterfly", emoji: "🦋",
    heat: 1, money: 1, points: 2, cost: 6,
    venue: "Night Market", tags: ["Performer"], tier: "uncommon",
    ability: { name: "Impersonator", icon: "🎭", desc: "On arrival, Copy the action ability of the guest to the left.", trigger: "arrival", type: "impersonator" },
    desc: "IMPERSONATOR — When this guest enters, copy the action ability of the guest to the left this round.",
  },
  magnetGuest: {
    name: "Magnet Guest", emoji: "🧲",
    heat: 1, money: 2, points: 2, cost: 8,
    venue: "Night Market", tags: ["VIP"], tier: "rare",
    ability: { name: "Magnet", icon: "🧲", desc: "On arrival, Admit the next guest immediately. If that guest has an arrival ability, trigger it too.", trigger: "arrival", type: "magnet" },
    desc: "MAGNET — When this guest enters, admit the next guest immediately. If that guest has an arrival ability, trigger it too.",
  },

  // === BACK ALLEY ===
  addressLeaker: {
    name: "Address Leaker", emoji: "📍",
    heat: 1, money: 0, points: 2, cost: 5,
    venue: "Back Alley", tags: ["Outlaw"], tier: "common",
    ability: { name: "Crash the Party", icon: "💣", desc: "On arrival, Plant a Gatecrasher in your opponent’s queue.", trigger: "arrival", type: "queueGatecrasher" },
    desc: "CRASH THE PARTY — When this guest enters, plant a Gatecrasher in your opponent’s queue.",
  },
  messyDrunk: {
    name: "Messy Drunk", emoji: "🍺",
    heat: 2, money: 1, points: 2, cost: 6,
    venue: "Back Alley", tags: ["Outlaw"], tier: "common",
    ability: { name: "Leaves a Mess", icon: "💥", desc: "Upon leaving, Plant a Gatecrasher in your opponent’s queue.", trigger: "departure", type: "queueGatecrasher" },
    desc: "LEAVES A MESS — When this guest leaves, plant a Gatecrasher in your opponent’s queue.",
  },
  dramaStarter: {
    name: "Drama Starter", emoji: "🎭",
    heat: 2, money: 0, points: 3, cost: 5,
    venue: "Back Alley", tags: ["Outlaw"], tier: "common",
    ability: { name: "Drama Exit", icon: "🔥", desc: "Upon leaving, Spike 1.", trigger: "departure", type: "addOpponentHeat", value: 1 },
    desc: "DRAMA EXIT — When this guest leaves, spike 1.",
  },
  chaosChaser: {
    name: "Chaos Chaser", emoji: "🌀",
    heat: 2, money: 2, points: 0, cost: 6,
    venue: "Back Alley", tags: ["Performer", "Outlaw"], tier: "uncommon",
    ability: { name: "Chaos Chaser", icon: "🔥", desc: "When scored, +1 Point for each Heat in your house.", trigger: "scoring", type: "chaosChaser" },
    desc: "CHAOS CHASER — At scoring, +1 Point for each Heat in your house.",
  },
  lateLegend: {
    name: "Late Legend", emoji: "🕐",
    heat: 1, money: 2, points: 0, cost: 6,
    venue: "Back Alley", tags: ["VIP", "Outlaw"], tier: "uncommon",
    ability: { name: "Last to Leave", icon: "🕐", desc: "+2 Points if this guest is Oldest.", trigger: "scoring", type: "lastToLeave", value: 2 },
    desc: "LAST TO LEAVE — At scoring, +2 Points if this guest is Oldest.",
  },
  rumorQueen: {
    name: "Rumor Queen", emoji: "👄",
    heat: 1, money: 1, points: 1, cost: 7,
    venue: "Back Alley", tags: ["Outlaw", "Broker"], tier: "rare",
    ability: { name: "Rumor Mill", icon: "👄", desc: "Reveal the next 2 guests in your opponent’s queue and choose their order.", trigger: "flash", type: "opponentStackChoice", value: 2 },
    desc: "RUMOR MILL — A: Reveal the next 2 guests in your opponent’s queue and choose their order.",
  },
  counselor: {
    name: "Counselor", emoji: "🧘",
    heat: 0, money: 0, points: 2, cost: 7,
    venue: "Back Alley", tags: ["Scout"], tier: "rare",
    ability: { name: "Counselor", icon: "🧘", desc: "Set your Heat to 0.", trigger: "flash", type: "setHeatZero" },
    desc: "COUNSELOR — A: Set your Heat to 0.",
  },
  cupid: {
    name: "Cupid", emoji: "💘",
    heat: 1, money: 0, points: 2, cost: 8,
    venue: "Back Alley", tags: ["Performer"], tier: "rare",
    ability: { name: "Cupid", icon: "💘", desc: "Boot 2 adjacent guests.", trigger: "flash", type: "bootAdjacent", value: 2 },
    desc: "CUPID — A: Boot 2 adjacent guests.",
  },

  // === TROUBLE ===
  gatecrasher: {
    name: "Gatecrasher", emoji: "💥",
    heat: 1, money: 0, points: 0, cost: 99,
    venue: "Trouble", tags: ["Outlaw"],
    desc: "No ability.", tier: "common",
  },

  // === SHOP ITEMS ===
  slotIncrease: {
    name: "+1 Slot", emoji: "📦",
    money: 0, heat: 0, points: 0, cost: 3,
    venue: "Shop", tags: [],
    desc: "Increase your house capacity by 1.",
    tier: "shop", isShopItem: true,
  },
  heatCapIncrease: {
    name: "+1 Heat Cap", emoji: "🔥",
    money: 0, heat: 0, points: 0, cost: 4,
    venue: "Shop", tags: [],
    desc: "Increase your heat capacity by 1.",
    tier: "shop", isShopItem: true,
  },
};

  const VENUES = {
    velvetRoom: {
      name: "Red Carpet Gala",
      emoji: "🥂",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A spotlight gala where showy guests score big and refresh each other's moves.",
      style: "points",
      color: "#c9884c",
      startingDeck: [
        "headliner",
        "mainCharacter",
        "storyPoster",
        "wallflower",
        "linkUpFriend",
        "afterpartyHost",
        "familiarFace",
        "doorWatcher",
      ],
      market: [
        "headliner",
        "mainCharacter",
        "storyPoster",
        "danceCaptain",
        "afterpartyHost",
        "wallflower",
        "linkUpFriend",
      ],
    },
    champagneCountdown: {
      name: "Champagne Countdown",
      emoji: "🍾",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A packed-house party that peaks at the perfect moment—fill every seat and close strong.",
      style: "points",
      color: "#c9884c",
      startingDeck: [
        "afterpartyHost",
        "headliner",
        "danceCaptain",
        "wallflower",
        "storyPoster",
        "socialClimber",
        "familiarFace",
        "bottleBringer",
      ],
      market: [
        "headliner",
        "mainCharacter",
        "storyPoster",
        "danceCaptain",
        "afterpartyHost",
        "wallflower",
        "linkUpFriend",
      ],
    },
    headlinerAfterparty: {
      name: "Headliner Afterparty",
      emoji: "🎤",
      gridSize: 3,
      bustThreshold: 3,
      desc: "Keep the star scoring while the crew refreshes and snaps their way through the lane.",
      style: "points",
      color: "#c9884c",
      startingDeck: [
        "headliner",
        "partyPhotographer",
        "danceCaptain",
        "afterpartyHost",
        "storyPoster",
        "wallflower",
        "linkUpFriend",
        "familiarFace",
      ],
      market: [
        "headliner",
        "mainCharacter",
        "storyPoster",
        "danceCaptain",
        "afterpartyHost",
        "wallflower",
        "linkUpFriend",
      ],
    },
    nightMarket: {
      name: "Bazaar Night",
      emoji: "🏮",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A curated market soirée where queue control and money angles keep your lineup sharp.",
      style: "money",
      color: "#7f5af0",
      startingDeck: [
        "windowWatcher",
        "tabRunner",
        "highRoller",
        "bigPlanner",
        "socialButterfly",
        "coolOffSmoker",
        "bottleBringer",
        "doorWatcher",
      ],
      market: [
        "windowWatcher",
        "vipWrangler",
        "tabRunner",
        "coolOffSmoker",
        "bottlePopper",
        "bigPlanner",
        "highRoller",
      ],
    },
    trendsetterMixer: {
      name: "Trendsetter Mixer",
      emoji: "🛍️",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A market mixer where money and timing are everything.",
      style: "money",
      color: "#7f5af0",
      startingDeck: [
        "vipWrangler",
        "highRoller",
        "socialButterfly",
        "tabRunner",
        "bigPlanner",
        "windowWatcher",
        "bottleBringer",
        "coolOffSmoker",
      ],
      market: [
        "windowWatcher",
        "vipWrangler",
        "tabRunner",
        "coolOffSmoker",
        "bottlePopper",
        "bigPlanner",
        "highRoller",
      ],
    },
    backAlley: {
      name: "Smuggler's Run",
      emoji: "🕳️",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A high-velocity outlaw party—sabotage rivals, chase chaos, and stay cool.",
      style: "control",
      color: "#2cb67d",
      startingDeck: [
        "addressLeaker",
        "chaosChaser",
        "counselor",
        "rumorQueen",
        "lateLegend",
        "messyDrunk",
        "fedUpRoommate",
        "loudFriend",
      ],
      market: [
        "addressLeaker",
        "messyDrunk",
        "dramaStarter",
        "chaosChaser",
        "lateLegend",
        "rumorQueen",
        "counselor",
      ],
    },
    blackMarketBash: {
      name: "Black Market Bash",
      emoji: "💼",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A gritty underground bash where outlaws disrupt and cash out before the heat catches up.",
      style: "control",
      color: "#2cb67d",
      startingDeck: [
        "dramaStarter",
        "addressLeaker",
        "counselor",
        "chaosChaser",
        "rumorQueen",
        "lateLegend",
        "fedUpRoommate",
        "loudFriend",
      ],
      market: [
        "addressLeaker",
        "messyDrunk",
        "dramaStarter",
        "chaosChaser",
        "lateLegend",
        "rumorQueen",
        "counselor",
      ],
    },
    riotNight: {
      name: "Riot Night",
      emoji: "🚨",
      gridSize: 3,
      bustThreshold: 3,
      desc: "A volatile street party built to sabotage opponents with heat and force panic closes.",
      style: "control",
      color: "#2cb67d",
      startingDeck: [
        "messyDrunk",
        "dramaStarter",
        "cupid",
        "addressLeaker",
        "chaosChaser",
        "counselor",
        "lateLegend",
        "fedUpRoommate",
      ],
      market: [
        "addressLeaker",
        "messyDrunk",
        "dramaStarter",
        "chaosChaser",
        "lateLegend",
        "rumorQueen",
        "counselor",
      ],
    },
  };

  const GUEST_LISTS = {
    rescueMarkedStar: {
      name: "Red Carpet Gala",
      venueId: "velvetRoom",
      description: "A spotlight gala where showy guests score big and refresh each other's moves.",
      guests: [...VENUES.velvetRoom.startingDeck],
    },
    exactFullVelvetSnap: {
      name: "Champagne Countdown",
      venueId: "champagneCountdown",
      description: "A packed-house party that peaks at the perfect moment—fill every seat and close strong.",
      guests: [...VENUES.champagneCountdown.startingDeck],
    },
    protectStarSpendBouncer: {
      name: "Headliner Afterparty",
      venueId: "headlinerAfterparty",
      description: "Keep the star scoring while the crew refreshes and snaps their way through the lane.",
      guests: [...VENUES.headlinerAfterparty.startingDeck],
    },
    leftEdgeEconomy: {
      name: "Bazaar Night",
      venueId: "nightMarket",
      description: "A curated market soirée where queue control and money angles keep your lineup sharp.",
      guests: [...VENUES.nightMarket.startingDeck],
    },
    brokerStack: {
      name: "Trendsetter Mixer",
      venueId: "trendsetterMixer",
      description: "A market mixer where money and timing are everything.",
      guests: [...VENUES.trendsetterMixer.startingDeck],
    },
    cashOutHitAndRun: {
      name: "Smuggler's Run",
      venueId: "backAlley",
      description: "A high-velocity outlaw party—sabotage rivals, chase chaos, and stay cool.",
      guests: [...VENUES.backAlley.startingDeck],
    },
    fenceRegister: {
      name: "Black Market Bash",
      venueId: "blackMarketBash",
      description: "A gritty underground bash where outlaws disrupt and cash out before the heat catches up.",
      guests: [...VENUES.blackMarketBash.startingDeck],
    },
    complaintTrap: {
      name: "Riot Night",
      venueId: "riotNight",
      description: "A volatile street party built to sabotage opponents with heat and force panic closes.",
      guests: [...VENUES.riotNight.startingDeck],
    },
  };

  const DECKS = {
    standardPlayerStatOnly: {
      name: "The Regulars",
      venueId: "velvetRoom",
      description: "A starter deck built around strong baseline stats with no special abilities.",
      guests: [
        "familiarFace",
        "familiarFace",
        "bottleBringer",
        "bottleBringer",
        "loudFriend",
        "loudFriend",
        "bigSpender",
        "bigSpender",
      ],
    },
    velvetClassic: {
      name: "VIP Lineup",
      venueId: "velvetRoom",
      description: "Spotlight scoring with refreshes and showy entrances.",
      guests: [...VENUES.velvetRoom.startingDeck],
    },
    marketCore: {
      name: "Thrifty Business",
      venueId: "nightMarket",
      description: "Curate your queue, cash out, and time your exits.",
      guests: [...VENUES.nightMarket.startingDeck],
    },
    alleyPressure: {
      name: "Rowdy Crew",
      venueId: "backAlley",
      description: "Sabotage, chaos, and competitive disruption.",
      guests: [...VENUES.backAlley.startingDeck],
    },
  };

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function createHouseGuest(guestId) {
    return { instanceId: nextInstanceId++, guestId, lockUntilClose: false, abilityUsed: false };
  }
  function getGuestId(entry) {
    return typeof entry === "string" ? entry : entry.guestId;
  }

  function normalizeHouseEntry(player, index) {
    const entry = player.house[index];
    if (typeof entry !== "string") return entry || null;
    // Preserve legacy visual identity by avoiding a new numeric instanceId.
    // Using a null instanceId keeps existing guest/index-based slot keys stable,
    // which prevents a mid-round re-mount/flicker when an ability is used.
    const normalized = { instanceId: null, guestId: entry, lockUntilClose: false, abilityUsed: false };
    player.house[index] = normalized;
    return normalized;
  }

  // --- Modular ability effect helpers ---
  // These centralise shared effect logic so each effect type is implemented once.

  function applySimpleEffect(player, opponent, abilityType, value, result, prefix) {
    if (!result.pings) result.pings = [];
    switch (abilityType) {
      case "coolHeat":
        player.heat = Math.max(0, player.heat - value);
        result.effects.push(`${prefix}cooled ${value} heat`);
        return true;
      case "addOpponentHeat":
        if (opponent) {
          opponent.heat += value;
          result.effects.push(`${prefix}added ${value} heat to opponent`);
        }
        return true;
      case "scoreNow":
        player.roundPoints += value;
        result.effects.push(`${prefix}scored ${value} points`);
        result.pings.push({ type: 'points', value });
        return true;
      case "gainMoney":
        player.roundMoney += value;
        result.effects.push(`${prefix}gained ${value} money`);
        result.pings.push({ type: 'money', value });
        return true;
      case "queueGatecrasher":
        if (opponent) {
          opponent.roundDeck.push("gatecrasher");
          result.effects.push(`${prefix}queued gatecrasher for opponent`);
        }
        return true;
      case "setHeatZero": {
        const oldHeat = player.heat;
        player.heat = 0;
        result.effects.push(`${prefix}cooled ${oldHeat} heat`);
        return true;
      }
      default:
        return false;
    }
  }

  function applyPeekEffect(deck, result, prefix) {
    if (deck.length >= 2) {
      const topIdx = deck.length - 1;
      const secondIdx = deck.length - 2;
      result.revealedGuests = [deck[topIdx], deck[secondIdx]];
      result.needsStackChoice = true;
      result.effects.push(`${prefix}peeked: ${GUESTS[deck[topIdx]].name}, ${GUESTS[deck[secondIdx]].name} — choose order`);
    } else if (deck.length === 1) {
      result.revealedGuests = [deck[0]];
      result.effects.push(`${prefix}peeked: ${GUESTS[deck[0]].name}`);
    } else {
      result.effects.push(`${prefix}queue empty`);
    }
  }

  function applyNameDropEffect(deck, count, result, prefix) {
    const actual = Math.min(count, deck.length);
    if (actual > 0) {
      const revealed = [];
      for (let i = deck.length - 1; i >= deck.length - actual; i--) {
        revealed.push(deck[i]);
      }
      result.revealedGuests = revealed;
      result.needsNameDropChoice = true;
      result.effects.push(`${prefix}revealed: ${revealed.map(id => GUESTS[id].name).join(", ")} — choose one to admit`);
    }
  }

  function getHouseCapacity(venue, player) {
    // House capacity matches the visible grid size; arriving guest is
    // rendered into the grid now, so don't subtract 1.
    // Add any permanent slot increases the player has purchased.
    const baseCapacity = Math.max(0, (venue?.gridSize || 0));
    const slotBonus = player?.slotIncrease || 0;
    return baseCapacity + slotBonus;
  }

  function getHeatCapacity(venue, player) {
    const baseCapacity = Math.max(0, venue?.bustThreshold || 0);
    const heatBonus = player?.heatCapBonus || 0;
    return baseCapacity + heatBonus;
  }

  function createPlayer(name, venueId, isAI) {
    const venue = VENUES[venueId];
    return {
      name,
      venueId,
      isAI,
      fullDeck: [...venue.startingDeck],
      guestList: [...venue.startingDeck],
      roundDeck: [],
      house: [],
      arrivingGuest: null,
      arrivingAbilityUsed: false,
      roundMoney: 0,
      roundPoints: 0,
      guestMoney: 0,
      guestPoints: 0,
      money: 0,
      points: 0,
      heat: 0,
      doorClosed: false,
      busted: false,
      phaseComplete: false,
      slotIncrease: 0,
      heatCapBonus: 0,
      shopItemPurchases: { slotIncrease: 0, heatCapIncrease: 0 },
      // Pending arrival state (set at draw time, consumed at admit time)
      arrivingBonusPoints: 0,
      arrivingCopiedAbility: null,
      pendingPlusOne: false,
      pendingMagnet: false,
    };
  }
  function createGameState(
    playerName,
    playerVenue,
    rivalName,
    rivalVenue,
    pointTarget = DEFAULT_POINT_TARGET,
  ) {
    return {
      round: 1,
      pointTarget,
      phase: "guest",
      guestPhaseScoredRound: null,
      player: createPlayer(playerName, playerVenue, false),
      rival: createPlayer(rivalName, rivalVenue, true),
      winner: null,
    };
  }

  function determineWinner(state) {
    const target = Math.max(1, state.pointTarget || DEFAULT_POINT_TARGET);
    const playerReached = state.player.points >= target;
    const rivalReached = state.rival.points >= target;

    if (!playerReached && !rivalReached) return null;
    if (playerReached && !rivalReached) return "player";
    if (rivalReached && !playerReached) return "rival";

    if (state.player.points === state.rival.points) {
      return null;
    }
    return state.player.points > state.rival.points ? "player" : "rival";
  }

  function startGuestPhase(state) {
    state.phase = "guest";
    state.guestPhaseScoredRound = null;
    [state.player, state.rival].forEach((p) => {
      const equippedDeck = p.fullDeck?.length ? p.fullDeck : p.guestList;
      p.roundDeck = shuffle(equippedDeck || []);
      // Don't clear house - preserve guests from previous round
      p.arrivingGuest = null;
      p.arrivingAbilityUsed = false;
      p.roundMoney = 0;
      p.roundPoints = 0;
      p.guestMoney = 0;
      p.guestPoints = 0;
      p.heat = 0;
      p.doorClosed = false;
      p.busted = false;
      p.phaseComplete = false;
      p.arrivingBonusPoints = 0;
      p.arrivingCopiedAbility = null;
      p.pendingPlusOne = false;
      p.pendingMagnet = false;
    });
    // ignore pendingOut at round start; there should be none
    // Arrival effects fire at draw time, so pass opponents
    const playerRes = drawNextGuest(state.player, VENUES[state.player.venueId], false, state.rival);
    const rivalRes = drawNextGuest(state.rival, VENUES[state.rival.venueId], false, state.player);
    return { playerArrival: playerRes.arrivalResult, rivalArrival: rivalRes.arrivalResult };
  }

  // returns object indicating whether a card was drawn and, if the house
  // is already full, the ID of the guest who will be pushed out the next time
  // the arriving guest is admitted.
  function drawNextGuest(player, venue, skipBustCheck = false, opponent = null) {
    if (player.roundDeck.length === 0) {
      player.arrivingGuest = null;
      player.arrivingAbilityUsed = false;
      player.phaseComplete = true;
      player.doorClosed = true;
      return { success: false, pendingOut: null };
    }

    // If the house is currently full, the oldest visible guest has already
    // reached the exit slot. Remove them immediately so the arriving guest can
    // occupy that grid slot.
    let pendingOut = null;
    const capacity = getHouseCapacity(venue, player);
    if (capacity >= 0 && player.house.length >= capacity && player.house.length) {
      const exiting = player.house.pop();
      pendingOut = getGuestId(exiting);
    }

    // Reset pending arrival state from previous guest
    player.arrivingBonusPoints = 0;
    player.arrivingCopiedAbility = null;
    player.pendingPlusOne = false;
    player.pendingMagnet = false;

    player.arrivingGuest = player.roundDeck.pop();
    player.arrivingAbilityUsed = false;
    const guest = GUESTS[player.arrivingGuest];
    if (guest) {
      player.heat += guest.heat;
      if (!skipBustCheck && player.heat > getHeatCapacity(venue, player)) {
        applyBustState(player);
      }
    }

    // Fire arrival effects at draw time (when the guest appears at the door)
    let arrivalResult = null;
    if (!player.busted && player.arrivingGuest) {
      arrivalResult = { effects: [], pushedOut: [] };
      handleArrivalEffects(player, opponent, player.arrivingGuest, venue, arrivalResult);
      if (!arrivalResult.effects.length && !arrivalResult.needsStackChoice && !arrivalResult.needsNameDropChoice) {
        arrivalResult = null;
      }
    }

    return { success: true, pendingOut, arrivalResult };
  }

  function applyGuestImpact(player, guestId) {
    const guest = GUESTS[guestId];
    if (!guest) return;
    // Guest base stats are deferred until the round results screen.
    // Only ability-granted values go into roundMoney/roundPoints.
    player.guestMoney += guest.money;
    player.guestPoints += guest.points;
  }

  function applyBustState(player) {
    player.busted = true;
    player.phaseComplete = true;
    player.roundMoney = Math.floor(player.roundMoney * BUST_PENALTY);
    player.roundPoints = Math.floor(player.roundPoints * BUST_PENALTY);
    player.guestMoney = Math.floor(player.guestMoney * BUST_PENALTY);
    player.guestPoints = Math.floor(player.guestPoints * BUST_PENALTY);
  }

  function moveArrivingGuestIntoHouse(player, venue) {
    if (!player.arrivingGuest) return [];
    applyGuestImpact(player, player.arrivingGuest);
    const popped = [];
    const admittedEntry = createHouseGuest(player.arrivingGuest);
    admittedEntry.abilityUsed = !!player.arrivingAbilityUsed;
    // Transfer pending arrival state from draw-time effects
    if (player.arrivingBonusPoints) {
      admittedEntry.bonusPoints = player.arrivingBonusPoints;
      player.arrivingBonusPoints = 0;
    }
    if (player.arrivingCopiedAbility) {
      admittedEntry.copiedAbility = player.arrivingCopiedAbility;
      player.arrivingCopiedAbility = null;
    }
    player.house.unshift(admittedEntry);
    player.arrivingAbilityUsed = false;
    // trim to capacity, collecting every removed guest
    while (player.house.length > getHouseCapacity(venue, player)) {
      popped.push(player.house.pop());
    }
    return popped;
  }

  function getEffectiveTagsForEntry(player, index) {
    const entry = player.house[index];
    if (!entry) return [];
    return [...(GUESTS[getGuestId(entry)].tags || [])];
  }

  function getLockedIndexes(player) {
    const locked = new Set();
    for (let i = 0; i < player.house.length; i++) {
      const entry = player.house[i];
      if (entry && typeof entry !== "string" && entry.lockUntilClose) {
        locked.add(i);
      }
    }
    return locked;
  }

  function pushLeftmost(player) {
    const idx = player.house.length - 1;
    const locked = getLockedIndexes(player);
    if (idx < 0 || locked.has(idx)) return null;
    return player.house.splice(idx, 1)[0];
  }

  function pullGuestOneStep(player) {
    const locked = getLockedIndexes(player);
    for (let i = player.house.length - 1; i >= 1; i--) {
      if (locked.has(i) || locked.has(i - 1)) continue;
      const [entry] = player.house.splice(i, 1);
      player.house.splice(i - 1, 0, entry);
      return i - 1;
    }
    return null;
  }

  // --- Targeting support for lane abilities (boot/bounce/nudge/lock) ---
  function resolveTargetIndex(player, sourceIndex, targeting) {
    switch (targeting) {
      case "oldest":
        return player.house.length - 1;
      case "newest":
        return 0;
      case "leftOfSelf":
        if (sourceIndex === -1) {
          // Arriving guest will be at index 0; left of self = current index 0
          return player.house.length > 0 ? 0 : -1;
        }
        return sourceIndex + 1;
      case "rightOfSelf":
        if (sourceIndex === -1) {
          // Arriving guest will be at index 0; right of self = invalid (nothing newer)
          return -1;
        }
        return sourceIndex - 1;
      default:
        return -1;
    }
  }

  function resolveStackChoice(player, firstId) {
    const deck = player.roundDeck;
    if (deck.length < 2) return false;
    const topIdx = deck.length - 1;
    const secondIdx = deck.length - 2;
    const top = deck[topIdx];
    const second = deck[secondIdx];
    if (firstId !== top && firstId !== second) return false;
    // Reorder so firstId is on top (drawn next = last in array)
    if (deck[topIdx] !== firstId) {
      deck[topIdx] = firstId;
      deck[secondIdx] = firstId === top ? second : top;
    }
    return true;
  }

  function admitGuest(player, venue, opponent = null, opponentVenue = null, _depth = 0) {
    if (!player.arrivingGuest || player.doorClosed || player.busted)
      return null;
    const guestId = player.arrivingGuest;
    const result = {
      admitted: guestId,
      pushedOut: [],
      pendingOut: null,
      busted: false,
      effects: [],
      pings: [],
    };

    // Capture draw-time arrival flags before they're reset by the next draw
    const hadPlusOne = player.pendingPlusOne;
    const hadMagnet = player.pendingMagnet;
    player.pendingPlusOne = false;
    player.pendingMagnet = false;

    const pushed = moveArrivingGuestIntoHouse(player, venue);
    // Handle departure effects for pushed-out guests
    pushed.forEach(exit => {
      const exitId = getGuestId(exit);
      result.pushedOut.push(exitId);
      handleDepartureEffects(player, opponent, exitId, result);
    });
    if (player.heat > getHeatCapacity(venue, player)) {
      result.busted = true;
      applyBustState(player);
    }
    player.arrivingGuest = null;
    player.arrivingAbilityUsed = false;

    // Arrival effects already fired at draw time — no handleArrivalEffects here.

    // Draw the next guest (its arrival effects fire during draw)
    if (!result.busted) {
      const drawRes = drawNextGuest(player, venue, false, opponent);
      if (drawRes.pendingOut) {
        result.pendingOut = drawRes.pendingOut;
        handleDepartureEffects(player, opponent, drawRes.pendingOut, result);
      }
      if (player.busted) result.busted = true;

      // If the NEXT drawn guest's arrival needs a choice, pass it through
      if (drawRes.arrivalResult?.needsStackChoice || drawRes.arrivalResult?.needsNameDropChoice) {
        result.needsStackChoice = drawRes.arrivalResult.needsStackChoice || false;
        result.needsNameDropChoice = drawRes.arrivalResult.needsNameDropChoice || false;
        result.revealedGuests = drawRes.arrivalResult.revealedGuests;
        result.deferredDraw = true;
        result.arrivalEffects = drawRes.arrivalResult.effects;
        result.arrivalPings = drawRes.arrivalResult.pings || [];
      } else if (drawRes.arrivalResult?.pings?.length) {
        result.arrivalPings = drawRes.arrivalResult.pings;
      }
    }

    // Handle plusOne / magnet: auto-admit the next drawn guest
    if (!result.busted && !result.deferredDraw && (hadPlusOne || hadMagnet) && _depth < 3) {
      if (player.arrivingGuest && !player.doorClosed && !player.busted) {
        const autoResult = admitGuest(player, venue, opponent, opponentVenue, _depth + 1);
        if (autoResult) {
          result.autoAdmitted = autoResult;
        }
      }
    }

    return result;
  }

  // --- Resolve target index for "choice" targeting via selectedGuest param ---
  // Returns house index, or -2 if targeting the arriving guest, or -1 if none.
  function resolveChoiceTarget(player, selectedGuest) {
    if (selectedGuest?.targetArriving && player.arrivingGuest) return -2;
    if (!selectedGuest?.targetInstanceId) return -1;
    return player.house.findIndex(
      (e) => typeof e !== "string" && e.instanceId === selectedGuest.targetInstanceId,
    );
  }

  function applyAbilityEffects(player, opponent, guest, result, sourceIndex, selectedGuest) {
    const abilityDef = (typeof sourceIndex === "number" && sourceIndex >= 0 &&
      player.house[sourceIndex] && typeof player.house[sourceIndex] !== "string" &&
      player.house[sourceIndex].copiedAbility)
      ? { ...guest, ability: player.house[sourceIndex].copiedAbility }
      : guest;
    const ability = abilityDef.ability;

    // Delegate simple shared effects first
    if (applySimpleEffect(player, opponent, ability.type, ability.value, result, "")) return;

    switch (ability.type) {
      case "revealNext": {
        const count = Math.min(ability.value, player.roundDeck.length);
        const revealed = [];
        for (let i = player.roundDeck.length - 1; i >= player.roundDeck.length - count; i--) {
          const revealId = player.roundDeck[i];
          revealed.push({ id: revealId, name: GUESTS[revealId].name });
        }
        result.revealedGuests = revealed.map((entry) => entry.id);
        result.effects.push(
          revealed.length
            ? `next up: ${revealed.map((entry) => entry.name).join(", ")}`
            : "queue empty",
        );
        break;
      }
      case "stackChoice":
        applyPeekEffect(player.roundDeck, result, "");
        break;
      case "nameDrop":
        applyNameDropEffect(player.roundDeck, ability.value || 3, result, "");
        break;
      case "boot": {
        const targeting = ability.targeting || "oldest";
        // The arriving guest can be targeted only if the ability source is a house guest
        const bootCanTargetArriving = sourceIndex >= 0 && !!player.arrivingGuest;
        let targetIdx;
        if (targeting === "choice") {
          targetIdx = resolveChoiceTarget(player, selectedGuest);
          if (targetIdx === -2 && bootCanTargetArriving) {
            const arrivingId = player.arrivingGuest;
            player.arrivingGuest = null;
            player.arrivingAbilityUsed = false;
            player.heat = Math.max(0, player.heat - GUESTS[arrivingId].heat);
            result.effects.push(`booted ${GUESTS[arrivingId].name}`);
            result.pushedOut = arrivingId;
            handleDepartureEffects(player, opponent, arrivingId, result);
            break;
          }
          if (targetIdx < 0 || targetIdx === -2) {
            if (player.house.length === 0 && !bootCanTargetArriving) {
              result.effects.push("no valid target");
            } else {
              result.needsTargetChoice = true;
              result.validTargets = player.house.map((e, i) => ({ index: i, guestId: getGuestId(e) }));
              result.canTargetArriving = bootCanTargetArriving;
            }
            break;
          }
        } else {
          targetIdx = resolveTargetIndex(player, sourceIndex, targeting);
        }
        if (targetIdx < 0 || targetIdx >= player.house.length) {
          result.effects.push("no valid target");
          break;
        }
        const locked = getLockedIndexes(player);
        if (locked.has(targetIdx)) {
          result.effects.push("target is locked");
          break;
        }
        const exiting = player.house.splice(targetIdx, 1)[0];
        const exitGuestId = getGuestId(exiting);
        result.effects.push(`booted ${GUESTS[exitGuestId].name}`);
        result.pushedOut = exitGuestId;
        handleDepartureEffects(player, opponent, exitGuestId, result);
        break;
      }
      case "bounce": {
        const targeting = ability.targeting || "oldest";
        const bounceCanTargetArriving = sourceIndex >= 0 && !!player.arrivingGuest;
        let targetIdx;
        if (targeting === "choice") {
          targetIdx = resolveChoiceTarget(player, selectedGuest);
          if (targetIdx === -2 && bounceCanTargetArriving) {
            const arrivingId = player.arrivingGuest;
            player.arrivingGuest = null;
            player.arrivingAbilityUsed = false;
            player.heat = Math.max(0, player.heat - GUESTS[arrivingId].heat);
            player.roundDeck.unshift(arrivingId);
            result.effects.push(`bounced ${GUESTS[arrivingId].name}`);
            break;
          }
          if (targetIdx < 0 || targetIdx === -2) {
            if (player.house.length === 0 && !bounceCanTargetArriving) {
              result.effects.push("no valid target");
            } else {
              result.needsTargetChoice = true;
              result.validTargets = player.house.map((e, i) => ({ index: i, guestId: getGuestId(e) }));
              result.canTargetArriving = bounceCanTargetArriving;
            }
            break;
          }
        } else {
          targetIdx = resolveTargetIndex(player, sourceIndex, targeting);
        }
        if (targetIdx < 0 || targetIdx >= player.house.length) {
          result.effects.push("no valid target");
          break;
        }
        const locked = getLockedIndexes(player);
        if (locked.has(targetIdx)) {
          result.effects.push("target is locked");
          break;
        }
        const bounced = player.house.splice(targetIdx, 1)[0];
        player.roundDeck.unshift(getGuestId(bounced));
        result.effects.push(`bounced ${GUESTS[getGuestId(bounced)].name}`);
        break;
      }
      case "nudge": {
        const targeting = ability.targeting || "oldest";
        let targetIdx;
        if (targeting === "choice") {
          targetIdx = resolveChoiceTarget(player, selectedGuest);
          if (targetIdx < 0) {
            if (player.house.length === 0) {
              result.effects.push("no valid target");
            } else {
              result.needsTargetChoice = true;
              result.validTargets = player.house.map((e, i) => ({ index: i, guestId: getGuestId(e) }));
            }
            break;
          }
        } else {
          targetIdx = resolveTargetIndex(player, sourceIndex, targeting);
        }

        if (targetIdx < 0 || targetIdx >= player.house.length) {
          result.effects.push("no valid target");
          break;
        }

        const locked = getLockedIndexes(player);
        if (locked.has(targetIdx)) {
          result.effects.push("target is locked");
          break;
        }

        const swapIdx = targetIdx + 1;
        if (swapIdx >= player.house.length) {
          const exiting = player.house.splice(targetIdx, 1)[0];
          const exitingId = getGuestId(exiting);
          result.pushedOut.push(exitingId);
          result.effects.push(`nudged ${GUESTS[exitingId].name} out`);
          handleDepartureEffects(player, opponent, exitingId, result);
          break;
        }

        if (locked.has(swapIdx)) {
          result.effects.push("target is locked");
          break;
        }

        const [entry] = player.house.splice(targetIdx, 1);
        player.house.splice(swapIdx, 0, entry);
        result.effects.push(`nudged ${GUESTS[getGuestId(entry)].name} left`);
        break;
      }
      case "clearHouse": {
        const cleared = [];
        while (player.house.length > 0) {
          const removed = player.house.pop();
          const removedId = getGuestId(removed);
          cleared.push(removedId);
          handleDepartureEffects(player, opponent, removedId, result);
        }
        result.effects.push(cleared.length ? `cleared ${cleared.length} guests` : "house already empty");
        break;
      }
      case "scoreGuest": {
        const scoreCanTargetArriving = sourceIndex >= 0 && !!player.arrivingGuest;
        const targetIdx = resolveChoiceTarget(player, selectedGuest);
        if (targetIdx === -2 && scoreCanTargetArriving) {
          const arrivingGuest = GUESTS[player.arrivingGuest];
          if (arrivingGuest) {
            player.roundPoints += arrivingGuest.points;
            player.roundMoney += arrivingGuest.money;
            result.effects.push(`scored ${arrivingGuest.points} points and ${arrivingGuest.money} money from ${arrivingGuest.name}`);
          }
          break;
        }
        if (targetIdx < 0 || targetIdx === -2) {
          if (player.house.length === 0 && !scoreCanTargetArriving) {
            result.effects.push("no valid target");
          } else {
            result.needsTargetChoice = true;
            result.validTargets = player.house.map((e, i) => ({ index: i, guestId: getGuestId(e) }));
            result.canTargetArriving = scoreCanTargetArriving;
          }
          break;
        }
        const targetEntry = player.house[targetIdx];
        const targetGuestId = getGuestId(targetEntry);
        const targetGuest = GUESTS[targetGuestId];
        if (targetGuest) {
          const bonus = targetGuest.points + ((typeof targetEntry !== "string" && targetEntry.bonusPoints) || 0);
          player.roundPoints += bonus;
          player.roundMoney += targetGuest.money;
          result.effects.push(`scored ${bonus} points and ${targetGuest.money} money from ${targetGuest.name}`);
        }
        break;
      }
      case "refreshAction": {
        const targetIdx = resolveChoiceTarget(player, selectedGuest);
        if (targetIdx < 0) {
          const refreshable = player.house.filter((e, i) => {
            if (typeof e === "string" || !e.abilityUsed) return false;
            const g = GUESTS[getGuestId(e)];
            return g?.ability?.trigger === "flash";
          });
          if (refreshable.length === 0) {
            result.effects.push("no guest to refresh");
          } else {
            result.needsTargetChoice = true;
            result.validTargets = player.house.map((e, i) => ({ index: i, guestId: getGuestId(e) }));
          }
          break;
        }
        const targetEntry = player.house[targetIdx];
        if (targetEntry && typeof targetEntry !== "string") {
          targetEntry.abilityUsed = false;
          result.effects.push(`refreshed ${GUESTS[getGuestId(targetEntry)].name}`);
        }
        break;
      }
      case "refreshAllActions": {
        let refreshed = 0;
        for (let i = 0; i < player.house.length; i++) {
          const entry = player.house[i];
          if (!entry || typeof entry === "string") continue;
          // Don't refresh self
          if (i === sourceIndex) continue;
          if (entry.abilityUsed) {
            entry.abilityUsed = false;
            refreshed++;
          }
        }
        result.effects.push(refreshed ? `refreshed ${refreshed} actions` : "no actions to refresh");
        break;
      }
      case "opponentStackChoice": {
        const deck = opponent.roundDeck;
        if (deck.length >= 2) {
          const topIdx = deck.length - 1;
          const secondIdx = deck.length - 2;
          result.revealedGuests = [deck[topIdx], deck[secondIdx]];
          result.needsOpponentStackChoice = true;
          result.effects.push(`opponent's queue: ${GUESTS[deck[topIdx]].name}, ${GUESTS[deck[secondIdx]].name} — choose order`);
        } else if (deck.length === 1) {
          result.revealedGuests = [deck[0]];
          result.effects.push(`opponent's queue: ${GUESTS[deck[0]].name}`);
        } else {
          result.effects.push("opponent's queue is empty");
        }
        break;
      }
      case "bootAdjacent": {
        const booted = [];
        if (sourceIndex >= 0) {
          const locked = getLockedIndexes(player);
          // Boot right neighbor first (lower index), then left (higher index)
          const neighbors = [];
          if (sourceIndex > 0) neighbors.push(sourceIndex - 1);
          if (sourceIndex < player.house.length - 1) neighbors.push(sourceIndex + 1);
          // Sort descending so splice doesn't shift indexes
          neighbors.sort((a, b) => b - a);
          for (const idx of neighbors) {
            if (locked.has(idx)) continue;
            const exiting = player.house.splice(idx, 1)[0];
            const exitId = getGuestId(exiting);
            booted.push(exitId);
            handleDepartureEffects(player, opponent, exitId, result);
          }
        }
        result.effects.push(booted.length ? `booted ${booted.length} adjacent guests` : "no adjacent guests");
        break;
      }
    }
  }

  // --- Departure effects: triggered when a guest leaves the house ---
  function handleDepartureEffects(player, opponent, departingGuestId, result) {
    const guest = GUESTS[departingGuestId];
    if (!guest?.ability || guest.ability.trigger !== "departure") return;
    const prefix = `${guest.name} departure: `;
    const pingsBefore = result.pings ? result.pings.length : 0;
    applySimpleEffect(player, opponent, guest.ability.type, guest.ability.value, result, prefix);
    // Tag any new pings with the departing guest ID
    if (result.pings) {
      for (let i = pingsBefore; i < result.pings.length; i++) {
        result.pings[i].guestId = departingGuestId;
        result.pings[i].phase = 'departure';
      }
    }
  }

  // --- Arrival effects: triggered at draw time (when guest appears at the door) ---
  function handleArrivalEffects(player, opponent, guestId, venue, result) {
    const guest = GUESTS[guestId];
    if (!guest?.ability || guest.ability.trigger !== "arrival") return;

    if (!result.pings) result.pings = [];
    switch (guest.ability.type) {
      case "scoreNow":
        player.roundPoints += guest.ability.value;
        result.effects.push(`scored ${guest.ability.value} points on arrival`);
        result.pings.push({ type: 'points', value: guest.ability.value });
        return;
      case "queueGatecrasher":
        if (opponent) {
          opponent.roundDeck.push("gatecrasher");
          result.effects.push("planted gatecrasher on opponent's queue");
        }
        return;
      case "plusOne":
        player.pendingPlusOne = true;
        result.effects.push("plus one triggered");
        break;
      case "magnet":
        player.pendingMagnet = true;
        result.effects.push("magnet triggered — plus one with arrival");
        break;
      case "stackChoice":
        applyPeekEffect(player.roundDeck, result, "");
        break;
      case "nameDrop":
        applyNameDropEffect(player.roundDeck, guest.ability.value || 3, result, "");
        break;
      case "socialClimber": {
        // Guest is at the door, not in house yet. Store pending bonus
        // to be applied when the guest is admitted.
        player.arrivingBonusPoints = (player.arrivingBonusPoints || 0) + 1;
        const max = guest.ability.maxBonus || 9;
        if (player.arrivingBonusPoints > max) player.arrivingBonusPoints = max;
        result.effects.push(`social climber: +${player.arrivingBonusPoints} permanent points`);
        break;
      }
      case "impersonator": {
        // Guest is at the door. Left neighbor will be house[0] (current newest).
        if (player.house.length > 0) {
          const leftGuest = GUESTS[getGuestId(player.house[0])];
          if (leftGuest?.ability && leftGuest.ability.trigger === "flash") {
            player.arrivingCopiedAbility = { ...leftGuest.ability };
            result.effects.push(`copied ${leftGuest.ability.name} from ${leftGuest.name}`);
          } else {
            result.effects.push("no action ability to copy");
          }
        } else {
          result.effects.push("no guest to copy from");
        }
        break;
      }
    }
  }

  // --- Scoring bonuses: evaluated at end of round ---
  function applyScoringBonuses(player, venue) {
    for (let i = 0; i < player.house.length; i++) {
      const entry = player.house[i];
      if (!entry) continue;
      const guestId = getGuestId(entry);
      const guest = GUESTS[guestId];

      // Add bonusPoints from socialClimber
      if (typeof entry !== "string" && entry.bonusPoints) {
        player.guestPoints += entry.bonusPoints;
      }

      if (!guest?.ability || guest.ability.trigger !== "scoring") continue;
      switch (guest.ability.type) {
        case "wallflower": {
          const capacity = getHouseCapacity(venue, player);
          const emptySlots = Math.max(0, capacity - player.house.length);
          player.roundPoints += emptySlots;
          break;
        }
        case "clique": {
          const myTags = guest.tags || [];
          let bonus = 0;
          if (i > 0) {
            const neighbor = GUESTS[getGuestId(player.house[i - 1])];
            if (neighbor && myTags.some(t => (neighbor.tags || []).includes(t))) bonus++;
          }
          if (i < player.house.length - 1) {
            const neighbor = GUESTS[getGuestId(player.house[i + 1])];
            if (neighbor && myTags.some(t => (neighbor.tags || []).includes(t))) bonus++;
          }
          player.roundPoints += bonus;
          break;
        }
        case "centerOfAttention": {
          if (i === 0) player.roundPoints += (guest.ability.value || 2);
          break;
        }
        case "packedHouse": {
          const capacity = getHouseCapacity(venue, player);
          if (player.house.length >= capacity && capacity > 0) {
            player.roundPoints += (guest.ability.value || 4);
          }
          break;
        }
        case "highRoller": {
          const totalMoney = player.roundMoney + player.guestMoney + player.money;
          player.roundPoints += Math.floor(totalMoney / 2);
          break;
        }
        case "chaosChaser": {
          player.roundPoints += player.heat;
          break;
        }
        case "lastToLeave": {
          if (i === player.house.length - 1) player.roundPoints += (guest.ability.value || 2);
          break;
        }
      }
    }
  }

  function activateAbility(player, opponent, playerVenue, opponentVenue, selectedGuest = null) {
    if (player.doorClosed || player.busted) return null;

    const selectedSource = selectedGuest?.source;
    if (selectedSource === "house") {
      let selectedIndex = -1;
      if (selectedGuest.instanceId != null) {
        selectedIndex = player.house.findIndex(
          (entry) =>
            typeof entry !== "string" &&
            entry.instanceId === selectedGuest.instanceId,
        );
      }
      if (selectedIndex < 0 && selectedGuest.guestId) {
        selectedIndex = player.house.findIndex(
          (entry) => getGuestId(entry) === selectedGuest.guestId,
        );
      }
      if (selectedIndex < 0) return null;

      const entry = normalizeHouseEntry(player, selectedIndex);
      const guestId = getGuestId(entry);
      const guest = GUESTS[guestId];
      // Allow flash trigger OR copiedAbility
      const hasCopied = entry.copiedAbility;
      if (!hasCopied && (!guest?.ability || guest.ability.trigger !== "flash")) {
        return null;
      }
      if (entry.abilityUsed) {
        return null;
      }

      const result = {
        activated: guest.name,
        ability: hasCopied || guest.ability,
        effects: [],
        pushedOut: [],
        pendingOut: null,
        busted: false,
      };
      applyAbilityEffects(player, opponent, guest, result, selectedIndex, selectedGuest);
      // Don't mark used if the ability needs a target choice
      if (!result.needsTargetChoice) {
        entry.abilityUsed = true;
      }
      return result;
    }

    if (!player.arrivingGuest) return null;
    const guest = GUESTS[player.arrivingGuest];
    if (!guest.ability || guest.ability.trigger !== "flash") return null;

    if (player.arrivingAbilityUsed) return null;

    const result = {
      activated: guest.name,
      ability: guest.ability,
      effects: [],
      pushedOut: [],
      pendingOut: null,
      busted: false,
    };
    applyAbilityEffects(player, opponent, guest, result, -1, selectedGuest);
    if (!result.needsTargetChoice) {
      player.arrivingAbilityUsed = true;
    }

    return result;
  }

  function closeDoor(player, venue, opponent = null) {
    if (player.doorClosed || player.busted) return false;
    // Bank only the currently arriving guest when closing.
    const hadArrivingGuest = !!player.arrivingGuest;
    const pushed = moveArrivingGuestIntoHouse(player, venue);
    const processedGuests = [];
    if (hadArrivingGuest && player.house.length) {
      const newestEntry = player.house[0];
      processedGuests.push({
        guestId: getGuestId(newestEntry),
        instanceId:
          newestEntry && typeof newestEntry === "object"
            ? newestEntry.instanceId
            : null,
      });
    }

    // Then animate the remaining visible in-house line.
    for (let i = 1; i < player.house.length; i++) {
      const entry = player.house[i];
      processedGuests.push({
        guestId: getGuestId(entry),
        instanceId: entry && typeof entry === "object" ? entry.instanceId : null,
      });
    }

    player.doorClosed = true;
    player.phaseComplete = true;
    player.arrivingGuest = null;
    player.arrivingAbilityUsed = false;
    return {
      closed: true,
      processedGuests,
      pushedOut: pushed.map(getGuestId),
      busted: player.busted,
    };
  }

  function bothDone(state) {
    return state.player.phaseComplete && state.rival.phaseComplete;
  }

  function getRoundEarnings(player) {
    if (!player) return { money: 0, points: 0, busted: false };

    let guestMoney = player.guestMoney;
    let guestPoints = player.guestPoints;

    if (player.arrivingGuest && !player.busted) {
      const arriving = GUESTS[player.arrivingGuest];
      if (arriving) {
        guestMoney += arriving.money;
        guestPoints += arriving.points;
      }
    }

    return {
      money: player.roundMoney + guestMoney,
      points: player.roundPoints + guestPoints,
      busted: !!player.busted,
    };
  }

  function endGuestPhase(state) {
    if (state.guestPhaseScoredRound === state.round) return;
    [state.player, state.rival].forEach((p) => {
      // If there's an arriving guest still waiting and the player hasn't
      // busted, move them into the house so they persist to the next round.
      if (p.arrivingGuest && !p.busted) {
        const venue = VENUES[p.venueId];
        moveArrivingGuestIntoHouse(p, venue);
      }
      p.arrivingGuest = null;
      p.arrivingAbilityUsed = false;
      if (!p.busted) {
        // Apply scoring bonuses before tallying
        const venue = VENUES[p.venueId];
        applyScoringBonuses(p, venue);
        const earned = getRoundEarnings(p);
        p.money += earned.money;
        p.points += earned.points;
      }
      p.roundMoney = 0;
      p.roundPoints = 0;
      p.guestMoney = 0;
      p.guestPoints = 0;
    });
    state.winner = determineWinner(state);
    state.guestPhaseScoredRound = state.round;
  }
  function getMarket(venueId) {
    const venue = VENUES[venueId];
    if (!venue) return [];

    const neutralGuests = Object.keys(GUESTS).filter((guestId) => {
      const guest = GUESTS[guestId];
      return guest.venue === "Neutral" && guest.cost < 99;
    });

    const marketPool = [...new Set([...venue.market, ...neutralGuests])].filter(
      (guestId) => !!GUESTS[guestId] && !GUESTS[guestId].isShopItem,
    );

    // Shuffle and take 10 random guests from the pool
    const shuffled = shuffle(marketPool);
    const randomGuests = shuffled.slice(0, 10);

    return randomGuests;
  }
  function buyGuest(player, guestId) {
    const guest = GUESTS[guestId];
    if (!guest) return false;

    // Calculate cost for shop items (dynamic pricing)
    let cost = guest.cost;
    if (guestId === 'slotIncrease') {
      cost = 3 + (player.shopItemPurchases.slotIncrease * 2);
    } else if (guestId === 'heatCapIncrease') {
      cost = 4 + (player.shopItemPurchases.heatCapIncrease * 3);
    }

    if (player.money < cost) return false;
    player.money -= cost;

    // Handle shop items specially
    if (guest.isShopItem) {
      if (guestId === 'slotIncrease') {
        player.slotIncrease += 1;
        player.shopItemPurchases.slotIncrease += 1;
      } else if (guestId === 'heatCapIncrease') {
        player.heatCapBonus += 1;
        player.shopItemPurchases.heatCapIncrease += 1;
      }
    } else {
      player.fullDeck.push(guestId);
    }
    return true;
  }
  function endBuyPhase(state) {
    if (state.winner) {
      state.phase = "gameover";
    } else {
      // Clear venue grids just before the next round begins so guests
      // are removed from the house at the round boundary.
      [state.player, state.rival].forEach((p) => {
        p.house = [];
        p.arrivingGuest = null;
        p.arrivingAbilityUsed = false;
      });
      state.round++;
      state.phase = "guest";
    }
  }

  // Resolve a name-drop choice: player picks one guest to come next.
  // Moves chosen to top of deck so it's drawn next when the current guest is admitted.
  function resolveNameDropChoice(player, venue, opponent, opponentVenue, chosenId) {
    const deck = player.roundDeck;
    const idx = deck.lastIndexOf(chosenId);
    if (idx < 0) return false;
    // Move chosen to top of deck (end of array = next to be drawn)
    deck.splice(idx, 1);
    deck.push(chosenId);
    return true;
  }

  // Resolve opponent stack choice (for Rumor Queen)
  function resolveOpponentStackChoice(opponent, firstId) {
    return resolveStackChoice(opponent, firstId);
  }

  return {
    GUESTS,
    VENUES,
    GUEST_LISTS,
    DECKS,
    TAGS,
    POINT_TARGET: DEFAULT_POINT_TARGET,
    BUST_PENALTY,
    shuffle,
    createGameState,
    startGuestPhase,
    drawNextGuest,
    admitGuest,
    activateAbility,
    closeDoor,
    bothDone,
    getRoundEarnings,
    endGuestPhase,
    getMarket,
    buyGuest,
    endBuyPhase,
    getHouseCapacity,
    getHeatCapacity,
    resolveStackChoice,
    resolveNameDropChoice,
    resolveOpponentStackChoice,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Game;
}
