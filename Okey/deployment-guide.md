# Okey-Spiel Deployment Guide

## 1. VPS Setup (Ubuntu/Debian)

```bash
# Server vorbereiten
sudo apt update
sudo apt install nodejs npm nginx

# App hochladen
git clone [dein-repository]
cd okey-game
npm install

# PM2 für Prozess-Management
npm install -g pm2
pm2 start server.js --name "okey-game"
pm2 startup
pm2 save
```

## 2. Nginx Konfiguration

```nginx
server {
    listen 80;
    server_name deine-domain.de;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 3. SSL mit Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de
```

## 4. Firewall Setup

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 5. Monitoring

```bash
# Logs anschauen
pm2 logs okey-game

# Status prüfen
pm2 status

# App neustarten
pm2 restart okey-game
```

## Kosten-Beispiel:

- **VPS (Hetzner):** 4€/Monat
- **Domain:** 10€/Jahr
- **SSL:** Kostenlos (Let's Encrypt)
- **Total:** ~5€/Monat

## Cloud-Alternative (Einfacher):

### Railway.app
1. GitHub Repository erstellen
2. Railway mit GitHub verbinden
3. Auto-Deploy aktivieren
4. Custom Domain hinzufügen

### Heroku
1. `Procfile` erstellen: `web: node server.js`
2. `heroku create dein-okey-spiel`
3. `git push heroku main`

## Multi-Tenant Okey-Hosting Geschäftsmodell

### 💰 Preismodell (Beispiel):
- **Starter:** 19€/Monat - Bis 50 gleichzeitige Spieler
- **Pro:** 49€/Monat - Bis 200 gleichzeitige Spieler  
- **Enterprise:** 99€/Monat - Bis 1000 Spieler + Custom Domain

### 🏗️ Technische Architektur:

```
🌐 Load Balancer (Nginx)
├── 🎮 Instance 1: kunde1.okeyhost.de
├── 🎮 Instance 2: kunde2.okeyhost.de
├── 🎮 Instance 3: kunde3.okeyhost.de
└── 📊 Admin Panel: admin.okeyhost.de
```

### 🔧 Multi-Tenant Setup:

#### 1. Database Schema pro Kunde:
```sql
-- Kunde-spezifische Datenbanken
okey_kunde1.db
okey_kunde2.db  
okey_kunde3.db

-- Oder eine Master-DB:
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY,
    subdomain TEXT UNIQUE,
    plan TEXT,
    max_players INTEGER,
    custom_domain TEXT,
    created_at DATETIME
);

CREATE TABLE tenant_users (
    id INTEGER PRIMARY KEY,
    tenant_id INTEGER,
    username TEXT,
    -- ...weitere Felder
);
```

#### 2. Dynamic Instance Management:
```javascript
// Multi-Tenant Server Setup
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Tenant Detection
app.use((req, res, next) => {
    const subdomain = req.get('host').split('.')[0];
    req.tenant = subdomain;
    next();
});

// Proxy zu spezifischer Okey-Instance
app.use('/', createProxyMiddleware({
    target: (req) => `http://localhost:${3000 + getTenantPort(req.tenant)}`,
    changeOrigin: true,
    ws: true // WebSocket Support
}));
```

#### 3. Automatisches Provisioning:
```javascript
// Neuen Tenant erstellen
async function createTenant(subdomain, plan) {
    // 1. Database erstellen
    await createTenantDatabase(subdomain);
    
    // 2. Okey-Instance starten
    const port = await getNextAvailablePort();
    await startOkeyInstance(subdomain, port);
    
    // 3. Nginx Config updaten
    await updateNginxConfig(subdomain, port);
    
    // 4. SSL Zertifikat erstellen
    await createSSLCert(subdomain);
    
    return { subdomain, port, status: 'active' };
}
```

### 🎨 Kundenverwaltung Panel:

#### Admin Dashboard Features:
- 📊 Kunde hinzufügen/entfernen
- 📈 Resource Monitoring pro Kunde
- 💰 Billing & Payment Integration
- 🎮 Spiel-Statistiken
- 🔧 Server-Health Monitoring

#### Kunden-Dashboard Features:
- 🎮 Ihr Okey-Spiel verwalten
- 👥 Spieler-Statistiken  
- 🎨 Theme/Branding anpassen
- 📊 Analytics & Reports
- 💳 Billing-Übersicht

### 🚀 Automatisierte Deployment Pipeline:

```yaml
# docker-compose.yml für Multi-Tenant
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: 
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
  
  okey-template:
    build: .
    environment:
      - NODE_ENV=production
    volumes:
      - ./tenant-configs:/app/configs
```

### 💰 Revenue Calculator:

```javascript
// Beispiel-Rechnung:
const customers = {
    starter: { count: 20, price: 19 },    // 380€
    pro: { count: 10, price: 49 },        // 490€  
    enterprise: { count: 3, price: 99 }   // 297€
};

const monthlyRevenue = 380 + 490 + 297; // = 1.167€/Monat
const yearlyRevenue = monthlyRevenue * 12; // = 14.004€/Jahr

// Kosten:
// - Server: 100€/Monat (Dedicated)
// - Domain/SSL: 20€/Monat
// - Entwicklung: 40h/Monat * 50€ = 2000€
// Net Profit: ~10.000€/Jahr
```
