const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'database.sqlite');
        this.db = new sqlite3.Database(this.dbPath);
        
        this.initializeDatabase();
        
        console.log('🗄️ DatabaseManager initialized');
    }
    
    initializeDatabase() {
        // Create tables if they don't exist
        this.db.serialize(() => {
            // Users table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT,
                    score INTEGER DEFAULT 0,
                    gamesPlayed INTEGER DEFAULT 0,
                    gamesWon INTEGER DEFAULT 0,
                    isGuest BOOLEAN DEFAULT 0,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    lastLogin DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isActive BOOLEAN DEFAULT 1
                )
            `);
            
            // Game history table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS game_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gameId TEXT NOT NULL,
                    userId INTEGER NOT NULL,
                    result TEXT NOT NULL, -- 'win', 'lose'
                    scoreChange INTEGER NOT NULL,
                    gameType TEXT NOT NULL, -- 'okey', 'batak'
                    duration INTEGER, -- in seconds
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users (id)
                )
            `);
            
            // Chat history table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER,
                    username TEXT NOT NULL,
                    message TEXT NOT NULL,
                    roomId TEXT NOT NULL,
                    isGuest BOOLEAN DEFAULT 0,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users (id)
                )
            `);
            
            // Achievements table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    type TEXT NOT NULL, -- 'first_win', 'streak_5', 'master_player', etc.
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    unlockedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (userId) REFERENCES users (id)
                )
            `);
            
            // Admin logs table
            this.db.run(`
                CREATE TABLE IF NOT EXISTS admin_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    adminId INTEGER,
                    targetUserId INTEGER,
                    details TEXT,
                    ipAddress TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (adminId) REFERENCES users (id),
                    FOREIGN KEY (targetUserId) REFERENCES users (id)
                )
            `);
        });
        
        console.log('📊 Database tables initialized');
    }
    
    // User management
    async createUser(userData) {
        return new Promise((resolve, reject) => {
            const { username, email, password, score, gamesPlayed, gamesWon, createdAt } = userData;
            
            this.db.run(
                `INSERT INTO users (username, email, password, score, gamesPlayed, gamesWon, createdAt) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [username, email, password, score, gamesPlayed, gamesWon, createdAt],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }
    
    async getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ? AND isActive = 1',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }
    
    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ? AND isActive = 1',
                [username],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }
    
    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ? AND isActive = 1',
                [email],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }
    
    async updateUserLastLogin(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?',
                [userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }
    
    async updateUserStats(userId, scoreChange, gameResult) {
        return new Promise((resolve, reject) => {
            let sql;
            if (gameResult === 'win') {
                sql = `UPDATE users SET 
                       score = score + ?, 
                       gamesPlayed = gamesPlayed + 1, 
                       gamesWon = gamesWon + 1 
                       WHERE id = ?`;
            } else {
                sql = `UPDATE users SET 
                       score = score + ?, 
                       gamesPlayed = gamesPlayed + 1 
                       WHERE id = ?`;
            }
            
            this.db.run(sql, [scoreChange, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }
    
    async updateUserPassword(userId, newPassword) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [newPassword, userId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }
    
    // Leaderboard
    async getLeaderboard(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT username, score, gamesPlayed, gamesWon, 
                        CASE WHEN gamesPlayed > 0 THEN ROUND((gamesWon * 100.0) / gamesPlayed, 2) ELSE 0 END as winRate
                 FROM users 
                 WHERE isActive = 1 
                 ORDER BY score DESC, winRate DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }
    
    // Game history
    async saveGameResult(gameData) {
        return new Promise((resolve, reject) => {
            const { gameId, userId, result, scoreChange, gameType, duration } = gameData;
            
            this.db.run(
                `INSERT INTO game_history (gameId, userId, result, scoreChange, gameType, duration) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [gameId, userId, result, scoreChange, gameType, duration],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }
    
    async getUserGameHistory(userId, limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM game_history 
                 WHERE userId = ? 
                 ORDER BY createdAt DESC 
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }
    
    // Chat history
    async saveChatMessage(messageData) {
        return new Promise((resolve, reject) => {
            const { userId, username, message, roomId, isGuest } = messageData;
            
            this.db.run(
                `INSERT INTO chat_history (userId, username, message, roomId, isGuest) 
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, username, message, roomId, isGuest ? 1 : 0],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }
    
    async getChatHistory(roomId, limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM chat_history 
                 WHERE roomId = ? 
                 ORDER BY createdAt DESC 
                 LIMIT ?`,
                [roomId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows.reverse()); // Return in chronological order
                    }
                }
            );
        });
    }
    
    // Statistics
    async getGameStats() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT 
                    COUNT(*) as totalUsers,
                    COUNT(CASE WHEN lastLogin > datetime('now', '-1 day') THEN 1 END) as activeToday,
                    COUNT(CASE WHEN lastLogin > datetime('now', '-7 days') THEN 1 END) as activeWeek,
                    SUM(gamesPlayed) as totalGames,
                    AVG(score) as averageScore
                 FROM users 
                 WHERE isActive = 1`,
                [],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows[0]);
                    }
                }
            );
        });
    }
    
    // Achievements
    async unlockAchievement(userId, achievementData) {
        return new Promise((resolve, reject) => {
            const { type, title, description } = achievementData;
            
            // Check if already unlocked
            this.db.get(
                'SELECT id FROM achievements WHERE userId = ? AND type = ?',
                [userId, type],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve(null); // Already unlocked
                    } else {
                        // Unlock achievement
                        this.db.run(
                            `INSERT INTO achievements (userId, type, title, description) 
                             VALUES (?, ?, ?, ?)`,
                            [userId, type, title, description],
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(this.lastID);
                                }
                            }
                        );
                    }
                }
            );
        });
    }
    
    async getUserAchievements(userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM achievements WHERE userId = ? ORDER BY unlockedAt DESC',
                [userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }
    
    // Admin functions
    async logAdminAction(actionData) {
        return new Promise((resolve, reject) => {
            const { action, adminId, targetUserId, details, ipAddress } = actionData;
            
            this.db.run(
                `INSERT INTO admin_logs (action, adminId, targetUserId, details, ipAddress) 
                 VALUES (?, ?, ?, ?, ?)`,
                [action, adminId, targetUserId, details, ipAddress],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }
    
    // Cleanup old data
    async cleanupOldData() {
        return new Promise((resolve, reject) => {
            // Remove chat messages older than 30 days
            this.db.run(
                `DELETE FROM chat_history WHERE createdAt < datetime('now', '-30 days')`,
                [],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`🧹 Cleaned up ${this.changes} old chat messages`);
                        resolve(this.changes);
                    }
                }
            );
        });
    }
    
    close() {
        this.db.close((err) => {
            if (err) {
                console.error('❌ Error closing database:', err);
            } else {
                console.log('🗄️ Database connection closed');
            }
        });
    }
}

module.exports = DatabaseManager;
