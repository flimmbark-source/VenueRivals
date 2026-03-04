# Venue Rivals - Visual Transformation Guide

## Before: Card-Based Layout

```
┌─────────────────────────────────────────────┐
│  ROUND 1/7              GUEST PHASE         │ ← HUD
├─────────────────────────────────────────────┤
│  RIVAL                        💵 $0  ⭐ 0   │
│  🔥━━━━━━━━━━━━━━━━━━━━━━━━ 0/21           │
│  [🚪] [😀][🎭][👀][💵][💥] → [🚪]          │ ← Card Grid
├─────────────────────────────────────────────┤
│  YOU                          💵 $5  ⭐ 3   │
│  🔥━━━━━━━━━━━━━━━━━━━━━━━━ 5/21           │
│  [🚪] [😀][🎭][👀][💵] → [🙌][🚪]          │ ← Card Grid
├─────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐ │
│  │ 🙌 Hype Friend                         │ │
│  │ 🔥 3  💵 1  ⭐ 2                       │ │
│  │ No special ability                     │ │
│  └────────────────────────────────────────┘ │
│  [ADMIT →] [ABILITY] [🚪 CLOSE]            │
└─────────────────────────────────────────────┘
```

**Characteristics:**
- Split view: rival on top, player on bottom
- Guests shown as static cards in a horizontal line
- Abstract representation
- Card slots and lane metaphor

---

## After: Top-Down Party View

```
┌─────────────────────────────────────────────┐
│ ROUND 1/7    🥂 The Velvet Room   GUEST PH  │ ← Party HUD
│ 🔥 ████░░░░░░ 5/21  💵 $5  ⭐ 3  👥 4       │
├─────────────────────────────────────────────┤
│                                    ┌──┐     │
│                                    │🚪│     │ ← Entry Door
│            🏮                       └──┘     │
│         (Venue Emoji)                        │
│                                              │
│  ┌────┐                                      │
│  │BAR │    😀  💃                       🪑  │ ← Bar Area
│  │🍺  │       (guests moving)          🛋️  │
│  └────┘                                 🪑  │ ← Lounge
│                                              │
│       🎵  👀                          🎭    │
│         ╔════════╗                          │
│    💥   ║  DANCE ║       🙌                 │ ← Dance Floor
│         ║  FLOOR ║                          │
│         ╚════════╝   💵                     │
│                                              │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 🙌 Hype Friend                          │ │ ← Guest Focus
│ │ 🔥 3  💵 1  ⭐ 2                        │ │   Panel
│ │ No special ability                      │ │
│ └─────────────────────────────────────────┘ │
│ [ADMIT →] [ABILITY] [🚪 CLOSE]             │
└─────────────────────────────────────────────┘
```

**Characteristics:**
- Single top-down venue view (player's venue)
- Guests as animated sprites moving around
- Visible party scene with venue layout
- Guests walk between dance floor, bar, lounge
- Entry door visible at top-right
- Live party atmosphere

---

## Visual Elements Comparison

### Venue Representation

**Before:**
- Horizontal lane with card slots
- Abstract space
- No spatial relationship between guests

**After:**
- Top-down room with defined areas
- Dance floor (center, glowing)
- Bar (left side, counter visible)
- Lounge (right side, seating)
- Entry door (top-right)
- Venue emoji (center-top)

### Guest Representation

**Before:**
- Static card slots
- Emoji in bordered square
- Stats overlaid on card
- Fixed positions in row

**After:**
- Animated sprite actors
- Emoji on colored circle body
- Wobble animation
- Free movement between behavior nodes
- Shadows beneath sprites
- Guests appear to attend party

### Guest Behavior

**Before:**
- Appear in arriving slot
- Slide into first slot
- Push through to exit
- No movement after placement

**After:**
- Appear at entry door
- Walk into venue
- Choose behavior (dance/drink/lounge)
- Move to behavior node
- Idle with animation
- Retarget to new behavior periodically

### HUD Changes

**Before:**
- Round info top-left
- Each player has header row
- Heat bar inline with venue
- Stats next to venue name

**After:**
- Clean top overlay HUD
- Round, venue, phase centered
- Heat bar with colored fill in stat group
- All stats in compact row
- Guest count added
- Translucent background

### Decision Panel

**Before:**
- Guest detail box above buttons
- Full width at bottom
- Fixed height panel

**After:**
- Guest focus panel
- Gradient overlay background
- Larger guest portrait
- Compact stat layout
- Same buttons, better spacing
- Appears only when guest at door

---

## Behavior Node System

### Node Types

**Dance Floor** (center)
- Multiple positions around perimeter
- Guests idle with dance animation
- Most active area

**Bar** (left)
- 3 positions along counter
- Guests face bar
- Standing idle animation

**Lounge** (right)
- 3-4 seating positions
- Guests in relaxed poses
- Sitting idle animation

### Movement Logic

```
Guest Admitted
     ↓
Spawn at Entry Door (top-right)
     ↓
Pick Random Behavior (dance/bar/lounge)
     ↓
Walk to Target Node Position
     ↓
Arrive & Play Idle Animation
     ↓
Wait 3-5 seconds
     ↓
Pick New Behavior → Repeat
```

---

## Color Coding

### Heat Bar States

- **Green** (0-50%): Safe zone
- **Yellow** (50-70%): Caution
- **Red** (70-90%): Danger
- **Dark Red** (90-100%): Critical, pulsing

### Venue Theming

**Velvet Room** (Purple)
- Dance floor: Purple glow
- Door: Purple border
- Accent: #7f5af0

**Night Market** (Orange)
- Dance floor: Orange glow
- Door: Orange border
- Accent: #ff9a5c

**Back Alley** (Green)
- Dance floor: Green glow
- Door: Green border
- Accent: #2cb67d

### Guest Sprites

Random colors from palette:
- Red, Blue, Gold, Purple, Green, Orange, Pink, Cyan

Each guest assigned color on spawn.

---

## Responsive Design

### Mobile Portrait (360px)
- Canvas fills screen
- HUD compact at top
- Guest focus panel at bottom
- Touch targets min 44px

### Tablet (768px)
- Larger venue canvas
- More spacious HUD
- Better sprite visibility

### Desktop (1920px)
- Max width 480px for canvas
- Centered layout
- Crisp rendering

---

## Animation Details

### Guest Sprites
- **Wobble**: Sin wave vertical movement (2px amplitude)
- **Walk**: Linear interpolation to target at 1.2px/frame
- **Retarget**: Every 180-300 frames (3-5 seconds)
- **Spawn**: Fade in at entry door

### UI Elements
- **Heat Bar**: Smooth width transition (0.3s ease)
- **Focus Panel**: Slide up from bottom
- **Stats**: Number count-up animation

### Canvas Rendering
- **FPS**: 60fps via requestAnimationFrame
- **Update**: Scene.update() → Scene.draw()
- **Sync**: 20fps polling (50ms intervals)

---

## Overlay System

### Round Results
```
┌─────────────────────────────────────────────┐
│  (Semi-transparent dark overlay)            │
│              ┌─────────────┐                │
│              │   ROUND 1   │                │
│              │   COMPLETE  │                │
│              │             │                │
│              │  Money: +5  │                │
│              │  Points: +3 │                │
│              │             │                │
│              │ [CONTINUE]  │                │
│              └─────────────┘                │
└─────────────────────────────────────────────┘
```

### Buy Phase
```
┌─────────────────────────────────────────────┐
│  (Dark overlay)                             │
│  ┌───────────────────────────────────────┐  │
│  │ SHOP                      💵 $12      │  │
│  │                                       │  │
│  │  [😀]  [🎭]  [👀]  [💵]  [🙌]       │  │
│  │  $2    $3    $4    $2    $3          │  │
│  │                                       │  │
│  │  [📦+1 Slot]  [🌡️+1 Heat]           │  │
│  │     $3            $4                  │  │
│  │                                       │  │
│  │           [DONE SHOPPING]             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Technical Rendering

### Canvas Layers (conceptual)
1. Background gradient
2. Venue structure (dance floor, bar, lounge)
3. Entry door
4. Guest sprites (sorted by y-position)
5. Venue emoji

### Draw Order
```javascript
function draw(ctx) {
    drawVenue(ctx);      // Background + structures

    // Sort guests by y-position (painter's algorithm)
    actors.sort((a, b) => a.y - b.y);

    for (const actor of actors) {
        actor.draw(ctx);  // Each guest sprite
    }
}
```

### Coordinate System
- Origin: Top-left (0, 0)
- Width: Canvas width (responsive)
- Height: Canvas height (responsive)
- Behavior nodes: Percentage-based (0.5, 0.5 = center)

---

## Conclusion

The transformation creates a live party atmosphere while preserving all game mechanics. Players see their venue as a real space with guests moving around, making decisions feel more impactful and the game world more tangible.
