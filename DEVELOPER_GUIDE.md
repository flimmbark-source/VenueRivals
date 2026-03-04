# Developer Guide - Top-Down Venue System

## Quick Start

### Running the Game
```bash
npm run dev
# Opens at http://localhost:3000
```

The game now displays a top-down party venue during gameplay.

## File Structure

```
project/
├── js/
│   ├── game.js                 # Core game logic (unchanged)
│   ├── ai.js                   # AI decisions (unchanged)
│   ├── renderer.js             # Title/gameover (unchanged)
│   ├── multiplayer.js          # Ably integration (unchanged)
│   ├── app.js                  # Main controller (minimal patch)
│   ├── venue-scene.js          # NEW: Top-down rendering
│   ├── topdown-adapter.js      # NEW: State ↔ Scene bridge
│   ├── topdown-integration.js  # NEW: Integration API
│   └── topdown-hooks.js        # NEW: Auto-sync hooks
├── css/
│   ├── style.css               # Original styles (preserved)
│   └── topdown.css             # NEW: Top-down layout
└── index.html                  # Updated game screen HTML
```

## Key Components

### 1. VenueScene (venue-scene.js)

**Purpose**: Renders top-down venue with animated guest sprites

```javascript
// Create a scene
const scene = new VenueScene.Scene('velvetRoom', 800, 600);

// Add a guest actor
const actor = scene.addGuest(instanceId, guestId);

// Update and draw (called in render loop)
scene.update();
scene.draw(ctx);

// Remove a guest
scene.removeGuest(instanceId);
```

**GuestActor Properties**:
- `instanceId`: Links to game state house entry
- `guestId`: Links to GUESTS data
- `x, y`: Current position
- `targetX, targetY`: Movement target
- `behavior`: Current activity ('entering', 'dancing', 'drinking', 'lounging')
- `animFrame`: Animation state

### 2. TopDownAdapter (topdown-adapter.js)

**Purpose**: Bridges game state with scene rendering

```javascript
// Initialize (call once)
TopDownAdapter.initialize();

// Start a game (creates scene)
TopDownAdapter.startScene(venueId);

// Sync guests from game state
TopDownAdapter.syncGuestsFromState(player);

// Update HUD
TopDownAdapter.updateHUD(gameState);

// Show/hide guest panel
TopDownAdapter.showGuestFocusPanel(guest, canAdmit, canAbility, canClose);
TopDownAdapter.hideGuestFocusPanel();

// Stop scene
TopDownAdapter.stopScene();
```

### 3. TopDownHooks (topdown-hooks.js)

**Purpose**: Auto-connects to existing app.js

**How it works**:
1. Detects when game screen becomes active
2. Polls `window.App.gameState` every 50ms
3. Calls TopDownAdapter methods automatically
4. No manual integration needed

### 4. Game State Access (app.js)

**Minimal patch added**:
```javascript
// At end of app.js
window.App = {
    get gameState() { return gameState; }
};
```

This exposes game state for top-down hooks to access.

## Adding New Features

### Add a New Behavior Node Type

**Example: Add "Stage" area**

1. **Define node positions** in `venue-scene.js`:
```javascript
const BEHAVIOR_NODES = {
    velvetRoom: {
        entry: { x: 0.85, y: 0.15 },
        danceFloor: [...],
        bar: [...],
        lounge: [...],
        stage: [              // NEW
            { x: 0.5, y: 0.2 },
            { x: 0.45, y: 0.25 },
            { x: 0.55, y: 0.25 }
        ]
    },
    // ... other venues
};
```

2. **Update pickNewBehavior** in GuestActor:
```javascript
pickNewBehavior(venueId, canvasWidth, canvasHeight) {
    const nodes = BEHAVIOR_NODES[venueId];
    const behaviors = ['danceFloor', 'bar', 'lounge', 'stage']; // Add 'stage'
    const chosen = behaviors[Math.floor(Math.random() * behaviors.length)];
    // ... rest of logic
}
```

3. **Render stage** in Scene.drawVenue:
```javascript
drawVenue(ctx) {
    // ... existing drawing

    // Stage
    ctx.fillStyle = '#3a2855';
    this.roundRect(ctx, w * 0.4, h * 0.15, w * 0.2, h * 0.1, 8);
    ctx.fill();
}
```

### Add Custom Guest Animation

**Example: Jumping animation**

```javascript
class GuestActor {
    update(venueId, canvasWidth, canvasHeight) {
        // ... existing update

        // Add jump for dance floor guests
        if (this.behavior === 'danceFloor') {
            this.jumpPhase = (this.jumpPhase || 0) + 0.1;
        }
    }

    draw(ctx) {
        const wobble = Math.sin(this.animFrame) * 2;
        const jump = this.behavior === 'danceFloor'
            ? Math.abs(Math.sin(this.jumpPhase || 0)) * 8
            : 0;

        ctx.save();
        ctx.translate(this.x, this.y + wobble - jump); // Subtract jump
        // ... rest of drawing
    }
}
```

### Add Particle Effects

**Example: Sparkles on admit**

1. **Create particle system** in adapter:
```javascript
let particles = [];

function spawnSparkles(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 4,
            life: 1,
            decay: 0.02
        });
    }
}

function updateParticles(ctx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
}
```

2. **Call in render loop**:
```javascript
function startRenderLoop() {
    function render() {
        venueScene.update();
        venueScene.draw(ctx);
        updateParticles(ctx); // Add this
        animationFrameId = requestAnimationFrame(render);
    }
    render();
}
```

3. **Spawn on admit**:
```javascript
function syncGuestsFromState(player) {
    // ... existing sync logic

    // Detect new guests
    for (const entry of player.house) {
        if (!scene.actors.find(a => a.instanceId === entry.instanceId)) {
            const actor = scene.addGuest(entry.instanceId, entry.guestId);
            spawnSparkles(actor.x, actor.y); // Add sparkles!
        }
    }
}
```

### Change Venue Layout

**Example: Customize Night Market**

Edit `Scene.drawVenue()` in venue-scene.js:

```javascript
drawVenue(ctx) {
    // ... existing code

    if (this.venueId === 'nightMarket') {
        // Custom lanterns
        ctx.fillStyle = '#ff9a5c';
        ctx.beginPath();
        ctx.arc(w * 0.2, h * 0.15, 8, 0, Math.PI * 2);
        ctx.arc(w * 0.8, h * 0.15, 8, 0, Math.PI * 2);
        ctx.fill();

        // Custom floor pattern
        ctx.strokeStyle = '#ff9a5c30';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(dfX + dfW/2, dfY + dfH/2, 20 + i * 15, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}
```

## Debugging

### View Game State
```javascript
// Open browser console
window.App.gameState
// Shows current game state object
```

### View Active Actors
```javascript
// In browser console
window.venueScene = TopDownAdapter.venueScene; // Expose scene
venueScene.actors
// Shows all current guest actors
```

### Monitor Sync Performance
```javascript
// Add to topdown-hooks.js
let syncCount = 0;
setInterval(() => {
    console.log(`Syncs per second: ${syncCount}`);
    syncCount = 0;
}, 1000);

// In sync function:
syncCount++;
```

### Debug Actor Positions
```javascript
// In Scene.draw(), add:
for (const actor of this.actors) {
    // Draw actor ID
    ctx.fillStyle = 'white';
    ctx.font = '8px monospace';
    ctx.fillText(actor.instanceId, actor.x - 10, actor.y - 20);

    // Draw target
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.arc(actor.targetX, actor.targetY, 5, 0, Math.PI * 2);
    ctx.stroke();
}
```

## Performance Optimization

### Reduce Polling Rate
```javascript
// In topdown-hooks.js, change:
setInterval(function() {
    // ... sync logic
}, 100); // Was 50ms, now 100ms (10 updates/sec)
```

### Limit Actor Updates
```javascript
// Only update actors near player focus
update() {
    const focusX = this.canvasWidth * 0.5;
    const focusY = this.canvasHeight * 0.5;

    for (const actor of this.actors) {
        const dist = Math.hypot(actor.x - focusX, actor.y - focusY);
        if (dist < 300) {
            actor.update(this.venueId, this.canvasWidth, this.canvasHeight);
        }
    }
}
```

### Canvas Optimization
```javascript
// Use offscreen canvas for static elements
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Draw venue once
offscreenCtx.drawVenue();

// In main draw:
ctx.drawImage(offscreenCanvas, 0, 0);
// Then draw actors on top
```

## Testing

### Unit Test Scene
```javascript
// Test guest actor creation
const scene = new VenueScene.Scene('velvetRoom', 800, 600);
const actor = scene.addGuest(1, 'regular');

console.assert(actor.instanceId === 1, 'Instance ID matches');
console.assert(actor.guestId === 'regular', 'Guest ID matches');
console.assert(scene.actors.length === 1, 'Actor added to scene');

scene.removeGuest(1);
console.assert(scene.actors.length === 0, 'Actor removed from scene');
```

### Integration Test
```javascript
// Start a test game
const testState = Game.createGameState('Test', 'velvetRoom', 'AI', 'nightMarket', 3);
Game.startGuestPhase(testState);

// Admit a guest
Game.admitGuest(testState.player, Game.VENUES.velvetRoom);

// Check scene synced
TopDownAdapter.syncGuestsFromState(testState.player);
console.assert(venueScene.actors.length === 1, 'Actor spawned on admit');
```

## Common Issues

### Canvas Not Appearing
**Problem**: Black screen where venue should be
**Solution**: Check canvas initialization
```javascript
// In browser console:
document.getElementById('venue-canvas')
// Should return canvas element

TopDownAdapter.canvas
// Should be defined
```

### Guests Not Moving
**Problem**: Actors spawn but don't move
**Solution**: Check render loop is running
```javascript
// Add to startRenderLoop():
console.log('Render loop started');

// Should log once when game starts
```

### Stats Not Updating
**Problem**: HUD shows incorrect values
**Solution**: Check game state is exposed
```javascript
window.App.gameState
// Should return game state object, not undefined
```

### Guests Disappear on Round End
**Expected behavior**: Guests should clear when new round starts
**Implementation**: Scene clears when `player.house` becomes empty

## Event Flow Diagram

```
User Action (Click ADMIT)
        ↓
app.js: handleAdmitClick()
        ↓
game.js: Game.admitGuest()
        ↓
gameState.player.house.push(newGuest)
        ↓
        ⏱️ 50ms polling tick
        ↓
topdown-hooks.js: detects house change
        ↓
TopDownAdapter.syncGuestsFromState()
        ↓
venueScene.addGuest(instanceId, guestId)
        ↓
new GuestActor created
        ↓
        🔄 60fps render loop
        ↓
GuestActor.update() → moves toward target
        ↓
GuestActor.draw() → renders sprite
        ↓
        👀 User sees guest enter and move
```

## Best Practices

1. **Never modify game.js or ai.js** - Keep game logic pristine
2. **Use instanceId for tracking** - It's unique and reliable
3. **Poll, don't push** - Polling is simpler for this architecture
4. **Keep scene stateless** - Scene should mirror game state, not own data
5. **Percentage-based layout** - Use 0-1 coordinates for responsiveness
6. **Separate concerns** - Adapter handles state, Scene handles rendering

## Resources

- **Game Mechanics**: See `js/game.js` JSDoc comments
- **Architecture**: See `TOPDOWN_REFACTOR.md`
- **Visual Design**: See `VISUAL_GUIDE.md`
- **Summary**: See `REFACTOR_SUMMARY.md`
