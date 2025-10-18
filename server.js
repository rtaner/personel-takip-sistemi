require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { dbOperations, useSupabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

console.log(`🗄️ Veritabanı: ${useSupabase ? 'Supabase (PostgreSQL)' : 'SQLite'}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Supabase URL: ${process.env.SUPABASE_URL ? 'Configured ✅' : 'Not configured ❌'}`);

// API Routes

// Tüm personeli getir
app.get('/api/personel', async (req, res) => {
  try {
    const personel = await dbOperations.getPersonel();
    res.json(personel);
  } catch (error) {
    console.error('Personel getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni personel ekle
app.post('/api/personel', async (req, res) => {
  try {
    const result = await dbOperations.addPersonel(req.body);
    res.json({ id: result.id, message: 'Personel başarıyla eklendi' });
  } catch (error) {
    console.error('Personel ekleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Personel güncelleme
app.put('/api/personel/:id', async (req, res) => {
  try {
    await dbOperations.updatePersonel(req.params.id, req.body);
    res.json({ message: 'Personel başarıyla güncellendi' });
  } catch (error) {
    console.error('Personel güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Personel silme
app.delete('/api/personel/:id', async (req, res) => {
  try {
    await dbOperations.deletePersonel(req.params.id);
    res.json({ message: 'Personel başarıyla silindi' });
  } catch (error) {
    console.error('Personel silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Personel notlarını getir
app.get('/api/personel/:id/notlar', async (req, res) => {
  try {
    const notlar = await dbOperations.getPersonelNotes(req.params.id);
    res.json(notlar);
  } catch (error) {
    console.error('Notlar getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni not ekle
app.post('/api/notlar', async (req, res) => {
  try {
    const result = await dbOperations.addNote(req.body);
    res.json({ id: result.id, message: 'Not başarıyla eklendi' });
  } catch (error) {
    console.error('Not ekleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Not güncelleme
app.put('/api/notlar/:id', async (req, res) => {
  try {
    await dbOperations.updateNote(req.params.id, req.body);
    res.json({ message: 'Not başarıyla güncellendi' });
  } catch (error) {
    console.error('Not güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Not silme
app.delete('/api/notlar/:id', async (req, res) => {
  try {
    await dbOperations.deleteNote(req.params.id);
    res.json({ message: 'Not başarıyla silindi' });
  } catch (error) {
    console.error('Not silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Personel görevlerini getir
app.get('/api/personel/:id/gorevler', async (req, res) => {
  try {
    const gorevler = await dbOperations.getPersonelTasks(req.params.id);
    res.json(gorevler);
  } catch (error) {
    console.error('Görevler getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yeni görev ekle
app.post('/api/gorevler', async (req, res) => {
  try {
    const result = await dbOperations.addTask(req.body);
    res.json({ id: result.id, message: 'Görev başarıyla eklendi' });
  } catch (error) {
    console.error('Görev ekleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Görev durumunu güncelle
app.put('/api/gorevler/:id', async (req, res) => {
  try {
    await dbOperations.updateTask(req.params.id, req.body);
    res.json({ message: 'Görev başarıyla güncellendi' });
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Görev silme
app.delete('/api/gorevler/:id', async (req, res) => {
  try {
    await dbOperations.deleteTask(req.params.id);
    res.json({ message: 'Görev başarıyla silindi' });
  } catch (error) {
    console.error('Görev silme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    database: useSupabase ? 'Supabase' : 'SQLite',
    timestamp: new Date().toISOString()
  });
});

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ${PORT} portunda çalışıyor`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${useSupabase ? 'Supabase (PostgreSQL)' : 'SQLite'}`);
  console.log(`✅ Server başarıyla başlatıldı`);
});