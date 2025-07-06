const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DatabaseManager = require('./DatabaseManager');

class AuthManager {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.jwtSecret = process.env.JWT_SECRET || 'okey-nostalji-secret-key-2025';
        
        console.log('🔐 AuthManager initialized');
    }
    
    async register(username, email, password) {
        try {
            // Validate input
            if (!username || !email || !password) {
                throw new Error('All fields are required');
            }
            
            if (username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }
            
            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }
            
            // Check if user already exists
            const existingUser = await this.dbManager.getUserByUsername(username);
            if (existingUser) {
                throw new Error('Username already exists');
            }
            
            const existingEmail = await this.dbManager.getUserByEmail(email);
            if (existingEmail) {
                throw new Error('Email already exists');
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);
            
            // Create user
            const userId = await this.dbManager.createUser({
                username: username,
                email: email,
                password: hashedPassword,
                score: 0,
                gamesPlayed: 0,
                gamesWon: 0,
                createdAt: new Date().toISOString()
            });
            
            // Generate token
            const token = this.generateToken(userId, username);
            
            console.log(`✅ User registered: ${username}`);
            
            return {
                success: true,
                token: token,
                user: {
                    id: userId,
                    username: username,
                    email: email,
                    score: 0,
                    isGuest: false
                }
            };
            
        } catch (error) {
            console.error('❌ Registration error:', error.message);
            throw error;
        }
    }
    
    async login(username, password) {
        try {
            // Validate input
            if (!username || !password) {
                throw new Error('Username and password are required');
            }
            
            // Get user from database
            const user = await this.dbManager.getUserByUsername(username);
            if (!user) {
                throw new Error('Invalid username or password');
            }
            
            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                throw new Error('Invalid username or password');
            }
            
            // Generate token
            const token = this.generateToken(user.id, user.username);
            
            // Update last login
            await this.dbManager.updateUserLastLogin(user.id);
            
            console.log(`✅ User logged in: ${username}`);
            
            return {
                success: true,
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    score: user.score,
                    gamesPlayed: user.gamesPlayed,
                    gamesWon: user.gamesWon,
                    isGuest: false
                }
            };
            
        } catch (error) {
            console.error('❌ Login error:', error.message);
            throw error;
        }
    }
    
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            const user = await this.dbManager.getUserById(decoded.userId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                score: user.score,
                gamesPlayed: user.gamesPlayed,
                gamesWon: user.gamesWon,
                isGuest: false
            };
            
        } catch (error) {
            console.error('❌ Token verification error:', error.message);
            return null;
        }
    }
    
    generateToken(userId, username) {
        return jwt.sign(
            { 
                userId: userId, 
                username: username 
            },
            this.jwtSecret,
            { expiresIn: '30d' }
        );
    }
    
    async updateUserScore(userId, scoreChange, gameResult) {
        try {
            await this.dbManager.updateUserStats(userId, scoreChange, gameResult);
        } catch (error) {
            console.error('❌ Score update error:', error.message);
        }
    }
    
    async resetPassword(email) {
        try {
            const user = await this.dbManager.getUserByEmail(email);
            if (!user) {
                throw new Error('Email not found');
            }
            
            // Generate temporary password
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 12);
            
            await this.dbManager.updateUserPassword(user.id, hashedPassword);
            
            // In a real app, you would send this via email
            console.log(`🔑 Temporary password for ${email}: ${tempPassword}`);
            
            return {
                success: true,
                message: 'Temporary password generated. Check console for demo.'
            };
            
        } catch (error) {
            console.error('❌ Password reset error:', error.message);
            throw error;
        }
    }
    
    async changePassword(userId, oldPassword, newPassword) {
        try {
            const user = await this.dbManager.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Verify old password
            const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
            if (!isOldPasswordValid) {
                throw new Error('Current password is incorrect');
            }
            
            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 12);
            
            await this.dbManager.updateUserPassword(userId, hashedNewPassword);
            
            console.log(`🔐 Password changed for user: ${user.username}`);
            
            return {
                success: true,
                message: 'Password changed successfully'
            };
            
        } catch (error) {
            console.error('❌ Password change error:', error.message);
            throw error;
        }
    }
    
    async createGuestUser(guestName) {
        try {
            if (!guestName) {
                guestName = `Guest${Date.now()}`;
            }
            
            // Make sure guest name is unique
            let finalGuestName = guestName;
            let counter = 1;
            while (await this.dbManager.getUserByUsername(finalGuestName)) {
                finalGuestName = `${guestName}${counter}`;
                counter++;
            }
            
            // Create guest user in database
            const userId = await this.dbManager.createUser({
                username: finalGuestName,
                email: `${finalGuestName}@guest.local`,
                password: null, // No password for guests
                score: 0,
                gamesPlayed: 0,
                gamesWon: 0,
                isGuest: true,
                createdAt: new Date().toISOString()
            });
            
            const user = {
                id: userId,
                username: finalGuestName,
                isGuest: true,
                score: 0,
                gamesPlayed: 0,
                gamesWon: 0
            };
            
            return {
                success: true,
                user: user,
                message: `Willkommen, ${finalGuestName}!`
            };
            
        } catch (error) {
            console.error('Guest user creation error:', error);
            return {
                success: false,
                message: 'Fehler beim Erstellen des Gast-Accounts'
            };
        }
    }
}

module.exports = AuthManager;
