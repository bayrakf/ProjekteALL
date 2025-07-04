const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const ExcelJS = require("exceljs");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;

// Backup-Funktion: Kopiert die SQLite-Datenbank in den Backup-Ordner
function backupDatabase() {
  const src = path.join(__dirname, "buchhaltung.db");
  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(backupDir, `buchhaltung-backup-${timestamp}.db`);
  fs.copyFile(src, dest, (err) => {
    if (err) {
      console.error("Backup fehlgeschlagen:", err);
    } else {
      console.log("Backup erfolgreich erstellt:", dest);
    }
  });
}

// Tägliches Backup um 03:00 Uhr nachts
cron.schedule('0 3 * * *', backupDatabase);




// Middleware-Reihenfolge: bodyParser, Session, Flash VOR allen Routen!
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "buchhaltungSecret2024",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());

// Manuelles Backup über Route (jetzt an der richtigen Stelle)
app.post("/backup", requireLogin, (req, res) => {
  backupDatabase();
  req.flash("success", "Backup wurde erstellt.");
  res.redirect("/dashboard");
});


// Route: Formular für neue Rechnung/Angebot (jetzt an der richtigen Stelle)
app.get("/invoice/new", requireLogin, (req, res) => {
  res.render("invoice_new", { user: req.session.user });
});

// POST-Route: Neue Rechnung/Angebot speichern
app.post("/invoice/new", requireLogin, (req, res) => {
  const { typ, empfaenger, datum, faellig, positionen, status, bemerkung } = req.body;
  let posArr;
  if (!positionen || typeof positionen !== "string" || positionen.trim() === "") {
    req.flash("error", "Mindestens eine Position muss angegeben werden!");
    return res.redirect("/invoice/new");
  }
  try {
    posArr = JSON.parse(positionen);
    if (!Array.isArray(posArr)) posArr = [posArr];
  } catch (e) {
    req.flash("error", "Positionen-Format ungültig! (Tipp: Positionen als Tabelle ausfüllen)");
    return res.redirect("/invoice/new");
  }
  // Fälligkeitsdatum: Wenn leer, Standard = 14 Tage nach Rechnungsdatum
  let faelligVal = faellig;
  if (!faelligVal || faelligVal.trim() === "") {
    const d = new Date(datum);
    d.setDate(d.getDate() + 14);
    faelligVal = d.toISOString().slice(0, 10);
  }
  if (!typ || !empfaenger || !datum || !Array.isArray(posArr) || posArr.length === 0) {
    req.flash("error", "Alle Pflichtfelder müssen ausgefüllt sein!");
    return res.redirect("/invoice/new");
  }
  // Automatische Berechnung: netto, mwst, brutto (19% MwSt Standard)
  let netto = 0;
  posArr.forEach(p => {
    const menge = parseFloat(p.menge) || 0;
    const preis = parseFloat(p.preis) || 0;
    netto += menge * preis;
  });
  const mwstSatz = 0.19;
  const mwst = Math.round(netto * mwstSatz * 100) / 100;
  const brutto = Math.round((netto + mwst) * 100) / 100;
  const year = datum.split("-")[0];
  db.get(
    `SELECT COUNT(*) as count FROM invoices WHERE datum LIKE ?`,
    [`${year}%`],
    (err, row) => {
      const num = (row.count + 1).toString().padStart(4, "0");
      const rechnungsnummer = `RECH-${year}${datum.replace(/-/g, "").slice(4)}-${num}`;
      db.run(
        `INSERT INTO invoices (user_id, typ, empfaenger, datum, faellig, positionen, netto, mwst, brutto, status, rechnungsnummer, bemerkung) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.session.user.id,
          typ,
          empfaenger,
          datum,
          faelligVal,
          JSON.stringify(posArr),
          netto,
          mwst,
          brutto,
          status || 'offen',
          rechnungsnummer,
          bemerkung || ''
        ],
        (err2) => {
          if (err2) {
            req.flash("error", "Fehler beim Speichern: " + (err2.message || err2));
            return res.redirect("/invoice/new");
          }
          req.flash("success", "Rechnung/Angebot gespeichert!");
          res.redirect("/dashboard");
        }
      );
    }
  );
});

// Hilfsfunktion für Rechnungsnummer
function generateRechnungsnummer(datum, cb) {
  const year = datum.split("-")[0];
  db.get(
    `SELECT COUNT(*) as count FROM transactions WHERE datum LIKE ?`,
    [`${year}%`],
    (err, row) => {
      const num = (row.count + 1).toString().padStart(4, "0");
      cb(`RECH-${year}${datum.replace(/-/g, "").slice(4)}-${num}`);
    }
  );
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/");
  },
  filename: function (req, file, cb) {
    const datum = req.body.datum || new Date().toISOString().slice(0, 10);
    generateRechnungsnummer(datum, (rechnungsnummer) => {
      const ext = path.extname(file.originalname);
      cb(null, `${rechnungsnummer}${ext}`);
    });
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});


const db = new sqlite3.Database("./buchhaltung.db");

// Migration: Tabelle für Rechnungen/Angebote (jetzt nach db-Initialisierung)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    typ TEXT, -- 'Rechnung' oder 'Angebot'
    empfaenger TEXT,
    datum TEXT,
    faellig TEXT,
    positionen TEXT, -- JSON-Array
    netto REAL,
    mwst REAL,
    brutto REAL,
    status TEXT, -- 'offen', 'bezahlt', 'storniert'
    rechnungsnummer TEXT,
    bemerkung TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      typ TEXT,
      betrag REAL,
      beschreibung TEXT,
      firma TEXT,
      datum TEXT,
      beleg TEXT,
      kategorie TEXT,
      tags TEXT,
      mwst_satz REAL DEFAULT 19.0,
      mwst_betrag REAL DEFAULT 0.0,
      wiederkehrend TEXT DEFAULT NULL,
      original_id INTEGER,
      bezahlt INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  );
  // Migration: Spalte bezahlt hinzufügen, falls sie fehlt
  db.get("PRAGMA table_info(transactions)", (err, info) => {
    db.all("PRAGMA table_info(transactions)", (err, columns) => {
      if (!columns.some(col => col.name === "bezahlt")) {
        db.run("ALTER TABLE transactions ADD COLUMN bezahlt INTEGER DEFAULT 0");
      }
      if (!columns.some(col => col.name === "kategorie")) {
        db.run("ALTER TABLE transactions ADD COLUMN kategorie TEXT");
      }
      if (!columns.some(col => col.name === "tags")) {
        db.run("ALTER TABLE transactions ADD COLUMN tags TEXT");
      }
      if (!columns.some(col => col.name === "mwst_satz")) {
        db.run("ALTER TABLE transactions ADD COLUMN mwst_satz REAL DEFAULT 19.0");
      }
      if (!columns.some(col => col.name === "mwst_betrag")) {
        db.run("ALTER TABLE transactions ADD COLUMN mwst_betrag REAL DEFAULT 0.0");
      }
      if (!columns.some(col => col.name === "wiederkehrend")) {
        db.run("ALTER TABLE transactions ADD COLUMN wiederkehrend TEXT DEFAULT NULL");
      }
      if (!columns.some(col => col.name === "original_id")) {
        db.run("ALTER TABLE transactions ADD COLUMN original_id INTEGER");
      }
    });
  });
  db.get("SELECT * FROM users WHERE username = ?", ["admin"], (err, row) => {
    if (!row) {
      const pw = bcrypt.hashSync("geheim", 10);
      db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
        "admin",
        pw,
      ]);
    }
  });
  db.get("SELECT * FROM users WHERE username = ?", ["freund"], (err, row) => {
    if (!row) {
      const pw = bcrypt.hashSync("geheim", 10);
      db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
        "freund",
        pw,
      ]);
    }
  });
});

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "buchhaltungSecret2024",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());

// Manuelles Backup über Route (jetzt an der richtigen Stelle)
app.post("/backup", requireLogin, (req, res) => {
  backupDatabase();
  req.flash("success", "Backup wurde erstellt.");
  res.redirect("/dashboard");
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

app.get("/dashboard-redirect", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  res.render("login", { error: req.flash("error") });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, user) => {
      if (!user || !bcrypt.compareSync(password, user.password)) {
        req.flash("error", "Benutzername oder Passwort falsch");
        return res.redirect("/login");
      }
      req.session.user = { id: user.id, username: user.username };
      res.redirect("/dashboard");
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});



// Dashboard mit optionaler Suche und Rechnungs-/Angebotsübersicht
app.get("/dashboard", requireLogin, async (req, res) => {
  // Wiederkehrende Buchungen prüfen und ggf. erzeugen (wie gehabt)
  const today = new Date().toISOString().slice(0, 10);
  db.all(
    "SELECT * FROM transactions WHERE user_id = ? AND wiederkehrend IS NOT NULL AND wiederkehrend != ''",
    [req.session.user.id],
    (err, wiederkehrende) => {
      if (wiederkehrende && wiederkehrende.length) {
        wiederkehrende.forEach(orig => {
          let nextDate;
          const lastDate = orig.datum;
          if (orig.wiederkehrend === 'monatlich') {
            const d = new Date(lastDate);
            d.setMonth(d.getMonth() + 1);
            nextDate = d.toISOString().slice(0, 10);
          } else if (orig.wiederkehrend === 'jaehrlich') {
            const d = new Date(lastDate);
            d.setFullYear(d.getFullYear() + 1);
            nextDate = d.toISOString().slice(0, 10);
          }
          if (nextDate && nextDate <= today) {
            db.get(
              "SELECT * FROM transactions WHERE user_id = ? AND original_id = ? AND datum = ?",
              [orig.user_id, orig.id, nextDate],
              (err2, exists) => {
                if (!exists) {
                  db.run(
                    `INSERT INTO transactions (user_id, typ, betrag, beschreibung, firma, kategorie, tags, mwst_satz, mwst_betrag, datum, beleg, bezahlt, wiederkehrend, original_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                    [
                      orig.user_id,
                      orig.typ,
                      orig.betrag,
                      orig.beschreibung,
                      orig.firma,
                      orig.kategorie,
                      orig.tags,
                      orig.mwst_satz,
                      orig.mwst_betrag,
                      nextDate,
                      null,
                      orig.wiederkehrend,
                      orig.id
                    ]
                  );
                }
              }
            );
          }
        });
      }

      // Filter-Variablen für das Dashboard (wie gehabt)
      const search = req.query.search ? `%${req.query.search}%` : null;
      const bezahltFilter = req.query.bezahlt;
      const kategorieFilter = req.query.kategorie || "";
      const tagsFilter = req.query.tags || "";
      const monatFilter = req.query.monat || "";
      const jahrFilter = req.query.jahr || "";
      const von = req.query.von || "";
      const bis = req.query.bis || "";
      let sql = "SELECT * FROM transactions WHERE user_id = ?";
      let params = [req.session.user.id];
      if (search) {
        sql += " AND (typ LIKE ? OR beschreibung LIKE ? OR firma LIKE ? OR datum LIKE ?)";
        params.push(search, search, search, search);
      }
      if (bezahltFilter === "1") {
        sql += " AND bezahlt = 1";
      } else if (bezahltFilter === "0") {
        sql += " AND bezahlt = 0";
      }
      if (kategorieFilter) {
        sql += " AND kategorie = ?";
        params.push(kategorieFilter);
      }
      if (tagsFilter) {
        sql += " AND (tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags = ?)";
        params.push(`%${tagsFilter},%`, `%,${tagsFilter}%`, `%,${tagsFilter},%`, tagsFilter);
      }
      if (monatFilter) {
        sql += " AND substr(datum,1,7) = ?";
        params.push(monatFilter);
      }
      if (jahrFilter) {
        sql += " AND substr(datum,1,4) = ?";
        params.push(jahrFilter);
      }
      if (von) {
        sql += " AND datum >= ?";
        params.push(von);
      }
      if (bis) {
        sql += " AND datum <= ?";
        params.push(bis);
      }
      sql += " ORDER BY datum DESC";

      // Rechnungs-/Angebotsübersicht laden
      db.all(
        "SELECT * FROM invoices WHERE user_id = ? ORDER BY datum DESC, id DESC",
        [req.session.user.id],
        (errInv, invoices) => {
          // Monats-/Jahresbericht: Summen nach Kategorie und Monat/Jahr (wie gehabt)
          const isMonatsbericht = req.query.bericht === 'monat' || req.query.report === 'monat';
          const isJahresbericht = req.query.bericht === 'jahr' || req.query.report === 'jahr';
          db.all(sql, params, (err, rows) => {
            let einnahmen = 0, ausgaben = 0;
            if (rows && Array.isArray(rows)) {
              rows.forEach(t => {
                if (t.typ === 'Einnahme') einnahmen += Number(t.betrag);
                if (t.typ === 'Ausgabe') ausgaben += Number(t.betrag);
              });
            }
            const saldo = einnahmen - ausgaben;

            let bericht = null;
            if (isMonatsbericht || isJahresbericht) {
              bericht = {};
              rows.forEach(t => {
                let key;
                if (isMonatsbericht) {
                  key = t.kategorie + ' ' + (t.datum ? t.datum.slice(0,7) : '');
                } else {
                  key = t.kategorie + ' ' + (t.datum ? t.datum.slice(0,4) : '');
                }
                if (!bericht[key]) bericht[key] = { einnahmen: 0, ausgaben: 0 };
                if (t.typ === 'Einnahme') bericht[key].einnahmen += Number(t.betrag);
                if (t.typ === 'Ausgabe') bericht[key].ausgaben += Number(t.betrag);
              });
            }

            res.render("dashboard", {
              user: req.session.user,
              entries: rows || [],
              transactions: rows || [],
              invoices: invoices || [],
              success: req.flash("success"),
              error: req.flash("error"),
              search: req.query.search || "",
              bezahltFilter: bezahltFilter || "",
              kategorieFilter,
              tagsFilter,
              monatFilter,
              jahrFilter,
              von,
              bis,
              einnahmen,
              ausgaben,
              saldo,
              bericht,
              isMonatsbericht,
              isJahresbericht
            });
          });
        }
      );
    }
  );
});

// CSV-Export
app.get("/export-csv", requireLogin, (req, res) => {
  db.all(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY datum DESC",
    [req.session.user.id],
    (err, rows) => {
      let csv = 'Typ;Betrag;Beschreibung;Firma;Datum;Beleg;Bezahlt\n';
      rows.forEach(row => {
        csv += `${row.typ};${row.betrag};${row.beschreibung};${row.firma};${row.datum};${row.beleg || ''};${row.bezahlt ? 'Ja' : 'Nein'}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="buchhaltung.csv"');
      res.send(csv);
    }
  );
});

// Bezahlt-Status umschalten
app.post("/toggle-bezahlt/:id", requireLogin, (req, res) => {
  db.get(
    "SELECT bezahlt FROM transactions WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.user.id],
    (err, row) => {
      if (!row) return res.redirect("/dashboard");
      const neuerStatus = row.bezahlt ? 0 : 1;
      db.run(
        "UPDATE transactions SET bezahlt = ? WHERE id = ? AND user_id = ?",
        [neuerStatus, req.params.id, req.session.user.id],
        () => res.redirect("/dashboard")
      );
    }
  );
});

app.post(
  "/add",
  requireLogin,
  upload.single("beleg"),
  (req, res) => {
    const { typ, betrag, beschreibung, firma, datum, kategorie, tags, mwst_satz } = req.body;
    let beleg = "";
    if (req.file) {
      beleg = req.file.filename;
    }
    if (!typ || !betrag || !beschreibung || !firma || !datum || !kategorie || mwst_satz === undefined) {
      req.flash("error", "Alle Felder müssen ausgefüllt sein!");
      return res.redirect("/dashboard");
    }
    const betragNum = parseFloat(betrag);
    const mwstSatzNum = parseFloat(mwst_satz);
    const mwstBetrag = betragNum * mwstSatzNum / (100 + mwstSatzNum);
    db.run(
      "INSERT INTO transactions (user_id, typ, betrag, beschreibung, firma, kategorie, tags, mwst_satz, mwst_betrag, datum, beleg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.session.user.id,
        typ,
        betragNum,
        beschreibung,
        firma,
        kategorie,
        tags,
        mwstSatzNum,
        mwstBetrag,
        datum,
        beleg,
      ],
      (err) => {
        if (err) {
          req.flash("error", "Fehler beim Speichern: " + (err.message || err));
        } else {
          req.flash("success", "Eintrag gespeichert!");
        }
        res.redirect("/dashboard");
      }
    );
  }
);

app.get("/beleg/:filename", requireLogin, (req, res) => {
  const filename = req.params.filename;
  const file = path.join(__dirname, "uploads", filename);
  res.sendFile(file);
});

app.post("/delete/:id", requireLogin, (req, res) => {
  db.get(
    "SELECT beleg FROM transactions WHERE id = ? AND user_id = ?",
    [req.params.id, req.session.user.id],
    (err, row) => {
      if (row && row.beleg) {
        fs.unlink("./uploads/" + row.beleg, () => {});
      }
      db.run(
        "DELETE FROM transactions WHERE id = ? AND user_id = ?",
        [req.params.id, req.session.user.id],
        (err2) => {
          req.flash("success", "Eintrag gelöscht!");
          res.redirect("/dashboard");
        }
      );
    }
  );
});

app.get("/export", requireLogin, async (req, res) => {
  db.all(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY datum DESC",
    [req.session.user.id],
    async (err, rows) => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Buchhaltung");

      worksheet.columns = [
        { header: "Typ", key: "typ", width: 15 },
        { header: "Betrag (€)", key: "betrag", width: 15 },
        { header: "Beschreibung", key: "beschreibung", width: 40 },
        { header: "Firma", key: "firma", width: 30 },
        { header: "Datum", key: "datum", width: 15 },
        { header: "Beleg-Datei", key: "beleg", width: 35 },
      ];

      rows.forEach((row) => {
        worksheet.addRow({
          typ: row.typ,
          betrag: row.betrag,
          beschreibung: row.beschreibung,
          firma: row.firma,
          datum: row.datum,
          beleg: row.beleg,
        });
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="buchhaltung.xlsx"'
      );
      await workbook.xlsx.write(res);
      res.end();
    }
  );
});

app.get("/users", requireLogin, (req, res) => {
  if (req.session.user.username !== "admin") {
    req.flash("error", "Keine Berechtigung.");
    return res.redirect("/dashboard");
  }
  db.all("SELECT id, username FROM users", [], (err, users) => {
    res.render("users", { users, success: req.flash("success"), error: req.flash("error") });
  });
});

app.post("/users/add", requireLogin, (req, res) => {
  if (req.session.user.username !== "admin") return res.redirect("/dashboard");
  const { username, password } = req.body;
  const pw = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, pw], (err) => {
    if (err) req.flash("error", "Fehler beim Anlegen.");
    else req.flash("success", "Benutzer hinzugefügt.");
    res.redirect("/users");
  });
});

app.post("/users/delete/:id", requireLogin, (req, res) => {
  if (req.session.user.username !== "admin") return res.redirect("/dashboard");
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
    if (err) req.flash("error", "Fehler beim Löschen.");
    else req.flash("success", "Benutzer gelöscht.");
    res.redirect("/users");
  });
});



// --- ALLE Routen erst NACH Initialisierung und Middleware! ---
// (Die Initialisierung und Middleware stehen weiter unten im File, daher ALLE Routen nach unten verschieben!)

// --- Routen-Block: BEGIN ---
let routesRegistered = false;
function registerRoutes(app, db, requireLogin) {
  if (routesRegistered) return;
  routesRegistered = true;

  // GET: Einzelne Rechnung/Angebot für Bearbeiten-Modal (AJAX)
  app.get("/invoice/:id/edit", requireLogin, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM invoices WHERE id = ? AND user_id = ?", [id, req.session.user.id], (err, invoice) => {
      if (err || !invoice) return res.status(404).send("Nicht gefunden");
      res.json(invoice);
    });
  });

  // POST: Update einer Rechnung/Angebots (Bearbeiten)
  app.post("/invoice/:id/edit", requireLogin, (req, res) => {
    const id = req.params.id;
    const data = req.body;
    // Pflichtfelder prüfen
    if (!data.empfaenger || !data.typ || !data.datum || !data.faellig || !data.positionen) {
      return res.status(400).json({ error: "Bitte alle Pflichtfelder ausfüllen und mindestens eine Position angeben." });
    }
    let posArr;
    try {
      if (typeof data.positionen === 'string') {
        posArr = JSON.parse(data.positionen);
      } else {
        posArr = data.positionen;
      }
      if (!Array.isArray(posArr) || posArr.length === 0) throw new Error();
    } catch (e) {
      return res.status(400).json({ error: "Positionen-Format ungültig!" });
    }
    // Summenberechnung wie beim Neuanlegen (MwSt 19%)
    let netto = 0;
    posArr.forEach(p => {
      const menge = parseFloat(p.menge) || 0;
      const preis = parseFloat(p.preis) || 0;
      netto += menge * preis;
    });
    const mwstSatz = 0.19;
    const mwst = Math.round(netto * mwstSatz * 100) / 100;
    const brutto = Math.round((netto + mwst) * 100) / 100;
    db.run(
      `UPDATE invoices SET typ=?, empfaenger=?, datum=?, faellig=?, positionen=?, netto=?, mwst=?, brutto=?, status=?, bemerkung=? WHERE id=? AND user_id=?`,
      [
        data.typ,
        data.empfaenger,
        data.datum,
        data.faellig,
        JSON.stringify(posArr),
        netto,
        mwst,
        brutto,
        data.status || 'offen',
        data.bemerkung || '',
        id,
        req.session.user.id
      ],
      function (err) {
        if (err) return res.status(500).json({ error: "Fehler beim Speichern." });
        res.json({ success: true });
      }
    );
  });

  // Route: Rechnung/Angebot löschen (POST, nur eigene)
  app.post('/invoice/:id/delete', requireLogin, (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM invoices WHERE id = ? AND user_id = ?', [id, req.session.user.id], function(err) {
      if (err) return res.status(500).send('Fehler beim Löschen');
      res.sendStatus(200);
    });
  });

  // PDF-Export für Rechnung/Angebot (HTML2PDF über Browser)
  const puppeteer = require('puppeteer');

  app.get('/invoice/:id/pdf', requireLogin, async (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, req.session.user.id], async (err, invoice) => {
      if (err || !invoice) return res.status(404).send('Nicht gefunden');
      // EJS-HTML für PDF generieren
      res.render('invoice_pdf', { invoice }, async (err2, html) => {
        if (err2) return res.status(500).send('Fehler beim Rendern');
        try {
          const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: 'networkidle0' });
          const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 32, bottom: 32, left: 24, right: 24 } });
          await browser.close();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${invoice.rechnungsnummer}.pdf"`);
          res.send(pdf);
        } catch (e) {
          res.status(500).send('PDF-Fehler: ' + e);
        }
      });
    });
  });

  // AJAX-Route: Liefert die Rechnungs-/Angebots-Tabelle als HTML-Partial für das Modal (mit Bearbeiten-Button)
  app.get("/invoices/table", requireLogin, (req, res) => {
    db.all(
      "SELECT * FROM invoices WHERE user_id = ? ORDER BY datum DESC, id DESC",
      [req.session.user.id],
      (err, invoices) => {
        if (err) return res.status(500).send("Fehler beim Laden der Rechnungen/Angebote.");
        let html = `<table id=\"invoices-table\" style=\"min-width:950px;width:100%;background:#f8fafc;border-radius:7px;margin-bottom:0;\">`;
        html += `<tr style=\"background:#e5e7eb;\">` +
          `<th style=\"padding:7px 10px;\">Nr.</th>` +
          `<th style=\"padding:7px 10px;\">Typ</th>` +
          `<th style=\"padding:7px 10px;\">Empfänger</th>` +
          `<th style=\"padding:7px 10px;\">Datum</th>` +
          `<th style=\"padding:7px 10px;\">Fällig</th>` +
          `<th style=\"padding:7px 10px;\">Netto (€)</th>` +
          `<th style=\"padding:7px 10px;\">MwSt (€)</th>` +
          `<th style=\"padding:7px 10px;\">Brutto (€)</th>` +
          `<th style=\"padding:7px 10px;\">Status</th>` +
          `<th style=\"padding:7px 10px;\">Notiz</th>` +
          `<th style=\"padding:7px 10px;\">Aktion</th>` +
          `</tr>`;
        invoices.forEach(inv => {
          html += `<tr class=\"invoice-row\" data-typ=\"${inv.typ.toLowerCase()}\">` +
            `<td style=\"padding:7px 10px;font-family:monospace;\">${inv.rechnungsnummer}</td>` +
            `<td style=\"padding:7px 10px;\">${inv.typ}</td>` +
            `<td style=\"padding:7px 10px;\">${inv.empfaenger}</td>` +
            `<td style=\"padding:7px 10px;\">${inv.datum}</td>` +
            `<td style=\"padding:7px 10px;\">${inv.faellig}</td>` +
            `<td style=\"padding:7px 10px;text-align:right;\">${Number(inv.netto).toFixed(2)}</td>` +
            `<td style=\"padding:7px 10px;text-align:right;\">${Number(inv.mwst).toFixed(2)}</td>` +
            `<td style=\"padding:7px 10px;text-align:right;\">${Number(inv.brutto).toFixed(2)}</td>` +
            `<td style=\"padding:7px 10px;\"><span style=\"padding:3px 10px;border-radius:5px;font-weight:600;background:${inv.status==='bezahlt'?'#22c55e':(inv.status==='storniert'?'#f87171':'#fde68a')};color:${inv.status==='bezahlt'?'#fff':(inv.status==='storniert'?'#fff':'#b45309')};\">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>` +
            `<td style=\"padding:7px 10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\" title=\"${inv.bemerkung}\">${inv.bemerkung}</td>` +
            `<td style=\"padding:7px 10px;display:flex;gap:7px;justify-content:center;align-items:center;\">` +
              `<button class=\"btn-pdf\" data-id=\"${inv.id}\" title=\"PDF anzeigen\" style=\"background:none;border:none;cursor:pointer;\"><img src='/assets/pdf-icon.png' alt='PDF' style='height:22px;vertical-align:middle;'/></button>` +
              `<button class=\"btn-edit-invoice\" data-id=\"${inv.id}\" title=\"Bearbeiten\" style=\"background:none;border:none;cursor:pointer;\"><span style=\"font-size:18px;color:#2563eb;\">✎</span></button>` +
              `<button class=\"btn-delete-invoice\" data-id=\"${inv.id}\" title=\"Löschen\" style=\"background:none;border:none;cursor:pointer;\"><span style=\"font-size:18px;color:#dc2626;\">🗑️</span></button>` +
            `</td>` +
            `</tr>`;
        });
        html += `</table>`;
        res.send(html);
      }
    );
  });
}

// --- Routen-Block: ENDE ---

// Nach Initialisierung und Middleware: Routen registrieren
// (db, app, requireLogin müssen initialisiert sein!)
// Stelle sicher, dass dies NACH allen const app = express(), db = new sqlite3.Database... und Middleware-Aufrufen steht!
registerRoutes(app, db, requireLogin);

// GET: Einzelne Rechnung/Angebot für Bearbeiten-Modal (AJAX)
app.get("/invoice/:id/edit", requireLogin, (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM invoices WHERE id = ? AND user_id = ?", [id, req.session.user.id], (err, invoice) => {
    if (err || !invoice) return res.status(404).send("Nicht gefunden");
    res.json(invoice);
  });
});

// POST: Update einer Rechnung/Angebots (Bearbeiten)
app.post("/invoice/:id/edit", requireLogin, (req, res) => {
  const id = req.params.id;
  const data = req.body;
  // Pflichtfelder prüfen
  if (!data.empfaenger || !data.typ || !data.datum || !data.faellig || !data.positionen) {
    return res.status(400).json({ error: "Bitte alle Pflichtfelder ausfüllen und mindestens eine Position angeben." });
  }
  let posArr;
  try {
    if (typeof data.positionen === 'string') {
      posArr = JSON.parse(data.positionen);
    } else {
      posArr = data.positionen;
    }
    if (!Array.isArray(posArr) || posArr.length === 0) throw new Error();
  } catch (e) {
    return res.status(400).json({ error: "Positionen-Format ungültig!" });
  }
  // Summenberechnung wie beim Neuanlegen (MwSt 19%)
  let netto = 0;
  posArr.forEach(p => {
    const menge = parseFloat(p.menge) || 0;
    const preis = parseFloat(p.preis) || 0;
    netto += menge * preis;
  });
  const mwstSatz = 0.19;
  const mwst = Math.round(netto * mwstSatz * 100) / 100;
  const brutto = Math.round((netto + mwst) * 100) / 100;
  db.run(
    `UPDATE invoices SET typ=?, empfaenger=?, datum=?, faellig=?, positionen=?, netto=?, mwst=?, brutto=?, status=?, bemerkung=? WHERE id=? AND user_id=?`,
    [
      data.typ,
      data.empfaenger,
      data.datum,
      data.faellig,
      JSON.stringify(posArr),
      netto,
      mwst,
      brutto,
      data.status || 'offen',
      data.bemerkung || '',
      id,
      req.session.user.id
    ],
    function (err) {
      if (err) return res.status(500).json({ error: "Fehler beim Speichern." });
      res.json({ success: true });
    }
  );
});

// Route: Rechnung/Angebot löschen (POST, nur eigene)
app.post('/invoice/:id/delete', requireLogin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM invoices WHERE id = ? AND user_id = ?', [id, req.session.user.id], function(err) {
    if (err) return res.status(500).send('Fehler beim Löschen');
    res.sendStatus(200);
  });
});

// PDF-Export für Rechnung/Angebot (HTML2PDF über Browser)
const puppeteer = require('puppeteer');

app.get('/invoice/:id/pdf', requireLogin, async (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [id, req.session.user.id], async (err, invoice) => {
    if (err || !invoice) return res.status(404).send('Nicht gefunden');
    // EJS-HTML für PDF generieren
    res.render('invoice_pdf', { invoice }, async (err2, html) => {
      if (err2) return res.status(500).send('Fehler beim Rendern');
      try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 32, bottom: 32, left: 24, right: 24 } });
        await browser.close();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${invoice.rechnungsnummer}.pdf"`);
        res.send(pdf);
      } catch (e) {
        res.status(500).send('PDF-Fehler: ' + e);
      }
    });
  });
});

// AJAX-Route: Liefert die Rechnungs-/Angebots-Tabelle als HTML-Partial für das Modal (mit Bearbeiten-Button)
app.get("/invoices/table", requireLogin, (req, res) => {
  db.all(
    "SELECT * FROM invoices WHERE user_id = ? ORDER BY datum DESC, id DESC",
    [req.session.user.id],
    (err, invoices) => {
      if (err) return res.status(500).send("Fehler beim Laden der Rechnungen/Angebote.");
      let html = `<table id=\"invoices-table\" style=\"min-width:950px;width:100%;background:#f8fafc;border-radius:7px;margin-bottom:0;\">`;
      html += `<tr style=\"background:#e5e7eb;\">` +
        `<th style=\"padding:7px 10px;\">Nr.</th>` +
        `<th style=\"padding:7px 10px;\">Typ</th>` +
        `<th style=\"padding:7px 10px;\">Empfänger</th>` +
        `<th style=\"padding:7px 10px;\">Datum</th>` +
        `<th style=\"padding:7px 10px;\">Fällig</th>` +
        `<th style=\"padding:7px 10px;\">Netto (€)</th>` +
        `<th style=\"padding:7px 10px;\">MwSt (€)</th>` +
        `<th style=\"padding:7px 10px;\">Brutto (€)</th>` +
        `<th style=\"padding:7px 10px;\">Status</th>` +
        `<th style=\"padding:7px 10px;\">Notiz</th>` +
        `<th style=\"padding:7px 10px;\">Aktion</th>` +
        `</tr>`;
      invoices.forEach(inv => {
        html += `<tr class=\"invoice-row\" data-typ=\"${inv.typ.toLowerCase()}\">` +
          `<td style=\"padding:7px 10px;font-family:monospace;\">${inv.rechnungsnummer}</td>` +
          `<td style=\"padding:7px 10px;\">${inv.typ}</td>` +
          `<td style=\"padding:7px 10px;\">${inv.empfaenger}</td>` +
          `<td style=\"padding:7px 10px;\">${inv.datum}</td>` +
          `<td style=\"padding:7px 10px;\">${inv.faellig}</td>` +
          `<td style=\"padding:7px 10px;text-align:right;\">${Number(inv.netto).toFixed(2)}</td>` +
          `<td style=\"padding:7px 10px;text-align:right;\">${Number(inv.mwst).toFixed(2)}</td>` +
          `<td style=\"padding:7px 10px;text-align:right;\">${Number(inv.brutto).toFixed(2)}</td>` +
          `<td style=\"padding:7px 10px;\"><span style=\"padding:3px 10px;border-radius:5px;font-weight:600;background:${inv.status==='bezahlt'?'#22c55e':(inv.status==='storniert'?'#f87171':'#fde68a')};color:${inv.status==='bezahlt'?'#fff':(inv.status==='storniert'?'#fff':'#b45309')};\">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>` +
          `<td style=\"padding:7px 10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\" title=\"${inv.bemerkung}\">${inv.bemerkung}</td>` +
          `<td style=\"padding:7px 10px;display:flex;gap:7px;justify-content:center;align-items:center;\">` +
            `<button class=\"btn-pdf\" data-id=\"${inv.id}\" title=\"PDF anzeigen\" style=\"background:none;border:none;cursor:pointer;\"><img src='/assets/pdf-icon.png' alt='PDF' style='height:22px;vertical-align:middle;'/></button>` +
            `<button class=\"btn-edit-invoice\" data-id=\"${inv.id}\" title=\"Bearbeiten\" style=\"background:none;border:none;cursor:pointer;\"><span style=\"font-size:18px;color:#2563eb;\">✎</span></button>` +
            `<button class=\"btn-delete-invoice\" data-id=\"${inv.id}\" title=\"Löschen\" style=\"background:none;border:none;cursor:pointer;\"><span style=\"font-size:18px;color:#dc2626;\">🗑️</span></button>` +
          `</td>` +
          `</tr>`;
      });
      html += `</table>`;
      res.send(html);
    }
  );
});

// Serve the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Serve the Buchhaltungsseite
app.get('/buchhaltung', (req, res) => {
  if (!req.session.user) return res.redirect("/login?redirect=buchhaltung");
  res.redirect('/dashboard'); // Nach Login zur Buchhaltung weiterleiten
});

// Füge app.listen hinzu, um sicherzustellen, dass der Server auf dem angegebenen Port lauscht
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});



