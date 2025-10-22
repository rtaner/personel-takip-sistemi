-- =====================================================
-- Üyelik Sistemi ve Organizasyon Yapısı - Veritabanı
-- =====================================================

-- 1. Organizations (Organizasyonlar) Tablosu
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    invite_code VARCHAR(10) UNIQUE NOT NULL,
    owner_id INTEGER, -- Bu sonra users tablosu oluşturulduktan sonra foreign key olacak
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- 2. Users (Kullanıcılar) Tablosu
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'personel' CHECK (role IN ('organizasyon_sahibi', 'yonetici', 'personel')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    session_token VARCHAR(255),
    session_expires_at TIMESTAMP
);

-- 3. Organizations tablosuna foreign key ekle
ALTER TABLE organizations 
ADD CONSTRAINT fk_organizations_owner 
FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;

-- 4. Mevcut personel tablosunu güncelle
ALTER TABLE personel 
ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 5. Mevcut notlar tablosunu güncelle
ALTER TABLE notlar 
ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- 6. Mevcut gorevler tablosunu güncelle
ALTER TABLE gorevler 
ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- =====================================================
-- İndeksler (Performans için)
-- =====================================================

-- Users tablosu indeksleri
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_session_token ON users(session_token);

-- Organizations tablosu indeksleri
CREATE INDEX idx_organizations_invite_code ON organizations(invite_code);
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);

-- Mevcut tabloların yeni indeksleri
CREATE INDEX idx_personel_organization_id ON personel(organization_id);
CREATE INDEX idx_personel_created_by ON personel(created_by);

CREATE INDEX idx_notlar_organization_id ON notlar(organization_id);
CREATE INDEX idx_notlar_created_by ON notlar(created_by);

CREATE INDEX idx_gorevler_organization_id ON gorevler(organization_id);
CREATE INDEX idx_gorevler_created_by ON gorevler(created_by);
CREATE INDEX idx_gorevler_assigned_to ON gorevler(assigned_to);

-- =====================================================
-- Row Level Security (RLS) Politikaları
-- =====================================================

-- Users tablosu RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi organizasyonundaki kullanıcıları görebilir
CREATE POLICY "Users can view users in same organization" ON users
    FOR SELECT USING (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        )
    );

-- Sadece organizasyon sahibi kullanıcı bilgilerini güncelleyebilir
CREATE POLICY "Only org owner can update users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::integer 
            AND role = 'organizasyon_sahibi' 
            AND organization_id = users.organization_id
        )
    );

-- Organizations tablosu RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi organizasyonlarını görebilir
CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT USING (
        id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        )
    );

-- Sadece organizasyon sahibi organizasyon bilgilerini güncelleyebilir
CREATE POLICY "Only owner can update organization" ON organizations
    FOR UPDATE USING (owner_id = auth.uid()::integer);

-- Personel tablosu RLS güncelleme
CREATE POLICY "Users can view personnel in same organization" ON personel
    FOR SELECT USING (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        )
    );

CREATE POLICY "Users can insert personnel in their organization" ON personel
    FOR INSERT WITH CHECK (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        )
    );

-- Notlar tablosu RLS güncelleme
CREATE POLICY "Users can view notes based on role" ON notlar
    FOR SELECT USING (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        ) AND (
            -- Organizasyon sahibi tüm notları görebilir
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid()::integer 
                AND role = 'organizasyon_sahibi'
            ) OR
            -- Diğerleri sadece kendi notlarını görebilir
            created_by = auth.uid()::integer
        )
    );

CREATE POLICY "Users can insert notes in their organization" ON notlar
    FOR INSERT WITH CHECK (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        ) AND created_by = auth.uid()::integer
    );

-- Görevler tablosu RLS güncelleme
CREATE POLICY "Users can view tasks based on role" ON gorevler
    FOR SELECT USING (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        ) AND (
            -- Organizasyon sahibi tüm görevleri görebilir
            EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid()::integer 
                AND role = 'organizasyon_sahibi'
            ) OR
            -- Görev oluşturan kendi görevlerini görebilir
            created_by = auth.uid()::integer OR
            -- Görevi atanan kişi görebilir
            assigned_to = auth.uid()::integer
        )
    );

CREATE POLICY "Users can insert tasks in their organization" ON gorevler
    FOR INSERT WITH CHECK (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()::integer
        ) AND created_by = auth.uid()::integer
    );

-- =====================================================
-- Yardımcı Fonksiyonlar
-- =====================================================

-- Davet kodu oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(10) AS $$
DECLARE
    chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result VARCHAR(10) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..10 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Test Verisi (Opsiyonel)
-- =====================================================

-- İlk organizasyon ve kullanıcı oluşturma örneği
-- Bu kısmı manuel test için kullanabilirsiniz

/*
-- Örnek organizasyon
INSERT INTO organizations (name, invite_code) 
VALUES ('1854 - Bilecik Bozüyük', generate_invite_code());

-- Örnek kullanıcı (şifre: 123456)
INSERT INTO users (username, password_hash, full_name, organization_id, role) 
VALUES (
    'taner', 
    '$2b$10$example_hash_here', -- Gerçek hash kullanın
    'Taner Bey', 
    1, 
    'organizasyon_sahibi'
);

-- Organizations tablosundaki owner_id'yi güncelle
UPDATE organizations SET owner_id = 1 WHERE id = 1;
*/