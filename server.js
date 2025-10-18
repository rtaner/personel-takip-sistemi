const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Veritabanı bağlantısı
const dbPath = process.env.DB_PATH || 'personel_takip.db';
const db = new sqlite3.Database(dbPath);

// Veritabanı tablolarını oluştur
db.serialize(() => {
  // Personel tablosu
  db.run(`CREATE TABLE IF NOT EXISTS personel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    soyad TEXT NOT NULL,
    pozisyon TEXT,
    telefon TEXT,
    email TEXT,
    baslangic_tarihi DATE,
    aktif BOOLEAN DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Notlar tablosu
  db.run(`CREATE TABLE IF NOT EXISTS notlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personel_id INTEGER,
    not_metni TEXT NOT NULL,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    kategori TEXT DEFAULT 'genel',
    FOREIGN KEY (personel_id) REFERENCES personel (id)
  )`);

  // Görevler tablosu
  db.run(`CREATE TABLE IF NOT EXISTS gorevler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personel_id INTEGER,
    gorev_baslik TEXT NOT NULL,
    gorev_aciklama TEXT,
    atanma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    bitis_tarihi DATE,
    durum TEXT DEFAULT 'beklemede',
    performans_puani INTEGER,
    FOREIGN KEY (personel_id) REFERENCES personel (id)
  )`);
});

// API Routes

// Tüm personeli getir
app.get('/api/personel', (req, res) => {
  db.all('SELECT * FROM personel WHERE aktif = 1 ORDER BY ad, soyad', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Yeni personel ekle
app.post('/api/personel', (req, res) => {
  const { ad, soyad, pozisyon, telefon, email, baslangic_tarihi } = req.body;
  
  db.run(
    'INSERT INTO personel (ad, soyad, pozisyon, telefon, email, baslangic_tarihi) VALUES (?, ?, ?, ?, ?, ?)',
    [ad, soyad, pozisyon, telefon, email, baslangic_tarihi],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Personel başarıyla eklendi' });
    }
  );
});

// Personel notlarını getir
app.get('/api/personel/:id/notlar', (req, res) => {
  const personelId = req.params.id;
  
  db.all(
    'SELECT * FROM notlar WHERE personel_id = ? ORDER BY tarih DESC',
    [personelId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Yeni not ekle
app.post('/api/notlar', (req, res) => {
  const { personel_id, not_metni, kategori } = req.body;
  
  db.run(
    'INSERT INTO notlar (personel_id, not_metni, kategori) VALUES (?, ?, ?)',
    [personel_id, not_metni, kategori || 'genel'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Not başarıyla eklendi' });
    }
  );
});

// Personel görevlerini getir
app.get('/api/personel/:id/gorevler', (req, res) => {
  const personelId = req.params.id;
  
  db.all(
    'SELECT * FROM gorevler WHERE personel_id = ? ORDER BY atanma_tarihi DESC',
    [personelId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Yeni görev ekle
app.post('/api/gorevler', (req, res) => {
  const { personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi } = req.body;
  
  db.run(
    'INSERT INTO gorevler (personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi) VALUES (?, ?, ?, ?)',
    [personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Görev başarıyla eklendi' });
    }
  );
});

// Görev durumunu güncelle
app.put('/api/gorevler/:id', (req, res) => {
  const gorevId = req.params.id;
  const { durum, performans_puani } = req.body;
  
  db.run(
    'UPDATE gorevler SET durum = ?, performans_puani = ? WHERE id = ?',
    [durum, performans_puani, gorevId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Görev başarıyla güncellendi' });
    }
  );
});

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
  console.log(`Uygulamaya erişim: http://localhost:${PORT}`);
});