# Venue Rivals - Top-Down Party Refactor

## Overview

This refactor transforms Venue Rivals from a card-based game into a live top-down party game while preserving ALL existing game mechanics.

## What Changed

### Visual Presentation
- **Before**: Card-grid layout with static guest slots
- **After**: Top-down venue view with animated guest sprites moving around

### Game View
- **Before**: Split-screen showing player and rival venues as horizontal lanes
- **After**: Single canvas showing player's venue from above with live party scene

### UI Layout
- **Before**: Guest detail panel at bottom, action buttons below
- **After**: Guest Focus Panel overlays at bottom, Party HUD at top

## What Stayed the SAME

### Core Mechanics (100% Preserved)
- All guest data, stats, abilities
- Heat, money, points calculations
- Queue and deck systems
- Admit/Close/Ability logic
- Buy phase and shop
- Round flow and win conditions
- AI decision-making
- Multiplayer via Ably

### Game Flow (Identical)
1. Setup/Loadout screen → unchanged
2. Guest Phase → same decisions, new visual representation
3. Buy Phase → same shop, overlay presentation
4. Round progression → same logic
5. Game Over → same win conditions

## New Files

### `js/venue-scene.js`
- **VenueScene.Scene**: Renders top-down venue with behavior nodes
- **GuestActor**: Animated sprite representing each admitted guest
- Behavior nodes: dance floor, bar, lounge
- Movement system: guests walk to targets and idle

### `js/topdown-adapter.js`
- Bridges game state with venue scene rendering
- `syncGuestsFromState()`: Creates/removes actors based on player.house
- `updateHUD()`: Updates all HUD elements from game state
- `showGuestFocusPanel()`: Displays arriving guest details

### `js/topdown-integration.js`
- Exposes `window.TopDown` API for app.js hooks
- Manages overlay visibility
- Coordinates scene lifecycle

### `js/topdown-hooks.js`
- Monkey-patches existing app.js without rewriting it
- Polls game state via `window.App.gameState`
- Auto-syncs scene every 50ms
- Detects game screen activation

### `css/topdown.css`
- Styles for canvas layout
- Party HUD positioning and design
- Guest Focus Panel styling
- Overlay panels

## Architecture

```
┌─────────────────────────────────────────┐
│          Existing Game Logic            │
│  (game.js, ai.js - UNCHANGED)          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│          app.js (minimal patch)         │
│  Exposes: window.App.gameState         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         topdown-hooks.js                │
│  Polls game state, triggers updates     │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│       topdown-adapter.js                │
│  Syncs state ↔ scene, updates HUD      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│        venue-scene.js                   │
│  Renders venue + guest actors           │
└─────────────────────────────────────────┘
```

## How It Works

### Game Start
1. User selects venue and starts game (unchanged)
2. app.js creates game state (unchanged)
3. topdown-hooks detects game screen activation
4. topdown-adapter creates VenueScene for player's venue
5. Render loop starts, drawing venue + guests

### Guest Arrives
1. game.js draws next guest, updates player.arrivingGuest (unchanged)
2. topdown-hooks polls and detects change
3. topdown-adapter calls `showGuestFocusPanel(guest)`
4. Player sees guest info + buttons in overlay

### Guest Admitted
1. Player clicks ADMIT button (unchanged)
2. app.js calls `Game.admitGuest()` (unchanged)
3. Guest added to player.house with instanceId (unchanged)
4. topdown-hooks detects house change
5. topdown-adapter calls `syncGuestsFromState()`
6. VenueScene creates new GuestActor
7. Actor spawns at entry door, walks to behavior node

### Guest Behavior
1. Each GuestActor picks a behavior (dance/bar/lounge)
2. Actor walks to target node position
3. On arrival, plays idle animation
4. After timeout, retargets to new behavior

### Round End
1. game.js ends guest phase (unchanged)
2. app.js shows results overlay
3. topdown-adapter hides guest focus panel
4. Buy phase begins with overlay

## Key Design Decisions

### Why Polling Instead of Events?
- app.js is large (2100+ lines) and uses closures extensively
- Minimal modification approach: expose state, poll from outside
- Avoids risky refactor of core game loop
- Easy to remove/disable if needed

### Why Separate Adapter Layer?
- Clean separation: game logic vs. presentation
- VenueScene knows nothing about game rules
- adapter translates between game state and scene actors
- Easy to test and debug independently

### Why Keep Original UI Elements?
- Loadout screen works perfectly as-is
- Shop/Buy phase UI is clear and functional
- Only replaced the in-game view layer
- Faster development, less risk

## Instance ID System

The refactor relies on `instanceId` for tracking guests:

```javascript
// game.js creates house entries with instanceId
function createHouseGuest(guestId) {
    return {
        instanceId: nextInstanceId++,
        guestId,
        lockUntilClose: false,
        abilityUsed: false
    };
}

// VenueScene links actors to house entries
class GuestActor {
    constructor(instanceId, guestId, ...) {
        this.instanceId = instanceId; // Links to house entry
        this.guestId = guestId;       // Links to GUESTS data
        ...
    }
}

// Adapter syncs by matching instanceIds
function syncGuestsFromState(player) {
    const stateIds = new Set(player.house.map(e => e.instanceId));

    // Add missing actors
    for (const entry of player.house) {
        if (!scene.actors.find(a => a.instanceId === entry.instanceId)) {
            scene.addGuest(entry.instanceId, entry.guestId);
        }
    }

    // Remove extra actors
    for (const actor of scene.actors) {
        if (!stateIds.has(actor.instanceId)) {
            scene.removeGuest(actor.instanceId);
        }
    }
}
```

## Testing Checklist

- [x] Game starts with top-down venue
- [x] HUD shows heat, money, points, guest count
- [x] Guest appears at door when drawn
- [x] Guest Focus Panel shows correct stats
- [x] ADMIT button adds guest to house
- [x] Guest sprite spawns and moves to behavior node
- [x] Multiple guests move independently
- [x] ABILITY button works (if guest has ability)
- [x] CLOSE button ends round
- [x] Round results show in overlay
- [x] Buy phase shows shop overlay
- [x] Next round clears house (guests removed from scene)
- [x] Game over shows overlay
- [x] AI opponent logic still works (invisible to player)

## Known Limitations

### Polling Performance
- Polls every 50ms = 20 updates/sec
- Fine for prototype, could use events for production

### Rival Not Visible
- Current design shows only player's venue
- Could add picture-in-picture or split view later

### Canvas Scaling
- Resizes on window resize
- May need adjustment for very small screens

## Future Enhancements

### Phase 1 (Current)
- Top-down player venue
- Live guest sprites
- Party HUD
- Guest focus panel

### Phase 2 (Potential)
- Add rival venue (split screen or PiP)
- More detailed animations (dancing, drinking)
- Particle effects on admit/ability use
- Sound effects

### Phase 3 (Advanced)
- Multiplayer spectator mode
- Replay system
- Custom venue editor
- More behavior node types

## Migration Path

To revert to original card-based view:
1. Remove topdown CSS file from index.html
2. Remove topdown JS files from index.html
3. Remove `window.App` exposure from app.js
4. Restore original HTML structure in game-screen div

All game logic remains functional without top-down layer.

## Performance Notes

- Canvas redraws at 60fps via requestAnimationFrame
- ~10-15 guest actors max (matches game capacity)
- Minimal CPU usage on modern devices
- No WebGL, just 2D canvas

## Conclusion

This refactor successfully transforms the visual presentation while preserving 100% of the game mechanics. The polling-based integration approach allows this transformation without rewriting the core game engine.
