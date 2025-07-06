const io = require('socket.io-client');

console.log('🧪 Testing 4-player Okey game with actual gameplay...');

// Create 4 socket connections
const players = [];
let gameInProgress = false;
let currentPlayerIndex = 0;

for (let i = 1; i <= 4; i++) {
    const socket = io('http://localhost:3000', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000
    });
    const player = { 
        socket, 
        id: i, 
        connected: false, 
        authenticated: false, 
        inTable: false,
        hand: [],
        userId: null,
        isMyTurn: false,
        reconnectAttempts: 0
    };
    players.push(player);
    
    socket.on('connect', () => {
        console.log(`✅ Player ${i} connected: ${socket.id}`);
        player.connected = true;
        player.reconnectAttempts = 0;
        
        // Guest login after a delay
        setTimeout(() => {
            const guestName = `TestPlayer${i}`;
            console.log(`🎭 Player ${i} logging in as ${guestName}`);
            socket.emit('guest-login', { guestName: guestName });
        }, i * 200);
    });
    
    socket.on('disconnect', (reason) => {
        console.log(`👋 Player ${i} disconnected: ${reason}`);
        player.connected = false;
        player.isMyTurn = false;
    });
    
    socket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Player ${i} reconnected after ${attemptNumber} attempts`);
        player.connected = true;
        
        // Re-authenticate if needed
        if (!player.authenticated && player.reconnectAttempts < 3) {
            setTimeout(() => {
                const guestName = `TestPlayer${i}`;
                console.log(`🔐 Player ${i} re-authenticating as ${guestName}`);
                socket.emit('guest-login', { guestName: guestName });
                player.reconnectAttempts++;
            }, 1000);
        }
    });
    
    socket.on('reconnect_error', (error) => {
        console.log(`❌ Player ${i} reconnect failed: ${error}`);
    });
    
    socket.on('authenticated', (data) => {
        if (data.success) {
            console.log(`🔐 Player ${i} authenticated: ${data.user.username}`);
            player.authenticated = true;
            player.userId = data.user.id;
            
            // Join table after authentication
            setTimeout(() => {
                console.log(`🪑 Player ${i} joining table...`);
                socket.emit('joinTable', { roomId: 'room1', tableId: 'table1' });
            }, 500);
        } else {
            console.log(`❌ Player ${i} authentication failed: ${data.message}`);
        }
    });
    
    socket.on('joinedRoom', (data) => {
        if (data.success) {
            console.log(`🪑 Player ${i} joined table ${data.tableId}`);
            player.inTable = true;
            
            const playersInTable = players.filter(p => p.inTable).length;
            console.log(`📊 Players in table: ${playersInTable}/4`);
        } else {
            console.log(`❌ Player ${i} failed to join table: ${data.message}`);
        }
    });
    
    socket.on('gameStarted', (data) => {
        console.log(`🎮 GAME STARTED! Player ${i} received game data`);
        console.log(`� Okey tile: ${data.okeyTile?.color} ${data.okeyTile?.number}`);
        console.log(`📍 Indicator tile: ${data.indicatorTile?.color} ${data.indicatorTile?.number}`);
        
        gameInProgress = true;
        player.hand = data.playerHands[player.userId] || [];
        player.isMyTurn = data.currentPlayer === player.userId;
        
        console.log(`🎲 Player ${i} hand size: ${player.hand.length} tiles`);
        console.log(`🎲 Player ${i} hand: ${player.hand.map(t => `${t.color}${t.number}`).join(', ')}`);
        
        if (player.isMyTurn) {
            console.log(`⭐ Player ${i} starts the game!`);
            currentPlayerIndex = i - 1;
            
            // Start the first move after a delay
            setTimeout(() => {
                makeMove(player, i);
            }, 2000);
        }
        
        if (i === 1) {
            console.log('� SUCCESS! 4-player Okey game started successfully!');
        }
    });

    // Listen for game state updates
    socket.on('gameState', (data) => {
        console.log(`📊 Player ${i} received game state update`);
        if (data.currentPlayer === player.userId && !player.isMyTurn) {
            player.isMyTurn = true;
            console.log(`🎯 Now it's Player ${i}'s turn!`);
            
            // Make a move after a short delay
            setTimeout(() => {
                makeMove(player, i);
            }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
        } else {
            player.isMyTurn = false;
        }
        
        // Update hand if provided
        if (data.playerHands && data.playerHands[player.userId]) {
            player.hand = data.playerHands[player.userId];
            console.log(`🎲 Player ${i} updated hand size: ${player.hand.length} tiles`);
        }
    });

    // Listen for turn updates
    socket.on('turnChanged', (data) => {
        console.log(`🔄 Turn changed - Current player: ${data.currentPlayer}`);
        player.isMyTurn = data.currentPlayer === player.userId;
        
        if (player.isMyTurn) {
            console.log(`🎯 It's Player ${i}'s turn!`);
            setTimeout(() => {
                makeMove(player, i);
            }, 1000 + Math.random() * 2000);
        }
    });

    // Listen for tile drawn
    socket.on('tileDrawn', (data) => {
        if (data.playerId === player.userId) {
            console.log(`🎲 Player ${i} drew a tile: ${data.tile?.color}${data.tile?.number}`);
            if (data.tile) {
                player.hand.push(data.tile);
                console.log(`🎲 Player ${i} hand size after draw: ${player.hand.length} tiles`);
            }
        } else {
            console.log(`👀 Player ${i} sees another player drew a tile`);
        }
    });

    // Listen for tile discarded
    socket.on('tileDiscarded', (data) => {
        console.log(`🗑️ Player ${i} sees tile discarded: ${data.tile?.color}${data.tile?.number} by player ${data.playerId}`);
        
        // If this player discarded, update hand
        if (data.playerId === player.userId) {
            console.log(`✅ Player ${i} successfully discarded tile`);
            // Hand should already be updated locally, but let's verify
            console.log(`🎲 Player ${i} hand size after discard: ${player.hand.length} tiles`);
        }
    });

    // Listen for game end
    socket.on('gameEnded', (data) => {
        console.log(`🏆 GAME ENDED! Player ${i} - Winner: ${data.winner?.username}`);
        console.log(`📊 Final scores:`, data.scores);
        gameInProgress = false;
    });
    
    socket.on('error', (data) => {
        console.log(`❌ Player ${i} error: ${data.message}`);
    });
}

// Function to make a move for a player
function makeMove(player, playerId) {
    if (!player.isMyTurn || !gameInProgress) {
        console.log(`⚠️ Player ${playerId} cannot move: turn=${player.isMyTurn}, game=${gameInProgress}`);
        return;
    }
    
    console.log(`🎯 Player ${playerId} is making a move... (hand size: ${player.hand.length})`);
    
    // 70% chance to draw from pile, 30% chance to take from discard
    const drawFromPile = Math.random() > 0.3;
    
    if (drawFromPile) {
        console.log(`🎲 Player ${playerId} draws from pile`);
        player.socket.emit('drawTile');
    } else {
        console.log(`🎲 Player ${playerId} attempts to take from discard pile`);
        player.socket.emit('takeFromDiscard');
    }
    
    // After drawing, discard a random tile after a short delay
    setTimeout(() => {
        if (player.hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * player.hand.length);
            const tileToDiscard = player.hand[randomIndex];
            
            console.log(`🗑️ Player ${playerId} discards: ${tileToDiscard.color}${tileToDiscard.number} (index ${randomIndex} of ${player.hand.length})`);
            
            // Remove tile from hand BEFORE sending to server
            player.hand.splice(randomIndex, 1);
            console.log(`🎲 Player ${playerId} hand size after local discard: ${player.hand.length}`);
            
            // Send discard to server
            player.socket.emit('discardTile', { tile: tileToDiscard });
            
            // Small chance to declare win (just for testing)
            if (Math.random() < 0.05 && player.hand.length <= 14) {
                setTimeout(() => {
                    console.log(`🏆 Player ${playerId} declares win!`);
                    player.socket.emit('declareWin', { hand: player.hand });
                }, 1000);
            }
        } else {
            console.log(`⚠️ Player ${playerId} has no tiles to discard!`);
        }
    }, 1500 + Math.random() * 1000); // 1.5-2.5 seconds delay
}

// Clean up after 60 seconds (longer to see more gameplay)
setTimeout(() => {
    console.log('🧹 Cleaning up...');
    players.forEach(({ socket }) => socket.disconnect());
    process.exit(0);
}, 60000);

console.log('⏱️ Test running... will cleanup in 60 seconds');
