-- Likert ölçeği için yeni tablolar

-- 1. Yetkinlik kategorileri tablosu
CREATE TABLE IF NOT EXISTS competencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    weight DECIMAL(3,2) DEFAULT 0.2,
    is_active BOOLEAN DEFAULT 1
);

-- Varsayılan yetkinlikler
INSERT INTO competencies (name, description, weight) VALUES
('communication', 'İletişim Becerisi', 0.2),
('teamwork', 'Takım Çalışması', 0.2),
('problem_solving', 'Problem Çözme', 0.2),
('customer_focus', 'Müşteri Odaklılık', 0.2),
('reliability', 'Güvenilirlik', 0.2);

-- 2. Not analiz sonuçları tablosu
CREATE TABLE IF NOT EXISTS note_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER REFERENCES notlar(id),
    competency_id INTEGER REFERENCES competencies(id),
    likert_score INTEGER CHECK (likert_score >= 1 AND likert_score <= 5),
    confidence_level DECIMAL(3,2), -- AI'nin ne kadar emin olduğu (0.0-1.0)
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    ai_reasoning TEXT -- AI'nin neden bu puanı verdiğinin açıklaması
);

-- 3. Personel yetkinlik özet tablosu (performans için)
CREATE TABLE IF NOT EXISTS personnel_competency_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personel_id INTEGER REFERENCES personel(id),
    competency_id INTEGER REFERENCES competencies(id),
    current_score DECIMAL(3,2), -- Mevcut ortalama puan
    previous_score DECIMAL(3,2), -- Önceki dönem puanı
    trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    note_count INTEGER DEFAULT 0 -- Kaç not üzerinden hesaplandığı
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_note_analysis_note_id ON note_analysis(note_id);
CREATE INDEX IF NOT EXISTS idx_note_analysis_competency ON note_analysis(competency_id);
CREATE INDEX IF NOT EXISTS idx_personnel_summary_personel ON personnel_competency_summary(personel_id);