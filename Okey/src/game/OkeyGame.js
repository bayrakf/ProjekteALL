const { v4: uuidv4 } = require('uuid');

/**
 * Authentic Turkish Okey Game Implementation
 * Based on official Okey rules with 106 tiles
 */
class OkeyGame {
    constructor(tableId, players, io) {
        this.tableId = tableId;
        this.io = io;
        this.players = new Map(players.map(p => [p.id, p])); // Convert array to Map
        this.gameState = 'waiting'; // waiting, playing, finished
        
        // Okey Game State
        this.tiles = [];
        this.middleStack = [];
        this.playerHands = new Map();
        this.playerDiscards = new Map();
        this.currentPlayer = null;
        this.turnDirection = 1; // 1 for clockwise, -1 for counter-clockwise
        
        // Authentic Okey Elements
        this.indicatorTile = null; // Gösterge taşı
        this.okeyTile = null; // Okey taşı
        this.sahteOkey = { color: 'black', number: 0 }; // Sahte Okey (fake okey)
        
        // Game Settings
        this.gameSettings = {
            handSize: 14, // Each player gets 14 tiles
            extraTilePlayer: null, // One player gets 15th tile to start
            pointsToWin: 101,
            basePoints: 20
        };
        
        // Turn Management
        this.turnStartTime = null;
        this.turnTimeLimit = 60000; // 60 seconds per turn
        this.turnTimer = null;
        
        // Game Statistics
        this.gameStats = {
            startTime: null,
            endTime: null,
            totalTurns: 0,
            winner: null,
            gameType: 'normal' // normal, çifte, renkli, sıralı
        };
        
        console.log(`🎮 New Okey Game created - Table: ${tableId}, Players: ${this.players.size}`);
    }
    
    /**
     * Initialize and shuffle the 106 Okey tiles
     */
    initializeTiles() {
        this.tiles = [];
        
        // Colors in Turkish Okey: Kırmızı, Sarı, Siyah, Mavi
        const colors = ['red', 'yellow', 'black', 'blue'];
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        
        // Create 2 sets of each tile (104 tiles)
        for (let set = 0; set < 2; set++) {
            for (const color of colors) {
                for (const number of numbers) {
                    this.tiles.push({
                        id: uuidv4(),
                        color: color,
                        number: number,
                        set: set + 1
                    });
                }
            }
        }
        
        // Add 2 Sahte Okey tiles (fake okey - black with no number)
        for (let i = 0; i < 2; i++) {
            this.tiles.push({
                id: uuidv4(),
                color: 'black',
                number: 0, // 0 represents Sahte Okey
                set: 0,
                isSahteOkey: true
            });
        }
        
        console.log(`🎲 Initialized ${this.tiles.length} tiles (104 regular + 2 Sahte Okey)`);
        this.shuffleTiles();
    }
    
    /**
     * Shuffle tiles using Fisher-Yates algorithm
     */
    shuffleTiles() {
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
        console.log('🔄 Tiles shuffled');
    }
    
    /**
     * Determine the indicator tile (Gösterge) and Okey tile
     */
    determineOkeyAndIndicator() {
        // Take the indicator tile from the top of the pile
        this.indicatorTile = this.tiles.pop();
        
        // Determine Okey tile based on indicator
        let okeyNumber = this.indicatorTile.number + 1;
        let okeyColor = this.indicatorTile.color;
        
        // Handle wrap-around: if indicator is 13, okey is 1
        if (okeyNumber > 13) {
            okeyNumber = 1;
        }
        
        // Sahte Okey as indicator means 1 of same color is Okey
        if (this.indicatorTile.isSahteOkey) {
            okeyNumber = 1;
            okeyColor = 'red'; // Default to red when Sahte Okey is indicator
        }
        
        this.okeyTile = {
            color: okeyColor,
            number: okeyNumber
        };
        
        console.log(`🎯 Indicator: ${this.indicatorTile.color} ${this.indicatorTile.number}`);
        console.log(`🃏 Okey tile: ${this.okeyTile.color} ${this.okeyTile.number}`);
    }
    
    /**
     * Deal tiles to all players
     */
    dealTiles() {
        // Initialize player hands and discards
        for (const [playerId] of this.players) {
            this.playerHands.set(playerId, []);
            this.playerDiscards.set(playerId, []);
        }
        
        const playerIds = Array.from(this.players.keys());
        
        // Deal 14 tiles to each player
        for (let round = 0; round < this.gameSettings.handSize; round++) {
            for (const playerId of playerIds) {
                if (this.tiles.length > 0) {
                    const tile = this.tiles.pop();
                    this.playerHands.get(playerId).push(tile);
                }
            }
        }
        
        // Give 15th tile to first player (they start)
        if (this.tiles.length > 0) {
            const startingPlayer = playerIds[0];
            const extraTile = this.tiles.pop();
            this.playerHands.get(startingPlayer).push(extraTile);
            this.gameSettings.extraTilePlayer = startingPlayer;
            this.currentPlayer = startingPlayer;
        }
        
        // Remaining tiles form the middle stack
        this.middleStack = [...this.tiles];
        this.tiles = []; // Clear the original tiles array
        
        console.log(`🎴 Dealt tiles to ${this.players.size} players`);
        console.log(`📚 Middle stack has ${this.middleStack.length} tiles`);
    }
    
    /**
     * Start the game
     */
    startGame() {
        if (this.players.size !== 4) {
            throw new Error('Okey requires exactly 4 players');
        }
        
        this.gameState = 'playing';
        this.gameStats.startTime = new Date();
        
        console.log('🚀 Starting authentic Okey game...');
        
        // Initialize game
        this.initializeTiles();
        this.determineOkeyAndIndicator();
        this.dealTiles();
        
        // Start first turn
        this.startTurn();
        
        // Notify all players
        this.broadcastGameState();
        
        console.log('✅ Okey game started successfully');
    }
    
    /**
     * Start a player's turn
     */
    startTurn() {
        this.turnStartTime = Date.now();
        this.gameStats.totalTurns++;
        
        // Set turn timer
        this.turnTimer = setTimeout(() => {
            this.handleTurnTimeout();
        }, this.turnTimeLimit);
        
        console.log(`⏰ Turn started for player: ${this.currentPlayer}`);
        
        // Notify current player
        this.io.to(this.tableId).emit('turnStarted', {
            currentPlayer: this.currentPlayer,
            turnNumber: this.gameStats.totalTurns,
            timeLimit: this.turnTimeLimit
        });
    }
    
    /**
     * Handle turn timeout
     */
    handleTurnTimeout() {
        console.log(`⏰ Turn timeout for player: ${this.currentPlayer}`);
        
        // Auto-discard a random tile if player has 15 tiles
        const playerHand = this.playerHands.get(this.currentPlayer);
        if (playerHand && playerHand.length === 15) {
            const randomIndex = Math.floor(Math.random() * playerHand.length);
            const discardedTile = playerHand.splice(randomIndex, 1)[0];
            this.playerDiscards.get(this.currentPlayer).push(discardedTile);
        }
        
        this.nextTurn();
    }
    
    /**
     * Move to next player's turn
     */
    nextTurn() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
        
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentPlayer);
        const nextIndex = (currentIndex + this.turnDirection + playerIds.length) % playerIds.length;
        this.currentPlayer = playerIds[nextIndex];
        
        this.startTurn();
    }
    
    /**
     * Player draws a tile from middle stack
     */
    drawTile(playerId) {
        if (playerId !== this.currentPlayer) {
            return { success: false, error: 'Not your turn' };
        }
        
        if (this.middleStack.length === 0) {
            return { success: false, error: 'No tiles left in middle stack' };
        }
        
        const drawnTile = this.middleStack.pop();
        this.playerHands.get(playerId).push(drawnTile);
        
        console.log(`🎲 Player ${playerId} drew tile: ${drawnTile.color} ${drawnTile.number}`);
        
        // Notify all players
        this.io.to(this.tableId).emit('tileDrawn', {
            userId: playerId,
            tile: drawnTile,
            middleStackCount: this.middleStack.length
        });
        
        return { success: true, tile: drawnTile };
    }
    
    /**
     * Player discards a tile
     */
    discardTile(playerId, tileId) {
        if (playerId !== this.currentPlayer) {
            return { success: false, error: 'Not your turn' };
        }
        
        const playerHand = this.playerHands.get(playerId);
        const tileIndex = playerHand.findIndex(tile => tile.id === tileId);
        
        if (tileIndex === -1) {
            return { success: false, error: 'Tile not found in hand' };
        }
        
        // Remove tile from hand and add to discard pile
        const discardedTile = playerHand.splice(tileIndex, 1)[0];
        this.playerDiscards.get(playerId).push(discardedTile);
        
        console.log(`🗑️ Player ${playerId} discarded: ${discardedTile.color} ${discardedTile.number}`);
        
        // Check for game end
        if (this.checkWinCondition(playerId)) {
            this.endGame(playerId);
            return { success: true, gameEnd: true };
        }
        
        // Notify all players
        this.io.to(this.tableId).emit('tileDiscarded', {
            userId: playerId,
            tile: discardedTile,
            handCount: playerHand.length
        });
        
        // Move to next turn
        this.nextTurn();
        
        return { success: true };
    }
    
    /**
     * Check if player has won
     */
    checkWinCondition(playerId) {
        const hand = this.playerHands.get(playerId);
        if (hand.length !== 14) return false;
        
        // Check for valid Okey combinations
        return this.isValidOkeyHand(hand);
    }
    
    /**
     * Validate if hand contains valid Okey combinations
     */
    isValidOkeyHand(hand) {
        // A valid Okey hand consists of:
        // - Groups of 3+ same numbers (different colors)
        // - Runs of 3+ consecutive numbers (same color)
        // - Each tile used exactly once
        
        // This is a simplified check - full implementation would be more complex
        const groups = this.findGroups(hand);
        const runs = this.findRuns(hand);
        
        // Check if all tiles are used in valid combinations
        const usedTiles = new Set();
        
        for (const group of groups) {
            for (const tile of group) {
                usedTiles.add(tile.id);
            }
        }
        
        for (const run of runs) {
            for (const tile of run) {
                usedTiles.add(tile.id);
            }
        }
        
        return usedTiles.size === hand.length;
    }
    
    /**
     * Find valid groups in hand
     */
    findGroups(hand) {
        // Implementation for finding groups (3+ same numbers)
        const groups = [];
        const numberGroups = {};
        
        for (const tile of hand) {
            if (!numberGroups[tile.number]) {
                numberGroups[tile.number] = [];
            }
            numberGroups[tile.number].push(tile);
        }
        
        for (const [number, tiles] of Object.entries(numberGroups)) {
            if (tiles.length >= 3) {
                groups.push(tiles);
            }
        }
        
        return groups;
    }
    
    /**
     * Find valid runs in hand
     */
    findRuns(hand) {
        // Implementation for finding runs (3+ consecutive numbers same color)
        const runs = [];
        const colorGroups = {};
        
        for (const tile of hand) {
            if (!colorGroups[tile.color]) {
                colorGroups[tile.color] = [];
            }
            colorGroups[tile.color].push(tile);
        }
        
        for (const [color, tiles] of Object.entries(colorGroups)) {
            tiles.sort((a, b) => a.number - b.number);
            
            let currentRun = [tiles[0]];
            for (let i = 1; i < tiles.length; i++) {
                if (tiles[i].number === tiles[i-1].number + 1) {
                    currentRun.push(tiles[i]);
                } else {
                    if (currentRun.length >= 3) {
                        runs.push([...currentRun]);
                    }
                    currentRun = [tiles[i]];
                }
            }
            
            if (currentRun.length >= 3) {
                runs.push(currentRun);
            }
        }
        
        return runs;
    }
    
    /**
     * End the game
     */
    endGame(winnerId) {
        this.gameState = 'finished';
        this.gameStats.endTime = new Date();
        this.gameStats.winner = winnerId;
        
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
        }
        
        console.log(`🏆 Game ended! Winner: ${winnerId}`);
        
        // Calculate points
        const points = this.calculatePoints(winnerId);
        
        // Notify all players
        this.io.to(this.tableId).emit('gameEnded', {
            winner: winnerId,
            points: points,
            gameStats: this.gameStats,
            finalHands: Object.fromEntries(this.playerHands)
        });
    }
    
    /**
     * Calculate points for game end
     */
    calculatePoints(winnerId) {
        const points = new Map();
        
        for (const [playerId] of this.players) {
            if (playerId === winnerId) {
                points.set(playerId, this.gameSettings.basePoints);
            } else {
                points.set(playerId, -this.gameSettings.basePoints);
            }
        }
        
        return Object.fromEntries(points);
    }
    
    /**
     * Broadcast current game state to all players
     */
    broadcastGameState() {
        const gameData = {
            gameState: this.gameState,
            currentPlayer: this.currentPlayer,
            indicatorTile: this.indicatorTile,
            okeyTile: this.okeyTile,
            middleStackCount: this.middleStack.length,
            playerHandCounts: Object.fromEntries(
                Array.from(this.playerHands.entries()).map(([id, hand]) => [id, hand.length])
            ),
            gameStats: this.gameStats
        };
        
        // Send personalized data to each player
        const playerHands = {};
        for (const [playerId] of this.players) {
            playerHands[playerId] = this.playerHands.get(playerId);
        }
        
        // Broadcast game started event to all players
        this.io.to(this.tableId).emit('gameStarted', {
            ...gameData,
            playerHands: playerHands,
            yourTurn: this.currentPlayer
        });
        
        console.log(`📡 Game state broadcasted to table ${this.tableId}`);
    }
    
    /**
     * Get game info for display
     */
    getGameInfo() {
        return {
            tableId: this.tableId,
            gameState: this.gameState,
            playerCount: this.players.size,
            currentPlayer: this.currentPlayer,
            turnNumber: this.gameStats.totalTurns,
            startTime: this.gameStats.startTime
        };
    }
}

module.exports = OkeyGame;