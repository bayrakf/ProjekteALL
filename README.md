# ProjekteALL

Eine Sammlung von Premium-Webprojekten mit modernem Design und professioneller Funktionalität.

## 🏢 Abdullah Elektrotechnik - Buchhaltungssystem

Ein vollständiges **Premium-Buchhaltungssystem** für Elektrotechnik-Unternehmen mit modernem Glasmorphismus-Design und professioneller Funktionalität.

### ✨ Hauptfunktionen

#### 🌟 Landing Page
- **Hero-Section** mit animierten Call-to-Action Buttons
- **Services-Übersicht** mit professionellen Bildern
- **Kontakt-Sektion** mit Google Maps Integration
- **Responsive Design** für alle Geräte
- **SEO-optimiert** und **Accessibility-konform**

#### 💼 Buchhaltungs-Dashboard
- **Live Finanz-Dashboard** mit echten Berechnungen
- **Einnahmen/Ausgaben** Verwaltung mit Kategorisierung
- **MwSt-Berechnung** automatisch
- **Drag & Drop** Datei-Upload für Belege
- **Backup-System** mit automatischen täglichen Sicherungen

#### 📋 Rechnungen & Angebote
- **Professionelle PDF-Generierung**
- **Dynamische Positionen** mit Mengen und Preisen
- **Status-Tracking** (Offen, Bezahlt, Storniert)
- **Automatische Rechnungsnummerierung**
- **Export-Funktionen** (PDF, Excel)

#### 📊 Finanz-Dashboard
- **Echtzeit-Statistiken** mit animierten Karten
- **Umsatz-Tracking** mit visuellen Indikatoren
- **Gewinn/Verlust-Analyse** auf einen Blick
- **Rechnungsstatus-Übersicht** mit Farb-Coding
- **Responsive Grid-Layout** für alle Bildschirmgrößen

#### 💰 Steuer-Vorbereitung
- **USt-Voranmeldung** mit automatischer Berechnung
- **EÜR-Export** (Einnahmen-Überschuss-Rechnung)
- **DATEV-Export** für Steuerberater
- **Steuerberichte** (Kassenbuch, Vorsteuer-Aufstellung)
- **XML-Export** für ELSTER

#### 🎨 Premium Modal-System
- **Glasmorphismus-Design** mit Blur-Effekten
- **Drag & Drop** - Modals verschiebbar
- **Resize-Funktionalität** - Größe anpassbar
- **Fokus-Management** für Accessibility
- **Escape/Overlay-Click** zum Schließen
- **ARIA-konform** für Screenreader

### 🛠️ Technologie-Stack

#### Backend
- **Node.js** - Server-Runtime
- **Express.js** - Web-Framework
- **SQLite3** - Lokale Datenbank
- **Multer** - Datei-Upload Middleware
- **bcrypt** - Passwort-Hashing
- **express-session** - Session-Management

#### Frontend
- **EJS Templates** - Server-side Rendering
- **Vanilla JavaScript ES6+** - Client-side Logic
- **CSS3** mit modernen Features
- **Google Fonts (Inter)** - Typography
- **Responsive Design** - Mobile-first Approach

#### Design-System
- **Glasmorphismus** - Moderne Blur-Effekte
- **Gold-Akzente (#f0c040)** - Premium-Branding
- **Gradient-Buttons** - Hochwertige Interaktionen
- **Box-Shadows** - Tiefe und Dimension
- **Smooth Animations** - Professionelle Übergänge

### 🚀 Installation & Setup

```bash
# Repository klonen
git clone https://github.com/bayrakf/ProjekteALL.git
cd ProjekteALL/abdullah

# Dependencies installieren
npm install

# Server starten
node app.js
```

**Anwendung öffnen:** `http://localhost:3000`

### 🔐 Login-Daten
```
Benutzername: admin
Passwort: admin123
```

### 📁 Projektstruktur

```
abdullah/
├── app.js                   # Express Server & Routing
├── buchhaltung.db          # SQLite Datenbank
├── package.json            # Dependencies
├── README.md               # Projekt-Dokumentation
├── backups/                # Automatische Backups
├── public/                 # Static Assets
│   ├── landing.html        # Landing Page
│   └── style.css           # Global Styles
├── uploads/                # Hochgeladene Belege
└── views/                  # EJS Templates
    ├── dashboard.ejs       # Hauptdashboard
    ├── login.ejs           # Login-Seite
    ├── users.ejs           # Benutzerverwaltung
    ├── invoice_new.ejs     # Neue Rechnung
    └── invoice_pdf.ejs     # PDF-Template
```

### 🎯 Features im Detail

#### Dashboard-Module
1. **Einträge-Verwaltung** - Einnahmen/Ausgaben erfassen
2. **Rechnungs-Erstellung** - PDF-Generation mit Corporate Design
3. **Finanz-Übersicht** - Live-Berechnungen und Statistiken
4. **Steuer-Tools** - USt, EÜR, DATEV für Compliance
5. **Filter & Berichte** - Erweiterte Datenauswertung

#### Benutzer-System
- **Admin-Bereich** mit Benutzerverwaltung
- **Session-basierte Authentifizierung**
- **Rollen-System** (Admin/Benutzer)
- **Sichere Passwort-Hashes**

#### Daten-Management
- **SQLite-Datenbank** für lokale Speicherung
- **Automatische Backups** täglich um 03:00 Uhr
- **CSV/Excel-Export** für externe Systeme
- **Beleg-Upload** mit PDF/Bild-Support

### 🌟 Design-Highlights

- **Luxuriöses Glasmorphismus-Design** mit Transparenz-Effekten
- **Gold-Farbschema** für Premium-Feeling
- **Responsive Modals** mit professioneller UX
- **Animated Hover-States** für alle Interaktionen
- **Corporate Identity** durchgehend konsistent

---

## 🏠 HausCare - Hausmeister-Dienste
## 🏠 HausCare - Hausmeister-Dienste

Eine moderne **React-Website** für professionelle Hausmeister-Dienstleistungen mit Shadcn/UI Components.

### ✨ Features
- **React 18** mit TypeScript für Type-Safety
- **Tailwind CSS** für utility-first Styling
- **Shadcn/UI Components** für konsistente UI
- **Vite Build-System** für schnelle Entwicklung
- **Responsive Design** für alle Geräte
- **Moderne Komponenten-Architektur**

### 🛠️ Technologien
- **React 18** - Frontend Framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build Tool & Dev Server
- **Tailwind CSS** - Utility-first CSS
- **Shadcn/UI** - Component Library

### 🚀 Installation
```bash
cd haus-care
npm install
npm run dev
```

---

## 📁 Repository-Struktur

```
ProjekteALL/
├── abdullah/                 # Buchhaltungssystem
│   ├── app.js               # Backend-Server
│   ├── views/               # EJS Templates
│   ├── public/              # Static Files
│   └── uploads/             # File Uploads
│
├── haus-care/               # React-Website
│   ├── src/                 # Source Code
│   ├── components/          # React Components
│   └── public/              # Static Assets
│
└── README.md                # Diese Datei
```

## 🎨 Design-Philosophie

Alle Projekte folgen einer **Premium-Design-Philosophie**:
- **Glasmorphismus-Effekte** für moderne Optik
- **Hochwertige Farbpaletten** (Gold, Blau, Grün)
- **Smooth Animationen** und Hover-Effekte
- **Responsive Design** für alle Geräte
- **Accessibility-Standards** (ARIA, Fokus-Management)
- **Professional UX** mit durchdachter Navigation

## 🔧 Entwicklung

### Git Workflow:
```bash
git add .
git commit -m "Feature: Beschreibung der Änderungen"
git push origin main
```

### Branching:
- `main` - Produktions-Branch
- `develop` - Entwicklungs-Branch
- `feature/*` - Feature-Branches

## 📈 Entwicklungs-Roadmap

### 🏢 Abdullah Elektrotechnik:
- [x] **Landing Page** - Premium Hero & Services
- [x] **Buchhaltungs-Dashboard** - Core Funktionalität
- [x] **Rechnungen & Angebote** - PDF-Generation
- [x] **Finanz-Dashboard** - Live-Statistiken
- [x] **Steuer-Vorbereitung** - USt, EÜR, DATEV
- [ ] **Banking & Zahlungsverfolgung** - Konten & Transaktionen
- [ ] **Erweiterte Kundenverwaltung** - CRM-Features
- [ ] **Lieferantenverwaltung** - Eingangsrechnungen
- [ ] **Mobile App** - React Native Version

### 🏠 HausCare:
- [x] **Landing Page** - React Components
- [x] **Service-Seiten** - Detailansichten
- [ ] **Online-Buchungssystem** - Terminvereinbarung
- [ ] **Kundenkonto** - User Dashboard
- [ ] **Admin-Dashboard** - Verwaltung

## 👨‍💻 Autor

**bayrakf** - [GitHub](https://github.com/bayrakf)

## 📄 Lizenz

Diese Projekte sind für Bildungs- und Portfolio-Zwecke erstellt.

---

*Erstellt mit ❤️ und modernsten Web-Technologien*
