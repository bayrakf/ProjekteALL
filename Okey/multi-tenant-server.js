const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class OkeyMultiTenant {
    constructor() {
        this.app = express();
        this.tenants = new Map();
        this.basePorts = 4000; // Start port for tenant instances
        this.adminPort = 3000;
        this.setupDatabase();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupDatabase() {
        this.db = new sqlite3.Database('./tenants.db');
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subdomain TEXT UNIQUE,
                plan TEXT DEFAULT 'starter',
                max_players INTEGER DEFAULT 50,
                custom_domain TEXT,
                port INTEGER,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('admin-panel'));
        
        // Tenant detection middleware
        this.app.use((req, res, next) => {
            const host = req.get('host');
            console.log(`🌐 Incoming request - Host: ${host}, URL: ${req.url}`);
            
            // Check if it's a subdomain.localhost request
            if (host.includes('.localhost:3000')) {
                const subdomain = host.split('.')[0];
                console.log(`🎮 Detected tenant: ${subdomain}`);
                req.tenant = subdomain;
                req.isAdmin = false;
                return next();
            }
            
            // Admin panel access (direct localhost:3000)
            if (host === 'localhost:3000' || host.includes('localhost:3000')) {
                console.log(`📊 Admin panel access detected`);
                req.isAdmin = true;
                return next();
            }
            
            // Regular tenant access (for production domains)
            const subdomain = host.split('.')[0];
            req.tenant = subdomain;
            req.isAdmin = false;
            next();
        });
    }

    setupRoutes() {
        // Admin API Routes
        this.app.get('/api/tenants', (req, res) => {
            if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden' });
            
            this.db.all('SELECT * FROM tenants ORDER BY created_at DESC', (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            });
        });

        this.app.post('/api/tenants', async (req, res) => {
            if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden' });
            
            const { subdomain, plan = 'starter' } = req.body;
            
            try {
                const result = await this.createTenant(subdomain, plan);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/tenants/:id', async (req, res) => {
            if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden' });
            
            try {
                await this.deleteTenant(req.params.id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Admin Panel UI
        this.app.get('/', (req, res) => {
            if (req.isAdmin) {
                res.sendFile(path.join(__dirname, 'admin-panel', 'index.html'));
            } else {
                // Proxy to tenant instance
                this.proxyToTenant(req, res);
            }
        });

        // Proxy all other requests to tenant instances
        this.app.use('/', (req, res, next) => {
            if (req.isAdmin) return next();
            this.proxyToTenant(req, res);
        });
    }

    async createTenant(subdomain, plan) {
        return new Promise((resolve, reject) => {
            const port = this.basePorts + this.tenants.size;
            const maxPlayers = this.getPlanLimits(plan).maxPlayers;

            this.db.run(
                'INSERT INTO tenants (subdomain, plan, max_players, port) VALUES (?, ?, ?, ?)',
                [subdomain, plan, maxPlayers, port],
                async function(err) {
                    if (err) return reject(err);
                    
                    try {
                        // Start new Okey instance for this tenant
                        await this.startTenantInstance(subdomain, port, maxPlayers);
                        
                        resolve({
                            id: this.lastID,
                            subdomain,
                            plan,
                            port,
                            maxPlayers,
                            status: 'active'
                        });
                    } catch (startErr) {
                        reject(startErr);
                    }
                }.bind(this)
            );
        });
    }

    async startTenantInstance(subdomain, port, maxPlayers) {
        const { spawn } = require('child_process');
        
        console.log(`🚀 Starting tenant instance: ${subdomain} on port ${port}`);
        
        // Start new Node.js process for tenant using the existing server.js
        const child = spawn('node', ['server.js'], {
            env: {
                ...process.env,
                PORT: port,
                TENANT_ID: subdomain,
                MAX_PLAYERS: maxPlayers,
                DB_PATH: `./tenant-dbs/${subdomain}.db`
            },
            stdio: ['pipe', 'pipe', 'pipe'], // Capture output
        });

        // Log tenant output
        child.stdout.on('data', (data) => {
            console.log(`📤 [${subdomain}] ${data.toString().trim()}`);
        });
        
        child.stderr.on('data', (data) => {
            console.error(`📤 [${subdomain}] ERROR: ${data.toString().trim()}`);
        });

        child.on('exit', (code) => {
            console.log(`🛑 Tenant ${subdomain} exited with code ${code}`);
            this.tenants.delete(subdomain);
        });

        this.tenants.set(subdomain, { port, process: child });
        
        console.log(`✅ Started tenant ${subdomain} on port ${port}`);
        return true;
    }

    proxyToTenant(req, res) {
        console.log(`🔍 Looking for tenant: ${req.tenant}`);
        console.log(`📋 Available tenants:`, Array.from(this.tenants.keys()));
        
        let tenant = this.tenants.get(req.tenant);
        
        // If tenant not in memory, try to load from database
        if (!tenant) {
            console.log(`🔄 Tenant ${req.tenant} not in memory, checking database...`);
            this.db.get('SELECT * FROM tenants WHERE subdomain = ? AND status = "active"', [req.tenant], async (err, dbTenant) => {
                if (err || !dbTenant) {
                    console.log(`❌ Tenant ${req.tenant} not found in database`);
                    return res.status(404).send(`
                        <h1>🎮 Okey Game Not Found</h1>
                        <p>The game "${req.tenant}" does not exist or is not active.</p>
                        <p><a href="http://localhost:3000">← Back to Admin Panel</a></p>
                    `);
                }
                
                try {
                    // Start the tenant instance
                    await this.startTenantInstance(dbTenant.subdomain, dbTenant.port, dbTenant.max_players);
                    
                    // Retry proxy
                    setTimeout(() => {
                        this.proxyToTenant(req, res);
                    }, 1000);
                } catch (error) {
                    console.error(`❌ Failed to start tenant ${req.tenant}:`, error);
                    res.status(502).send('Game temporarily unavailable');
                }
            });
            return;
        }

        console.log(`✅ Proxying ${req.tenant} to port ${tenant.port}`);

        // Create proxy to tenant instance
        const proxy = createProxyMiddleware({
            target: `http://localhost:${tenant.port}`,
            changeOrigin: true,
            ws: true, // WebSocket support
            onError: (err, req, res) => {
                console.error(`❌ Proxy error for ${req.tenant}:`, err.message);
                res.status(502).send(`
                    <h1>🔧 Game Temporarily Unavailable</h1>
                    <p>The game "${req.tenant}" is starting up. Please refresh in a moment.</p>
                    <script>setTimeout(() => location.reload(), 3000);</script>
                `);
            }
        });

        proxy(req, res);
    }

    getPlanLimits(plan) {
        const plans = {
            starter: { maxPlayers: 50, price: 19 },
            pro: { maxPlayers: 200, price: 49 },
            enterprise: { maxPlayers: 1000, price: 99 }
        };
        return plans[plan] || plans.starter;
    }

    async deleteTenant(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM tenants WHERE id = ?', [id], (err, tenant) => {
                if (err) return reject(err);
                if (!tenant) return reject(new Error('Tenant not found'));

                // Stop tenant process
                const tenantInstance = this.tenants.get(tenant.subdomain);
                if (tenantInstance) {
                    tenantInstance.process.kill();
                    this.tenants.delete(tenant.subdomain);
                }

                // Delete from database
                this.db.run('DELETE FROM tenants WHERE id = ?', [id], (deleteErr) => {
                    if (deleteErr) return reject(deleteErr);
                    resolve(true);
                });
            });
        });
    }

    async loadExistingTenants() {
        return new Promise((resolve) => {
            this.db.all('SELECT * FROM tenants WHERE status = "active"', async (err, tenants) => {
                if (err || !tenants) return resolve();

                for (const tenant of tenants) {
                    try {
                        await this.startTenantInstance(tenant.subdomain, tenant.port, tenant.max_players);
                        console.log(`🔄 Restored tenant: ${tenant.subdomain}`);
                    } catch (error) {
                        console.error(`❌ Failed to restore tenant ${tenant.subdomain}:`, error);
                    }
                }
                resolve();
            });
        });
    }

    async start() {
        await this.loadExistingTenants();
        
        this.app.listen(this.adminPort, () => {
            console.log(`🚀 Okey Multi-Tenant Platform running on port ${this.adminPort}`);
            console.log(`📊 Admin Panel: http://localhost:${this.adminPort}`);
            console.log(`🎮 Create tenants: subdomain.localhost:${this.adminPort}`);
        });
    }
}

// Start the platform
const platform = new OkeyMultiTenant();
platform.start().catch(console.error);

module.exports = OkeyMultiTenant;
