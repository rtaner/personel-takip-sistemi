-- Personel tablosu
CREATE TABLE personel (
    id SERIAL PRIMARY KEY,
    ad VARCHAR(100) NOT NULL,
    soyad VARCHAR(100) NOT NULL,
    pozisyon VARCHAR(100),
    telefon VARCHAR(20),
    email VARCHAR(100),
    baslangic_tarihi DATE,
    aktif BOOLEAN DEFAULT true,
    olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notlar tablosu
CREATE TABLE notlar (
    id SERIAL PRIMARY KEY,
    personel_id INTEGER REFERENCES personel(id) ON DELETE CASCADE,
    not_metni TEXT NOT NULL,
    tarih TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    kategori VARCHAR(50) DEFAULT 'genel'
);

-- Görevler tablosu
CREATE TABLE gorevler (
    id SERIAL PRIMARY KEY,
    personel_id INTEGER REFERENCES personel(id) ON DELETE CASCADE,
    gorev_baslik VARCHAR(200) NOT NULL,
    gorev_aciklama TEXT,
    atanma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bitis_tarihi DATE,
    durum VARCHAR(50) DEFAULT 'beklemede',
    performans_puani INTEGER
);

-- İndeksler (performans için)
CREATE INDEX idx_notlar_personel_id ON notlar(personel_id);
CREATE INDEX idx_gorevler_personel_id ON gorevler(personel_id);
CREATE INDEX idx_personel_aktif ON personel(aktif);

-- Row Level Security (RLS) - İsteğe bağlı
ALTER TABLE personel ENABLE ROW LEVEL SECURITY;
ALTER TABLE notlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorevler ENABLE ROW LEVEL SECURITY;

-- Herkese okuma/yazma izni (geliştirme için)
CREATE POLICY "Enable all operations for all users" ON personel FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON notlar FOR ALL USING (true);
CREATE POLICY "Enable all operations for all users" ON gorevler FOR ALL USING (true);