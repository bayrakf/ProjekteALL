// Quick Test Script for 4-Player Okey Game
// Run this in the browser console on http://localhost:3000

console.log('🎮 Starting 4-Player Okey Test...');

// Function to test the game with multiple simulated players
async function test4PlayerGame() {
    console.log('🚀 Test started!');
    
    // 1. Login as guest
    if (window.gameClient) {
        console.log('✅ Game client found');
        
        // Quick guest login
        await window.gameClient.handleGuestLogin();
        
        // Wait a bit then join table
        setTimeout(async () => {
            console.log('🪑 Joining table...');
            await window.gameClient.joinTable('room1', 'table1');
            
            // Add demo players
            setTimeout(() => {
                console.log('🤖 Adding demo players...');
                window.gameClient.addDemoPlayers();
                
                // Try to start game after demo players join
                setTimeout(() => {
                    console.log('🎮 Attempting to start game...');
                    if (window.gameClient.socket) {
                        window.gameClient.socket.emit('startGame');
                    }
                }, 4000);
                
            }, 2000);
        }, 2000);
    } else {
        console.error('❌ Game client not found!');
    }
}

// Run the test
test4PlayerGame();

console.log('📋 Test script loaded. Check console for progress...');
