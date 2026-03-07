/* ============================================
   VENUE RIVALS - App Controller
   Screen management, game loop, UI binding,
   guest phase, buy phase, animation
   ============================================ */

(function () {
    'use strict';

    // === State ===
    let gameState = null;
    let selectedVenueType = null;
    let currentScreen = 'title';
    let animLoopId = null;
    let aiTimerId = null;
    let currentMarket = null;
    let tooltipEl = null;
    let iconTooltipEl = null;
    let guestAbilityPopupEl = null;
    let guestAbilityPopupBackdropEl = null;
    let loadoutState = null;
    let selectedGridGuest = null;
    // cache the last rendered guest detail to avoid unnecessary refreshes
    let _lastGuestDetailKey = null;
    let multiplayerSession = null;
    let multiplayerMode = 'single';
    let multiplayerRole = 'host';
    let waitingPopupEl = null;
    let waitingPopupBackdropEl = null;
    let pendingHostMatchConfig = null;
    const revealDoorIntel = { player: null, rival: null };
    const venueActors = { player: new Map(), rival: new Map() };
    let actorAnimTimer = null;
    let activePartyView = 'player';
    let swipeStartX = null;
    let playerFlashWindowInstanceId = null;

    const ACTOR_TICK_MS = 50;
    const ACTOR_MIN_SPEED = 0.65;
    const ACTOR_DISTANCE_SPEED_FACTOR = 0.065;
    const ACTOR_MAX_SPEED = 4.2;

    // === Pixel Sprite Generator (Multi-frame) ===
    // Generates 4-frame sprite sheets: idle0, idle1, walk0, walk1.
    // Each frame is 12x16 pixels at 2x scale (24x32 rendered).
    // Cached as a single horizontal strip data URL per guest.
    const _spriteCache = {};
    const SPRITE_W = 12;
    const SPRITE_H = 16;
    const SPRITE_SCALE = 2.7;
    const SPRITE_FRAMES = 4; // idle0, idle1, walk0, walk1

    const SKIN = {
        light:  '#f5d6b8',
        medium: '#e8c49a',
        tan:    '#d4a574',
        brown:  '#a67c52',
        dark:   '#6b4226',
    };
    function skinShade(base, amt) {
        // darken a hex color for shadow detail
        const n = parseInt(base.slice(1), 16);
        const r = Math.max(0, ((n>>16)&0xff) - amt);
        const g = Math.max(0, ((n>>8)&0xff) - amt);
        const b = Math.max(0, (n&0xff) - amt);
        return `rgb(${r},${g},${b})`;
    }
    function colorShade(hex, amt) {
        if (hex.startsWith('rgb')) return hex;
        const n = parseInt(hex.slice(1), 16);
        const r = Math.max(0, Math.min(255, ((n>>16)&0xff) + amt));
        const g = Math.max(0, Math.min(255, ((n>>8)&0xff) + amt));
        const b = Math.max(0, Math.min(255, (n&0xff) + amt));
        return `rgb(${r},${g},${b})`;
    }

    const HAIR_COLORS = {
        black:  '#1a1a2e', brown:  '#5c3a1e', blonde: '#e8c44c',
        red:    '#b83c28', white:  '#d8d8e8', blue:   '#4488cc',
        purple: '#8844aa', green:  '#44aa66', pink:   '#e866aa',
        orange: '#e88833', silver: '#aaaacc',
    };

    // Blueprint: { skin, hair, hairColor, shirt, pants, shoes, items[] }
    // hair:  'short','spiky','long','slick','bald','mohawk','cap','tophat','hood','bandana','beanie','ponytail','afro','pigtails'
    // items: 'glasses','shades','monocle','mask','scar',
    //        'bowtie','tie','chain','badge','earring',
    //        'scarf','bag','backpack','camera','clipboard','headphones',
    //        'cape','vest','apron','holster','cane','crown','gloves','bandolier'
    const GUEST_SPRITES = {
        regular:       { skin:'light',  hair:'short',    hairColor:'brown',  shirt:'#7788aa', pants:'#445566', shoes:'#333344', items:[] },
        chiller:       { skin:'light',  hair:'slick',    hairColor:'blue',   shirt:'#44aadd', pants:'#335577', shoes:'#224466', items:['shades','scarf'] },
        tipper:        { skin:'medium', hair:'short',    hairColor:'black',  shirt:'#2cb67d', pants:'#445544', shoes:'#333333', items:['bowtie','chain'] },
        tipOffArtist:  { skin:'tan',    hair:'slick',    hairColor:'black',  shirt:'#333344', pants:'#222233', shoes:'#111122', items:['shades','holster'] },
        hypeFriend:    { skin:'medium', hair:'spiky',    hairColor:'orange', shirt:'#ffaa33', pants:'#886622', shoes:'#664411', items:['headphones'] },
        hypester:      { skin:'tan',    hair:'spiky',    hairColor:'red',    shirt:'#ee4422', pants:'#882211', shoes:'#661100', items:['earring','chain','vest'] },
        standIn:       { skin:'light',  hair:'long',     hairColor:'purple', shirt:'#7755bb', pants:'#554488', shoes:'#332266', items:['mask','cape'] },
        usher:         { skin:'medium', hair:'slick',    hairColor:'black',  shirt:'#222233', pants:'#111122', shoes:'#0a0a18', items:['gloves','badge'] },
        floorRunner:   { skin:'tan',    hair:'bandana',  hairColor:'brown',  shirt:'#55cc77', pants:'#336644', shoes:'#224422', items:['badge','backpack'] },
        bookkeeper:    { skin:'light',  hair:'short',    hairColor:'brown',  shirt:'#bbaa77', pants:'#665544', shoes:'#443322', items:['glasses','clipboard'] },
        rovingCritic:  { skin:'light',  hair:'tophat',   hairColor:'white',  shirt:'#886644', pants:'#443322', shoes:'#221100', items:['monocle','cane'] },
        partyPromoter: { skin:'medium', hair:'afro',     hairColor:'blonde', shirt:'#ee6633', pants:'#aa4422', shoes:'#882211', items:['headphones','chain'] },
        bigSpender:    { skin:'light',  hair:'slick',    hairColor:'black',  shirt:'#ffd166', pants:'#aa8833', shoes:'#886622', items:['bowtie','bag','crown'] },
        celebrity:     { skin:'tan',    hair:'long',     hairColor:'blonde', shirt:'#dd33aa', pants:'#882266', shoes:'#661155', items:['shades','scarf','earring'] },
        headliner:     { skin:'medium', hair:'ponytail', hairColor:'pink',   shirt:'#ffcc00', pants:'#aa8800', shoes:'#886600', items:['earring','cape','crown'] },
        champagneHost: { skin:'light',  hair:'slick',    hairColor:'black',  shirt:'#111122', pants:'#0a0a18', shoes:'#050510', items:['bowtie','vest'] },
        velvetBouncer: { skin:'dark',   hair:'bald',     hairColor:'black',  shirt:'#222233', pants:'#111122', shoes:'#0a0a18', items:['badge','earring'] },
        spotlightPhotographer: { skin:'medium', hair:'beanie', hairColor:'brown', shirt:'#666688', pants:'#444466', shoes:'#333355', items:['camera','bag'] },
        galleryScout:  { skin:'tan',    hair:'cap',      hairColor:'brown',  shirt:'#558844', pants:'#445533', shoes:'#334422', items:['backpack'] },
        trendBroker:   { skin:'light',  hair:'slick',    hairColor:'black',  shirt:'#334466', pants:'#222244', shoes:'#111133', items:['glasses','tie','clipboard'] },
        curioDealer:   { skin:'medium', hair:'cap',      hairColor:'red',    shirt:'#885533', pants:'#664422', shoes:'#553311', items:['earring','bag','apron'] },
        stylist:       { skin:'light',  hair:'pigtails', hairColor:'pink',   shirt:'#cc44cc', pants:'#883388', shoes:'#662266', items:['scarf','bag'] },
        gateRunner:    { skin:'tan',    hair:'hood',     hairColor:'black',  shirt:'#cc2222', pants:'#661111', shoes:'#440000', items:['scar','bandolier'] },
        wheelman:      { skin:'medium', hair:'cap',      hairColor:'brown',  shirt:'#555555', pants:'#333333', shoes:'#222222', items:['shades','gloves'] },
        fence:         { skin:'dark',   hair:'hood',     hairColor:'black',  shirt:'#444433', pants:'#332222', shoes:'#221111', items:['bag','holster'] },
        provocateur:   { skin:'tan',    hair:'mohawk',   hairColor:'red',    shirt:'#881133', pants:'#440022', shoes:'#330011', items:['scar','chain','earring'] },
        gatecrasher:   { skin:'dark',   hair:'mohawk',   hairColor:'red',    shirt:'#aa1111', pants:'#551111', shoes:'#330000', items:['scar','bandolier'] },
    };

    // ---- Sprite drawing engine ----
    function generateSpriteSheet(guestId) {
        if (_spriteCache[guestId]) return _spriteCache[guestId];

        const bp = GUEST_SPRITES[guestId] || GUEST_SPRITES.regular;
        const skin = SKIN[bp.skin] || SKIN.light;
        const skinDark = skinShade(skin, 30);
        const hairC = HAIR_COLORS[bp.hairColor] || bp.hairColor;
        const hairHi = colorShade(hairC, 30);
        const shirt = bp.shirt;
        const shirtHi = colorShade(shirt, 20);
        const shirtLo = colorShade(shirt, -25);
        const pants = bp.pants;
        const pantsLo = colorShade(pants, -20);
        const shoes = bp.shoes;
        const items = new Set(bp.items);

        const fw = SPRITE_W * SPRITE_SCALE;
        const fh = SPRITE_H * SPRITE_SCALE;
        const canvas = document.createElement('canvas');
        canvas.width = fw * SPRITE_FRAMES;
        canvas.height = fh;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const s = SPRITE_SCALE;

        // Draw each frame
        for (let f = 0; f < SPRITE_FRAMES; f++) {
            const ox = f * SPRITE_W; // pixel offset for this frame
            const isIdle = f < 2;
            const frameIdx = f % 2; // 0 or 1 for the two sub-poses

            function px(x, y, color) {
                ctx.fillStyle = color;
                ctx.fillRect((ox + x) * s, y * s, s, s);
            }

            // Idle frames: frameIdx 0 = neutral, frameIdx 1 = slight bob (arms shift)
            // Walk frames: frameIdx 0 = left leg fwd, frameIdx 1 = right leg fwd

            // ---- HAIR (rows 0-3) ----
            switch (bp.hair) {
                case 'spiky':
                    px(4,0,hairC); px(6,0,hairC); px(8,0,hairC);
                    px(3,1,hairHi); px(5,1,hairC); px(7,1,hairC);
                    for (let x=3;x<=8;x++) px(x,2,hairC);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'long':
                    for (let x=4;x<=7;x++) px(x,0,hairC);
                    for (let x=3;x<=8;x++) px(x,1,hairC);
                    for (let x=3;x<=8;x++) px(x,2,hairC);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    px(3,4,hairC); px(8,4,hairC);
                    px(3,5,hairC); px(8,5,hairC);
                    break;
                case 'slick':
                    for (let x=4;x<=7;x++) px(x,1,hairC);
                    for (let x=3;x<=8;x++) px(x,2,hairHi);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'bald':
                    for (let x=4;x<=7;x++) px(x,2,skinDark);
                    for (let x=3;x<=8;x++) px(x,3,skin);
                    break;
                case 'mohawk':
                    px(5,0,hairC); px(6,0,hairC);
                    px(5,1,hairHi); px(6,1,hairHi);
                    px(5,2,hairC); px(6,2,hairC);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'cap':
                    for (let x=2;x<=9;x++) px(x,2,shirt);
                    px(2,3,shirt);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'tophat':
                    for (let x=4;x<=7;x++) px(x,0,hairC);
                    for (let x=4;x<=7;x++) px(x,1,hairC);
                    for (let x=3;x<=8;x++) px(x,2,colorShade(hairC, -20));
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'hood':
                    for (let x=3;x<=8;x++) px(x,1,shirtLo);
                    for (let x=3;x<=8;x++) px(x,2,shirt);
                    for (let x=3;x<=8;x++) px(x,3,shirt);
                    px(3,4,shirt); px(8,4,shirt);
                    break;
                case 'bandana':
                    for (let x=3;x<=8;x++) px(x,2,'#cc3333');
                    px(9,3,'#cc3333'); // trailing end
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'beanie':
                    for (let x=3;x<=8;x++) px(x,1,shirt);
                    for (let x=3;x<=8;x++) px(x,2,colorShade(shirt,30));
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
                case 'ponytail':
                    for (let x=4;x<=7;x++) px(x,1,hairC);
                    for (let x=3;x<=8;x++) px(x,2,hairC);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    px(9,3,hairC); px(9,4,hairC); px(9,5,hairC); // tail
                    px(10,6,hairC);
                    break;
                case 'afro':
                    for (let x=3;x<=8;x++) px(x,0,hairC);
                    for (let x=2;x<=9;x++) px(x,1,hairC);
                    for (let x=2;x<=9;x++) px(x,2,hairHi);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    px(2,3,hairC); px(9,3,hairC);
                    break;
                case 'pigtails':
                    for (let x=4;x<=7;x++) px(x,1,hairC);
                    for (let x=3;x<=8;x++) px(x,2,hairC);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    px(2,3,hairC); px(2,4,hairC); px(2,5,hairC); // left pigtail
                    px(9,3,hairC); px(9,4,hairC); px(9,5,hairC); // right pigtail
                    break;
                default: // 'short'
                    for (let x=4;x<=7;x++) px(x,2,hairC);
                    for (let x=3;x<=8;x++) px(x,3,hairC);
                    break;
            }

            // ---- Crown (over hair) ----
            if (items.has('crown')) {
                px(4,0,'#ffd166'); px(5,0,'#ffaa22'); px(6,0,'#ffd166'); px(7,0,'#ffaa22');
                px(4,1,'#ffd166'); px(5,1,'#ffd166'); px(6,1,'#ffd166'); px(7,1,'#ffd166');
            }

            // ---- HEAD / FACE (rows 4-6) ----
            for (let x=4;x<=7;x++) { px(x,4,skin); px(x,5,skin); px(x,6,skin); }
            px(3,5,skin); px(8,5,skin); // ears
            // Eyes
            px(5,5,'#1a1a2e'); px(6,5,'#1a1a2e');
            // Mouth
            px(5,6,skinDark); px(6,6,skinDark);

            // Face accessories
            if (items.has('glasses')) {
                px(4,5,'#6688aa'); px(5,5,'#aaddff'); px(6,5,'#aaddff'); px(7,5,'#6688aa');
            }
            if (items.has('shades')) {
                px(4,5,'#111122'); px(5,5,'#1a1a33'); px(6,5,'#1a1a33'); px(7,5,'#111122');
            }
            if (items.has('monocle')) {
                px(6,5,'#ddcc88'); px(7,5,'#ddcc88'); px(7,6,'#bbaa66');
            }
            if (items.has('mask')) {
                px(4,5,'#eeeeee'); px(5,5,'#222233'); px(6,5,'#222233'); px(7,5,'#eeeeee');
            }
            if (items.has('scar')) {
                px(7,4,'#cc4444'); px(8,5,'#cc4444'); px(7,6,'#cc4444');
            }
            if (items.has('earring')) {
                px(3,5,'#ffd166');
            }

            // ---- BODY / SHIRT (rows 7-10) ----
            // Torso
            for (let y=7;y<=10;y++) {
                for (let x=4;x<=7;x++) px(x,y,shirt);
            }
            // Collar / neckline
            px(5,7,shirtHi); px(6,7,shirtHi);

            // Arms — animate per frame
            if (isIdle) {
                // idle: arms down; frameIdx 1 = slight arm shift
                const armDy = frameIdx === 1 ? 1 : 0;
                px(3,8+armDy,shirt); px(8,8+armDy,shirt);
                px(3,9+armDy,skin); px(8,9+armDy,skin); // hands
            } else {
                // walk: alternate arms
                if (frameIdx === 0) {
                    px(3,8,shirt); px(3,9,skin); // left arm back
                    px(9,9,shirt); px(9,10,skin); // right arm forward
                } else {
                    px(9,8,shirt); px(9,9,skin); // right arm back
                    px(2,9,shirt); px(2,10,skin); // left arm forward
                }
            }

            // ---- Body items ----
            if (items.has('bowtie')) {
                px(5,7,'#cc2244'); px(6,7,'#cc2244');
            }
            if (items.has('tie')) {
                px(5,7,'#cc2244'); px(5,8,'#cc2244'); px(5,9,'#aa1133');
            }
            if (items.has('chain')) {
                px(5,8,'#ffd166'); px(6,9,'#ffd166'); px(5,10,'#eebb44');
            }
            if (items.has('badge')) {
                px(6,8,'#ffd166'); px(7,8,'#eebb44');
            }
            if (items.has('gloves')) {
                // override hand pixels
                if (isIdle) {
                    const armDy = frameIdx === 1 ? 1 : 0;
                    px(3,9+armDy,'#eeeeee'); px(8,9+armDy,'#eeeeee');
                } else {
                    if (frameIdx === 0) { px(3,9,'#eeeeee'); px(9,10,'#eeeeee'); }
                    else { px(9,9,'#eeeeee'); px(2,10,'#eeeeee'); }
                }
            }
            if (items.has('vest')) {
                px(4,7,shirtLo); px(7,7,shirtLo);
                px(4,8,shirtLo); px(7,8,shirtLo);
                px(4,9,shirtLo); px(7,9,shirtLo);
            }
            if (items.has('apron')) {
                for (let x=4;x<=7;x++) { px(x,9,'#eeeecc'); px(x,10,'#eeeecc'); }
            }

            // ---- Scarf (wraps around neck, drapes) ----
            if (items.has('scarf')) {
                const scarfC = items.has('shades') ? '#ee4444' : '#44bbdd';
                px(4,7,scarfC); px(5,7,scarfC); px(6,7,scarfC); px(7,7,scarfC);
                px(3,8,scarfC); // draping end
                if (frameIdx === 1) px(3,9,scarfC); // sway
            }

            // ---- Cape (behind body) ----
            if (items.has('cape')) {
                const capeC = '#7733aa';
                px(3,8,capeC); px(8,8,capeC);
                px(3,9,capeC); px(8,9,capeC);
                px(3,10,capeC); px(8,10,capeC);
                px(2,10,capeC); px(9,10,capeC);
                if (frameIdx === 1) { px(2,11,capeC); px(9,11,capeC); }
            }

            // ---- Headphones ----
            if (items.has('headphones')) {
                px(3,3,'#333333'); px(8,3,'#333333');
                px(3,4,'#555555'); px(8,4,'#555555');
                px(4,2,'#444444'); px(7,2,'#444444');
            }

            // ---- Camera (hangs on chest) ----
            if (items.has('camera')) {
                px(5,9,'#333333'); px(6,9,'#444444'); px(6,10,'#333333');
                px(7,9,'#aaaaaa'); // flash
            }

            // ---- Clipboard (in hand) ----
            if (items.has('clipboard')) {
                if (isIdle) {
                    px(8,9,'#ddcc88'); px(8,10,'#ddcc88'); px(8,11,'#ccbb77');
                } else if (frameIdx === 0) {
                    px(9,10,'#ddcc88'); px(9,11,'#ddcc88');
                }
            }

            // ---- Bag (shoulder) ----
            if (items.has('bag')) {
                const bagC = '#996633';
                px(8,7,bagC);
                px(8,8,bagC); px(9,8,bagC);
                px(8,9,bagC); px(9,9,bagC);
                px(9,10,colorShade(bagC,-20));
            }

            // ---- Backpack ----
            if (items.has('backpack')) {
                const bpC = '#557744';
                px(3,7,bpC); px(2,8,bpC); px(3,8,bpC);
                px(2,9,bpC); px(3,9,bpC); px(2,10,bpC);
            }

            // ---- Holster (side) ----
            if (items.has('holster')) {
                px(8,9,'#443322'); px(8,10,'#443322'); px(8,11,'#554433');
            }

            // ---- Bandolier (diagonal strap) ----
            if (items.has('bandolier')) {
                px(7,7,'#554422'); px(6,8,'#554422'); px(5,9,'#554422'); px(4,10,'#554422');
                px(7,8,'#997744'); px(6,9,'#997744'); // ammo dots
            }

            // ---- Cane (right side) ----
            if (items.has('cane')) {
                const caneC = '#886644';
                if (isIdle) {
                    px(9,9,caneC); px(9,10,caneC); px(9,11,caneC); px(9,12,caneC); px(9,13,caneC);
                    px(10,9,'#ddcc88'); // handle
                } else {
                    // cane tilts while walking
                    const tilt = frameIdx === 0 ? 9 : 8;
                    px(tilt,10,caneC); px(tilt,11,caneC); px(9,12,caneC); px(9,13,caneC);
                    px(tilt+1,9,'#ddcc88');
                }
            }

            // ---- PANTS / LEGS (rows 11-13) ----
            if (isIdle) {
                // Standing: legs together, frameIdx 1 = subtle weight shift
                for (let y=11;y<=13;y++) {
                    px(4,y,pants); px(5,y,pants); px(6,y,pants); px(7,y,pants);
                }
                if (frameIdx === 1) {
                    // weight on right foot: left foot lifts 1px
                    px(4,13,pants); // left foot stays but lighter
                }
                // Subtle gap between legs
                px(5,13,pantsLo); px(6,13,pantsLo);
            } else {
                // Walking: alternate legs
                // Both frames have torso-level pants
                px(4,11,pants); px(5,11,pants); px(6,11,pants); px(7,11,pants);
                if (frameIdx === 0) {
                    // left leg forward, right leg back
                    px(3,12,pants); px(4,12,pants); px(5,12,pants);
                    px(6,12,pants); px(7,12,pants); px(8,12,pants);
                    px(3,13,pants); px(4,13,pants);  // left foot forward
                    px(7,13,pants); px(8,13,pants);  // right foot back
                } else {
                    // right leg forward, left leg back
                    px(6,12,pants); px(7,12,pants); px(8,12,pants);
                    px(3,12,pants); px(4,12,pants); px(5,12,pants);
                    px(7,13,pants); px(8,13,pants);  // right foot forward
                    px(3,13,pants); px(4,13,pants);  // left foot back
                }
            }

            // ---- FEET (rows 14-15) ----
            if (isIdle) {
                px(4,14,shoes); px(5,14,shoes); px(6,14,shoes); px(7,14,shoes);
                px(4,15,shoes); px(5,15,shoes); px(6,15,shoes); px(7,15,shoes);
            } else {
                if (frameIdx === 0) {
                    px(3,14,shoes); px(4,14,shoes); // left forward
                    px(7,14,shoes); px(8,14,shoes); // right back
                    px(3,15,shoes); px(4,15,shoes);
                    px(7,15,shoes); px(8,15,shoes);
                } else {
                    px(7,14,shoes); px(8,14,shoes); // right forward
                    px(3,14,shoes); px(4,14,shoes); // left back
                    px(7,15,shoes); px(8,15,shoes);
                    px(3,15,shoes); px(4,15,shoes);
                }
            }
        }

        const dataUrl = canvas.toDataURL('image/png');
        _spriteCache[guestId] = dataUrl;
        return dataUrl;
    }

    function getActorHtml(guestId) {
        const sheetUrl = generateSpriteSheet(guestId);
        const fw = SPRITE_W * SPRITE_SCALE;
        const fh = SPRITE_H * SPRITE_SCALE;
        return `<div class="actor-sprite" style="background-image:url(${sheetUrl});width:${fw}px;height:${fh}px;background-position:0 0;background-size:${fw * SPRITE_FRAMES}px ${fh}px"></div>`;
    }

    function getGuestCardSpriteHtml(guestId) {
        const sheetUrl = generateSpriteSheet(guestId);
        const fw = SPRITE_W * SPRITE_SCALE;
        const fh = SPRITE_H * SPRITE_SCALE;
        return `<span class="slot-sprite" style="background-image:url(${sheetUrl});width:${fw}px;height:${fh}px;background-position:0 0;background-size:${fw * SPRITE_FRAMES}px ${fh}px" aria-hidden="true"></span>`;
    }

    const MIN_DECK_SIZE = 4;
    const MAX_DECK_SIZE = 15;
    const ABLY_API_KEY = '_tDhUg.HYf2eA:VPJbNYIBgqUrolL5QzcLSyj4XRCheq3cizKtHVAtGCA';

    const VENUE_POOL_DESC = {
        velvetRoom: 'Lock stars in place and close at the right moment',
        nightMarket: 'Peek at the queue, bounce and score smart',
        backAlley: 'Push guests out, taunt opponents, stay cool',
    };

    const VENUE_STYLE_LABEL = {
        money: '\u{1F4B5}U+ Money',
        points: '\u2B50 Points',
        control: '\u{1F6E1} Control',
    };

    // Rival names
    const RIVAL_NAMES = [
        'The Crimson Fox', 'Midnight Ember', 'Velvet Edge',
        'Neon Pulse', 'The Gilded Owl', 'Shadow & Tonic',
    ];

    // === DOM References ===
    const screens = {
        title: document.getElementById('title-screen'),
        howToPlay: document.getElementById('how-to-play-screen'),
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
    };

    const titleCanvas = document.getElementById('title-canvas');
    const gameoverCanvas = document.getElementById('gameover-canvas');

    // === Screen Management ===
    function switchScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');
        currentScreen = name;
    }

    // === Animation Loop ===
    function startAnimLoop() {
        cancelAnimationFrame(animLoopId);
        function loop() {
            if (currentScreen === 'title') {
                Renderer.drawTitleScreen(titleCanvas);
            }
            animLoopId = requestAnimationFrame(loop);
        }
        loop();
    }

    function startGameOverAnim(won) {
        function loop() {
            Renderer.drawGameOverScene(gameoverCanvas, won);
            if (currentScreen === 'game') {
                requestAnimationFrame(loop);
            }
        }
        loop();
    }

    // === Utility ===
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function isMultiplayer() {
        return multiplayerMode === 'multiplayer';
    }

    function setMultiplayerStatus(text) {
        const el = document.getElementById('multiplayer-status');
        if (el) el.textContent = text;
    }

    function showWaitingPopup(message) {
        closeWaitingPopup();
        waitingPopupBackdropEl = document.createElement('div');
        waitingPopupBackdropEl.className = 'multiplayer-popup-backdrop';
        waitingPopupEl = document.createElement('div');
        waitingPopupEl.className = 'multiplayer-popup';
        waitingPopupEl.textContent = message;
        document.body.appendChild(waitingPopupBackdropEl);
        document.body.appendChild(waitingPopupEl);
    }

    function updateWaitingPopup(message) {
        if (!waitingPopupEl) return;
        waitingPopupEl.textContent = message;
    }

    function closeWaitingPopup() {
        if (waitingPopupEl) {
            waitingPopupEl.remove();
            waitingPopupEl = null;
        }
        if (waitingPopupBackdropEl) {
            waitingPopupBackdropEl.remove();
            waitingPopupBackdropEl = null;
        }
    }

    function publishState() {
        if (!isMultiplayer() || multiplayerRole !== 'host' || !multiplayerSession || !gameState) return;
        multiplayerSession.publish('state-sync', { gameState, currentMarket });
    }

    function getLocalMarket() {
        if (!Array.isArray(currentMarket) && currentMarket && typeof currentMarket === 'object') {
            const marketForRole = multiplayerRole === 'join' ? currentMarket.rival : currentMarket.player;
            return Array.isArray(marketForRole) ? marketForRole : [];
        }
        return Array.isArray(currentMarket) ? currentMarket : [];
    }

    function syncPanelsForState() {
        if (!gameState) return;

        if (gameState.phase === 'buy') {
            document.getElementById('guest-phase-panel').style.display = 'none';
            document.getElementById('round-results-panel').style.display = 'none';
            document.getElementById('buy-phase-panel').style.display = '';
            document.getElementById('gameover-panel').style.display = 'none';
            renderShop();
            setPhoneBuyPhaseLayout(true);
            return;
        }

        if (gameState.phase === 'gameover') {
            document.getElementById('guest-phase-panel').style.display = 'none';
            document.getElementById('round-results-panel').style.display = 'none';
            document.getElementById('buy-phase-panel').style.display = 'none';
            document.getElementById('gameover-panel').style.display = '';
            setPhoneBuyPhaseLayout(false);
            return;
        }

        if (Game.bothDone(gameState)) {
            document.getElementById('guest-phase-panel').style.display = 'none';
            document.getElementById('round-results-panel').style.display = '';
            document.getElementById('buy-phase-panel').style.display = 'none';
            document.getElementById('gameover-panel').style.display = 'none';
            // If buy phase has already started (results being shown before shop opens), keep compact HUD.
            setPhoneBuyPhaseLayout(gameState.phase === 'buy');
            return;
        }

        document.getElementById('guest-phase-panel').style.display = '';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';
        setPhoneBuyPhaseLayout(false);
    }

    function setPhoneBuyPhaseLayout(isBuyPhase) {
        const phoneScreenEl = document.querySelector('#phone-hud .phone-screen');
        if (!phoneScreenEl) return;
        phoneScreenEl.classList.toggle('buy-phase-compact', !!isBuyPhase);
    }

    function mapStateToJoinPerspective(state) {
        if (!state || multiplayerRole !== 'join') return state;

        const winner = state.winner === 'player'
            ? 'rival'
            : state.winner === 'rival'
                ? 'player'
                : state.winner;

        return {
            ...state,
            player: state.rival,
            rival: state.player,
            winner,
        };
    }

    function refreshAll() {
        if (!gameState) return;
        syncSelectedGridGuest();
        syncPanelsForState();
        renderHouseGrid('player');
        renderHouseGrid('rival');
        renderArrivingGuest('player');
        renderArrivingGuest('rival');
        updateGuestDetail();
        updateVenueStatus('player');
        updateVenueStatus('rival');
        updateHUD();
        applyPartyView(false);
    }


    function applyPartyView(animate = true) {
        const track = document.getElementById('party-track');
        if (!track) return;
        track.style.transition = animate ? 'transform 0.28s ease' : 'none';
        track.style.transform = activePartyView === 'player' ? 'translateX(0%)' : 'translateX(-50%)';

        const playerBtn = document.getElementById('btn-view-player');
        const rivalBtn = document.getElementById('btn-view-rival');
        playerBtn?.classList.toggle('active', activePartyView === 'player');
        rivalBtn?.classList.toggle('active', activePartyView === 'rival');
    }

    function setPartyView(view, animate = true) {
        if (view !== 'player' && view !== 'rival') return;
        activePartyView = view;
        removeTooltip();
        applyPartyView(animate);
        updateHUD();
        updateGuestDetail();
    }

    function bindPartyCarouselInteractions() {
        const carousel = document.getElementById('party-carousel');
        if (!carousel) return;

        carousel.addEventListener('touchstart', (e) => {
            if (!e.touches?.length) return;
            swipeStartX = e.touches[0].clientX;
        }, { passive: true });

        carousel.addEventListener('touchend', (e) => {
            if (swipeStartX == null || !e.changedTouches?.length) return;
            const deltaX = e.changedTouches[0].clientX - swipeStartX;
            swipeStartX = null;
            if (Math.abs(deltaX) < 40) return;
            if (deltaX < 0) setPartyView('rival');
            else setPartyView('player');
        }, { passive: true });

        document.getElementById('btn-view-player')?.addEventListener('click', () => setPartyView('player'));
        document.getElementById('btn-view-rival')?.addEventListener('click', () => setPartyView('rival'));
    }

    function syncSelectedGridGuest() {
        if (!gameState) {
            selectedGridGuest = null;
            return;
        }
        const p = gameState.player;
        if (!p.arrivingGuest || p.doorClosed || p.busted) {
            selectedGridGuest = null;
            return;
        }
        if (!selectedGridGuest) {
            selectedGridGuest = { guestId: p.arrivingGuest, source: 'arriving' };
            return;
        }
        if (selectedGridGuest.source === 'arriving' && selectedGridGuest.guestId !== p.arrivingGuest) {
            selectedGridGuest = { guestId: p.arrivingGuest, source: 'arriving' };
            return;
        }
        if (selectedGridGuest.source === 'house') {
            const inHouse = p.house.some((entry) => {
                if (selectedGridGuest.instanceId != null && typeof entry !== 'string') {
                    return entry.instanceId === selectedGridGuest.instanceId;
                }
                return (entry.guestId || entry) === selectedGridGuest.guestId;
            });
            if (!inHouse) {
                selectedGridGuest = { guestId: p.arrivingGuest, source: 'arriving' };
            }
        }
    }


    function refreshSelectedGridSlotVisual() {
        const slotsEl = document.getElementById('player-slots');
        if (!slotsEl) return;

        slotsEl.querySelectorAll('.guest-slot.selected').forEach((slot) => slot.classList.remove('selected'));
        if (!selectedGridGuest) return;

        const occupiedSlots = slotsEl.querySelectorAll('.occupied-slot[data-guest-id]');
        occupiedSlots.forEach((slot) => {
            const sameSource = (slot.dataset.slotSource || '') === selectedGridGuest.source;
            const sameGuest = (slot.dataset.guestId || '') === selectedGridGuest.guestId;
            if (!sameSource || !sameGuest) return;

            if (selectedGridGuest.source === 'house' && selectedGridGuest.instanceId != null) {
                if ((slot.dataset.instanceId || '') !== String(selectedGridGuest.instanceId)) return;
            }
            slot.classList.add('selected');
        });
    }

    function handleRemoteEvent(evt) {
        if (!evt || !evt.type) return;

        if (evt.type === 'player-joined' && multiplayerRole === 'host' && pendingHostMatchConfig) {
            const profile = evt.payload?.profile || {};
            updateWaitingPopup('Connected!');
            setMultiplayerStatus('Connected! Starting match...');
            startGame(pendingHostMatchConfig.name, pendingHostMatchConfig.venueType, pendingHostMatchConfig.totalRounds, {
                rivalName: profile.name || 'Challenger',
                rivalVenue: profile.venueId,
                rivalDeck: profile.deck,
                rivalGuestList: profile.guestList,
            });
            multiplayerSession?.publish('match-start', {
                hostConfig: pendingHostMatchConfig,
                stateSnapshot: gameState,
                marketSnapshot: currentMarket,
            });
            pendingHostMatchConfig = null;
            setTimeout(closeWaitingPopup, 700);
            return;
        }

        if (evt.type === 'match-start' && multiplayerRole === 'join') {
            closeWaitingPopup();
            const hostConfig = evt.payload?.hostConfig;
            if (!hostConfig) return;
            const localName = document.getElementById('venue-name-input')?.value.trim() || 'My Venue';
            startGame(escapeHtml(localName), loadoutState?.venueId || hostConfig.venueType, hostConfig.totalRounds, {
                rivalName: hostConfig.name,
                rivalVenue: hostConfig.venueType,
            });

            if (evt.payload?.stateSnapshot) {
                gameState = mapStateToJoinPerspective(evt.payload.stateSnapshot);
                currentMarket = evt.payload.marketSnapshot || currentMarket;
                refreshAll();
            }

            setMultiplayerStatus('Connected!');
            return;
        }

        if (evt.type === 'state-sync' && evt.payload?.gameState) {
            const incoming = mapStateToJoinPerspective(evt.payload.gameState);
            const prevPlayerKey = gameState ? `${gameState.player.arrivingGuest || ''}|${gameState.player.doorClosed}|${gameState.player.busted}|${gameState.player.heat}|${gameState.player.roundMoney}|${gameState.player.roundPoints}|${gameState.player.house.length}` : null;
            const prevRivalKey = gameState ? `${gameState.rival.arrivingGuest || ''}|${gameState.rival.doorClosed}|${gameState.rival.busted}|${gameState.rival.heat}|${gameState.rival.house.length}` : null;
            const prevPhase = gameState ? gameState.phase : null;
            const newPlayerKey = `${incoming.player.arrivingGuest || ''}|${incoming.player.doorClosed}|${incoming.player.busted}|${incoming.player.heat}|${incoming.player.roundMoney}|${incoming.player.roundPoints}|${incoming.player.house.length}`;
            const newRivalKey = `${incoming.rival.arrivingGuest || ''}|${incoming.rival.doorClosed}|${incoming.rival.busted}|${incoming.rival.heat}|${incoming.rival.house.length}`;

            gameState = incoming;
            currentMarket = evt.payload.currentMarket || currentMarket;

            // Only sync panels if phase actually changed (can trigger layout recalcs)
            if (prevPhase !== gameState.phase) {
                syncPanelsForState();
            }

            // Only update HUD if game structure or round changed
            if (prevRivalKey !== newRivalKey || prevPhase !== gameState.phase) {
                updateHUD();
            }

            // Only re-render rival UI if their state actually changed
            if (prevRivalKey !== newRivalKey) {
                renderHouseGrid('rival');
                updateVenueStatus('rival');
            }

            // Only re-render player UI if their state actually changed
            if (prevPlayerKey !== newPlayerKey) {
                renderHouseGrid('player');
                renderArrivingGuest('player');
                updateGuestDetail();
                updateVenueStatus('player');
            }
            return;
        }

        if (multiplayerRole !== 'host') return;
        if (evt.type !== 'request-action') return;

        const action = evt.payload?.action;
        const actor = evt.payload?.actor || 'rival';
        if (action === 'admit') runAdmit(actor);
        else if (action === 'ability') runAbility(actor);
        else if (action === 'close') runCloseDoor(actor);
        else if (action === 'done-shopping') runDoneShopping(actor);
        else if (action === 'buy') runBuyGuest(actor, evt.payload?.guestId);
    }

    function getActorState(actor) {
        if (actor === 'rival') {
            return { self: gameState.rival, opponent: gameState.player, selfKey: 'rival', opponentKey: 'player' };
        }
        return { self: gameState.player, opponent: gameState.rival, selfKey: 'player', opponentKey: 'rival' };
    }

    // === HUD Update ===
    function updateHUD() {
        if (!gameState) return;
        const p = gameState.player;
        const includeProjectedRoundTotals =
            gameState.phase === 'guest' && gameState.guestPhaseScoredRound !== gameState.round;

        const hudRoundNumEl = document.getElementById('hud-round-num');
        const hudRoundTotalEl = document.getElementById('hud-round-total');
        const hudPhaseEl = document.getElementById('hud-phase');
        const hudPlayerPtsEl = document.getElementById('hud-player-pts');
        const playerMoneyEl = document.getElementById('player-money');

        if (!hudRoundNumEl || !hudRoundTotalEl || !hudPhaseEl || !hudPlayerPtsEl || !playerMoneyEl) {
            return;
        }

        hudRoundNumEl.textContent = gameState.round;
        hudRoundTotalEl.textContent = gameState.totalRounds;
        hudPhaseEl.textContent =
            gameState.phase === 'guest' ? 'GUEST PHASE' :
                gameState.phase === 'buy' ? 'BUY PHASE' : 'GAME OVER';

        const r = gameState.rival;
        const hudActor = activePartyView === 'rival' ? r : p;
        hudPlayerPtsEl.textContent = `⭐ ${hudActor.points + (includeProjectedRoundTotals ? hudActor.roundPoints : 0)}`;
        playerMoneyEl.textContent = `💵 $${hudActor.money + (includeProjectedRoundTotals ? hudActor.roundMoney : 0)}`;

        const hudVenue = Game.VENUES[hudActor.venueId];
        updateHeatBar('player', hudActor.heat, Game.getHeatCapacity(hudVenue, hudActor), hudActor.busted);
        updateHeatBar('rival', r.heat, Game.getHeatCapacity(Game.VENUES[r.venueId], r), r.busted);
    }

    function updateHeatBar(who, heat, max, busted = false) {
        const fill = document.getElementById(`${who}-heat-fill`);
        const text = document.getElementById(`${who}-heat-text`);
        if (!fill || !text) return;
        const pct = busted ? 100 : Math.min(100, (heat / max) * 100);
        fill.style.width = pct + '%';
        fill.className = 'heat-fill';
        if (pct > 85) fill.classList.add('critical');
        else if (pct > 70) fill.classList.add('danger');
        else if (pct > 50) fill.classList.add('warning');
        else fill.classList.add('safe');
        text.textContent = `\u{1F525} ${heat}/${max}`;
    }

    function renderAbilityBadge(guest) {
        if (!guest.ability) return '';
        const icon = escapeHtml(guest.ability.icon || '');
        return `<span class="ability-icon-badge" aria-label="${escapeHtml(guest.ability.name || 'Ability')}" title="${escapeHtml(guest.ability.name || 'Ability')}">${icon}</span>`;
    }


    // === Venue Scene Actors ===
    function getHouseEntryKey(entry, index) {
        if (entry && typeof entry === 'object' && entry.instanceId != null) return `i-${entry.instanceId}`;
        const guestId = entry && typeof entry === 'object' ? entry.guestId : entry;
        return `g-${guestId}-${index}`;
    }

    function getSceneBounds(who) {
        const scene = document.getElementById(`${who}-scene`);
        if (!scene) return null;
        return {
            width: scene.clientWidth || 280,
            height: scene.clientHeight || 150,
        };
    }

    function pickBehaviorTarget(who) {
        const bounds = getSceneBounds(who);
        if (!bounds) return { x: 120, y: 80, behavior: 'hang' };
        const choices = [
            { behavior: 'dance', x: bounds.width * 0.34, y: bounds.height * 0.46 },
            { behavior: 'drink', x: bounds.width * 0.78, y: bounds.height * 0.35 },
            { behavior: 'lounge', x: bounds.width * 0.24, y: bounds.height * 0.72 },
            { behavior: 'wander', x: bounds.width * (0.42 + Math.random() * 0.36), y: bounds.height * (0.56 + Math.random() * 0.28) },
        ];
        return choices[Math.floor(Math.random() * choices.length)];
    }

    function getDoorPositionFromElement(who, elementId, fallback) {
        const sceneEl = document.getElementById(`${who}-scene`);
        const doorEl = document.getElementById(elementId);
        if (!sceneEl || !doorEl) return fallback;
        const sceneRect = sceneEl.getBoundingClientRect();
        const doorRect = doorEl.getBoundingClientRect();
        return {
            x: Math.max(8, Math.min(sceneRect.width - 8, (doorRect.left - sceneRect.left) + (doorRect.width / 2))),
            y: Math.max(8, Math.min(sceneRect.height - 8, (doorRect.top - sceneRect.top) + (doorRect.height / 2))),
        };
    }

    function getEntryDoorPosition(who) {
        const bounds = getSceneBounds(who) || { width: 280, height: 150 };
        const fallback = { x: bounds.width * 0.93, y: 12 };
        const elementId = who === 'player' ? 'player-door-card' : 'rival-door-card';
        return getDoorPositionFromElement(who, elementId, fallback);
    }

    function getExitDoorPosition(who) {
        const bounds = getSceneBounds(who) || { width: 280, height: 150 };
        const fallback = { x: 14, y: 14 };
        const elementId = who === 'player' ? 'player-exit-card' : 'rival-exit-card';
        return getDoorPositionFromElement(who, elementId, fallback);
    }

    function ensureActorLoop() {
        if (actorAnimTimer) return;
        actorAnimTimer = setInterval(stepVenueActors, ACTOR_TICK_MS);
    }

    function stopActorLoop() {
        if (!actorAnimTimer) return;
        clearInterval(actorAnimTimer);
        actorAnimTimer = null;
    }

    function clearVenueActors() {
        ['player', 'rival'].forEach((who) => {
            venueActors[who].clear();
            const layer = document.getElementById(`${who}-actors`);
            if (layer) layer.innerHTML = '';
        });
        stopActorLoop();
    }

    function syncVenueActors(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const layer = document.getElementById(`${who}-actors`);
        if (!layer || !player) return;
        const actors = venueActors[who];
        const wanted = new Set();

        player.house.forEach((entry, idx) => {
            const guestId = entry.guestId || entry;
            const guest = Game.GUESTS[guestId];
            if (!guest) return;
            const key = getHouseEntryKey(entry, idx);
            wanted.add(key);
            let actor = actors.get(key);

            // If this guest was the arriving-in-grid guest last frame, promote that actor into house.
            const arrivingActor = actors.get('arriving-guest');
            if (!actor && arrivingActor && arrivingActor.guestId === guestId) {
                actors.set(key, arrivingActor);
                actors.delete('arriving-guest');
                actor = arrivingActor;
                actor.state = 'active';
                actor.el.classList.remove('entering', 'exiting', 'leaving');
            }

            if (!actor) {
                const target = pickBehaviorTarget(who);
                const spawn = getEntryDoorPosition(who);
                const el = document.createElement('div');
                el.className = 'venue-actor entering';
                el.innerHTML = getActorHtml(guestId);
                el.title = `${guest.name} • entering`;
                layer.appendChild(el);
                actor = {
                    el,
                    x: spawn.x,
                    y: spawn.y,
                    targetX: target.x,
                    targetY: target.y,
                    behavior: target.behavior,
                    state: 'active',
                    t: Math.random() * Math.PI * 2,
                    guestName: guest.name,
                    guestId,
                    frame: 0,
                    frameTick: 0,
                };
                actors.set(key, actor);
                setTimeout(() => el.classList.remove('entering'), 320);
            } else if (actor.state === 'exiting') {
                actor.state = 'active';
                actor.el.classList.remove('exiting', 'leaving');
                const target = pickBehaviorTarget(who);
                actor.targetX = target.x;
                actor.targetY = target.y;
                actor.behavior = target.behavior;
            }

            actor.guestId = guestId;
            actor.guestName = guest.name;

            if (actor.state === 'active' && Math.random() < 0.03) {
                const target = pickBehaviorTarget(who);
                actor.targetX = target.x;
                actor.targetY = target.y;
                actor.behavior = target.behavior;
            }
            actor.el.title = `${actor.guestName} • ${actor.behavior}`;
        });

        // Arriving guest appears in venue grid before admit: show their actor immediately.
        if (player.arrivingGuest && !player.doorClosed && !player.busted) {
            wanted.add('arriving-guest');
            const guestId = player.arrivingGuest;
            const guest = Game.GUESTS[guestId];
            if (guest) {
                let arrivingActor = actors.get('arriving-guest');
                if (!arrivingActor) {
                    const target = pickBehaviorTarget(who);
                    const spawn = getEntryDoorPosition(who);
                    const el = document.createElement('div');
                    el.className = 'venue-actor entering';
                    el.innerHTML = getActorHtml(guestId);
                    layer.appendChild(el);
                    arrivingActor = {
                        el,
                        x: spawn.x,
                        y: spawn.y,
                        targetX: target.x,
                        targetY: target.y,
                        behavior: target.behavior,
                        state: 'active',
                        t: Math.random() * Math.PI * 2,
                        guestName: guest.name,
                        guestId,
                        frame: 0,
                        frameTick: 0,
                    };
                    actors.set('arriving-guest', arrivingActor);
                    setTimeout(() => el.classList.remove('entering'), 320);
                } else {
                    arrivingActor.guestId = guestId;
                    arrivingActor.guestName = guest.name;
                    arrivingActor.el.innerHTML = getActorHtml(guestId);
                    if (arrivingActor.state === 'exiting') {
                        arrivingActor.state = 'active';
                        arrivingActor.el.classList.remove('exiting', 'leaving');
                    }
                }
                arrivingActor.el.title = `${arrivingActor.guestName} • ${arrivingActor.behavior}`;
            }
        }

        for (const [key, actor] of actors.entries()) {
            if (!wanted.has(key) && actor.state !== 'exiting') {
                const exitTarget = getExitDoorPosition(who);
                actor.state = 'exiting';
                actor.behavior = 'leaving';
                actor.targetX = exitTarget.x;
                actor.targetY = exitTarget.y;
                actor.el.classList.add('exiting');
                actor.el.title = `${actor.guestName} • leaving`;
            }
        }

        ensureActorLoop();
    }

    function queueVenueActorExit(who, guestId) {
        const actors = venueActors[who];
        if (!actors || !actors.size) return false;

        const candidates = [];
        for (const [key, actor] of actors.entries()) {
            if (actor.state === 'exiting') continue;
            if (guestId && actor.guestId !== guestId) continue;
            candidates.push([key, actor]);
        }
        if (!candidates.length) return false;

        // Prefer established house actors over the transient arriving placeholder.
        candidates.sort((a, b) => {
            const aArriving = a[0] === 'arriving-guest' ? 1 : 0;
            const bArriving = b[0] === 'arriving-guest' ? 1 : 0;
            return aArriving - bArriving;
        });

        const [, actor] = candidates[0];
        const exitTarget = getExitDoorPosition(who);
        actor.state = 'exiting';
        actor.behavior = 'leaving';
        actor.targetX = exitTarget.x;
        actor.targetY = exitTarget.y;
        actor.el.classList.add('exiting');
        actor.el.title = `${actor.guestName} • leaving`;
        ensureActorLoop();
        return true;
    }

    // Micro-VFX puff symbols per behavior
    const PUFF_SYMBOLS = {
        dance: '\u266A',   // ♪
        drink: '\u2615',   // ☕ (cup)
        lounge: '\uD83D\uDCA4', // 💤 (zzz)
    };
    // Performance flag: disable micro-VFX on low-end devices or via prefers-reduced-motion
    let vfxEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function spawnActorPuff(actor) {
        if (!vfxEnabled || !actor.el || !actor.el.parentNode) return;
        const sym = PUFF_SYMBOLS[actor.behavior];
        if (!sym) return;
        const puff = document.createElement('span');
        puff.className = 'actor-puff';
        puff.textContent = sym;
        actor.el.appendChild(puff);
        setTimeout(() => puff.remove(), 300);
    }

    function spawnTroublePuff(actorEl) {
        if (!vfxEnabled || !actorEl || !actorEl.parentNode) return;
        const puff = document.createElement('span');
        puff.className = 'actor-puff';
        puff.textContent = '\u{1F4A2}'; // 💢
        puff.style.color = '#ff5c5c';
        actorEl.appendChild(puff);
        setTimeout(() => puff.remove(), 300);
    }

    function stepVenueActors() {
        ['player', 'rival'].forEach((who) => {
            const actors = venueActors[who];
            const bounds = getSceneBounds(who);
            if (!bounds) return;
            const removeKeys = [];

            actors.forEach((actor, key) => {
                const dx = actor.targetX - actor.x;
                const dy = actor.targetY - actor.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 1) {
                    const maxSpeed = actor.state === 'exiting' ? ACTOR_MAX_SPEED + 1.2 : ACTOR_MAX_SPEED;
                    const speed = Math.min(maxSpeed, ACTOR_MIN_SPEED + dist * ACTOR_DISTANCE_SPEED_FACTOR);
                    actor.x += (dx / dist) * speed;
                    actor.y += (dy / dist) * speed;
                } else if (actor.state === 'exiting') {
                    actor.el.classList.add('leaving');
                    removeKeys.push(key);
                } else if (Math.random() < 0.025) {
                    const target = pickBehaviorTarget(who);
                    actor.targetX = target.x;
                    actor.targetY = target.y;
                    actor.behavior = target.behavior;
                    actor.el.title = `${actor.guestName} • ${target.behavior}`;
                }

                // Spawn micro-VFX puffs occasionally when idle at target
                if (actor.state !== 'exiting' && dist <= 1 && Math.random() < 0.008) {
                    spawnActorPuff(actor);
                }

                // --- Sprite frame animation ---
                const isMoving = dist > 2;
                // frameTick counts 50ms ticks; swap sub-frame every ~6 ticks (300ms)
                actor.frameTick = (actor.frameTick || 0) + 1;
                if (actor.frameTick >= 6) {
                    actor.frameTick = 0;
                    actor.frame = (actor.frame || 0) === 0 ? 1 : 0; // toggle 0/1
                }
                // Frame index: idle = 0-1, walk = 2-3
                const spriteFrame = isMoving ? (2 + actor.frame) : actor.frame;
                const spriteEl = actor.el.firstChild;
                if (spriteEl && spriteEl.style) {
                    spriteEl.style.backgroundPosition = `-${spriteFrame * SPRITE_W * SPRITE_SCALE}px 0`;
                }

                actor.t += actor.state === 'exiting' ? 0.06 : 0.18;
                const bob = actor.state === 'exiting' ? 0 : Math.sin(actor.t) * 1.5;
                actor.el.style.left = `${Math.max(8, Math.min(bounds.width - 24, actor.x))}px`;
                actor.el.style.top = `${Math.max(8, Math.min(bounds.height - 36, actor.y + bob))}px`;
            });

            removeKeys.forEach((key) => {
                const actor = actors.get(key);
                if (!actor) return;
                const el = actor.el;
                setTimeout(() => el.remove(), 220);
                actors.delete(key);
            });
        });

        if (!venueActors.player.size && !venueActors.rival.size) stopActorLoop();
    }


    // === Guest Slot Rendering ===
    function createGuestSlot(guestId, animate, options = {}) {
        const guest = Game.GUESTS[guestId];
        if (!guest) {
            const fallback = document.createElement('div');
            fallback.className = 'guest-slot occupied-slot tier-common';
            if (guestId != null) fallback.dataset.guestId = String(guestId);
            fallback.innerHTML = `
                <span class="slot-stat slot-heat">🔥0</span>
                <span class="slot-emoji">❓</span>
                <span class="slot-stat slot-money">0</span>
                <span class="slot-stat slot-points">0</span>
            `;
            fallback.title = 'Unknown guest';
            return fallback;
        }
        const el = document.createElement('div');
        el.className = `guest-slot occupied-slot tier-${guest.tier}`;
        el.dataset.guestId = guestId;
        if (animate) el.classList.add('entering');
        el.innerHTML = `
            <span class="slot-stat slot-heat">${guest.heat}</span>
            <button type="button" class="slot-emoji slot-sprite-btn${guest.ability ? ' has-ability' : ''}" aria-label="${escapeHtml(guest.name)} sprite" tabindex="-1">${getGuestCardSpriteHtml(guestId)}</button>
            <span class="slot-stat slot-money">${guest.money}</span>
            ${renderAbilityBadge(guest)}
            <span class="slot-stat slot-points">${guest.points}</span>
        `;
        el.title = `${guest.name} - ${guest.desc}`;
        if (options.interactive !== false) {
            el.addEventListener('click', (e) => showTooltip(e, guestId, options));
        }
        return el;
    }

    function renderHouseGrid(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const slotsEl = document.getElementById(`${who}-slots`);
        slotsEl.innerHTML = '';
        const venue = Game.VENUES[player.venueId];

        const houseCapacity = Game.getHouseCapacity(venue, player);
        // Count occupied slots: house + arriving guest (cap to capacity for empties)
        const occupiedCount = Math.min(player.house.length, houseCapacity) + (player.arrivingGuest ? 1 : 0);
        
        // Render empty slots for remaining capacity
        for (let i = 0; i < houseCapacity - occupiedCount; i++) {
            const empty = document.createElement('div');
            empty.className = 'guest-slot empty-slot';
            slotsEl.appendChild(empty);
        }

        // Render oldest-to-newest but only up to capacity
        let guests = [...player.house].reverse();
        if (guests.length > houseCapacity) {
            guests = guests.slice(guests.length - houseCapacity);
        }
        guests.forEach((entry) => {
            const guestId = entry.guestId || entry;
            const slot = createGuestSlot(guestId, false, { interactive: false });
            if (who === 'player') {
                const instanceId = typeof entry === 'string' ? null : entry.instanceId;
                slot.dataset.slotSource = 'house';
                if (instanceId != null) slot.dataset.instanceId = String(instanceId);
                if (who === 'player' && instanceId != null && instanceId === playerFlashWindowInstanceId) slot.classList.add('just-entered');
                if (selectedGridGuest?.source === 'house' &&
                    selectedGridGuest.guestId === guestId &&
                    (selectedGridGuest.instanceId == null || selectedGridGuest.instanceId === instanceId)) {
                    slot.classList.add('selected');
                }
                slot.addEventListener('click', () => {
                    selectedGridGuest = { guestId, source: 'house', instanceId };
                    _lastGuestDetailKey = null;
                    refreshSelectedGridSlotVisual();
                    updateGuestDetail();
                    showTooltipForTarget(slot, guestId, { who: 'player', source: 'house', instanceId });
                });
            } else {
                slot.addEventListener('click', () => {
                    showTooltipForTarget(slot, guestId, { who: 'rival', source: 'house' });
                });
            }
            slotsEl.appendChild(slot);
        });

        // Render arriving guest as the rightmost/newest slot
        if (player.arrivingGuest) {
            const slot = createGuestSlot(player.arrivingGuest, false, { interactive: false });
            slot.classList.add('arriving-in-grid');
            if (who === 'player') {
                slot.dataset.slotSource = 'arriving';
                if (selectedGridGuest?.source === 'arriving' && selectedGridGuest.guestId === player.arrivingGuest) {
                    slot.classList.add('selected');
                }
                slot.addEventListener('click', () => {
                    selectedGridGuest = { guestId: player.arrivingGuest, source: 'arriving' };
                    _lastGuestDetailKey = null;
                    refreshSelectedGridSlotVisual();
                    updateGuestDetail();
                    showTooltipForTarget(slot, player.arrivingGuest, { who: 'player', source: 'arriving' });
                });
            } else {
                slot.addEventListener('click', () => {
                    showTooltipForTarget(slot, player.arrivingGuest, { who: 'rival', source: 'arriving' });
                });
            }
            slotsEl.appendChild(slot);
        }

        syncVenueActors(who);
    }

    function renderArrivingGuest(who) {
        const arrivingEl = document.getElementById(`${who}-arriving`);
        if (!arrivingEl) return;
        // Door-side arriving card intentionally hidden; arriving guest remains visible in the guest strip/detail panel.
        arrivingEl.innerHTML = '';
        arrivingEl.dataset.renderKey = '';
    }

    function updateVenueStatus(who) {
        const player = who === 'player' ? gameState.player : gameState.rival;
        const statusEl = document.getElementById(`${who}-status`);
        if (!statusEl) return;

        if (player.busted) {
            statusEl.textContent = 'BUSTED!';
            statusEl.className = 'venue-status busted';
        } else if (player.doorClosed) {
            statusEl.textContent = 'DOOR CLOSED';
            statusEl.className = 'venue-status closed';
        } else if (player.arrivingGuest) {
            statusEl.textContent = '';
            statusEl.className = 'venue-status';
        } else {
            statusEl.textContent = '';
            statusEl.className = 'venue-status';
        }
    }

    function animateDoorOpen(who) {
        const doorId = who === 'player' ? 'player-door-card' : 'rival-door-card';
        const doorEl = document.getElementById(doorId);
        if (!doorEl) return;
        doorEl.classList.remove('door-opening');
        void doorEl.offsetWidth; // reflow to restart animation
        doorEl.classList.add('door-opening');
        setTimeout(() => doorEl.classList.remove('door-opening'), 360);
    }

    function showExitStamp(who) {
        const exitId = who === 'player' ? 'player-exit-card' : 'rival-exit-card';
        const exitEl = document.getElementById(exitId);
        if (!exitEl) return;
        const stamp = document.createElement('span');
        stamp.className = 'exit-stamp';
        stamp.textContent = 'EXIT';
        exitEl.appendChild(stamp);
        setTimeout(() => stamp.remove(), 280);
    }

    function animateExitGuest(who, guestId) {
        if (Array.isArray(guestId)) {
            guestId.forEach((id) => animateExitGuest(who, id));
            return;
        }

        // Show exit stamp briefly
        showExitStamp(who);

        // Move matching venue actor to exit door before it disappears.
        // (syncVenueActors also enforces exits for removed actors as a fallback.)
        queueVenueActorExit(who, guestId);

        // Animate the grid card itself drifting left and fading out.
        let sourceSlot = guestId ? document.querySelector(`#${who}-slots .occupied-slot[data-guest-id="${guestId}"]`) : null;
        if (!sourceSlot) sourceSlot = document.querySelector(`#${who}-slots .occupied-slot`);
        if (!sourceSlot) return;

        const resolvedGuestId = guestId || sourceSlot.dataset.guestId;
        if (!resolvedGuestId || !Game.GUESTS[resolvedGuestId]) return;

        const ghost = createGuestSlot(resolvedGuestId, false);
        ghost.classList.add('exit-ghost');

        const sourceRect = sourceSlot.getBoundingClientRect();
        ghost.style.left = `${sourceRect.left}px`;
        ghost.style.top = `${sourceRect.top}px`;
        document.body.appendChild(ghost);

        requestAnimationFrame(() => {
            ghost.style.transform = 'translate(-56px, 0)';
            ghost.classList.add('leaving');
        });

        setTimeout(() => ghost.remove(), 380);
    }

    function getPlayerFlashWindowEntry() {
        if (!gameState || playerFlashWindowInstanceId == null) return null;
        return gameState.player.house.find((entry) => typeof entry !== 'string' && entry.instanceId === playerFlashWindowInstanceId) || null;
    }

    function isPlayerFlashAvailable() {
        const entry = getPlayerFlashWindowEntry();
        if (!entry) return false;
        const guest = Game.GUESTS[entry.guestId];
        return !!(guest?.ability && !entry.abilityUsed && !gameState.player.doorClosed && !gameState.player.busted);
    }

    function setGuestPhaseControls({ canAdmit = false, canClose = false, canFlash = false } = {}) {
        const entryDoors = [document.getElementById('player-door'), document.getElementById('player-door-card')].filter(Boolean);
        const exitDoors = [document.getElementById('player-exit'), document.getElementById('player-exit-card')].filter(Boolean);
        entryDoors.forEach((entryDoor) => {
            entryDoor.classList.toggle('door-action-disabled', !canAdmit);
            entryDoor.setAttribute('aria-disabled', canAdmit ? 'false' : 'true');
        });
        exitDoors.forEach((exitDoor) => {
            exitDoor.classList.toggle('door-action-disabled', !canClose);
            exitDoor.setAttribute('aria-disabled', canClose ? 'false' : 'true');
        });

        const flashButton = tooltipEl?.querySelector('#btn-tooltip-ability');
        if (flashButton) flashButton.disabled = !canFlash;
    }

    // === Guest Detail Panel ===
    function updateGuestDetail() {
        if (!gameState) return;
        const p = gameState.player;
        syncSelectedGridGuest();
        const selectedGuestId = selectedGridGuest?.guestId || p.arrivingGuest;
        const selectedGuestSource = selectedGridGuest?.source || 'arriving';
        refreshSelectedGridSlotVisual();
        // Avoid re-rendering if player's arriving state and visible stats haven't changed
        const key = `${p.arrivingGuest || ''}|${p.doorClosed}|${p.busted}|${p.heat}|${p.roundMoney}|${p.roundPoints}|${selectedGuestId || ''}|${selectedGuestSource}`;
        if (key === _lastGuestDetailKey) return;
        _lastGuestDetailKey = key;

        if (!p.arrivingGuest || p.doorClosed || p.busted) {
            setGuestPhaseControls({ canAdmit: false, canClose: false, canFlash: false });
            return;
        }

        const canUseSelectedAbility = isPlayerFlashAvailable();

        setGuestPhaseControls({ canAdmit: true, canClose: true, canFlash: canUseSelectedAbility });
    }

    // === Tooltip ===
    function showTooltipForTarget(target, guestId, options = {}) {
        if (!target) return;
        removeTooltip();
        const guest = Game.GUESTS[guestId];
        if (!guest) return;
        const el = document.createElement('div');
        el.className = 'guest-tooltip';

        const tooltipWho = options.who || 'rival';
        const canTriggerAbility = tooltipWho === 'player' && isPlayerFlashAvailable();

        let abilityHTML = '';
        if (guest.ability) {
            abilityHTML = `<div class="tt-ability">${guest.ability.icon} ${guest.ability.name}: ${guest.ability.desc}</div>`;
        }

        const abilityBtnHTML = tooltipWho === 'player'
            ? `<button class="btn btn-ability tt-ability-btn" id="btn-tooltip-ability" ${canTriggerAbility ? '' : 'disabled'}>Ability</button>`
            : '';

        el.innerHTML = `
            <div class="tt-name">${guest.emoji} ${guest.name}</div>
            <div class="tt-stats-row">
                <div class="tt-stats">
                    <span class="stat-money">💵${guest.money}</span>
                    <span class="stat-points">⭐${guest.points}</span>
                    <span class="stat-heat">🔥${guest.heat}</span>
                </div>
                ${abilityBtnHTML}
            </div>
            ${abilityHTML}
        `;

        document.body.appendChild(el);
        tooltipEl = el;

        // Position
        const rect = target.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 80;
        let top = rect.top - el.offsetHeight - 8;
        if (top < 10) top = rect.bottom + 8;
        if (left < 10) left = 10;
        if (left + el.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - el.offsetWidth - 10;
        }
        el.style.left = left + 'px';
        el.style.top = top + 'px';

        const tooltipAbilityBtn = el.querySelector('#btn-tooltip-ability');
        if (tooltipAbilityBtn) {
            tooltipAbilityBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                handleAbility();
            });
        }

        // Dismiss on click anywhere outside the tooltip
        // Defer listener attachment to allow current click to finish
        setTimeout(() => {
            const dismissTooltip = (clickEvent) => {
                // Guard against stale document listeners from previous tooltips.
                if (tooltipEl !== el) {
                    document.removeEventListener('click', dismissTooltip);
                    return;
                }
                if (!el.contains(clickEvent.target)) {
                    removeTooltip();
                    document.removeEventListener('click', dismissTooltip);
                }
            };
            document.addEventListener('click', dismissTooltip);
        }, 0);
    }

        function showTooltip(e, guestId, options = {}) {
        e.stopPropagation();
        showTooltipForTarget(e.currentTarget || e.target, guestId, options);
    }

    function removeTooltip() {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    }

    function showIconTooltip(e, text, sticky = false) {
        removeIconTooltip();
        const el = document.createElement('div');
        el.className = 'effect-tooltip';
        el.textContent = text;
        document.body.appendChild(el);
        iconTooltipEl = el;

        const target = e?.currentTarget || e?.target;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const left = Math.min(window.innerWidth - el.offsetWidth - 10, Math.max(10, rect.left - 10));
        const top = Math.max(10, rect.top - el.offsetHeight - 8);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;

        if (!sticky) {
            setTimeout(removeIconTooltip, 1600);
        }
    }

    function removeIconTooltip() {
        if (iconTooltipEl) {
            iconTooltipEl.remove();
            iconTooltipEl = null;
        }
    }


    function bindGuestTooltipHoldInteractions(el, guestId) {
        if (!el || !guestId) return;

        let pressTimer = null;
        let didLongPress = false;

        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        const onPressStart = (e) => {
            if (e.target.closest('.slot-emoji.has-ability')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            didLongPress = false;
            clearPressTimer();
            pressTimer = setTimeout(() => {
                showTooltipForTarget(el, guestId);
                didLongPress = true;
                pressTimer = null;
            }, 420);
        };

        el.addEventListener('pointerdown', onPressStart);
        el.addEventListener('pointerup', clearPressTimer);
        el.addEventListener('pointercancel', clearPressTimer);
        el.addEventListener('pointerleave', clearPressTimer);

        // Swallow the click that fires after a long-press so it doesn't buy immediately.
        el.addEventListener('click', (e) => {
            if (!didLongPress) return;
            e.preventDefault();
            e.stopPropagation();
            didLongPress = false;
        }, true);
    }

    function bindAbilityTooltipInteractions(el, message) {
        if (!el || !message) return;

        let pressTimer = null;
        let didLongPress = false;

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (didLongPress) {
                didLongPress = false;
                return;
            }
            showIconTooltip(e, message, true);
        });

        el.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            didLongPress = false;
            pressTimer = setTimeout(() => {
                showIconTooltip(e, message, true);
                didLongPress = true;
                pressTimer = null;
            }, 420);
        }, { passive: true });

        const clearPressTimer = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        el.addEventListener('touchend', (e) => {
            e.stopPropagation();
            clearPressTimer();
        }, { passive: true });
        el.addEventListener('touchcancel', clearPressTimer, { passive: true });
        el.addEventListener('touchmove', clearPressTimer, { passive: true });
    }

    function getQueuedGuestPreview(player, count) {
        if (!player || !Array.isArray(player.roundDeck) || count <= 0) return [];
        const previewCount = Math.min(count, player.roundDeck.length);
        const ids = [];
        for (let i = player.roundDeck.length - 1; i >= player.roundDeck.length - previewCount; i--) {
            ids.push(player.roundDeck[i]);
        }
        return ids;
    }

    function clearRevealDoorIntel(who = null) {
        if (who) {
            revealDoorIntel[who] = null;
            renderRevealDoorIntel(who);
            return;
        }
        revealDoorIntel.player = null;
        revealDoorIntel.rival = null;
        renderRevealDoorIntel('player');
        renderRevealDoorIntel('rival');
    }

    function setRevealDoorIntel(who, guestIds) {
        const ids = Array.isArray(guestIds) ? guestIds.filter(Boolean) : [];
        if (!ids.length) {
            clearRevealDoorIntel(who);
            return;
        }
        revealDoorIntel[who] = {
            count: ids.length,
            index: 0,
        };
        renderRevealDoorIntel(who);
    }

    function renderRevealDoorIntel(who) {
        if (!gameState) return;
        const doorEl = document.getElementById(who === 'player' ? 'player-door-card' : `${who}-door`);
        if (!doorEl) return;

        const player = who === 'player' ? gameState.player : gameState.rival;
        const intel = revealDoorIntel[who];

        const existing = doorEl.querySelector('.reveal-door-overlay');
        if (existing) existing.remove();

        if (!intel) return;

        const queued = getQueuedGuestPreview(player, intel.count);
        if (!queued.length) {
            clearRevealDoorIntel(who);
            return;
        }

        intel.index = intel.index % queued.length;
        const shownIndex = intel.index;
        const guestId = queued[shownIndex];
        const guest = Game.GUESTS[guestId];
        if (!guest) return;

        const overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.className = 'reveal-door-overlay';
        overlay.title = `${guest.name} (${shownIndex + 1}/${queued.length})`;

        const card = createGuestSlot(guestId, false, { interactive: false });
        card.classList.add('reveal-door-card');

        const idx = document.createElement('span');
        idx.className = 'reveal-door-index';
        idx.textContent = `${shownIndex + 1}/${queued.length}`;

        overlay.appendChild(card);
        overlay.appendChild(idx);

        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (queued.length <= 1) return;
            intel.index = (intel.index + 1) % queued.length;
            renderRevealDoorIntel(who);
        });

        doorEl.appendChild(overlay);
    }

    // === Center Feedback ===
    function showFeedback(text, type, duration) {
        const el = document.getElementById('center-feedback');
        if (!el) return;

        const popupDuration = Math.max(1400, duration || 2200);
        el.style.setProperty('--feedback-duration', `${popupDuration}ms`);
        el.innerHTML = `<div class="feedback-msg ${type || ''}">${text}</div>`;

        setTimeout(() => {
            if (el.querySelector('.feedback-msg')?.textContent === text) {
                el.innerHTML = '';
            }
        }, popupDuration + 120);
    }

    // === Guest Phase Actions ===
    function runAdmit(actor = 'player') {
        if (!gameState || gameState.phase !== 'guest') return;
        const { self, opponent, selfKey } = getActorState(actor);
        if (!self.arrivingGuest || self.doorClosed || self.busted) return;

        const venue = Game.VENUES[self.venueId];
        // Snapshot player's visible state so we can avoid unnecessary re-renders
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const result = Game.admitGuest(self, venue, opponent, Game.VENUES[opponent.venueId]);
        if (!result) return;
        if (selfKey === 'player') {
            playerFlashWindowInstanceId = typeof self.house[0] === 'object' ? self.house[0].instanceId : null;
        }

        // Animate entry door opening
        animateDoorOpen(selfKey);

        if (result.pushedOut && result.pushedOut.length) {
            result.pushedOut.forEach(id => animateExitGuest(selfKey, id));
        }
        if (result.pendingOut) {
            animateExitGuest(selfKey, result.pendingOut);
        }
        renderHouseGrid(selfKey);
        renderArrivingGuest(selfKey);
        // Only refresh player detail if the action was by the player, or
        // if the opponent's action changed the player's visible state.
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateVenueStatus(selfKey);
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        if (result.busted) {
            document.getElementById(`${selfKey}-area`).classList.add('bust-flash');
            showFeedback('YOU BUSTED!', 'bust', 3000);
            setTimeout(() => {
                document.getElementById(`${selfKey}-area`).classList.remove('bust-flash');
            }, 500);
        }

        checkGuestPhaseDone();
        publishState();
    }

    function handleAdmit() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'admit', actor: 'rival' });
            return;
        }
        runAdmit('player');
    }

    function runAbility(actor = 'player') {
        if (!gameState || gameState.phase !== 'guest') return;
        const { self, opponent, selfKey, opponentKey } = getActorState(actor);
        if (self.doorClosed || self.busted) return;

        const selfVenue = Game.VENUES[self.venueId];
        const opponentVenue = Game.VENUES[opponent.venueId];
        // Snapshot player's visible state
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const flashEntry = selfKey === 'player' ? getPlayerFlashWindowEntry() : null;
        const selectedForAbility = selfKey === 'player'
            ? (flashEntry ? { source: 'house', guestId: flashEntry.guestId, instanceId: flashEntry.instanceId } : null)
            : null;
        const result = Game.activateAbility(self, opponent, selfVenue, opponentVenue, selectedForAbility);
        if (!result) return;

        showFeedback(`${result.ability.name}: ${result.effects.join(', ')}`, 'disruption', 2500);
        if (result.revealedGuests) setRevealDoorIntel(selfKey, result.revealedGuests);

        if (result.pushedOut) {
            animateExitGuest(selfKey, result.pushedOut);
        }
        if (result.pendingOut) {
            animateExitGuest(selfKey, result.pendingOut);
        }

        renderHouseGrid(selfKey);
        renderHouseGrid(opponentKey);
        renderArrivingGuest(selfKey);
        // Only re-render the opponent's arriving area if the player's visible arriving state changed
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) renderArrivingGuest(opponentKey);
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateVenueStatus(selfKey);
        updateVenueStatus(opponentKey);
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        if (opponent.busted) {
            document.getElementById(`${opponentKey}-area`).classList.add('bust-flash');
            setTimeout(() => {
                document.getElementById(`${opponentKey}-area`).classList.remove('bust-flash');
            }, 500);
        }

        checkGuestPhaseDone();
        publishState();
    }

    function handleAbility() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'ability', actor: 'rival' });
            return;
        }
        runAbility('player');
    }

    function runCloseDoor(actor = 'player') {
        if (!gameState || gameState.phase !== 'guest') return;
        const { self, opponent, selfKey } = getActorState(actor);
        if (self.doorClosed || self.busted) return;

        const venue = Game.VENUES[self.venueId];
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const result = Game.closeDoor(self, venue, opponent);
        if (selfKey === 'player') playerFlashWindowInstanceId = null;
        if (result?.pushedOut && result.pushedOut.length) {
            result.pushedOut.forEach(id => animateExitGuest(selfKey, id));
        }
        renderHouseGrid(selfKey);
        renderArrivingGuest(selfKey);
        if (selfKey === 'player' || JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateVenueStatus(selfKey);
        updateHUD();
        removeTooltip();
        removeIconTooltip();

        showFeedback('You closed the door safely', 'money', 2000);
        checkGuestPhaseDone();
        publishState();
    }

    function handleCloseDoor() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'close', actor: 'rival' });
            return;
        }
        runCloseDoor('player');
    }

    // === AI Guest Phase ===
    function startAITimer() {
        if (isMultiplayer()) return;
        if (aiTimerId) clearInterval(aiTimerId);
        const baseDelay = 1200;
        const variance = 600;

        function aiTick() {
            if (!gameState || gameState.phase !== 'guest') {
                clearInterval(aiTimerId);
                aiTimerId = null;
                return;
            }

            const r = gameState.rival;
            if (r.phaseComplete) {
                clearInterval(aiTimerId);
                aiTimerId = null;
                checkGuestPhaseDone();
                return;
            }

            const action = AI.decideGuestAction(gameState);
            if (!action) {
                // Defensive fallback: if rival still has an active turn, bank safely.
                if (!r.phaseComplete && !r.doorClosed && !r.busted) {
                    executeAIAction('close');
                    return;
                }
                clearInterval(aiTimerId);
                aiTimerId = null;
                checkGuestPhaseDone();
                return;
            }

            executeAIAction(action);
        }

        aiTimerId = setInterval(aiTick, baseDelay + Math.random() * variance);
    }

    function executeAIAction(action) {
        const r = gameState.rival;
        const p = gameState.player;
        const rVenue = Game.VENUES[r.venueId];
        const pVenue = Game.VENUES[p.venueId];
        const playerSnapshot = {
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        };
        const rivalHouseSnapshot = gameState.rival.house.length;

        if (action === 'admit') {
            const result = Game.admitGuest(r, rVenue, gameState.player, Game.VENUES[gameState.player.venueId]);
            if (!result) return;

            if (result.pushedOut && result.pushedOut.length) {
                result.pushedOut.forEach(id => animateExitGuest('rival', id));
            }
            if (result.pendingOut) {
                animateExitGuest('rival', result.pendingOut);
            }
            // Only re-render rival grid if their house visibly changed
            if (gameState.rival.house.length !== rivalHouseSnapshot) {
                renderHouseGrid('rival');
            }

            if (result.busted) {
                document.getElementById('rival-area').classList.add('bust-flash');
                showFeedback(`${r.name} BUSTED!`, 'bust', 2500);
                setTimeout(() => {
                    document.getElementById('rival-area').classList.remove('bust-flash');
                }, 500);
            }
        } else if (action === 'ability') {
            const result = Game.activateAbility(r, p, rVenue, pVenue);
            if (!result) return;
            showFeedback(`${r.name}: \u26A1 ${result.ability.name}`, 'disruption', 2500);
            if (result.revealedGuests) setRevealDoorIntel('rival', result.revealedGuests);
            if (result.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            if (result.pendingOut) {
                animateExitGuest('rival', result.pendingOut);
            }

            // Check if player was busted
            if (p.busted) {
                document.getElementById('player-area').classList.add('bust-flash');
                updateGuestDetail();
                updateVenueStatus('player');
                setTimeout(() => {
                    document.getElementById('player-area').classList.remove('bust-flash');
                }, 500);
            }

            // Only re-render player grid if their visible state actually changed
            if (JSON.stringify(playerSnapshot) !== JSON.stringify({
                arrivingGuest: gameState.player.arrivingGuest,
                doorClosed: gameState.player.doorClosed,
                busted: gameState.player.busted,
                heat: gameState.player.heat,
                roundMoney: gameState.player.roundMoney,
                roundPoints: gameState.player.roundPoints,
            })) renderHouseGrid('player');
            // Only re-render rival grid if their house visibly changed
            if (gameState.rival.house.length !== rivalHouseSnapshot) {
                renderHouseGrid('rival');
            }
        } else if (action === 'close') {
            const result = Game.closeDoor(r, rVenue, gameState.player);
            if (result?.pushedOut) {
                animateExitGuest('rival', result.pushedOut);
            }
            // Only re-render if house changed
            if (gameState.rival.house.length !== rivalHouseSnapshot) {
                renderHouseGrid('rival');
            }
            showFeedback(`${r.name} closed their door`, 'money', 2000);
        }

        renderArrivingGuest('rival');
        // Only update player's arriving area if their visible arriving state changed
        if (JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) renderArrivingGuest('player');
        updateVenueStatus('rival');
        // Refresh player UI only if their visible state changed
        updateVenueStatus('player');
        if (JSON.stringify(playerSnapshot) !== JSON.stringify({
            arrivingGuest: gameState.player.arrivingGuest,
            doorClosed: gameState.player.doorClosed,
            busted: gameState.player.busted,
            heat: gameState.player.heat,
            roundMoney: gameState.player.roundMoney,
            roundPoints: gameState.player.roundPoints,
        })) updateGuestDetail();
        updateHUD();
    }

    // === Phase Transitions ===
    function checkGuestPhaseDone() {
        if (!gameState || gameState.phase !== 'guest') return;
        if (!Game.bothDone(gameState)) return;

        // Both players done - stop AI timer
        if (aiTimerId) { clearInterval(aiTimerId); aiTimerId = null; }

        // Small delay for last animation
        setTimeout(showRoundResults, 600);
        publishState();
    }

    function showRoundResults() {
        Game.endGuestPhase(gameState);
        updateHUD();

        const p = gameState.player;
        const r = gameState.rival;
        const isFinalRound = gameState.round >= gameState.totalRounds;

        let html = `<h3>Round ${gameState.round} Results</h3>`;

        // Player results
        html += `<div class="results-row"><span class="label player-color">${p.name}</span></div>`;
        html += `<div class="results-row"><span class="label">\u{1F4B5} Money earned</span><span class="value ${p.busted ? 'bust-value' : 'positive'}">+$${p.roundMoney}${p.busted ? ' (busted)' : ''}</span></div>`;
        html += `<div class="results-row"><span class="label">\u2B50 Points earned</span><span class="value ${p.busted ? 'bust-value' : 'positive'}">+${p.roundPoints}${p.busted ? ' (busted)' : ''}</span></div>`;

        html += '<div class="results-divider"></div>';

        // Rival results
        html += `<div class="results-row"><span class="label rival-color">${r.name}</span></div>`;
        html += `<div class="results-row"><span class="label">\u{1F4B5} Money earned</span><span class="value ${r.busted ? 'bust-value' : 'positive'}">+$${r.roundMoney}${r.busted ? ' (busted)' : ''}</span></div>`;
        html += `<div class="results-row"><span class="label">\u2B50 Points earned</span><span class="value ${r.busted ? 'bust-value' : 'positive'}">+${r.roundPoints}${r.busted ? ' (busted)' : ''}</span></div>`;

        document.getElementById('results-content').innerHTML = html;
        document.getElementById('btn-next-phase').textContent = isFinalRound ? 'Final Results' : 'Continue to Shop';

        // Show results panel
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = '';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';

        if (!isFinalRound) {
            // Enter buy phase immediately when results appear, but keep results visible
            // until player confirms and opens the shop panel.
            startBuyPhase({ deferPanel: true });
            setPhoneBuyPhaseLayout(true);
        }

        publishState();
    }

    function handleNextPhase() {
        const isFinalRound = gameState.round >= gameState.totalRounds;

        if (isFinalRound) {
            Game.endBuyPhase(gameState);
            showGameOver();
        } else {
            showBuyPanel();
        }
    }

    // === Buy Phase ===
    function startBuyPhase(options = {}) {
        const deferPanel = !!options.deferPanel;
        gameState.phase = 'buy';
        updateHUD();

        // Generate markets
        const playerMarket = Game.getMarket(gameState.player.venueId);
        const rivalMarket = Game.getMarket(gameState.rival.venueId);

        if (!isMultiplayer()) {
            const aiBuys = AI.decideBuyPhaseActions(gameState, rivalMarket);
            aiBuys.forEach(guestId => Game.buyGuest(gameState.rival, guestId));

            if (aiBuys.length > 0) {
                const names = aiBuys.map(id => Game.GUESTS[id].name).join(', ');
                showFeedback(`${gameState.rival.name} bought: ${names}`, 'disruption', 3000);
            }
        }

        currentMarket = isMultiplayer()
            ? { player: playerMarket, rival: rivalMarket }
            : playerMarket;
        renderShop();

        if (!deferPanel) {
            showBuyPanel();
        }
    }

    function showBuyPanel() {
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = '';
        document.getElementById('gameover-panel').style.display = 'none';
        setPhoneBuyPhaseLayout(true);
    }

    function renderShopCard(guestId, cost, canAfford, container) {
        const guest = Game.GUESTS[guestId];

        const wrapper = document.createElement('div');
        wrapper.className = 'shop-card-wrapper' + (canAfford ? '' : ' disabled');

        const costLabel = document.createElement('div');
        costLabel.className = 'shop-card-cost';
        costLabel.textContent = '$' + cost;
        wrapper.appendChild(costLabel);

        const slot = createGuestSlot(guestId, false, { interactive: false });
        slot.removeAttribute('title');
        wrapper.appendChild(slot);

        if (guest.isShopItem) {
            const nameLabel = document.createElement('div');
            nameLabel.className = 'shop-card-name';
            nameLabel.textContent = guest.name;
            slot.appendChild(nameLabel);
        }

        bindGuestTooltipHoldInteractions(wrapper, guestId);

        const slotEmoji = slot.querySelector('.slot-emoji');
        if (slotEmoji && guest.ability) {
            const abilityMessage = `${guest.ability.name}: ${guest.ability.desc}`;
            bindAbilityTooltipInteractions(slotEmoji, abilityMessage);
        }

        if (canAfford) {
            wrapper.addEventListener('click', () => {
                if (isMultiplayer() && multiplayerRole === 'join') {
                    multiplayerSession?.publish('request-action', { action: 'buy', actor: 'rival', guestId });
                    showFeedback(`Bought ${guest.name}!`, 'money', 1500);
                    return;
                }
                if (Game.buyGuest(gameState.player, guestId)) {
                    showFeedback(`Bought ${guest.name}!`, 'money', 1500);
                    renderShop();
                    updateHUD();
                    publishState();
                }
            });
        }

        container.appendChild(wrapper);
    }

    function renderShop() {
        const shopMoney = document.getElementById('shop-money');
        const shopPlayer = gameState.player;
        shopMoney.textContent = `\u{1F4B5} $${shopPlayer.money}`;

        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '';
        const upgradesPanel = document.getElementById('shop-upgrades');
        upgradesPanel.innerHTML = '';

        const readOnlyShop = false;

        // Sort guest cards by cost (cheapest first)
        const market = getLocalMarket().slice();
        market.sort((a, b) => Game.GUESTS[a].cost - Game.GUESTS[b].cost);

        // Render guest cards in the main grid
        market.forEach(guestId => {
            const guest = Game.GUESTS[guestId];
            const cost = guest.cost;
            const canAfford = !readOnlyShop && shopPlayer.money >= cost;
            renderShopCard(guestId, cost, canAfford, grid);
        });

        // Render upgrade items in the sidebar
        const upgradeLabel = document.createElement('div');
        upgradeLabel.className = 'shop-upgrades-label';
        upgradeLabel.textContent = 'UPGRADES';

        ['slotIncrease', 'heatCapIncrease'].forEach(guestId => {
            const guest = Game.GUESTS[guestId];
            let cost = guest.cost;
            if (guestId === 'slotIncrease') {
                cost = 3 + (shopPlayer.shopItemPurchases.slotIncrease * 2);
            } else if (guestId === 'heatCapIncrease') {
                cost = 4 + (shopPlayer.shopItemPurchases.heatCapIncrease * 3);
            }
            const canAfford = !readOnlyShop && shopPlayer.money >= cost;
            renderShopCard(guestId, cost, canAfford, upgradesPanel);
        });
        upgradesPanel.appendChild(upgradeLabel);
    }

    function runDoneShopping(actor = 'player') {
        if (actor === 'rival' && isMultiplayer()) {
            gameState.rival.phaseComplete = true;
            publishState();
            return;
        }

        Game.endBuyPhase(gameState);
        setPhoneBuyPhaseLayout(false);

        if (gameState.phase === 'gameover') {
            showGameOver();
        } else {
            startNewRound();
        }
        publishState();
    }

    function runBuyGuest(actor, guestId) {
        if (!gameState || gameState.phase !== 'buy' || !guestId) return;
        const { self } = getActorState(actor);
        if (Game.buyGuest(self, guestId)) {
            updateHUD();
            publishState();
        }
    }

    function handleDoneShopping() {
        if (isMultiplayer() && multiplayerRole === 'join') {
            multiplayerSession?.publish('request-action', { action: 'done-shopping', actor: 'rival' });
            showFeedback('Waiting for host to continue…', 'points', 1500);
            return;
        }

        runDoneShopping('player');
    }

    // === Game Flow ===
    function startGame(name, venueType, totalRounds, options = {}) {
        Renderer.resetAnimState();

        // Pick rival
        const venueKeys = Object.keys(Game.VENUES).filter(k => k !== venueType);
        const rivalVenue = options.rivalVenue || venueKeys[Math.floor(Math.random() * venueKeys.length)];
        const rivalName = options.rivalName || RIVAL_NAMES[Math.floor(Math.random() * RIVAL_NAMES.length)];

        gameState = Game.createGameState(name, venueType, rivalName, rivalVenue, totalRounds);
        clearVenueActors();

        // Override player deck with the loadout deck
        if (loadoutState) {
            gameState.player.fullDeck = [...loadoutState.deck];
            gameState.player.guestList = [...loadoutState.guestList];
        }
        if (options.rivalDeck?.length) gameState.rival.fullDeck = [...options.rivalDeck];
        if (options.rivalGuestList?.length) gameState.rival.guestList = [...options.rivalGuestList];

        switchScreen('game');
        startNewRound();
    }

    function startNewRound() {
        Game.startGuestPhase(gameState);
        clearRevealDoorIntel();
        playerFlashWindowInstanceId = null;
        setPhoneBuyPhaseLayout(false);

        showFeedback(`ROUND ${gameState.round}`, 'points', 1500);

        // Reset UI
        document.getElementById('guest-phase-panel').style.display = '';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = 'none';

        renderHouseGrid('player');
        renderHouseGrid('rival');
        renderArrivingGuest('player');
        renderArrivingGuest('rival');
        updateGuestDetail();
        updateVenueStatus('player');
        updateVenueStatus('rival');
        updateHUD();
        setPartyView('player', false);

        // Start AI
        setTimeout(() => startAITimer(), 800);
        publishState();
    }

    // === Game Over ===
    function showGameOver() {
        const won = gameState.winner === 'player';
        const p = gameState.player;
        const r = gameState.rival;

        document.getElementById('hud-phase').textContent = 'GAME OVER';

        const title = document.getElementById('gameover-title');
        title.textContent = won ? 'Victory!' : 'Defeated!';
        title.className = won ? 'win' : 'lose';

        document.getElementById('gameover-message').textContent = won
            ? `${p.name} dominated the scene! Congratulations!`
            : `${r.name} outscored you. Better luck next time!`;

        document.getElementById('gameover-stats').innerHTML = `
            <div class="gameover-stat-card">
                <div class="stat-label">Your Points</div>
                <div class="stat-value player-color">${p.points}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Rival Points</div>
                <div class="stat-value rival-color">${r.points}</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Your Deck</div>
                <div class="stat-value">${p.fullDeck.length} guests</div>
            </div>
            <div class="gameover-stat-card">
                <div class="stat-label">Rival Deck</div>
                <div class="stat-value">${r.fullDeck.length} guests</div>
            </div>
        `;

        // Show game over panel
        document.getElementById('guest-phase-panel').style.display = 'none';
        document.getElementById('round-results-panel').style.display = 'none';
        document.getElementById('buy-phase-panel').style.display = 'none';
        document.getElementById('gameover-panel').style.display = '';

        startGameOverAnim(won);
    }

    // === Loadout Management ===
    function getGuestListsForVenue(venueId) {
        return Object.entries(Game.GUEST_LISTS).filter(([, list]) => list.venueId === venueId);
    }

    function getAllDecks() {
        return Object.entries(Game.DECKS);
    }

    function getDefaultDeckId() {
        const decks = getAllDecks();
        return decks.length ? decks[0][0] : null;
    }

    function applyDeck(deckId) {
        const deck = Game.DECKS[deckId];
        if (!deck) return;
        loadoutState.selectedDeckId = deckId;
        loadoutState.previewDeckId = deckId;
        loadoutState.deck = [...deck.guests];
    }

    function getDefaultGuestListId(venueId) {
        const lists = getGuestListsForVenue(venueId);
        return lists.length ? lists[0][0] : null;
    }

    function applyGuestList(listId) {
        const list = Game.GUEST_LISTS[listId];
        if (!list) return;
        loadoutState.selectedGuestListId = listId;
        loadoutState.previewGuestListId = listId;
        loadoutState.guestList = [...list.guests];
    }

    function initLoadout() {
        const defaultVenue = 'velvetRoom';
        const defaultDeckId = getDefaultDeckId();
        const defaultGuestListId = getDefaultGuestListId(defaultVenue);
        loadoutState = {
            venueId: defaultVenue,
            deck: defaultDeckId ? [...Game.DECKS[defaultDeckId].guests] : [...Game.VENUES[defaultVenue].startingDeck],
            inventory: [...Game.VENUES[defaultVenue].market],
            selectedDeckId: defaultDeckId,
            previewDeckId: defaultDeckId,
            selectedGuestListId: defaultGuestListId,
            previewGuestListId: defaultGuestListId,
            guestList: defaultGuestListId ? [...Game.GUEST_LISTS[defaultGuestListId].guests] : [...Game.VENUES[defaultVenue].startingDeck],
        };
        selectedVenueType = defaultVenue;
        renderLoadout();
    }

    function renderLoadout() {
        renderLoadoutVenue();
        renderLoadoutDeck();
        renderLoadoutGuestList();
        checkStartEnabled();
    }

    function renderLoadoutVenue() {
        const venue = Game.VENUES[loadoutState.venueId];
        const venueNameEl = document.getElementById('loadout-venue-name');
        if (venueNameEl) venueNameEl.textContent = venue.name;
        const body = document.getElementById('loadout-venue-body');
        body.innerHTML = `
            <div class="loadout-venue-icon">${venue.emoji}</div>
            <div class="loadout-venue-name">${venue.name}</div>
            <div class="loadout-venue-desc">${venue.desc}</div>
            <div class="loadout-venue-stats">
                <span class="stat-tag">Slots: ${Math.max(0, venue.gridSize)}</span>
                <span class="stat-tag">Bust: ${venue.bustThreshold}</span>
                <span class="stat-tag">${VENUE_STYLE_LABEL[venue.style]}</span>
            </div>
            <div class="loadout-venue-pool">${VENUE_POOL_DESC[loadoutState.venueId]}</div>
        `;
    }

    function renderLoadoutDeck() {
        const body = document.getElementById('loadout-deck-body');
        const count = loadoutState.deck.length;
        const valid = count >= MIN_DECK_SIZE;
        const selectedDeck = Game.DECKS[loadoutState.selectedDeckId];
        const deckName = selectedDeck ? selectedDeck.name : `${count} card${count !== 1 ? 's' : ''}`;

        const deckNameEl = document.getElementById('loadout-deck-name');
        if (deckNameEl) deckNameEl.textContent = deckName;

        body.innerHTML = `
            <div class="loadout-deck-preview-grid" id="loadout-deck-preview-grid"></div>
            ${!valid ? `<div class="loadout-deck-warning">Need at least ${MIN_DECK_SIZE} cards</div>` : ''}
        `;
        renderLoadoutGuestCards('loadout-deck-preview-grid', loadoutState.deck);
    }

    function renderLoadoutGuestList() {
        const body = document.getElementById('loadout-guest-list-body');
        const count = loadoutState.guestList.length;
        const valid = count >= MIN_DECK_SIZE;
        const selectedList = Game.GUEST_LISTS[loadoutState.selectedGuestListId];
        const guestListName = selectedList ? selectedList.name : 'Custom Guest List';

        const guestListNameEl = document.getElementById('loadout-guest-list-name');
        if (guestListNameEl) guestListNameEl.textContent = guestListName;

        body.innerHTML = `
            <div class="loadout-deck-preview-grid" id="loadout-guest-list-preview-grid"></div>
            ${!valid ? `<div class="loadout-deck-warning">Need at least ${MIN_DECK_SIZE} cards</div>` : ''}
        `;
                renderLoadoutGuestCards('loadout-guest-list-preview-grid', loadoutState.guestList);
    }

    function renderLoadoutGuestCards(containerId, guests) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        guests.forEach((guestId) => {
            const slot = createGuestSlot(guestId, false, { interactive: false });
            slot.classList.add('loadout-preview-card');
            container.appendChild(slot);
        });
    }

    function openVenueSelect() {
        const overlay = document.getElementById('venue-select-overlay');
        const grid = document.getElementById('venue-select-grid');

        grid.innerHTML = '';
        Object.entries(Game.VENUES).forEach(([id, venue]) => {
            const isEquipped = id === loadoutState.venueId;
            const card = document.createElement('div');
            card.className = 'venue-type-card' + (isEquipped ? ' selected' : '');
            card.dataset.type = id;
            card.innerHTML = `
                <div class="venue-type-emoji">${venue.emoji}</div>
                <div>
                    <h3>${venue.name}${isEquipped ? ' <span class="equipped-badge">EQUIPPED</span>' : ''}</h3>
                    <p>${venue.desc}</p>
                    <div class="venue-stats-preview">
                        <span class="stat-tag">Slots: ${Math.max(0, venue.gridSize)}</span>
                        <span class="stat-tag">Bust: ${venue.bustThreshold}</span>
                        <span class="stat-tag">${VENUE_STYLE_LABEL[venue.style]}</span>
                    </div>
                    <div class="venue-select-pool">${VENUE_POOL_DESC[id]}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (id !== loadoutState.venueId) {
                    loadoutState.venueId = id;
                    loadoutState.inventory = [...venue.market];
                    applyGuestList(getDefaultGuestListId(id));
                    selectedVenueType = id;
                }
                closeVenueSelect();
                renderLoadout();
            });

            grid.appendChild(card);
        });

        overlay.style.display = '';
    }

    function closeVenueSelect() {
        document.getElementById('venue-select-overlay').style.display = 'none';
    }

    function openDeckManage() {
        document.getElementById('deck-manage-overlay').style.display = '';
        renderDeckManage();
    }

    function closeDeckManage() {
        document.getElementById('deck-manage-overlay').style.display = 'none';
        renderLoadout();
    }

    function openGuestListManage() {
        document.getElementById('guest-list-manage-overlay').style.display = '';
        renderGuestListManage();
    }

    function closeGuestListManage() {
        document.getElementById('guest-list-manage-overlay').style.display = 'none';
        renderLoadout();
    }

    function renderDeckManage() {
        const presetsGrid = document.getElementById('deck-presets-grid');
        const badge = document.getElementById('deck-size-badge');
        const decks = getAllDecks();

        badge.textContent = `${decks.length} presets`;
        badge.className = 'deck-size-badge';

        presetsGrid.innerHTML = '';
        decks.forEach(([id, deck]) => {
            const card = document.createElement('div');
            const selected = id === loadoutState.selectedDeckId;
            card.className = 'venue-type-card' + (selected ? ' selected' : '');
            const emojis = deck.guests.map(g => Game.GUESTS[g].emoji).join('');
            card.innerHTML = `
                <div class="guest-list-card-leading">
                    ${selected ? '<span class="equipped-badge">EQUIPPED</span>' : ''}
                    <div class="venue-type-emoji">🃏</div>
                </div>
                <div>
                    <h3>${deck.name}</h3>
                    <p>${deck.description}</p>
                    <div class="venue-stats-preview">
                        <span class="stat-tag">${deck.guests.length} guests</span>
                        <span class="guest-list-card-emojis">${emojis}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                applyDeck(id);
                renderDeckManage();
                checkStartEnabled();
            });
            presetsGrid.appendChild(card);
        });

        renderDeckPreview(loadoutState.selectedDeckId);
    }

    function createDeckManageCard(guestId) {
        const guest = Game.GUESTS[guestId];
        const wrapper = document.createElement('div');
        wrapper.className = 'deck-manage-card';

        const nameEl = document.createElement('div');
        nameEl.className = 'deck-card-name' + (guest.ability ? ' has-ability' : '');
        nameEl.textContent = guest.name;
        wrapper.appendChild(nameEl);

        const slot = createGuestSlot(guestId, false, { interactive: false });
        wrapper.appendChild(slot);

        return wrapper;
    }

    function renderGuestListPreview(listId) {
        const previewGrid = document.getElementById('guest-list-preview-grid');
        const previewEmpty = document.getElementById('guest-list-preview-empty');
        const list = Game.GUEST_LISTS[listId];

        previewGrid.innerHTML = '';
        if (!list) {
            previewEmpty.style.display = '';
            return;
        }

        previewEmpty.style.display = 'none';
        list.guests.forEach((guestId) => {
            const card = createDeckManageCard(guestId);
            card.addEventListener('click', () => showGuestAbilityPopup(guestId));
            previewGrid.appendChild(card);
        });
    }

    function renderDeckPreview(deckId) {
        const previewGrid = document.getElementById('deck-preview-grid');
        const previewEmpty = document.getElementById('deck-preview-empty');
        const deck = Game.DECKS[deckId];

        previewGrid.innerHTML = '';
        if (!deck) {
            previewEmpty.style.display = '';
            return;
        }

        previewEmpty.style.display = 'none';
        deck.guests.forEach((guestId) => {
            const card = createDeckManageCard(guestId);
            card.addEventListener('click', () => showGuestAbilityPopup(guestId));
            previewGrid.appendChild(card);
        });
    }

    function closeGuestAbilityPopup() {
        if (guestAbilityPopupEl) {
            guestAbilityPopupEl.remove();
            guestAbilityPopupEl = null;
        }
        if (guestAbilityPopupBackdropEl) {
            guestAbilityPopupBackdropEl.remove();
            guestAbilityPopupBackdropEl = null;
        }
    }

    function showGuestAbilityPopup(guestId) {
        const guest = Game.GUESTS[guestId];
        if (!guest) return;

        closeGuestAbilityPopup();

        guestAbilityPopupBackdropEl = document.createElement('button');
        guestAbilityPopupBackdropEl.type = 'button';
        guestAbilityPopupBackdropEl.className = 'guest-ability-popup-backdrop';
        guestAbilityPopupBackdropEl.setAttribute('aria-label', 'Close guest ability popup');
        guestAbilityPopupBackdropEl.addEventListener('click', closeGuestAbilityPopup);

        guestAbilityPopupEl = document.createElement('div');
        guestAbilityPopupEl.className = 'guest-ability-popup';

        const abilityHtml = guest.ability
            ? `<div class="guest-ability-popup-title">${guest.ability.icon} ${guest.ability.name}</div>
               <div class="guest-ability-popup-desc">${guest.ability.desc}</div>`
            : '<div class="guest-ability-popup-desc">No special ability.</div>';

        guestAbilityPopupEl.innerHTML = `
            <button type="button" class="guest-ability-popup-close" aria-label="Close">✕</button>
            <div class="guest-ability-popup-name">${guest.emoji} ${guest.name}</div>
            ${abilityHtml}
        `;

        const closeBtn = guestAbilityPopupEl.querySelector('.guest-ability-popup-close');
        if (closeBtn) closeBtn.addEventListener('click', closeGuestAbilityPopup);

        document.body.appendChild(guestAbilityPopupBackdropEl);
        document.body.appendChild(guestAbilityPopupEl);
    }

    function renderGuestListManage() {
        const presetsGrid = document.getElementById('guest-list-presets-grid');
        const badge = document.getElementById('guest-list-size-badge');
        const lists = getGuestListsForVenue(loadoutState.venueId);

        badge.textContent = `${lists.length} presets`;
        badge.className = 'deck-size-badge';

        presetsGrid.innerHTML = '';
        lists.forEach(([id, list]) => {
            const card = document.createElement('div');
            const selected = id === loadoutState.selectedGuestListId;
            card.className = 'venue-type-card' + (selected ? ' selected' : '');
            const emojis = list.guests.map(g => Game.GUESTS[g].emoji).join('');
            card.innerHTML = `
                <div class="guest-list-card-leading">
                    ${selected ? '<span class="equipped-badge">EQUIPPED</span>' : ''}
                    <div class="venue-type-emoji">📜</div>
                </div>
                <div>
                    <h3>${list.name}</h3>
                    <p>${list.description}</p>
                    <div class="venue-stats-preview">
                        <span class="stat-tag">${list.guests.length} guests</span>
                        <span class="guest-list-card-emojis">${emojis}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                applyGuestList(id);
                renderGuestListManage();
                checkStartEnabled();
            });
            presetsGrid.appendChild(card);
        });

        renderGuestListPreview(loadoutState.selectedGuestListId);
    }

    // === Event Listeners ===
    function setupEventListeners() {
        // Title
        document.getElementById('btn-new-game').addEventListener('click', () => {
            switchScreen('setup');
        });
        document.getElementById('btn-how-to-play').addEventListener('click', () => {
            switchScreen('howToPlay');
        });
        document.getElementById('btn-back-to-title').addEventListener('click', () => {
            switchScreen('title');
        });

        // Setup / Loadout
        document.getElementById('loadout-venue-card').addEventListener('click', openVenueSelect);
        document.getElementById('loadout-deck-card').addEventListener('click', openDeckManage);
        document.getElementById('loadout-guest-list-card').addEventListener('click', openGuestListManage);
        document.getElementById('btn-close-venue-select').addEventListener('click', closeVenueSelect);
        document.getElementById('btn-close-deck-manage').addEventListener('click', closeDeckManage);
        document.getElementById('btn-close-guest-list-manage').addEventListener('click', closeGuestListManage);

        // Close overlays on background click
        document.getElementById('venue-select-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeVenueSelect();
        });
        document.getElementById('deck-manage-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDeckManage();
        });
        document.getElementById('guest-list-manage-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeGuestListManage();
        });

        document.getElementById('venue-name-input').addEventListener('input', checkStartEnabled);

        const modeInput = document.getElementById('game-mode-input');
        const multiplayerFields = document.getElementById('multiplayer-fields');
        const roundsInput = document.getElementById('round-count-input');

        function syncModeSettings() {
            const selectedMode = modeInput?.value || 'single';
            const multiplayerSelected = selectedMode === 'host' || selectedMode === 'join';
            if (multiplayerFields) multiplayerFields.style.display = multiplayerSelected ? '' : 'none';
            if (roundsInput) roundsInput.disabled = selectedMode === 'join';
        }

        modeInput?.addEventListener('change', syncModeSettings);
        syncModeSettings();

        document.getElementById('btn-start-game').addEventListener('click', async () => {
            const rawName = document.getElementById('venue-name-input').value.trim() || 'My Venue';
            const roundCount = parseInt(document.getElementById('round-count-input').value, 10) || Game.TOTAL_ROUNDS;
            const selectedMode = modeInput?.value || 'single';
            multiplayerMode = selectedMode === 'single' ? 'single' : 'multiplayer';
            multiplayerRole = selectedMode === 'join' ? 'join' : 'host';

            if (!isMultiplayer()) {
                startGame(escapeHtml(rawName), loadoutState.venueId, roundCount);
                return;
            }

            const roomCode = document.getElementById('room-code-input').value.trim();
            if (!roomCode) {
                setMultiplayerStatus('Room code is required.');
                return;
            }

            try {
                setMultiplayerStatus('Connecting to Ably…');
                multiplayerSession = await Multiplayer.createSession({
                    apiKey: ABLY_API_KEY,
                    roomCode,
                    role: multiplayerRole,
                    onEvent: handleRemoteEvent,
                });
                setMultiplayerStatus('Connected.');

                if (multiplayerRole === 'host') {
                    pendingHostMatchConfig = {
                        name: escapeHtml(rawName),
                        venueType: loadoutState.venueId,
                        totalRounds: roundCount,
                    };
                    showWaitingPopup('Waiting');
                    setMultiplayerStatus('Waiting for another player...');
                } else {
                    setMultiplayerStatus('Connected. Waiting for host…');
                    multiplayerSession.publish('player-joined', {
                        profile: {
                            name: escapeHtml(rawName),
                            venueId: loadoutState.venueId,
                            deck: [...(loadoutState?.deck || [])],
                            guestList: [...(loadoutState?.guestList || [])],
                        },
                    });
                }
            } catch (err) {
                setMultiplayerStatus(err?.message || 'Unable to connect to Ably.');
            }
        });

        bindPartyCarouselInteractions();

        // Guest phase controls
        document.getElementById('player-door').addEventListener('click', handleAdmit);
        document.getElementById('player-door-card').addEventListener('click', handleAdmit);
        document.getElementById('player-exit').addEventListener('click', handleCloseDoor);
        document.getElementById('player-exit-card').addEventListener('click', handleCloseDoor);

        // Round results
        document.getElementById('btn-next-phase').addEventListener('click', handleNextPhase);

        // Buy phase
        document.getElementById('btn-done-shopping').addEventListener('click', handleDoneShopping);

        // Game over
        document.getElementById('btn-play-again').addEventListener('click', () => {
            if (aiTimerId) { clearInterval(aiTimerId); aiTimerId = null; }
            Renderer.resetAnimState();
            clearVenueActors();
            gameState = null;
            currentMarket = null;
            if (multiplayerSession) { multiplayerSession.close(); multiplayerSession = null; }
            closeWaitingPopup();
            pendingHostMatchConfig = null;
            multiplayerMode = 'single';
            document.getElementById('venue-name-input').value = '';
            document.getElementById('round-count-input').value = String(Game.TOTAL_ROUNDS);
            const modeSelect = document.getElementById('game-mode-input');
            if (modeSelect) modeSelect.value = 'single';
            const roundSelect = document.getElementById('round-count-input');
            if (roundSelect) roundSelect.disabled = false;
            const multiplayerFields = document.getElementById('multiplayer-fields');
            if (multiplayerFields) multiplayerFields.style.display = 'none';
            setPartyView('player', false);
            initLoadout();
            switchScreen('title');
        });

        // Remove tooltip on any click outside
        document.addEventListener('click', (e) => {
            if (tooltipEl && !e.target.closest('.guest-slot') && !e.target.closest('.shop-card-wrapper') && !e.target.closest('.guest-tooltip')) {
            }
            if (iconTooltipEl && !e.target.closest('.arriving-emoji.has-ability') && !e.target.closest('.slot-emoji.has-ability') && !e.target.closest('.effect-tooltip')) {
                removeIconTooltip();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && guestAbilityPopupEl) {
                closeGuestAbilityPopup();
            }
        });
    }

    function checkStartEnabled() {
        const nameOk = document.getElementById('venue-name-input').value.trim().length > 0;
        const deckOk = loadoutState && loadoutState.deck.length >= MIN_DECK_SIZE;
        const guestListOk = loadoutState && loadoutState.guestList.length >= MIN_DECK_SIZE;
        document.getElementById('btn-start-game').disabled = !(nameOk && deckOk && guestListOk);
    }

    // === Init ===
    function init() {
        initLoadout();
        setupEventListeners();
        applyPartyView(false);
        startAnimLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
