/* ============================================
   VENUE RIVALS - Core Game Engine
   ============================================ */

const Game = (() => {
  const DEFAULT_TOTAL_ROUNDS = 7;
  const BUST_PENALTY = 0.25;
  const TAGS = ["VIP", "Performer", "Scout", "Broker", "Outlaw"];

  let nextInstanceId = 1;

  const GUESTS = {
    // === NEUTRAL ===
    regular: {
      name: "Regular",
      emoji: "🙂",
      heat: 1,
      money: 0,
      points: 1,
      cost: 2,
      venue: "Neutral",
      tags: ["VIP"],
      desc: "No special ability.",
      tier: "common",
    },
    chiller: {
      name: "Chiller",
      emoji: "❄️",
      heat: 1,
      money: 0,
      points: 1,
      cost: 2,
      venue: "Neutral",
      tags: ["VIP"],
      desc: "Chill: Cool 1 Heat.",
      tier: "common",
      ability: {
        name: "Chill",
        icon: "❄️",
        desc: "Cool 1 Heat",
        trigger: "flash",
        type: "coolHeat",
        value: 1,
      },
    },
    tipper: {
      name: "Tipper",
      emoji: "💵",
      heat: 2,
      money: 2,
      points: 0,
      cost: 2,
      venue: "Neutral",
      tags: ["Broker"],
      desc: "No special ability.",
      tier: "common",
    },
    tipOffArtist: {
      name: "Tip-Off Artist",
      emoji: "👀",
      heat: 2,
      money: 3,
      points: 0,
      cost: 4,
      venue: "Neutral",
      tags: ["Broker"],
      desc: "Tip-Off: Reveal the next guest.",
      tier: "common",
      ability: {
        name: "Tip-Off",
        icon: "👀",
        desc: "Reveal the next guest",
        trigger: "flash",
        type: "revealNext",
        value: 1,
      },
    },
    hypeFriend: {
      name: "Hype Friend",
      emoji: "🙌",
      heat: 3,
      money: 1,
      points: 2,
      cost: 3,
      venue: "Neutral",
      tags: ["Performer"],
      desc: "No special ability.",
      tier: "common",
    },
    hypester: {
      name: "Hypester",
      emoji: "🔥",
      heat: 2,
      money: 2,
      points: 2,
      cost: 6,
      venue: "Neutral",
      tags: ["Performer"],
      desc: "Hype Up: Add 1 Heat to opponent.",
      tier: "common",
      ability: {
        name: "Hype Up",
        icon: "🔥",
        desc: "Add 1 Heat to opponent",
        trigger: "flash",
        type: "addOpponentHeat",
        value: 1,
      },
    },
    standIn: {
      name: "Stand-In",
      emoji: "🎭",
      heat: 3,
      money: 1,
      points: 2,
      cost: 5,
      venue: "Neutral",
      tags: ["Performer"],
      desc: "Understudy: Bounce the Leftmost back to the queue.",
      tier: "common",
      ability: {
        name: "Understudy",
        icon: "🔄",
        desc: "Bounce the Leftmost back to the queue",
        trigger: "flash",
        type: "bounceLeftmost",
      },
    },
    usher: {
      name: "Usher",
      emoji: "🧤",
      heat: 2,
      money: 0,
      points: 2,
      cost: 5,
      venue: "Neutral",
      tags: ["VIP"],
      desc: "Escort: Pull 1 guest forward.",
      tier: "common",
      ability: {
        name: "Escort",
        icon: "👋",
        desc: "Pull 1 guest forward",
        trigger: "flash",
        type: "pullForward",
      },
    },
    floorRunner: {
      name: "Floor Runner",
      emoji: "🏃",
      heat: 2,
      money: 0,
      points: 2,
      cost: 7,
      venue: "Neutral",
      tags: ["Scout"],
      desc: "Crowd Surf: Push the Leftmost out.",
      tier: "common",
      ability: {
        name: "Crowd Surf",
        icon: "↩️",
        desc: "Push the Leftmost out",
        trigger: "flash",
        type: "pushLeftmost",
      },
    },
    bookkeeper: {
      name: "Bookkeeper",
      emoji: "📒",
      heat: 1,
      money: 4,
      points: 1,
      cost: 6,
      venue: "Neutral",
      tags: ["Broker"],
      desc: "Audit: Cool 2 Heat.",
      tier: "common",
      ability: {
        name: "Audit",
        icon: "📊",
        desc: "Cool 2 Heat",
        trigger: "flash",
        type: "coolHeat",
        value: 2,
      },
    },
    rovingCritic: {
      name: "Roving Critic",
      emoji: "🧐",
      heat: 3,
      money: 0,
      points: 3,
      cost: 5,
      venue: "Neutral",
      tags: ["VIP"],
      desc: "Inspect: Reveal the next 2 guests.",
      tier: "uncommon",
      ability: {
        name: "Inspect",
        icon: "🔍",
        desc: "Reveal the next 2 guests",
        trigger: "flash",
        type: "revealNext",
        value: 2,
      },
    },
    partyPromoter: {
      name: "Party Promoter",
      emoji: "📣",
      heat: 3,
      money: 4,
      points: 0,
      cost: 8,
      venue: "Neutral",
      tags: ["Broker"],
      desc: "Megaphone: Add 1 Heat to opponent.",
      tier: "uncommon",
      ability: {
        name: "Megaphone",
        icon: "📢",
        desc: "Add 1 Heat to opponent",
        trigger: "flash",
        type: "addOpponentHeat",
        value: 1,
      },
    },
    bigSpender: {
      name: "Big Spender",
      emoji: "🛍️",
      heat: 2,
      money: 3,
      points: 0,
      cost: 6,
      venue: "Neutral",
      tags: ["VIP"],
      desc: "No special ability.",
      tier: "uncommon",
    },
    celebrity: {
      name: "Celebrity",
      emoji: "🎬",
      heat: 2,
      money: 0,
      points: 4,
      cost: 7,
      venue: "Neutral",
      tags: ["VIP", "Performer"],
      desc: "Star Power: Lock 1 guest.",
      tier: "rare",
      ability: {
        name: "Star Power",
        icon: "⭐",
        desc: "Lock 1 guest",
        trigger: "flash",
        type: "lockAnother",
      },
    },

    // === VELVET ROOM ===
    headliner: {
      name: "Headliner",
      emoji: "🌟",
      heat: 3,
      money: 0,
      points: 4,
      cost: 6,
      venue: "Velvet Room",
      tags: ["VIP", "Performer"],
      desc: "Spotlight: Lock both adjacent guests.",
      tier: "rare",
      ability: {
        name: "Spotlight",
        icon: "🔦",
        desc: "Lock both adjacent guests",
        trigger: "flash",
        type: "lockAdjacent",
      },
    },
    champagneHost: {
      name: "Champagne Host",
      emoji: "🥂",
      heat: 2,
      money: 2,
      points: 4,
      cost: 5,
      venue: "Velvet Room",
      tags: ["VIP"],
      desc: "Toast: Pull 1 guest forward.",
      tier: "uncommon",
      ability: {
        name: "Toast",
        icon: "🥂",
        desc: "Pull 1 guest forward",
        trigger: "flash",
        type: "pullForward",
      },
    },
    velvetBouncer: {
      name: "Velvet Bouncer",
      emoji: "🛡️",
      heat: 3,
      money: 2,
      points: 2,
      cost: 4,
      venue: "Velvet Room",
      tags: ["VIP"],
      desc: "VIP Rope: Lock 1 guest.",
      tier: "uncommon",
      ability: {
        name: "VIP Rope",
        icon: "⛓️",
        desc: "Lock 1 guest",
        trigger: "flash",
        type: "lockAnother",
      },
    },
    spotlightPhotographer: {
      name: "Spotlight Photographer",
      emoji: "📸",
      heat: 3,
      money: 1,
      points: 4,
      cost: 5,
      venue: "Velvet Room",
      tags: ["Performer"],
      desc: "Flash: Score 2 Points immediately.",
      tier: "uncommon",
      ability: {
        name: "Flash",
        icon: "📷",
        desc: "Score 2 Points immediately",
        trigger: "flash",
        type: "scoreNow",
        value: 2,
      },
    },

    // === NIGHT MARKET ===
    galleryScout: {
      name: "Gallery Scout",
      emoji: "🔭",
      heat: 1,
      money: 0,
      points: 2,
      cost: 4,
      venue: "Night Market",
      tags: ["Scout"],
      desc: "Peek: Reveal the next 2 guests. Choose their order.",
      tier: "common",
      ability: {
        name: "Peek",
        icon: "🧭",
        desc: "Reveal the next 2 guests. Choose their order",
        trigger: "flash",
        type: "revealAndReorder",
      },
    },
    trendBroker: {
      name: "Trend Broker",
      emoji: "📈",
      heat: 2,
      money: 3,
      points: 0,
      cost: 5,
      venue: "Night Market",
      tags: ["Broker"],
      desc: "Cash Out: Score 2 Points immediately.",
      tier: "uncommon",
      ability: {
        name: "Cash Out",
        icon: "💰",
        desc: "Score 2 Points immediately",
        trigger: "flash",
        type: "scoreNow",
        value: 2,
      },
    },
    curioDealer: {
      name: "Curio Dealer",
      emoji: "🗃️",
      heat: 1,
      money: 3,
      points: 0,
      cost: 4,
      venue: "Night Market",
      tags: ["Broker"],
      desc: "Trade In: Bounce the Leftmost back to the queue.",
      tier: "common",
      ability: {
        name: "Trade In",
        icon: "🔄",
        desc: "Bounce the Leftmost back to the queue",
        trigger: "flash",
        type: "bounceLeftmost",
      },
    },
    stylist: {
      name: "Stylist",
      emoji: "🧵",
      heat: 2,
      money: 1,
      points: 3,
      cost: 6,
      venue: "Night Market",
      tags: ["Scout", "Broker"],
      desc: "Makeover: Pull 1 guest forward.",
      tier: "uncommon",
      ability: {
        name: "Makeover",
        icon: "✨",
        desc: "Pull 1 guest forward",
        trigger: "flash",
        type: "pullForward",
      },
    },

    // === BACK ALLEY ===
    gateRunner: {
      name: "Gate Runner",
      emoji: "🚨",
      heat: 1,
      money: 1,
      points: 3,
      cost: 6,
      venue: "Back Alley",
      tags: ["Outlaw"],
      desc: "Raid: Queue a Gatecrasher for opponent.",
      tier: "common",
      ability: {
        name: "Raid",
        icon: "💣",
        desc: "Queue a Gatecrasher for opponent",
        trigger: "flash",
        type: "queueGatecrasher",
      },
    },
    wheelman: {
      name: "Wheelman",
      emoji: "🚗",
      heat: 3,
      money: 4,
      points: 1,
      cost: 8,
      venue: "Back Alley",
      tags: ["Outlaw"],
      desc: "Getaway: Push another guest out.",
      tier: "common",
      ability: {
        name: "Getaway",
        icon: "↪️",
        desc: "Push another guest out",
        trigger: "flash",
        type: "pushAnother",
      },
    },
    fence: {
      name: "Fence",
      emoji: "🧰",
      heat: 3,
      money: 3,
      points: 0,
      cost: 5,
      venue: "Back Alley",
      tags: ["Outlaw", "Broker"],
      desc: "Lay Low: Cool 2 Heat.",
      tier: "common",
      ability: {
        name: "Lay Low",
        icon: "🕶️",
        desc: "Cool 2 Heat",
        trigger: "flash",
        type: "coolHeat",
        value: 2,
      },
    },
    provocateur: {
      name: "Provocateur",
      emoji: "😈",
      heat: 2,
      money: 1,
      points: 3,
      cost: 5,
      venue: "Back Alley",
      tags: ["Outlaw"],
      desc: "Taunt: Add 2 Heat to opponent.",
      tier: "uncommon",
      ability: {
        name: "Taunt",
        icon: "😤",
        desc: "Add 2 Heat to opponent",
        trigger: "flash",
        type: "addOpponentHeat",
        value: 2,
      },
    },

    // === TROUBLE ===
    gatecrasher: {
      name: "Gatecrasher",
      emoji: "💥",
      heat: 2,
      money: 0,
      points: 0,
      cost: 99,
      venue: "Trouble",
      tags: ["Outlaw"],
      desc: "Trouble. No special move.",
      tier: "common",
    },

    // === SHOP ITEMS ===
    slotIncrease: {
      name: "+1 Slot",
      emoji: "📦",
      money: 0,
      heat: 0,
      points: 0,
      cost: 3,
      venue: "Shop",
      tags: [],
      desc: "Increase your house capacity by 1.",
      tier: "shop",
      isShopItem: true,
    },
    heatCapIncrease: {
      name: "+1 🔥 Cap",
      emoji: "🌡️",
      money: 0,
      heat: 0,
      points: 0,
      cost: 4,
      venue: "Shop",
      tags: [],
      desc: "Increase your heat capacity by 1.",
      tier: "shop",
      isShopItem: true,
    },
  };

  const VENUES = {
    velvetRoom: {
      name: "Velvet Room",
      emoji: "🥂",
      gridSize: 2,
      bustThreshold: 6,
      desc: "Lock the star in place and close at the perfect moment.",
      style: "points",
      color: "#c9884c",
      startingDeck: [
        "usher",
        "rovingCritic",
        "headliner",
        "champagneHost",
        "velvetBouncer",
        "spotlightPhotographer",
        "standIn",
        "floorRunner",
      ],
      market: [
        "headliner",
        "champagneHost",
        "velvetBouncer",
        "spotlightPhotographer",
        "usher",
        "rovingCritic",
        "partyPromoter",
      ],
    },
    nightMarket: {
      name: "Night Market",
      emoji: "🏮",
      gridSize: 3,
      bustThreshold: 5,
      desc: "Peek at the queue, reorder guests, and score at the right time.",
      style: "money",
      color: "#7f5af0",
      startingDeck: [
        "galleryScout",
        "trendBroker",
        "curioDealer",
        "stylist",
        "standIn",
        "bookkeeper",
        "partyPromoter",
        "usher",
      ],
      market: [
        "galleryScout",
        "trendBroker",
        "curioDealer",
        "stylist",
        "standIn",
        "bookkeeper",
        "partyPromoter",
      ],
    },
    backAlley: {
      name: "Back Alley",
      emoji: "🕳️",
      gridSize: 4,
      bustThreshold: 4,
      desc: "Push guests out, taunt opponents with heat, and stay cool under fire.",
      style: "control",
      color: "#2cb67d",
      startingDeck: [
        "gateRunner",
        "wheelman",
        "fence",
        "provocateur",
        "floorRunner",
        "usher",
        "bookkeeper",
        "partyPromoter",
      ],
      market: [
        "gateRunner",
        "wheelman",
        "fence",
        "provocateur",
        "floorRunner",
        "bookkeeper",
        "standIn",
      ],
    },
  };

  const GUEST_LISTS = {
    rescueMarkedStar: {
      name: "Red Carpet Gala",
      venueId: "velvetRoom",
      description:
        "An elegant spotlight gala where VIPs are locked into position until the grand close.",
      guests: [
        "rovingCritic",
        "usher",
        "headliner",
        "velvetBouncer",
        "champagneHost",
        "spotlightPhotographer",
        "standIn",
        "partyPromoter",
      ],
    },
    exactFullVelvetSnap: {
      name: "Champagne Countdown",
      venueId: "velvetRoom",
      description:
        "A packed-house party that peaks at the perfect moment—fill every seat and close strong.",
      guests: [
        "champagneHost",
        "headliner",
        "standIn",
        "usher",
        "spotlightPhotographer",
        "velvetBouncer",
        "rovingCritic",
        "bookkeeper",
      ],
    },
    protectStarSpendBouncer: {
      name: "Headliner Afterparty",
      venueId: "velvetRoom",
      description:
        "Keep the star locked while the crew pushes and pulls through the lane.",
      guests: [
        "headliner",
        "velvetBouncer",
        "floorRunner",
        "usher",
        "spotlightPhotographer",
        "champagneHost",
        "rovingCritic",
        "standIn",
      ],
    },
    leftEdgeEconomy: {
      name: "Bazaar Night",
      venueId: "nightMarket",
      description:
        "A curated market soirée where peeking and bouncing keeps your lineup sharp.",
      guests: [
        "curioDealer",
        "galleryScout",
        "bookkeeper",
        "partyPromoter",
        "trendBroker",
        "stylist",
        "standIn",
        "floorRunner",
      ],
    },
    brokerStack: {
      name: "Trendsetter Mixer",
      venueId: "nightMarket",
      description:
        "A market mixer where scoring at the right moment is everything.",
      guests: [
        "trendBroker",
        "stylist",
        "standIn",
        "partyPromoter",
        "bookkeeper",
        "galleryScout",
        "curioDealer",
        "usher",
      ],
    },
    cashOutHitAndRun: {
      name: "Smuggler's Run",
      venueId: "backAlley",
      description:
        "A high-velocity outlaw party—push guests out, taunt rivals, and stay cool.",
      guests: [
        "gateRunner",
        "wheelman",
        "floorRunner",
        "fence",
        "provocateur",
        "bookkeeper",
        "usher",
        "partyPromoter",
      ],
    },
    fenceRegister: {
      name: "Black Market Bash",
      venueId: "backAlley",
      description:
        "A gritty underground bash where outlaws lay low and cash out before the heat catches up.",
      guests: [
        "fence",
        "gateRunner",
        "wheelman",
        "floorRunner",
        "provocateur",
        "bookkeeper",
        "standIn",
        "usher",
      ],
    },
    complaintTrap: {
      name: "Riot Night",
      venueId: "backAlley",
      description:
        "A volatile street party built to taunt opponents with heat and force panic closes.",
      guests: [
        "gateRunner",
        "provocateur",
        "wheelman",
        "fence",
        "floorRunner",
        "partyPromoter",
        "standIn",
        "bookkeeper",
      ],
    },
  };

  const DECKS = {
    standardPlayerStatOnly: {
      name: "The Regulars",
      venueId: "velvetRoom",
      description:
        "A starter deck built around strong baseline stats with no basic-guest abilities.",
      guests: [
        "regular",
        "regular",
        "regular",
        "tipper",
        "tipper",
        "hypeFriend",
        "hypeFriend",
        "bigSpender",
      ],
    },
    velvetClassic: {
      name: "VIP Lineup",
      venueId: "velvetRoom",
      description: "VIP lineup with locks, pulls, and scoring.",
      guests: [...VENUES.velvetRoom.startingDeck],
    },
    marketCore: {
      name: "Thrifty Buisness",
      venueId: "nightMarket",
      description: "Peek, bounce, pull, and score at the right time.",
      guests: [...VENUES.nightMarket.startingDeck],
    },
    alleyPressure: {
      name: "Rowdy Crew",
      venueId: "backAlley",
      description: "Push, taunt, raid, and stay cool under pressure.",
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
    return { instanceId: nextInstanceId++, guestId, lockUntilClose: false };
  }
  function getGuestId(entry) {
    return typeof entry === "string" ? entry : entry.guestId;
  }

  function getHouseCapacity(venue, player) {
    // House capacity matches the visible grid size; arriving guest is
    // rendered into the grid now, so don't subtract 1.
    // Add any permanent slot increases the player has purchased.
    const baseCapacity = Math.max(0, (venue?.gridSize || 0));
    const slotBonus = player?.slotIncrease || 0;
    return baseCapacity + slotBonus;
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
      roundMoney: 0,
      roundPoints: 0,
      money: 0,
      points: 0,
      heat: 0,
      doorClosed: false,
      busted: false,
      phaseComplete: false,
      slotIncrease: 0,
      heatCapBonus: 0,
      shopItemPurchases: { slotIncrease: 0, heatCapIncrease: 0 },
    };
  }
  function createGameState(
    playerName,
    playerVenue,
    rivalName,
    rivalVenue,
    totalRounds = DEFAULT_TOTAL_ROUNDS,
  ) {
    return {
      round: 1,
      totalRounds,
      phase: "guest",
      guestPhaseScoredRound: null,
      player: createPlayer(playerName, playerVenue, false),
      rival: createPlayer(rivalName, rivalVenue, true),
      winner: null,
    };
  }

  function startGuestPhase(state) {
    state.phase = "guest";
    state.guestPhaseScoredRound = null;
    [state.player, state.rival].forEach((p) => {
      const equippedDeck = p.fullDeck?.length ? p.fullDeck : p.guestList;
      p.roundDeck = shuffle(equippedDeck || []);
      // Don't clear house - preserve guests from previous round
      p.arrivingGuest = null;
      p.roundMoney = 0;
      p.roundPoints = 0;
      p.heat = 0;
      p.doorClosed = false;
      p.busted = false;
      p.phaseComplete = false;
    });
    // ignore pendingOut at round start; there should be none
    drawNextGuest(state.player, VENUES[state.player.venueId]);
    drawNextGuest(state.rival, VENUES[state.rival.venueId]);
  }

  // returns object indicating whether a card was drawn and, if the house
  // is already full, the ID of the guest who will be pushed out the next time
  // the arriving guest is admitted.
  function drawNextGuest(player, venue, skipBustCheck = false) {
    if (player.roundDeck.length === 0) {
      player.arrivingGuest = null;
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

    player.arrivingGuest = player.roundDeck.pop();
    const guest = GUESTS[player.arrivingGuest];
    if (guest) {
      player.heat += guest.heat;
      if (!skipBustCheck && player.heat > venue.bustThreshold) {
        applyBustState(player);
      }
    }
    return { success: true, pendingOut };
  }

  function applyGuestImpact(player, guestId) {
    const guest = GUESTS[guestId];
    if (!guest) return;
    player.roundMoney += guest.money;
    player.roundPoints += guest.points;
  }

  function applyBustState(player) {
    player.busted = true;
    player.phaseComplete = true;
    player.roundMoney = Math.floor(player.roundMoney * BUST_PENALTY);
    player.roundPoints = Math.floor(player.roundPoints * BUST_PENALTY);
  }

  function moveArrivingGuestIntoHouse(player, venue) {
    if (!player.arrivingGuest) return [];
    applyGuestImpact(player, player.arrivingGuest);
    const popped = [];
    player.house.unshift(createHouseGuest(player.arrivingGuest));
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

  function admitGuest(player, venue, opponent = null, opponentVenue = null) {
    if (!player.arrivingGuest || player.doorClosed || player.busted)
      return null;
    const guestId = player.arrivingGuest;
    const result = {
      admitted: guestId,
      pushedOut: [],
      pendingOut: null,
      busted: false,
      effects: [],
    };
    const pushed = moveArrivingGuestIntoHouse(player, venue);
    if (pushed.length) result.pushedOut = pushed.map(getGuestId);
    if (player.heat > venue.bustThreshold) {
      result.busted = true;
      applyBustState(player);
    }
    player.arrivingGuest = null;
    if (!result.busted) {
      const drawRes = drawNextGuest(player, venue);
      if (drawRes.pendingOut) {
        result.pendingOut = drawRes.pendingOut;
      }
      if (player.busted) result.busted = true;
    }
    return result;
  }

  function activateAbility(player, opponent, playerVenue, opponentVenue) {
    if (!player.arrivingGuest || player.doorClosed || player.busted)
      return null;
    const guest = GUESTS[player.arrivingGuest];
    if (!guest.ability || guest.ability.trigger !== "flash") return null;

    const admitted = admitGuest(player, playerVenue, opponent, opponentVenue);
    if (!admitted) return null;
    const result = {
      activated: guest.name,
      ability: guest.ability,
      effects: [...(admitted.effects || [])],
      pushedOut: admitted.pushedOut,
      pendingOut: admitted.pendingOut,
      busted: admitted.busted,
    };

    switch (guest.ability.type) {
      case "coolHeat": {
        player.heat = Math.max(0, player.heat - guest.ability.value);
        result.effects.push(`cooled ${guest.ability.value} heat`);
        break;
      }
      case "addOpponentHeat": {
        opponent.heat += guest.ability.value;
        result.effects.push(`added ${guest.ability.value} heat to opponent`);
        break;
      }
      case "scoreNow": {
        player.points += guest.ability.value;
        result.effects.push(`scored ${guest.ability.value} points`);
        break;
      }
      case "revealNext": {
        const count = Math.min(guest.ability.value, player.roundDeck.length);
        const revealed = [];
        for (
          let i = player.roundDeck.length - 1;
          i >= player.roundDeck.length - count;
          i--
        ) {
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
      case "revealAndReorder": {
        const revealed = [];
        if (player.roundDeck.length >= 2) {
          const a = player.roundDeck.pop();
          const b = player.roundDeck.pop();
          revealed.push(a, b);
          const aVal = GUESTS[a].points + GUESTS[a].money - GUESTS[a].heat;
          const bVal = GUESTS[b].points + GUESTS[b].money - GUESTS[b].heat;
          if (aVal >= bVal) {
            player.roundDeck.push(b);
            player.roundDeck.push(a);
          } else {
            player.roundDeck.push(a);
            player.roundDeck.push(b);
          }
          result.effects.push(`peeked: ${GUESTS[a].name}, ${GUESTS[b].name}`);
        } else if (player.roundDeck.length === 1) {
          revealed.push(player.roundDeck[0]);
          result.effects.push(`peeked: ${GUESTS[player.roundDeck[0]].name}`);
        }
        if (revealed.length) result.revealedGuests = revealed;
        break;
      }
      case "bounceLeftmost": {
        const idx = player.house.length - 1;
        const locked = getLockedIndexes(player);
        if (idx >= 0 && !locked.has(idx)) {
          const bounced = player.house.splice(idx, 1)[0];
          player.roundDeck.unshift(getGuestId(bounced));
          result.effects.push(`bounced ${GUESTS[getGuestId(bounced)].name}`);
        }
        break;
      }
      case "pullForward": {
        const idx = pullGuestOneStep(player);
        if (idx !== null) result.effects.push("pulled a guest forward");
        break;
      }
      case "pushLeftmost": {
        const exiting = pushLeftmost(player);
        if (exiting) {
          result.effects.push(`pushed ${GUESTS[getGuestId(exiting)].name}`);
          result.pushedOut = getGuestId(exiting);
        }
        break;
      }
      case "pushAnother": {
        const locked = getLockedIndexes(player);
        let pushed = false;
        for (let i = player.house.length - 1; i >= 1; i--) {
          if (locked.has(i)) continue;
          const exiting = player.house.splice(i, 1)[0];
          result.effects.push(`pushed ${GUESTS[getGuestId(exiting)].name}`);
          result.pushedOut = getGuestId(exiting);
          pushed = true;
          break;
        }
        if (!pushed) result.effects.push("no guest to push");
        break;
      }
      case "lockAnother": {
        if (player.house.length > 1) {
          player.house[1].lockUntilClose = true;
          result.effects.push("locked a guest");
        }
        break;
      }
      case "lockAdjacent": {
        let locked = 0;
        if (player.house.length > 1) {
          player.house[1].lockUntilClose = true;
          locked++;
        }
        result.effects.push(
          locked ? `locked ${locked} adjacent` : "no adjacent guests",
        );
        break;
      }
      case "queueGatecrasher": {
        opponent.roundDeck.push("gatecrasher");
        result.effects.push("queued gatecrasher for opponent");
        break;
      }
    }

    return result;
  }

  function closeDoor(player, venue, opponent = null) {
    if (player.doorClosed || player.busted) return false;
    // Move arriving guest into the house before closing so it stays in the grid
    const pushed = moveArrivingGuestIntoHouse(player, venue);
    player.doorClosed = true;
    player.phaseComplete = true;
    player.arrivingGuest = null;
    return {
      closed: true,
      pushedOut: pushed.map(getGuestId),
      busted: player.busted,
    };
  }

  function bothDone(state) {
    return state.player.phaseComplete && state.rival.phaseComplete;
  }
  function endGuestPhase(state) {
    if (state.guestPhaseScoredRound === state.round) return;
    [state.player, state.rival].forEach((p) => {
      // If there's an arriving guest still waiting, move them into the house
      // so they persist to the next round
      if (p.arrivingGuest) {
        p.house.unshift(createHouseGuest(p.arrivingGuest));
        applyGuestImpact(p, p.arrivingGuest);
        p.arrivingGuest = null;
        // Remove guests exceeding capacity
        const venue = VENUES[p.venueId];
        while (p.house.length > getHouseCapacity(venue, p)) {
          p.house.pop();
        }
      }
      p.money += p.roundMoney;
      p.points += p.roundPoints;
    });
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
    if (state.round >= state.totalRounds) {
      state.phase = "gameover";
      state.winner =
        state.player.points === state.rival.points
          ? state.player.money >= state.rival.money
            ? "player"
            : "rival"
          : state.player.points > state.rival.points
            ? "player"
            : "rival";
    } else {
      // Clear venue grids just before the next round begins so guests
      // are removed from the house at the round boundary.
      [state.player, state.rival].forEach((p) => {
        p.house = [];
        p.arrivingGuest = null;
      });
      state.round++;
      state.phase = "guest";
    }
  }

  return {
    GUESTS,
    VENUES,
    GUEST_LISTS,
    DECKS,
    TAGS,
    TOTAL_ROUNDS: DEFAULT_TOTAL_ROUNDS,
    BUST_PENALTY,
    shuffle,
    createGameState,
    startGuestPhase,
    drawNextGuest,
    admitGuest,
    activateAbility,
    closeDoor,
    bothDone,
    endGuestPhase,
    getMarket,
    buyGuest,
    endBuyPhase,
    getHouseCapacity,
  };
})();
