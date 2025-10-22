const sqlite3 = require('sqlite3').verbose();
const { supabase } = require('./supabase-config');

// SQLite veritabanı (fallback)
const dbPath = process.env.DB_PATH || 'personel_takip.db';
const db = new sqlite3.Database(dbPath);

// Veritabanı seçimi
const useSupabase = !!supabase;

// SQLite tablolarını oluştur
if (!useSupabase) {
    db.serialize(() => {
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

        db.run(`CREATE TABLE IF NOT EXISTS notlar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personel_id INTEGER,
            not_metni TEXT NOT NULL,
            tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
            kategori TEXT DEFAULT 'genel',
            FOREIGN KEY (personel_id) REFERENCES personel (id)
        )`);

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
}

// Veritabanı işlemleri
const dbOperations = {
    // Personel işlemleri
    async getPersonel() {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('personel')
                .select('*')
                .eq('aktif', true)
                .order('ad', { ascending: true });
            
            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM personel WHERE aktif = 1 ORDER BY ad, soyad', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    },

    async addPersonel(personelData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('personel')
                .insert([personelData])
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { ad, soyad, pozisyon, telefon, email, baslangic_tarihi } = personelData;
                db.run(
                    'INSERT INTO personel (ad, soyad, pozisyon, telefon, email, baslangic_tarihi) VALUES (?, ?, ?, ?, ?, ?)',
                    [ad, soyad, pozisyon, telefon, email, baslangic_tarihi],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updatePersonel(id, personelData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('personel')
                .update(personelData)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { ad, soyad, pozisyon } = personelData;
                db.run(
                    'UPDATE personel SET ad = ?, soyad = ?, pozisyon = ? WHERE id = ?',
                    [ad, soyad, pozisyon, id],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    async deletePersonel(id) {
        if (useSupabase) {
            // Önce notları ve görevleri sil
            await supabase.from('notlar').delete().eq('personel_id', id);
            await supabase.from('gorevler').delete().eq('personel_id', id);
            
            const { error } = await supabase
                .from('personel')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run('DELETE FROM notlar WHERE personel_id = ?', [id]);
                    db.run('DELETE FROM gorevler WHERE personel_id = ?', [id]);
                    db.run('DELETE FROM personel WHERE id = ?', [id], function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    });
                });
            });
        }
    },

    // Not işlemleri
    async getPersonelNotes(personelId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .select('*')
                .eq('personel_id', personelId)
                .order('tarih', { ascending: false });
            
            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM notlar WHERE personel_id = ? ORDER BY tarih DESC',
                    [personelId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
        }
    },

    async addNote(noteData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .insert([noteData])
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { personel_id, not_metni, kategori } = noteData;
                db.run(
                    'INSERT INTO notlar (personel_id, not_metni, kategori) VALUES (?, ?, ?)',
                    [personel_id, not_metni, kategori || 'genel'],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updateNote(id, noteData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .update(noteData)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { not_metni, kategori } = noteData;
                db.run(
                    'UPDATE notlar SET not_metni = ?, kategori = ? WHERE id = ?',
                    [not_metni, kategori, id],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    async deleteNote(id) {
        if (useSupabase) {
            const { error } = await supabase
                .from('notlar')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                db.run('DELETE FROM notlar WHERE id = ?', [id], function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        }
    },

    // Görev işlemleri
    async getPersonelTasks(personelId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .select('*')
                .eq('personel_id', personelId)
                .order('atanma_tarihi', { ascending: false });
            
            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM gorevler WHERE personel_id = ? ORDER BY atanma_tarihi DESC',
                    [personelId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
        }
    },

    async addTask(taskData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .insert([taskData])
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi } = taskData;
                db.run(
                    'INSERT INTO gorevler (personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi) VALUES (?, ?, ?, ?)',
                    [personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updateTask(id, taskData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .update(taskData)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                // Tüm alanları güncelle
                const fields = [];
                const values = [];
                
                if (taskData.gorev_baslik !== undefined) {
                    fields.push('gorev_baslik = ?');
                    values.push(taskData.gorev_baslik);
                }
                if (taskData.gorev_aciklama !== undefined) {
                    fields.push('gorev_aciklama = ?');
                    values.push(taskData.gorev_aciklama);
                }
                if (taskData.bitis_tarihi !== undefined) {
                    fields.push('bitis_tarihi = ?');
                    values.push(taskData.bitis_tarihi);
                }
                if (taskData.durum !== undefined) {
                    fields.push('durum = ?');
                    values.push(taskData.durum);
                }
                if (taskData.performans_puani !== undefined) {
                    fields.push('performans_puani = ?');
                    values.push(taskData.performans_puani);
                }
                
                values.push(id);
                
                const sql = `UPDATE gorevler SET ${fields.join(', ')} WHERE id = ?`;
                
                db.run(sql, values, function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        }
    },

    async deleteTask(id) {
        if (useSupabase) {
            const { error } = await supabase
                .from('gorevler')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                db.run('DELETE FROM gorevler WHERE id = ?', [id], function(err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        }
    }
};

module.exports = { dbOperations, useSupabase };