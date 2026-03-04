/* ============================================
   VENUE RIVALS - Venue Scene System
   Top-down party venue with guest sprites
   ============================================ */

const VenueScene = (() => {
    const SPRITE_SIZE = 24;
    const MOVE_SPEED = 1.2;

    const BEHAVIOR_NODES = {
        velvetRoom: {
            entry: { x: 0.85, y: 0.15 },
            danceFloor: [
                { x: 0.5, y: 0.45 },
                { x: 0.45, y: 0.5 },
                { x: 0.55, y: 0.5 },
                { x: 0.5, y: 0.55 }
            ],
            bar: [
                { x: 0.15, y: 0.3 },
                { x: 0.2, y: 0.35 },
                { x: 0.15, y: 0.4 }
            ],
            lounge: [
                { x: 0.75, y: 0.7 },
                { x: 0.8, y: 0.75 },
                { x: 0.85, y: 0.7 }
            ]
        },
        nightMarket: {
            entry: { x: 0.85, y: 0.15 },
            danceFloor: [
                { x: 0.5, y: 0.5 },
                { x: 0.45, y: 0.55 },
                { x: 0.55, y: 0.55 },
                { x: 0.5, y: 0.6 }
            ],
            bar: [
                { x: 0.2, y: 0.25 },
                { x: 0.25, y: 0.3 },
                { x: 0.2, y: 0.35 }
            ],
            lounge: [
                { x: 0.75, y: 0.75 },
                { x: 0.8, y: 0.8 },
                { x: 0.85, y: 0.75 }
            ]
        },
        backAlley: {
            entry: { x: 0.85, y: 0.15 },
            danceFloor: [
                { x: 0.55, y: 0.5 },
                { x: 0.5, y: 0.55 },
                { x: 0.6, y: 0.55 },
                { x: 0.55, y: 0.6 }
            ],
            bar: [
                { x: 0.15, y: 0.3 },
                { x: 0.2, y: 0.35 },
                { x: 0.15, y: 0.4 }
            ],
            lounge: [
                { x: 0.8, y: 0.7 },
                { x: 0.85, y: 0.75 },
                { x: 0.75, y: 0.75 }
            ]
        }
    };

    const GUEST_COLORS = [
        '#ff6e6e', '#4cc9f0', '#ffd166', '#7f5af0',
        '#2cb67d', '#ff9a5c', '#e85d75', '#48bfe3'
    ];

    class GuestActor {
        constructor(instanceId, guestId, venueId, canvasWidth, canvasHeight) {
            this.instanceId = instanceId;
            this.guestId = guestId;
            this.guest = Game.GUESTS[guestId];

            const nodes = BEHAVIOR_NODES[venueId] || BEHAVIOR_NODES.velvetRoom;
            const entryNode = nodes.entry;

            this.x = entryNode.x * canvasWidth;
            this.y = entryNode.y * canvasHeight;
            this.targetX = this.x;
            this.targetY = this.y;

            this.behavior = 'entering';
            this.animFrame = Math.random() * Math.PI * 2;
            this.colorIndex = Math.floor(Math.random() * GUEST_COLORS.length);
            this.retargetTimer = 0;
            this.hasReachedFirstTarget = false;
        }

        update(venueId, canvasWidth, canvasHeight) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 2) {
                this.x += (dx / dist) * MOVE_SPEED;
                this.y += (dy / dist) * MOVE_SPEED;
            } else {
                this.x = this.targetX;
                this.y = this.targetY;

                if (!this.hasReachedFirstTarget) {
                    this.hasReachedFirstTarget = true;
                    this.pickNewBehavior(venueId, canvasWidth, canvasHeight);
                }
            }

            this.retargetTimer++;
            if (this.retargetTimer > 180 + Math.random() * 120) {
                this.retargetTimer = 0;
                this.pickNewBehavior(venueId, canvasWidth, canvasHeight);
            }

            this.animFrame += 0.05;
        }

        pickNewBehavior(venueId, canvasWidth, canvasHeight) {
            const nodes = BEHAVIOR_NODES[venueId] || BEHAVIOR_NODES.velvetRoom;
            const behaviors = ['danceFloor', 'bar', 'lounge'];
            const chosen = behaviors[Math.floor(Math.random() * behaviors.length)];

            this.behavior = chosen;

            const nodeList = nodes[chosen];
            if (nodeList && nodeList.length > 0) {
                const node = nodeList[Math.floor(Math.random() * nodeList.length)];
                this.targetX = node.x * canvasWidth;
                this.targetY = node.y * canvasHeight;
            }
        }

        draw(ctx) {
            const wobble = Math.sin(this.animFrame) * 2;
            const color = GUEST_COLORS[this.colorIndex];

            ctx.save();
            ctx.translate(this.x, this.y + wobble);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(0, 8, 8, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Body
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            // Emoji overlay
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.guest.emoji, 0, -1);

            ctx.restore();
        }
    }

    class Scene {
        constructor(venueId, canvasWidth, canvasHeight) {
            this.venueId = venueId;
            this.canvasWidth = canvasWidth;
            this.canvasHeight = canvasHeight;
            this.actors = [];
            this.venue = Game.VENUES[venueId];
        }

        addGuest(instanceId, guestId) {
            const actor = new GuestActor(instanceId, guestId, this.venueId, this.canvasWidth, this.canvasHeight);
            this.actors.push(actor);
            return actor;
        }

        removeGuest(instanceId) {
            const index = this.actors.findIndex(a => a.instanceId === instanceId);
            if (index >= 0) {
                this.actors.splice(index, 1);
            }
        }

        clearAllGuests() {
            this.actors = [];
        }

        update() {
            for (const actor of this.actors) {
                actor.update(this.venueId, this.canvasWidth, this.canvasHeight);
            }
        }

        drawVenue(ctx) {
            const w = this.canvasWidth;
            const h = this.canvasHeight;

            // Background gradient
            const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
            bgGrad.addColorStop(0, '#1a1932');
            bgGrad.addColorStop(1, '#0f0e17');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);

            // Venue-specific color
            const venueColor = this.venue.color || '#7f5af0';

            // Dance floor
            const dfX = w * 0.35;
            const dfY = h * 0.35;
            const dfW = w * 0.3;
            const dfH = h * 0.3;

            const dfGrad = ctx.createRadialGradient(dfX + dfW/2, dfY + dfH/2, 0, dfX + dfW/2, dfY + dfH/2, dfW/2);
            dfGrad.addColorStop(0, venueColor + '40');
            dfGrad.addColorStop(1, venueColor + '10');
            ctx.fillStyle = dfGrad;
            this.roundRect(ctx, dfX, dfY, dfW, dfH, 10);
            ctx.fill();

            // Bar
            ctx.fillStyle = '#2a2855';
            this.roundRect(ctx, w * 0.08, h * 0.2, w * 0.15, h * 0.25, 8);
            ctx.fill();
            ctx.fillStyle = venueColor + '60';
            ctx.fillRect(w * 0.08, h * 0.2, w * 0.15, 4);

            // Lounge
            ctx.fillStyle = '#232146';
            this.roundRect(ctx, w * 0.7, h * 0.65, w * 0.22, h * 0.25, 8);
            ctx.fill();

            // Entry door (top-right)
            const doorX = w * 0.82;
            const doorY = h * 0.08;
            const doorW = w * 0.12;
            const doorH = h * 0.12;

            ctx.fillStyle = '#2a2855';
            this.roundRect(ctx, doorX, doorY, doorW, doorH, 6);
            ctx.fill();

            ctx.strokeStyle = venueColor;
            ctx.lineWidth = 3;
            this.roundRect(ctx, doorX, doorY, doorW, doorH, 6);
            ctx.stroke();

            // Door icon
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = venueColor;
            ctx.fillText('🚪', doorX + doorW/2, doorY + doorH/2);

            // Venue emoji indicator
            ctx.font = 'bold 32px sans-serif';
            ctx.fillText(this.venue.emoji, w * 0.5, h * 0.12);
        }

        roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        draw(ctx) {
            this.drawVenue(ctx);

            for (const actor of this.actors) {
                actor.draw(ctx);
            }
        }
    }

    return {
        Scene,
        GuestActor
    };
})();
