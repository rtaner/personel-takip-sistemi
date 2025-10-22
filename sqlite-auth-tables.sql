-- =====================================================
-- Üyelik Sistemi ve Organizasyon Yapısı - SQLite
-- =====================================================

-- 1. Organizations (Organizasyonlar) Tablosu
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

-- 2. Users (Kullanıcılar) Tablosu
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    organization_id INTEGER,
    role TEXT DEFAULT 'personel' CHECK (role IN ('organizasyon_sahibi', 'yonetici', 'personel')),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    session_token TEXT,
    session_expires_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- 3. Organizations tablosuna foreign key constraint ekle
-- SQLite'da ALTER TABLE ile foreign key eklenemez, bu yüzden trigger kullanacağız

-- 4. Mevcut personel tablosunu güncelle
ALTER TABLE personel ADD COLUMN organization_id INTEGER;
ALTER TABLE personel ADD COLUMN created_by INTEGER;

-- 5. Mevcut notlar tablosunu güncelle
ALTER TABLE notlar ADD COLUMN created_by INTEGER;
ALTER TABLE notlar ADD COLUMN organization_id INTEGER;

-- 6. Mevcut gorevler tablosunu güncelle
ALTER TABLE gorevler ADD COLUMN created_by INTEGER;
ALTER TABLE gorevler ADD COLUMN assigned_to INTEGER;
ALTER TABLE gorevler ADD COLUMN organization_id INTEGER;

-- =====================================================
-- İndeksler (Performans için)
-- =====================================================

-- Users tablosu indeksleri
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);

-- Organizations tablosu indeksleri
CREATE INDEX IF NOT EXISTS idx_organizations_invite_code ON organizations(invite_code);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

-- Mevcut tabloların yeni indeksleri
CREATE INDEX IF NOT EXISTS idx_personel_organization_id ON personel(organization_id);
CREATE INDEX IF NOT EXISTS idx_personel_created_by ON personel(created_by);

CREATE INDEX IF NOT EXISTS idx_notlar_organization_id ON notlar(organization_id);
CREATE INDEX IF NOT EXISTS idx_notlar_created_by ON notlar(created_by);

CREATE INDEX IF NOT EXISTS idx_gorevler_organization_id ON gorevler(organization_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_created_by ON gorevler(created_by);
CREATE INDEX IF NOT EXISTS idx_gorevler_assigned_to ON gorevler(assigned_to);