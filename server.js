require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Environment variables kontrolü
console.log('🔧 Environment Variables Kontrolü:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('USE_SUPABASE:', process.env.USE_SUPABASE);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Tanımlı' : '❌ Eksik');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Tanımlı' : '❌ Eksik');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Tanımlı' : '❌ Eksik');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Tanımlı' : '❌ Eksik');

// AI Analiz Servisleri
const AIAnalysisService = require('./ai-analysis-service');

// Gelişmiş AI Analiz Servisi (Gemini)
const advancedAI = new AIAnalysisService(process.env.GEMINI_API_KEY);

// Basit AI Analiz Servisi (Eski - Fallback için)
class SimpleAIAnalysisService {
    constructor() {
        // Şimdilik basit kural tabanlı analiz, sonra Gemini API ekleyeceğiz
        this.competencies = {
            communication: ['iletişim', 'konuşma', 'dinleme', 'açıklama', 'anlatma', 'müşteri', 'telefon'],
            teamwork: ['takım', 'birlikte', 'yardım', 'işbirliği', 'destek', 'beraber', 'grup'],
            problem_solving: ['çözdü', 'problem', 'sorun', 'çözüm', 'analiz', 'düşünme', 'strateji'],
            customer_focus: ['müşteri', 'hizmet', 'memnuniyet', 'kalite', 'empati', 'odaklı'],
            reliability: ['zamanında', 'güvenilir', 'sorumlu', 'disiplin', 'düzenli', 'geç', 'erken']
        };
    }

    analyzeNote(noteText, noteType) {
        const text = noteText.toLowerCase();
        const scores = {};

        // Her yetkinlik için analiz
        Object.keys(this.competencies).forEach(competency => {
            const keywords = this.competencies[competency];
            let matchCount = 0;
            let confidence = 0.2; // Minimum güven

            // Anahtar kelime eşleşmesi
            keywords.forEach(keyword => {
                if (text.includes(keyword)) {
                    matchCount++;
                    confidence += 0.2;
                }
            });

            // Puan hesaplama
            let score = 3; // Varsayılan nötr
            if (matchCount > 0) {
                if (noteType === 'olumlu') {
                    score = Math.min(5, 3 + matchCount);
                } else {
                    score = Math.max(1, 3 - matchCount);
                }
                confidence = Math.min(0.9, confidence);
            }

            scores[competency] = {
                score: score,
                confidence: confidence,
                reasoning: matchCount > 0 ?
                    `'${keywords.filter(k => text.includes(k)).join(', ')}' anahtar kelimeleri tespit edildi` :
                    'Bu yetkinlik hakkında bilgi bulunamadı'
            };
        });

        return {
            scores: scores,
            overall_sentiment: noteType === 'olumlu' ? 'positive' : 'negative',
            key_insights: this.extractInsights(noteText, noteType),
            recommendations: this.generateRecommendations(scores, noteType)
        };
    }

    extractInsights(noteText, noteType) {
        const insights = [];
        const text = noteText.toLowerCase();

        // Davranışsal gözlemler
        if (text.includes('zamanında') || text.includes('erken')) {
            insights.push('⏰ Zaman yönetimi disiplini sergileniyor');
        }
        if (text.includes('geç') || text.includes('gecikme')) {
            insights.push('⚠️ Zaman yönetiminde gelişim alanı tespit edildi');
        }
        if (text.includes('müşteri') && noteType === 'olumlu') {
            insights.push('👥 Müşteri odaklı yaklaşım gösteriyor');
        }
        if (text.includes('şikayet') && text.includes('çöz')) {
            insights.push('🔧 Müşteri sorunlarını proaktif çözme becerisi');
        }
        if (text.includes('takım') || text.includes('yardım') || text.includes('işbirliği')) {
            insights.push('🤝 Takım çalışmasına yatkınlık gösteriyor');
        }
        if (text.includes('liderlik') || text.includes('yönlendirme')) {
            insights.push('👑 Liderlik potansiyeli sergileniyor');
        }
        if (text.includes('yaratıcı') || text.includes('yenilikçi') || text.includes('farklı')) {
            insights.push('💡 Yaratıcı düşünce ve yenilikçi yaklaşım');
        }
        if (text.includes('hızlı') || text.includes('verimli')) {
            insights.push('⚡ Yüksek verimlilik ve hız gösteriyor');
        }
        if (text.includes('sabırlı') || text.includes('sakin')) {
            insights.push('🧘 Stres yönetimi ve sabır gösteriyor');
        }
        if (text.includes('öğrenme') || text.includes('gelişim')) {
            insights.push('📚 Sürekli öğrenme ve gelişim odaklı');
        }

        // Olumsuz davranış kalıpları
        if (noteType === 'olumsuz') {
            if (text.includes('iletişim') || text.includes('anlaşmazlık')) {
                insights.push('📢 İletişim becerilerinde gelişim gereksinimi');
            }
            if (text.includes('motivasyon') || text.includes('isteksiz')) {
                insights.push('🔋 Motivasyon ve engagement konularında destek gerekli');
            }
            if (text.includes('hata') || text.includes('yanlış')) {
                insights.push('🎯 Dikkat ve kalite odaklı çalışma konusunda gelişim alanı');
            }
        }

        return insights.length > 0 ? insights : ['📝 Genel performans değerlendirmesi kaydedildi'];
    }

    generateRecommendations(scores, noteType) {
        const recommendations = [];
        const strengths = [];
        const improvements = [];

        // Güçlü ve zayıf yönleri belirle
        Object.keys(scores).forEach(competency => {
            const score = scores[competency];
            if (score.confidence > 0.5) {
                if (score.score >= 4) {
                    strengths.push({ competency, score: score.score });
                } else if (score.score <= 2) {
                    improvements.push({ competency, score: score.score });
                }
            }
        });

        // Detaylı İK Uzmanı Analizi
        if (improvements.length > 0) {
            recommendations.push("📊 PERFORMANS ANALİZİ:");

            improvements.forEach(item => {
                switch (item.competency) {
                    case 'communication':
                        recommendations.push("🗣️ İLETİŞİM GELİŞİM PLANI:");
                        recommendations.push("• Kısa Vadeli (1-2 hafta): Günlük müşteri etkileşimlerini gözlemleyin");
                        recommendations.push("• Orta Vadeli (1 ay): Etkili iletişim teknikleri eğitimi düzenleyin");
                        recommendations.push("• Uzun Vadeli (3 ay): Sunum becerileri workshop'u ve mentorluk programı");
                        recommendations.push("• Ölçüm: Müşteri geri bildirim puanları ve iletişim etkinliği değerlendirmesi");
                        break;
                    case 'teamwork':
                        recommendations.push("🤝 TAKIM ÇALIŞMASI GELİŞİM PLANI:");
                        recommendations.push("• Kısa Vadeli: Takım projelerinde aktif rol almaya teşvik edin");
                        recommendations.push("• Orta Vadeli: Çapraz fonksiyonel projelerde görevlendirin");
                        recommendations.push("• Uzun Vadeli: Takım liderliği sorumluluğu verin");
                        recommendations.push("• Ölçüm: 360° geri bildirim ve takım üyesi değerlendirmeleri");
                        break;
                    case 'problem_solving':
                        recommendations.push("🧩 PROBLEM ÇÖZME GELİŞİM PLANI:");
                        recommendations.push("• Kısa Vadeli: Günlük karşılaştığı problemleri dokümante etmesini isteyin");
                        recommendations.push("• Orta Vadeli: Analitik düşünme ve yaratıcı problem çözme eğitimi");
                        recommendations.push("• Uzun Vadeli: Karmaşık projelerde problem çözme liderliği");
                        recommendations.push("• Ölçüm: Çözülen problem sayısı ve çözüm kalitesi değerlendirmesi");
                        break;
                    case 'customer_focus':
                        recommendations.push("👥 MÜŞTERİ ODAKLILIK GELİŞİM PLANI:");
                        recommendations.push("• Kısa Vadeli: Müşteri deneyimi gözlem programına dahil edin");
                        recommendations.push("• Orta Vadeli: Müşteri hizmetleri mükemmelliği eğitimi");
                        recommendations.push("• Uzun Vadeli: Müşteri ilişkileri yönetimi sertifikasyonu");
                        recommendations.push("• Ölçüm: Müşteri memnuniyet skorları ve şikayet çözüm süreleri");
                        break;
                    case 'reliability':
                        recommendations.push("⏰ GÜVENİLİRLİK GELİŞİM PLANI:");
                        recommendations.push("• Kısa Vadeli: Günlük zaman çizelgesi oluşturma ve takip sistemi");
                        recommendations.push("• Orta Vadeli: Zaman yönetimi ve önceliklendirme koçluğu");
                        recommendations.push("• Uzun Vadeli: Sorumluluk alanlarını genişletme ve özerklik artırma");
                        recommendations.push("• Ölçüm: Teslim süreleri, devamsızlık oranları ve görev tamamlama yüzdesi");
                        break;
                }
            });
        }

        // Güçlü yönleri vurgula
        if (strengths.length > 0) {
            recommendations.push("");
            recommendations.push("🌟 GÜÇLÜ YÖNLER VE KULLANIM STRATEJİSİ:");

            strengths.forEach(item => {
                switch (item.competency) {
                    case 'communication':
                        recommendations.push("• İletişim yeteneğini takım içi bilgi paylaşımında kullanın");
                        recommendations.push("• Yeni çalışanların mentorluk programında görevlendirin");
                        break;
                    case 'teamwork':
                        recommendations.push("• Takım çalışması becerisini proje liderliğinde değerlendirin");
                        recommendations.push("• Çapraz departman işbirliği projelerinde koordinatör rolü verin");
                        break;
                    case 'problem_solving':
                        recommendations.push("• Problem çözme yeteneğini süreç iyileştirme projelerinde kullanın");
                        recommendations.push("• Karmaşık müşteri sorunlarının çözümünde öncü rol verin");
                        break;
                    case 'customer_focus':
                        recommendations.push("• Müşteri odaklılığını müşteri deneyimi iyileştirme projelerinde kullanın");
                        recommendations.push("• Müşteri geri bildirim analizi ve aksiyon planı geliştirmede görevlendirin");
                        break;
                    case 'reliability':
                        recommendations.push("• Güvenilirliğini kritik projelerde ve deadline'ı sıkı işlerde değerlendirin");
                        recommendations.push("• Takım içi süreç standardizasyonu ve kalite kontrol işlerinde görevlendirin");
                        break;
                }
            });
        }

        // Genel öneriler
        recommendations.push("");
        recommendations.push("📋 GENEL ÖNERİLER:");
        recommendations.push("• Aylık 1-1 performans görüşmeleri düzenleyin");
        recommendations.push("• Gelişim hedeflerini SMART kriterleriyle belirleyin");
        recommendations.push("• 3 ayda bir 360° geri bildirim alın");
        recommendations.push("• Başarıları takım önünde takdir edin ve paylaşın");

        return recommendations.length > 0 ? recommendations : [
            "📊 Mevcut performans dengeli görünüyor.",
            "• Düzenli gözlem ve geri bildirimle gelişimi destekleyin",
            "• Yeni zorluklar ve sorumluluklar vererek potansiyeli keşfedin"
        ];
    }
}

const simpleAIAnalysisService = new SimpleAIAnalysisService();

// Supabase Configuration
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
let useSupabase = false;

// Supabase istemcisini oluştur
if (process.env.USE_SUPABASE === 'true' && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    useSupabase = true;
    console.log('✅ Supabase bağlantısı kuruldu');

    // Bağlantıyı test et
    supabase.from('users').select('count', { count: 'exact', head: true })
        .then(({ error }) => {
            if (error) {
                console.error('❌ Supabase bağlantı testi başarısız:', error.message);
            } else {
                console.log('✅ Supabase bağlantı testi başarılı');
            }
        })
        .catch(err => {
            console.error('❌ Supabase bağlantı testi hatası:', err.message);
        });
} else {
    console.log('⚠️ Supabase bilgileri bulunamadı, SQLite kullanılacak');
}

// SQLite veritabanı (fallback)
const dbPath = process.env.DB_PATH || 'personel_takip.db';
const db = new sqlite3.Database(dbPath);

// SQLite tablolarını oluştur
if (!useSupabase) {
    db.serialize(() => {
        // Mevcut tablolar
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            bitis_tarihi DATE,
            durum TEXT DEFAULT 'beklemede',
            performans_puani INTEGER,
            FOREIGN KEY (personel_id) REFERENCES personel (id)
        )`);

        // Yeni auth tabloları
        db.run(`CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            owner_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS users (
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
        )`);

        // Mevcut tablolara yeni alanlar ekle (sadece yoksa)
        db.run(`ALTER TABLE personel ADD COLUMN organization_id INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });
        db.run(`ALTER TABLE personel ADD COLUMN created_by INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });

        db.run(`ALTER TABLE notlar ADD COLUMN created_by INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });
        db.run(`ALTER TABLE notlar ADD COLUMN organization_id INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });

        db.run(`ALTER TABLE gorevler ADD COLUMN created_by INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });
        db.run(`ALTER TABLE gorevler ADD COLUMN assigned_to INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });

        // Likert analizi için yeni tablolar
        db.run(`CREATE TABLE IF NOT EXISTS competencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            weight DECIMAL(3,2) DEFAULT 0.2,
            is_active BOOLEAN DEFAULT 1
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS note_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER REFERENCES notlar(id),
            competency_id INTEGER REFERENCES competencies(id),
            likert_score INTEGER CHECK (likert_score >= 1 AND likert_score <= 5),
            confidence_level DECIMAL(3,2),
            analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            ai_reasoning TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS personnel_competency_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personel_id INTEGER REFERENCES personel(id),
            competency_id INTEGER REFERENCES competencies(id),
            current_score DECIMAL(3,2),
            previous_score DECIMAL(3,2),
            trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            note_count INTEGER DEFAULT 0
        )`);

        // İK Analiz Raporları Tablosu
        db.run(`CREATE TABLE IF NOT EXISTS hr_analysis_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personel_id INTEGER REFERENCES personel(id),
            analysis_data TEXT NOT NULL,
            overall_risk_level TEXT NOT NULL,
            immediate_action_required INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER REFERENCES users(id)
        )`);

        // Varsayılan yetkinlikleri ekle
        db.run(`INSERT OR IGNORE INTO competencies (id, name, description, weight) VALUES
            (1, 'communication', 'İletişim Becerisi', 0.2),
            (2, 'teamwork', 'Takım Çalışması', 0.2),
            (3, 'problem_solving', 'Problem Çözme', 0.2),
            (4, 'customer_focus', 'Müşteri Odaklılık', 0.2),
            (5, 'reliability', 'Güvenilirlik', 0.2)
        `);
        db.run(`ALTER TABLE gorevler ADD COLUMN organization_id INTEGER`, (err) => {
            // Hata normal - alan zaten varsa
        });

        // İndeksler
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_organizations_invite_code ON organizations(invite_code)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_personel_organization_id ON personel(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notlar_organization_id ON notlar(organization_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_gorevler_organization_id ON gorevler(organization_id)`);

        console.log('✅ Auth tabloları ve indeksler oluşturuldu');
    });
}

// Mock İK Analizi (Test Amaçlı)
function generateMockHRAnalysis(personnelData) {
    const { personnelInfo, notes, performanceScores } = personnelData;
    const negativeNotes = notes.filter(n => n.kategori === 'olumsuz');
    const positiveNotes = notes.filter(n => n.kategori === 'olumlu');

    // Risk seviyesi belirleme
    let riskLevel = 'low';
    if (negativeNotes.length > 3) riskLevel = 'high';
    else if (negativeNotes.length > 1) riskLevel = 'medium';

    // Hijyen/disiplin sorunları varsa kritik
    const criticalKeywords = ['hijyen', 'el yıka', 'rapor verme', 'geç kal'];
    const hasCriticalIssues = negativeNotes.some(note =>
        criticalKeywords.some(keyword => note.not_metni.toLowerCase().includes(keyword))
    );

    if (hasCriticalIssues) riskLevel = 'critical';

    return {
        executive_summary: {
            overall_risk_level: riskLevel,
            primary_concerns: negativeNotes.slice(0, 3).map(n => n.not_metni),
            key_strengths: positiveNotes.slice(0, 2).map(n => n.not_metni),
            immediate_action_required: riskLevel === 'critical' || riskLevel === 'high'
        },
        behavioral_analysis: {
            work_discipline: {
                score: negativeNotes.length > 2 ? 2 : 4,
                risk_level: negativeNotes.length > 2 ? 'high' : 'low',
                evidence: negativeNotes.slice(0, 2).map(n => n.not_metni),
                pattern: 'declining'
            },
            corporate_culture: {
                score: 3,
                risk_level: 'medium',
                evidence: ['Genel gözlem'],
                pattern: 'stable'
            },
            basic_rules: {
                score: hasCriticalIssues ? 1 : 4,
                risk_level: hasCriticalIssues ? 'critical' : 'low',
                evidence: hasCriticalIssues ? ['Hijyen kuralları ihlali tespit edildi'] : ['Kurallara uyum sağlıyor'],
                pattern: hasCriticalIssues ? 'declining' : 'stable'
            },
            performance: {
                score: positiveNotes.length > negativeNotes.length ? 4 : 2,
                risk_level: positiveNotes.length > negativeNotes.length ? 'low' : 'medium',
                evidence: notes.slice(0, 2).map(n => n.not_metni),
                pattern: 'inconsistent'
            }
        },
        competency_scores: {
            communication: { score: 3, confidence: 0.7, reasoning: 'Orta seviye iletişim', chain_effect: 'Takım dinamiklerini etkiliyor' },
            teamwork: { score: positiveNotes.length > 0 ? 4 : 2, confidence: 0.8, reasoning: 'Takım çalışması değişken', chain_effect: 'Genel performansı etkiliyor' },
            problem_solving: { score: 3, confidence: 0.6, reasoning: 'Problem çözme becerileri orta', chain_effect: 'Müşteri memnuniyetini etkiliyor' },
            customer_focus: { score: 3, confidence: 0.7, reasoning: 'Müşteri odaklılık orta seviye', chain_effect: 'Satış performansını etkiliyor' },
            reliability: { score: hasCriticalIssues ? 1 : 3, confidence: 0.9, reasoning: hasCriticalIssues ? 'Güvenilirlik sorunu var' : 'Güvenilirlik orta', chain_effect: 'Tüm iş süreçlerini etkiliyor' }
        },
        manager_action_plan: {
            immediate_actions: riskLevel === 'critical' ? [
                {
                    action: 'Acil disiplin görüşmesi yapın',
                    priority: 'critical',
                    timeline: 'acil',
                    evidence: negativeNotes.slice(0, 2).map(n => n.not_metni),
                    expected_outcome: 'Davranış değişikliği'
                }
            ] : [
                {
                    action: 'Performans gözden geçirmesi yapın',
                    priority: 'medium',
                    timeline: '1_hafta',
                    evidence: ['Genel performans değerlendirmesi'],
                    expected_outcome: 'İyileştirme planı'
                }
            ],
            coaching_plan: [
                {
                    area: 'İş disiplini',
                    method: 'Birebir koçluk',
                    duration: '1 ay',
                    success_metrics: ['Zamanında gelme', 'Rapor verme']
                }
            ],
            monitoring_plan: {
                daily_checks: ['Zaman disiplini', 'Hijyen kuralları'],
                weekly_reviews: ['Performans değerlendirmesi'],
                monthly_evaluation: ['Genel gelişim raporu']
            },
            escalation_triggers: ['Tekrarlayan disiplin ihlali', 'Müşteri şikayeti']
        },
        business_impact: {
            current_impact: riskLevel === 'critical' ? 'Yüksek risk' : 'Orta seviye etki',
            potential_risks: ['Takım morali', 'Müşteri memnuniyeti'],
            cost_implications: 'Eğitim ve koçluk maliyeti',
            team_morale_effect: negativeNotes.length > positiveNotes.length ? 'Negatif etki' : 'Nötr etki'
        },
        follow_up_schedule: {
            next_review_date: '1 hafta sonra',
            review_frequency: 'Haftalık',
            success_indicators: ['Davranış iyileştirmesi', 'Performans artışı']
        }
    };
}

// Yardımcı fonksiyonlar
function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// JWT token oluşturma
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            organizationId: user.organization_id,
            role: user.role
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '2d' }
    );
}

// Şifre hash'leme
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

// Şifre doğrulama
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Middleware: JWT Token Doğrulama
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Erişim token\'ı gerekli' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Geçersiz token' });
        }
        req.user = user;
        next();
    });
}

// Middleware: Rol Bazlı Yetki Kontrolü
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
        }

        next();
    };
}

// Middleware: Organizasyon Filtreleme
function filterByOrganization(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
    }

    // Kullanıcının organizasyon ID'sini req'e ekle (hem organizationId hem organization_id destekle)
    req.organizationId = req.user.organization_id || req.user.organizationId || null;
    next();
}

// Veritabanı işlemleri
const dbOperations = {
    // Personel işlemleri
    async getPersonel(organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('personel')
                .select('*')
                .eq('aktif', true);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.order('ad', { ascending: true });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                let sql = 'SELECT * FROM personel WHERE aktif = 1';
                let params = [];

                if (organizationId) {
                    sql += ' AND organization_id = ?';
                    params.push(organizationId);
                }

                sql += ' ORDER BY ad, soyad';

                db.all(sql, params, (err, rows) => {
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
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { ad, soyad, pozisyon, telefon, email, baslangic_tarihi, organization_id, created_by } = personelData;
                db.run(
                    'INSERT INTO personel (ad, soyad, pozisyon, telefon, email, baslangic_tarihi, organization_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [ad, soyad, pozisyon, telefon, email, baslangic_tarihi, organization_id, created_by],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updatePersonel(id, personelData, organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('personel')
                .update(personelData)
                .eq('id', id);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.select();

            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { ad, soyad, pozisyon } = personelData;
                let sql = 'UPDATE personel SET ad = ?, soyad = ?, pozisyon = ? WHERE id = ?';
                let params = [ad, soyad, pozisyon, id];

                if (organizationId) {
                    sql += ' AND organization_id = ?';
                    params.push(organizationId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        }
    },

    async deletePersonel(id, organizationId = null) {
        if (useSupabase) {
            // Önce organizasyon kontrolü yap
            if (organizationId) {
                const { data: personel } = await supabase
                    .from('personel')
                    .select('id')
                    .eq('id', id)
                    .eq('organization_id', organizationId)
                    .maybeSingle();

                if (!personel) {
                    throw new Error('Personel bulunamadı veya erişim yetkiniz yok');
                }
            }

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
                    // Organizasyon kontrolü
                    if (organizationId) {
                        db.get('SELECT id FROM personel WHERE id = ? AND organization_id = ?', [id, organizationId], (err, row) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            if (!row) {
                                reject(new Error('Personel bulunamadı veya erişim yetkiniz yok'));
                                return;
                            }

                            // Silme işlemini yap
                            db.run('DELETE FROM notlar WHERE personel_id = ?', [id]);
                            db.run('DELETE FROM gorevler WHERE personel_id = ?', [id]);
                            db.run('DELETE FROM personel WHERE id = ?', [id], function (err) {
                                if (err) reject(err);
                                else resolve({ changes: this.changes });
                            });
                        });
                    } else {
                        db.run('DELETE FROM notlar WHERE personel_id = ?', [id]);
                        db.run('DELETE FROM gorevler WHERE personel_id = ?', [id]);
                        db.run('DELETE FROM personel WHERE id = ?', [id], function (err) {
                            if (err) reject(err);
                            else resolve({ changes: this.changes });
                        });
                    }
                });
            });
        }
    },

    // Not işlemleri
    async getPersonelNotes(personelId, organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('notlar')
                .select(`
                    *,
                    users!created_by(username, full_name)
                `)
                .eq('personel_id', personelId);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                let sql = `
                    SELECT n.*, u.username, u.full_name as created_by_name 
                    FROM notlar n 
                    LEFT JOIN users u ON n.created_by = u.id 
                    WHERE n.personel_id = ?
                `;
                let params = [personelId];

                if (organizationId) {
                    sql += ' AND n.organization_id = ?';
                    params.push(organizationId);
                }

                sql += ' ORDER BY n.tarih DESC';

                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    },

    async addNote(noteData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .insert([noteData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { personel_id, not_metni, kategori, created_by, organization_id } = noteData;
                db.run(
                    'INSERT INTO notlar (personel_id, not_metni, kategori, created_by, organization_id) VALUES (?, ?, ?, ?, ?)',
                    [personel_id, not_metni, kategori || 'genel', created_by, organization_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updateNote(id, noteData, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - sadece not sahibi veya organizasyon sahibi güncelleyebilir
            let query = supabase
                .from('notlar')
                .update(noteData)
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (userRole !== 'organizasyon_sahibi') {
                query = query.eq('created_by', userId);
            }

            const { data, error } = await query.select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Not bulunamadı veya güncelleme yetkiniz yok');
            }
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { not_metni, kategori } = noteData;
                let sql = 'UPDATE notlar SET not_metni = ?, kategori = ? WHERE id = ? AND organization_id = ?';
                let params = [not_metni, kategori, id, organizationId];

                if (userRole !== 'organizasyon_sahibi') {
                    sql += ' AND created_by = ?';
                    params.push(userId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Not bulunamadı veya güncelleme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    async deleteNote(id, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - sadece not sahibi veya organizasyon sahibi silebilir
            let query = supabase
                .from('notlar')
                .delete()
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (userRole !== 'organizasyon_sahibi') {
                query = query.eq('created_by', userId);
            }

            const { error, count } = await query;

            if (error) throw error;
            if (count === 0) {
                throw new Error('Not bulunamadı veya silme yetkiniz yok');
            }
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                let sql = 'DELETE FROM notlar WHERE id = ? AND organization_id = ?';
                let params = [id, organizationId];

                if (userRole !== 'organizasyon_sahibi') {
                    sql += ' AND created_by = ?';
                    params.push(userId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Not bulunamadı veya silme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    // Görev işlemleri
    async getPersonelTasks(personelId, organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('gorevler')
                .select(`
                    *,
                    created_by_user:users!gorevler_created_by_fkey(username, full_name),
                    assigned_to_user:users!gorevler_assigned_to_fkey(username, full_name)
                `)
                .eq('personel_id', personelId);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                let sql = `
                    SELECT g.*, 
                           u1.username as created_by_username, u1.full_name as created_by_name,
                           u2.username as assigned_to_username, u2.full_name as assigned_to_name
                    FROM gorevler g 
                    LEFT JOIN users u1 ON g.created_by = u1.id 
                    LEFT JOIN users u2 ON g.assigned_to = u2.id 
                    WHERE g.personel_id = ?
                `;
                let params = [personelId];

                if (organizationId) {
                    sql += ' AND g.organization_id = ?';
                    params.push(organizationId);
                }

                sql += ' ORDER BY g.created_at DESC';

                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    },

    async addTask(taskData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .insert([taskData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi, created_by, assigned_to, organization_id } = taskData;
                db.run(
                    'INSERT INTO gorevler (personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi, created_by, assigned_to, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi, created_by, assigned_to, organization_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updateTask(id, taskData, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - görev sahibi, atanan kişi veya yöneticiler güncelleyebilir
            let query = supabase
                .from('gorevler')
                .update(taskData)
                .eq('id', id)
                .eq('organization_id', organizationId);

            // Sadece organizasyon sahibi ve yönetici tüm görevleri güncelleyebilir
            if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                // Personel sadece kendine atanan görevleri güncelleyebilir
                query = query.eq('assigned_to', userId);
            }

            const { data, error } = await query.select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Görev bulunamadı veya güncelleme yetkiniz yok');
            }
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
                if (taskData.assigned_to !== undefined) {
                    fields.push('assigned_to = ?');
                    values.push(taskData.assigned_to);
                }

                values.push(id);
                values.push(organizationId);

                let sql = `UPDATE gorevler SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`;

                // Yetki kontrolü
                if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                    sql += ' AND assigned_to = ?';
                    values.push(userId);
                }

                db.run(sql, values, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Görev bulunamadı veya güncelleme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    async deleteTask(id, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - sadece görev oluşturan veya organizasyon sahibi/yönetici silebilir
            let query = supabase
                .from('gorevler')
                .delete()
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                query = query.eq('created_by', userId);
            }

            const { error, count } = await query;

            if (error) throw error;
            if (count === 0) {
                throw new Error('Görev bulunamadı veya silme yetkiniz yok');
            }
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                let sql = 'DELETE FROM gorevler WHERE id = ? AND organization_id = ?';
                let params = [id, organizationId];

                if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                    sql += ' AND created_by = ?';
                    params.push(userId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Görev bulunamadı veya silme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    // Auth işlemleri
    async createUser(userData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .insert([userData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { username, password_hash, full_name, organization_id, role } = userData;
                db.run(
                    'INSERT INTO users (username, password_hash, full_name, organization_id, role) VALUES (?, ?, ?, ?, ?)',
                    [username, password_hash, full_name, organization_id, role || 'personel'],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async getUserByUsername(username) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE username = ? AND is_active = 1',
                    [username],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async getUserById(userId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE id = ? AND is_active = 1',
                    [userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async createOrganization(orgData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .insert([orgData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { name, invite_code, owner_id } = orgData;
                db.run(
                    'INSERT INTO organizations (name, invite_code, owner_id) VALUES (?, ?, ?)',
                    [name, invite_code, owner_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async getOrganizationByInviteCode(inviteCode) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('invite_code', inviteCode)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM organizations WHERE invite_code = ? AND is_active = 1',
                    [inviteCode],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async updateUserSession(userId, sessionToken, expiresAt) {
        if (useSupabase) {
            const { error } = await supabase
                .from('users')
                .update({
                    session_token: sessionToken,
                    session_expires_at: expiresAt,
                    last_login: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) throw error;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET session_token = ?, session_expires_at = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [sessionToken, expiresAt, userId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    async updateUserOrganization(userId, organizationId) {
        if (useSupabase) {
            const { error } = await supabase
                .from('users')
                .update({ organization_id: organizationId })
                .eq('id', userId);

            if (error) throw error;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET organization_id = ? WHERE id = ?',
                    [organizationId, userId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    // Organizasyon işlemleri
    async getOrganizationMembers(organizationId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, full_name, role, is_active, created_at, last_login')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.all(
                    'SELECT id, username, full_name, role, is_active, created_at, last_login FROM users WHERE organization_id = ? AND is_active = 1 ORDER BY created_at',
                    [organizationId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
        }
    },

    async updateUserRole(userId, newRole, organizationId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId)
                .eq('organization_id', organizationId)
                .select();

            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET role = ? WHERE id = ? AND organization_id = ?',
                    [newRole, userId, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    async getOrganizationStats(organizationId) {
        if (useSupabase) {
            // Kullanıcı sayısı
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, role')
                .eq('organization_id', organizationId)
                .eq('is_active', true);

            if (usersError) throw usersError;

            // Personel sayısı
            const { data: personel, error: personelError } = await supabase
                .from('personel')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('aktif', true);

            if (personelError) throw personelError;

            // Not sayısı
            const { data: notlar, error: notlarError } = await supabase
                .from('notlar')
                .select('id')
                .eq('organization_id', organizationId);

            if (notlarError) throw notlarError;

            // Görev sayısı
            const { data: gorevler, error: gorevlerError } = await supabase
                .from('gorevler')
                .select('id, durum')
                .eq('organization_id', organizationId);

            if (gorevlerError) throw gorevlerError;

            return {
                totalUsers: users.length,
                usersByRole: {
                    organizasyon_sahibi: users.filter(u => u.role === 'organizasyon_sahibi').length,
                    yonetici: users.filter(u => u.role === 'yonetici').length,
                    personel: users.filter(u => u.role === 'personel').length
                },
                totalPersonel: personel.length,
                totalNotes: notlar.length,
                totalTasks: gorevler.length,
                tasksByStatus: {
                    beklemede: gorevler.filter(g => g.durum === 'beklemede').length,
                    devam_ediyor: gorevler.filter(g => g.durum === 'devam_ediyor').length,
                    tamamlandi: gorevler.filter(g => g.durum === 'tamamlandi').length
                }
            };
        } else {
            return new Promise((resolve, reject) => {
                // Paralel sorgular için Promise.all kullan
                const queries = [
                    // Kullanıcı sayıları
                    new Promise((res, rej) => {
                        db.all(
                            'SELECT role, COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = 1 GROUP BY role',
                            [organizationId],
                            (err, rows) => err ? rej(err) : res(rows)
                        );
                    }),
                    // Personel sayısı
                    new Promise((res, rej) => {
                        db.get(
                            'SELECT COUNT(*) as count FROM personel WHERE organization_id = ? AND aktif = 1',
                            [organizationId],
                            (err, row) => err ? rej(err) : res(row)
                        );
                    }),
                    // Not sayısı
                    new Promise((res, rej) => {
                        db.get(
                            'SELECT COUNT(*) as count FROM notlar WHERE organization_id = ?',
                            [organizationId],
                            (err, row) => err ? rej(err) : res(row)
                        );
                    }),
                    // Görev sayıları
                    new Promise((res, rej) => {
                        db.all(
                            'SELECT durum, COUNT(*) as count FROM gorevler WHERE organization_id = ? GROUP BY durum',
                            [organizationId],
                            (err, rows) => err ? rej(err) : res(rows)
                        );
                    })
                ];

                Promise.all(queries)
                    .then(([userRoles, personelCount, noteCount, taskStatuses]) => {
                        const usersByRole = {
                            organizasyon_sahibi: 0,
                            yonetici: 0,
                            personel: 0
                        };

                        userRoles.forEach(row => {
                            usersByRole[row.role] = row.count;
                        });

                        const tasksByStatus = {
                            beklemede: 0,
                            devam_ediyor: 0,
                            tamamlandi: 0
                        };

                        taskStatuses.forEach(row => {
                            tasksByStatus[row.durum] = row.count;
                        });

                        resolve({
                            totalUsers: Object.values(usersByRole).reduce((a, b) => a + b, 0),
                            usersByRole,
                            totalPersonel: personelCount.count,
                            totalNotes: noteCount.count,
                            totalTasks: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
                            tasksByStatus
                        });
                    })
                    .catch(reject);
            });
        }
    },

    async generateNewInviteCode(organizationId) {
        let newCode;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            newCode = generateInviteCode();
            attempts++;

            // Kod benzersiz mi kontrol et
            const existing = await this.getOrganizationByInviteCode(newCode);
            if (!existing) {
                break;
            }
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            throw new Error('Benzersiz davet kodu oluşturulamadı');
        }

        // Organizasyonun davet kodunu güncelle
        if (useSupabase) {
            const { error } = await supabase
                .from('organizations')
                .update({ invite_code: newCode })
                .eq('id', organizationId);

            if (error) throw error;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE organizations SET invite_code = ? WHERE id = ?',
                    [newCode, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ invite_code: newCode });
                    }
                );
            });
        }

        return { invite_code: newCode };
    },

    async getOrganizationById(organizationId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', organizationId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM organizations WHERE id = ? AND is_active = 1',
                    [organizationId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async updateOrganization(organizationId, updateData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .update({
                    name: updateData.name,
                    updated_at: new Date().toISOString()
                })
                .eq('id', organizationId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE organizations SET name = ? WHERE id = ? AND is_active = 1',
                    [updateData.name, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Organizasyon bulunamadı'));
                        else resolve({ id: organizationId, changes: this.changes });
                    }
                );
            });
        }
    },

    async updateOrganizationInviteCode(organizationId, inviteCode) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .update({
                    invite_code: inviteCode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', organizationId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE organizations SET invite_code = ? WHERE id = ? AND is_active = 1',
                    [inviteCode, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Organizasyon bulunamadı'));
                        else resolve({ id: organizationId, changes: this.changes });
                    }
                );
            });
        }
    },

    async updateUserProfile(userId, updateData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({
                    full_name: updateData.full_name
                })
                .eq('id', userId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET full_name = ? WHERE id = ? AND is_active = 1',
                    [updateData.full_name, userId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Kullanıcı bulunamadı'));
                        else resolve({ id: userId, changes: this.changes });
                    }
                );
            });
        }
    },

    async updateUserPassword(userId, passwordHash) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash
                })
                .eq('id', userId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET password_hash = ? WHERE id = ? AND is_active = 1',
                    [passwordHash, userId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Kullanıcı bulunamadı'));
                        else resolve({ id: userId, changes: this.changes });
                    }
                );
            });
        }
    },

    // AI Analiz sonuçlarını kaydet
    async saveNoteAnalysis(noteId, analysis) {
        if (useSupabase) {
            // Supabase için implement edilecek
            return null;
        } else {
            return new Promise((resolve, reject) => {
                // Her yetkinlik için ayrı kayıt
                const competencyIds = {
                    communication: 1,
                    teamwork: 2,
                    problem_solving: 3,
                    customer_focus: 4,
                    reliability: 5
                };

                const insertPromises = Object.keys(analysis.scores).map(competency => {
                    const score = analysis.scores[competency];
                    return new Promise((res, rej) => {
                        db.run(`
                            INSERT INTO note_analysis 
                            (note_id, competency_id, likert_score, confidence_level, ai_reasoning)
                            VALUES (?, ?, ?, ?, ?)
                        `, [
                            noteId,
                            competencyIds[competency],
                            score.score,
                            score.confidence,
                            score.reasoning
                        ], function (err) {
                            if (err) rej(err);
                            else res(this.lastID);
                        });
                    });
                });

                Promise.all(insertPromises)
                    .then(results => resolve(results))
                    .catch(err => reject(err));
            });
        }
    },

    // Personel yetkinlik özetini güncelle
    async updatePersonnelCompetencySummary(personnelId, analysis) {
        if (useSupabase) {
            // Supabase için implement edilecek
            return null;
        } else {
            return new Promise((resolve, reject) => {
                const competencyIds = {
                    communication: 1,
                    teamwork: 2,
                    problem_solving: 3,
                    customer_focus: 4,
                    reliability: 5
                };

                const updatePromises = Object.keys(analysis.scores).map(competency => {
                    const score = analysis.scores[competency];
                    const competencyId = competencyIds[competency];

                    return new Promise((res, rej) => {
                        // Mevcut özeti al
                        db.get(`
                            SELECT current_score, note_count 
                            FROM personnel_competency_summary 
                            WHERE personel_id = ? AND competency_id = ?
                        `, [personnelId, competencyId], (err, row) => {
                            if (err) {
                                rej(err);
                                return;
                            }

                            if (row) {
                                // Mevcut kayıt var, güncelle
                                const newNoteCount = row.note_count + 1;
                                const newScore = ((row.current_score * row.note_count) + score.score) / newNoteCount;
                                const trend = newScore > row.current_score ? 'up' :
                                    newScore < row.current_score ? 'down' : 'stable';

                                db.run(`
                                    UPDATE personnel_competency_summary 
                                    SET previous_score = current_score,
                                        current_score = ?,
                                        trend_direction = ?,
                                        note_count = ?,
                                        last_updated = CURRENT_TIMESTAMP
                                    WHERE personel_id = ? AND competency_id = ?
                                `, [newScore, trend, newNoteCount, personnelId, competencyId], function (err) {
                                    if (err) rej(err);
                                    else res(this.changes);
                                });
                            } else {
                                // Yeni kayıt oluştur
                                db.run(`
                                    INSERT INTO personnel_competency_summary 
                                    (personel_id, competency_id, current_score, previous_score, trend_direction, note_count)
                                    VALUES (?, ?, ?, ?, ?, ?)
                                `, [personnelId, competencyId, score.score, score.score, 'stable', 1], function (err) {
                                    if (err) rej(err);
                                    else res(this.lastID);
                                });
                            }
                        });
                    });
                });

                Promise.all(updatePromises)
                    .then(results => resolve(results))
                    .catch(err => reject(err));
            });
        }
    }
};

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

// =====================================================
// AUTH API ENDPOINTS
// =====================================================

// Kullanıcı Kaydı
app.post('/api/auth/register', async (req, res) => {
    try {
        console.log('🔥 Kayit islemi basladi:', req.body);
        const { username, password, fullName, inviteCode } = req.body;

        // Validasyon
        if (!username || !password || !fullName) {
            console.log('❌ Validasyon hatasi: Eksik alanlar');
            return res.status(400).json({ error: 'Tüm alanlar gerekli' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }

        // Kullanıcı adı kontrolü
        console.log('🔍 Kullanici adi kontrolu:', username);
        const existingUser = await dbOperations.getUserByUsername(username);
        if (existingUser) {
            console.log('❌ Kullanici adi zaten var:', username);
            return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanımda' });
        }

        // Şifreyi hash'le
        console.log('🔐 Sifre hashleniyor...');
        const passwordHash = await hashPassword(password);
        console.log('✅ Sifre hashlendi');

        let organizationId = null;
        let role = 'organizasyon_sahibi'; // İlk kullanıcı organizasyon sahibi

        // Davet kodu varsa organizasyon bul
        if (inviteCode) {
            const organization = await dbOperations.getOrganizationByInviteCode(inviteCode);
            if (!organization) {
                return res.status(404).json({ error: 'Geçersiz davet kodu' });
            }
            organizationId = organization.id;
            role = 'personel'; // Davet ile gelenler personel
        }

        // Kullanıcı oluştur
        console.log('👤 Kullanici olusturuluyor:', { username, fullName, organizationId, role });
        const newUser = await dbOperations.createUser({
            username,
            password_hash: passwordHash,
            full_name: fullName,
            organization_id: organizationId,
            role
        });
        console.log('✅ Kullanici olusturuldu:', newUser.id);

        // Eğer davet kodu yoksa (ilk kullanıcı), organizasyon oluştur
        if (!inviteCode) {
            const orgName = fullName + ' Organizasyonu';
            const newInviteCode = generateInviteCode();

            const organization = await dbOperations.createOrganization({
                name: orgName,
                invite_code: newInviteCode,
                owner_id: newUser.id
            });

            // Kullanıcının organizasyon ID'sini güncelle
            organizationId = organization.id;
            await dbOperations.updateUserOrganization(newUser.id, organizationId);
        }

        // Kullanıcıyı personel tablosuna da ekle (görev atanabilmesi için)
        try {
            const [firstName, ...lastNameParts] = fullName.split(' ');
            const lastName = lastNameParts.join(' ') || firstName;

            await dbOperations.addPersonel({
                ad: firstName,
                soyad: lastName,
                pozisyon: role === 'organizasyon_sahibi' ? 'Organizasyon Sahibi' :
                    role === 'yonetici' ? 'Yönetici' : 'Personel',
                telefon: '', // Boş bırak, sonra güncellenebilir
                email: '', // Boş bırak, sonra güncellenebilir
                baslangic_tarihi: new Date().toISOString().split('T')[0],
                organization_id: organizationId,
                created_by: newUser.id
            });
        } catch (personelError) {
            console.error('Personel kaydı oluşturulamadı:', personelError);
            // Personel kaydı başarısız olsa bile kullanıcı kaydı devam etsin
        }

        res.status(201).json({
            success: true,
            message: 'Kayıt başarılı',
            user: {
                id: newUser.id,
                username,
                fullName,
                role,
                organizationId
            }
        });

    } catch (error) {
        console.error('Kayıt hatası:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });

        // Supabase hatalarını daha anlaşılır hale getir
        if (error.code === 'PGRST116') {
            res.status(400).json({ error: 'Veri bulunamadı veya oluşturulamadı' });
        } else if (error.message && error.message.includes('violates not-null constraint')) {
            res.status(400).json({ error: 'Gerekli alanlar eksik' });
        } else {
            res.status(500).json({ error: 'Sunucu hatası' });
        }
    }
});

// Kullanıcı Girişi
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validasyon
        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        // Kullanıcıyı bul
        const user = await dbOperations.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }

        // Şifre kontrolü
        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }

        // JWT token oluştur
        const token = generateToken(user);

        // Session bilgilerini güncelle
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 2); // 2 gün

        await dbOperations.updateUserSession(user.id, token, expiresAt.toISOString());

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                organizationId: user.organization_id
            },
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Giriş hatası:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });

        // Supabase hatalarını daha anlaşılır hale getir
        if (error.code === 'PGRST116') {
            res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        } else {
            res.status(500).json({ error: 'Sunucu hatası' });
        }
    }
});

// Kullanıcı Çıkışı
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Session token'ı temizle
        await dbOperations.updateUserSession(req.user.id, null, null);

        res.json({
            success: true,
            message: 'Çıkış başarılı'
        });

    } catch (error) {
        console.error('Çıkış hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Token Doğrulama
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            organizationId: req.user.organizationId
        }
    });
});

// =====================================================
// ORGANIZATION API ENDPOINTS
// =====================================================

// Organizasyon üyelerini getir
app.get('/api/organization/members', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const members = await dbOperations.getOrganizationMembers(req.organizationId);
        res.json({
            success: true,
            members
        });
    } catch (error) {
        console.error('Üye listesi getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Yeni davet kodu oluştur (sadece organizasyon sahibi)
app.post('/api/organization/invite-code', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const result = await dbOperations.generateNewInviteCode(req.user.organizationId);
        res.json({
            success: true,
            inviteCode: result.invite_code,
            message: 'Yeni davet kodu oluşturuldu'
        });
    } catch (error) {
        console.error('Davet kodu oluşturma hatası:', error);
        res.status(500).json({ error: 'Davet kodu oluşturulamadı' });
    }
});

// Kullanıcı rolünü güncelle (sadece organizasyon sahibi)
app.put('/api/organization/member/:id/role', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const { role } = req.body;
        const memberId = req.params.id;

        // Rol validasyonu
        const validRoles = ['organizasyon_sahibi', 'yonetici', 'personel'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Geçersiz rol' });
        }

        // Kendi rolünü değiştirmeye çalışıyor mu?
        if (memberId == req.user.id) {
            return res.status(403).json({ error: 'Kendi rolünüzü değiştiremezsiniz' });
        }

        await dbOperations.updateUserRole(memberId, role, req.user.organizationId);

        res.json({
            success: true,
            message: 'Kullanıcı rolü güncellendi'
        });
    } catch (error) {
        console.error('Rol güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Organizasyon istatistiklerini getir
app.get('/api/organization/stats', authenticateToken, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        // Supabase bağlantısını kontrol et
        if (!useSupabase) {
            return res.status(503).json({
                error: 'Veritabanı bağlantısı mevcut değil',
                message: 'Lütfen sistem yöneticisi ile iletişime geçin'
            });
        }

        const stats = await dbOperations.getOrganizationStats(req.user.organizationId);

        // Organizasyon bilgilerini de ekle
        const organization = await dbOperations.getOrganizationById(req.user.organizationId);

        res.json({
            success: true,
            organization: {
                id: organization.id,
                name: organization.name,
                inviteCode: organization.invite_code,
                createdAt: organization.created_at
            },
            stats
        });
    } catch (error) {
        console.error('İstatistik getirme hatası:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            organizationId: req.user?.organizationId
        });

        // Supabase hatalarını daha anlaşılır hale getir
        if (error.code === 'PGRST116') {
            res.status(404).json({ error: 'Organizasyon bulunamadı' });
        } else {
            res.status(500).json({ error: 'İstatistikler yüklenirken hata oluştu' });
        }
    }
});

// Organizasyon ayarlarını güncelle (sadece organizasyon sahibi)
app.put('/api/organization/settings', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const { name } = req.body;

        // Validasyon
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Organizasyon adı boş olamaz' });
        }

        if (name.trim().length > 100) {
            return res.status(400).json({ error: 'Organizasyon adı çok uzun (maksimum 100 karakter)' });
        }

        // Organizasyon adını güncelle
        await dbOperations.updateOrganization(req.user.organizationId, {
            name: name.trim()
        });

        res.json({
            success: true,
            message: 'Organizasyon ayarları başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Organizasyon ayarları güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Özel davet kodu güncelle (sadece organizasyon sahibi)
app.put('/api/organization/invite-code/custom', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const { inviteCode } = req.body;

        // Validasyon
        if (!inviteCode || inviteCode.trim().length === 0) {
            return res.status(400).json({ error: 'Davet kodu boş olamaz' });
        }

        const cleanCode = inviteCode.trim();

        if (cleanCode.length < 3 || cleanCode.length > 20) {
            return res.status(400).json({ error: 'Davet kodu 3-20 karakter arasında olmalıdır' });
        }

        // Sadece harf, rakam, tire ve alt çizgi içerebilir
        if (!/^[a-zA-Z0-9-_]+$/.test(cleanCode)) {
            return res.status(400).json({ error: 'Davet kodu sadece harf, rakam, tire (-) ve alt çizgi (_) içerebilir' });
        }

        // Davet kodunun benzersiz olup olmadığını kontrol et
        const existingOrg = await dbOperations.getOrganizationByInviteCode(cleanCode);
        if (existingOrg && existingOrg.id !== req.user.organizationId) {
            return res.status(409).json({ error: 'Bu davet kodu zaten kullanımda. Lütfen farklı bir kod seçin.' });
        }

        // Davet kodunu güncelle
        await dbOperations.updateOrganizationInviteCode(req.user.organizationId, cleanCode);

        res.json({
            success: true,
            inviteCode: cleanCode,
            message: 'Davet kodu başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Davet kodu güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kullanıcı profil bilgilerini getir
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await dbOperations.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Organizasyon adını al
        let organizationName = null;
        if (user.organization_id) {
            const organization = await dbOperations.getOrganizationById(user.organization_id);
            organizationName = organization?.name;
        }

        res.json({
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            organization_name: organizationName,
            created_at: user.created_at
        });
    } catch (error) {
        console.error('Profil getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kullanıcı profil bilgilerini güncelle
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name } = req.body;

        if (!full_name || full_name.trim().length === 0) {
            return res.status(400).json({ error: 'Ad soyad boş olamaz' });
        }

        if (full_name.trim().length > 100) {
            return res.status(400).json({ error: 'Ad soyad çok uzun (maksimum 100 karakter)' });
        }

        await dbOperations.updateUserProfile(req.user.id, {
            full_name: full_name.trim()
        });

        res.json({
            success: true,
            message: 'Profil başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kullanıcı şifresini değiştir
app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gereklidir' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır' });
        }

        // Mevcut şifreyi kontrol et
        const user = await dbOperations.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Mevcut şifre yanlış' });
        }

        // Yeni şifreyi hash'le
        const newPasswordHash = await bcrypt.hash(new_password, 10);

        await dbOperations.updateUserPassword(req.user.id, newPasswordHash);

        res.json({
            success: true,
            message: 'Şifre başarıyla değiştirildi'
        });

    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Manuel AI analizi başlat (sadece organizasyon sahibi/yönetici)
app.post('/api/personel/:id/analyze', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Personelin tüm notlarını al
        const notes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, not_metni, kategori, tarih
                FROM notlar 
                WHERE personel_id = ? AND organization_id = ?
                ORDER BY tarih DESC
            `, [personnelId, req.organizationId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (notes.length === 0) {
            return res.json({
                success: false,
                message: 'Analiz için yeterli not bulunamadı'
            });
        }

        // Mevcut analizleri temizle
        await new Promise((resolve, reject) => {
            db.run(`
                DELETE FROM note_analysis 
                WHERE note_id IN (
                    SELECT id FROM notlar WHERE personel_id = ? AND organization_id = ?
                )
            `, [personnelId, req.organizationId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await new Promise((resolve, reject) => {
            db.run(`
                DELETE FROM personnel_competency_summary 
                WHERE personel_id = ?
            `, [personnelId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Her notu analiz et
        let analysisCount = 0;
        for (const note of notes) {
            try {
                const analysis = simpleAIAnalysisService.analyzeNote(note.not_metni, note.kategori);
                await dbOperations.saveNoteAnalysis(note.id, analysis);
                await dbOperations.updatePersonnelCompetencySummary(personnelId, analysis);
                analysisCount++;
            } catch (error) {
                console.error(`Not ${note.id} analiz hatası:`, error);
            }
        }

        res.json({
            success: true,
            message: `${analysisCount} not başarıyla analiz edildi`,
            analyzed_notes: analysisCount,
            total_notes: notes.length
        });

    } catch (error) {
        console.error('AI analiz hatası:', error);
        res.status(500).json({ error: 'Analiz sırasında hata oluştu' });
    }
});

// Personel yetkinlik raporu getir
app.get('/api/personel/:id/competency-report', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Yetkinlik özetini al
        const competencySummary = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    c.name,
                    c.description,
                    pcs.current_score,
                    pcs.previous_score,
                    pcs.trend_direction,
                    pcs.note_count,
                    pcs.last_updated
                FROM personnel_competency_summary pcs
                JOIN competencies c ON pcs.competency_id = c.id
                WHERE pcs.personel_id = ?
                ORDER BY c.name
            `, [personnelId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Son notların analizini al
        const recentAnalysis = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    na.likert_score,
                    na.confidence_level,
                    na.ai_reasoning,
                    na.analysis_date,
                    c.name as competency_name,
                    n.not_metni,
                    n.kategori
                FROM note_analysis na
                JOIN competencies c ON na.competency_id = c.id
                JOIN notlar n ON na.note_id = n.id
                WHERE n.personel_id = ?
                ORDER BY na.analysis_date DESC
                LIMIT 20
            `, [personnelId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Genel performans hesapla
        const overallScore = competencySummary.length > 0 ?
            competencySummary.reduce((sum, comp) => sum + (comp.current_score || 3), 0) / competencySummary.length : 3;

        // AI önerileri oluştur
        const recommendations = [];
        competencySummary.forEach(comp => {
            if (comp.current_score < 3) {
                recommendations.push(`${comp.description} alanında gelişim gerekli`);
            } else if (comp.current_score > 4) {
                recommendations.push(`${comp.description} alanında güçlü performans`);
            }
        });

        res.json({
            personnel_id: personnelId,
            overall_score: Math.round(overallScore * 10) / 10,
            competency_summary: competencySummary,
            recent_analysis: recentAnalysis,
            recommendations: recommendations.length > 0 ? recommendations : ['Performansı takip etmeye devam edin'],
            report_date: new Date().toISOString()
        });

    } catch (error) {
        console.error('Yetkinlik raporu hatası:', error);
        res.status(500).json({ error: 'Rapor oluşturulurken hata oluştu' });
    }
});

// Personel raporu export et
app.get('/api/personel/:id/export/:format', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const personnelId = req.params.id;
        const format = req.params.format; // 'excel' veya 'pdf'

        // Personel bilgilerini al
        const personnel = await dbOperations.getPersonelById(personnelId);
        if (!personnel) {
            return res.status(404).json({ error: 'Personel bulunamadı' });
        }

        // Eksik alanları tamamla
        personnel.ad_soyad = `${personnel.ad || ''} ${personnel.soyad || ''}`.trim();
        personnel.departman = personnel.pozisyon || 'Belirtilmemiş';
        personnel.ise_baslama = personnel.baslangic_tarihi || '-';
        personnel.telefon = personnel.telefon || 'Belirtilmemiş';
        personnel.email = personnel.email || 'Belirtilmemiş';
        personnel.pozisyon = personnel.pozisyon || 'Belirtilmemiş';



        // Notları al
        const notes = await dbOperations.getNotesByPersonelId(personnelId);

        // Görevleri al
        const tasks = await dbOperations.getTasksByPersonelId(personnelId);

        if (format === 'excel') {
            // Excel formatında export
            const workbook = {
                SheetNames: ['Personel Bilgileri', 'Notlar', 'Görevler'],
                Sheets: {}
            };

            // Personel bilgileri sayfası
            workbook.Sheets['Personel Bilgileri'] = {
                A1: { v: 'Ad Soyad', t: 's' },
                B1: { v: personnel.ad_soyad, t: 's' },
                A2: { v: 'Pozisyon', t: 's' },
                B2: { v: personnel.pozisyon, t: 's' },
                A3: { v: 'Departman', t: 's' },
                B3: { v: personnel.departman, t: 's' },
                A4: { v: 'Telefon', t: 's' },
                B4: { v: personnel.telefon, t: 's' },
                A5: { v: 'Email', t: 's' },
                B5: { v: personnel.email, t: 's' },
                A6: { v: 'İşe Başlama', t: 's' },
                B6: { v: personnel.ise_baslama, t: 's' },
                '!ref': 'A1:B6'
            };

            // Notlar sayfası
            const notesSheet = {
                A1: { v: 'Tarih', t: 's' },
                B1: { v: 'Kategori', t: 's' },
                C1: { v: 'Not', t: 's' },
                D1: { v: 'Yazan', t: 's' }
            };

            notes.forEach((note, index) => {
                const row = index + 2;
                notesSheet[`A${row}`] = { v: note.tarih, t: 's' };
                notesSheet[`B${row}`] = { v: note.kategori, t: 's' };
                notesSheet[`C${row}`] = { v: note.not_metni, t: 's' };
                notesSheet[`D${row}`] = { v: note.created_by_name || 'Bilinmiyor', t: 's' };
            });

            notesSheet['!ref'] = `A1:D${notes.length + 1}`;
            workbook.Sheets['Notlar'] = notesSheet;

            // Görevler sayfası
            const tasksSheet = {
                A1: { v: 'Başlık', t: 's' },
                B1: { v: 'Açıklama', t: 's' },
                C1: { v: 'Durum', t: 's' },
                D1: { v: 'Öncelik', t: 's' },
                E1: { v: 'Bitiş Tarihi', t: 's' },
                F1: { v: 'Atayan', t: 's' },
                G1: { v: 'Atanan', t: 's' }
            };

            tasks.forEach((task, index) => {
                const row = index + 2;
                tasksSheet[`A${row}`] = { v: task.baslik, t: 's' };
                tasksSheet[`B${row}`] = { v: task.aciklama, t: 's' };
                tasksSheet[`C${row}`] = { v: task.durum, t: 's' };
                tasksSheet[`D${row}`] = { v: task.oncelik, t: 's' };
                tasksSheet[`E${row}`] = { v: task.bitis_tarihi, t: 's' };
                tasksSheet[`F${row}`] = { v: task.created_by_name || 'Bilinmiyor', t: 's' };
                tasksSheet[`G${row}`] = { v: task.assigned_to_name || 'Bilinmiyor', t: 's' };
            });

            tasksSheet['!ref'] = `A1:G${tasks.length + 1}`;
            workbook.Sheets['Görevler'] = tasksSheet;

            // Excel dosyasını oluştur (basit CSV formatında)
            let csvContent = '';

            // Personel bilgileri
            csvContent += 'PERSONEL BİLGİLERİ\n';
            csvContent += `Ad Soyad,${personnel.ad_soyad || '-'}\n`;
            csvContent += `Pozisyon,${personnel.pozisyon || '-'}\n\n`;

            // Notlar
            csvContent += 'NOTLAR\n';
            csvContent += 'Tarih,Kategori,Not,Yazan\n';
            notes.forEach(note => {
                csvContent += `"${note.tarih || '-'}","${note.kategori || '-'}","${(note.not_metni || '-').replace(/"/g, '""')}","${note.created_by_name || 'Sistem'}"\n`;
            });
            csvContent += '\n';

            // Görevler
            csvContent += 'GÖREVLER\n';
            csvContent += 'Başlık,Açıklama,Durum,Bitiş Tarihi,Performans\n';
            tasks.forEach(task => {
                csvContent += `"${task.gorev_baslik || '-'}","${(task.gorev_aciklama || '-').replace(/"/g, '""')}","${task.durum || '-'}","${task.bitis_tarihi || '-'}","${task.performans_puani ? `${task.performans_puani}/5` : '-'}"\n`;
            });

            const today = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
            const safeName = personnel.ad_soyad
                .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                .replace(/ş/g, 's').replace(/Ş/g, 'S')
                .replace(/ı/g, 'i').replace(/İ/g, 'I')
                .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                .replace(/ç/g, 'c').replace(/Ç/g, 'C')
                .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
            const fileName = `${safeName}_${today}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send('\ufeff' + csvContent); // UTF-8 BOM ekle

        } else if (format === 'pdf') {
            // PDF formatında export (HTML template)
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Personel Raporu - ${personnel.ad_soyad}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .info-table td:first-child { font-weight: bold; width: 150px; }
        .note-text { max-width: 300px; word-wrap: break-word; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Personel Raporu</h1>
        <p>Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
    </div>

    <div class="section">
        <h2>Personel Bilgileri</h2>
        <table class="info-table">
            <tr><td>Ad Soyad:</td><td>${personnel.ad_soyad || '-'}</td></tr>
            <tr><td>Pozisyon:</td><td>${personnel.pozisyon || '-'}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Notlar (${notes.length} adet)</h2>
        <table>
            <thead>
                <tr>
                    <th>Tarih</th>
                    <th>Kategori</th>
                    <th>Not</th>
                    <th>Yazan</th>
                </tr>
            </thead>
            <tbody>
                ${notes.map(note => `
                    <tr>
                        <td>${note.tarih || '-'}</td>
                        <td>${note.kategori || '-'}</td>
                        <td class="note-text">${note.not_metni || '-'}</td>
                        <td>${note.created_by_name || 'Sistem'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Görevler (${tasks.length} adet)</h2>
        <table>
            <thead>
                <tr>
                    <th>Başlık</th>
                    <th>Açıklama</th>
                    <th>Durum</th>
                    <th>Bitiş Tarihi</th>
                    <th>Performans</th>
                </tr>
            </thead>
            <tbody>
                ${tasks.map(task => `
                    <tr>
                        <td>${task.gorev_baslik || '-'}</td>
                        <td class="note-text">${task.gorev_aciklama || '-'}</td>
                        <td>${task.durum || '-'}</td>
                        <td>${task.bitis_tarihi || '-'}</td>
                        <td>${task.performans_puani ? `${task.performans_puani}/5` : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

            const today = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
            const safeName = personnel.ad_soyad
                .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                .replace(/ş/g, 's').replace(/Ş/g, 'S')
                .replace(/ı/g, 'i').replace(/İ/g, 'I')
                .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                .replace(/ç/g, 'c').replace(/Ç/g, 'C')
                .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
            const fileName = `${safeName}_${today}.html`;

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(htmlContent);
        } else {
            res.status(400).json({ error: 'Geçersiz format. excel veya pdf kullanın.' });
        }

    } catch (error) {
        console.error('Export hatası:', error);
        res.status(500).json({ error: 'Rapor oluşturulurken hata oluştu' });
    }
});

// Davet kodu geçerliliğini kontrol et (public endpoint)
app.get('/api/organization/invite-code/:code/validate', async (req, res) => {
    try {
        const { code } = req.params;

        const organization = await dbOperations.getOrganizationByInviteCode(code);

        if (!organization) {
            return res.status(404).json({
                valid: false,
                error: 'Geçersiz davet kodu'
            });
        }

        res.json({
            valid: true,
            organization: {
                id: organization.id,
                name: organization.name
            }
        });
    } catch (error) {
        console.error('Davet kodu doğrulama hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Kullanıcının rol yetkilerini kontrol et
app.get('/api/organization/permissions', authenticateToken, (req, res) => {
    try {
        const userRole = req.user.role;

        const permissions = {
            canManageUsers: userRole === 'organizasyon_sahibi',
            canCreateInviteCode: userRole === 'organizasyon_sahibi',
            canViewAllPersonel: ['organizasyon_sahibi', 'yonetici'].includes(userRole),
            canViewAllNotes: userRole === 'organizasyon_sahibi',
            canViewAllTasks: ['organizasyon_sahibi', 'yonetici'].includes(userRole),
            canAssignTasks: ['organizasyon_sahibi', 'yonetici'].includes(userRole),
            canViewStats: ['organizasyon_sahibi', 'yonetici'].includes(userRole)
        };

        res.json({
            success: true,
            role: userRole,
            permissions
        });
    } catch (error) {
        console.error('Yetki kontrolü hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Personel için kendi görevlerini getir
app.get('/api/organization/my-tasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .select(`
                    *,
                    personel:personel_id(ad, soyad)
                `)
                .eq('assigned_to', userId)
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data);
        } else {
            db.all(`
                SELECT g.*, p.ad, p.soyad,
                       (p.ad || ' ' || p.soyad) as personel_name
                FROM gorevler g 
                LEFT JOIN personel p ON g.personel_id = p.id 
                WHERE g.assigned_to = ? AND g.organization_id = ? 
                ORDER BY g.created_at DESC
            `, [userId, organizationId], (err, rows) => {
                if (err) {
                    console.error('Görevler getirme hatası:', err);
                    res.status(500).json({ error: 'Sunucu hatası' });
                } else {
                    res.json(rows);
                }
            });
        }
    } catch (error) {
        console.error('Kendi görevleri getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Personel için kendi notlarını getir
app.get('/api/organization/my-notes', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .select(`
                    *,
                    personel:personel_id(ad, soyad)
                `)
                .eq('created_by', userId)
                .eq('organization_id', organizationId)
                .order('tarih', { ascending: false });

            if (error) throw error;
            res.json(data);
        } else {
            db.all(`
                SELECT n.*, p.ad, p.soyad,
                       (p.ad || ' ' || p.soyad) as personel_name
                FROM notlar n 
                LEFT JOIN personel p ON n.personel_id = p.id 
                WHERE n.created_by = ? AND n.organization_id = ? 
                ORDER BY n.tarih DESC
            `, [userId, organizationId], (err, rows) => {
                if (err) {
                    console.error('Notlar getirme hatası:', err);
                    res.status(500).json({ error: 'Sunucu hatası' });
                } else {
                    res.json(rows);
                }
            });
        }
    } catch (error) {
        console.error('Kendi notları getirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// =====================================================
// PERSONEL API ENDPOINTS (Güncellenmiş)
// =====================================================


// Tüm personeli getir (organizasyon bazlı)
app.get('/api/personel', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        let personel = await dbOperations.getPersonel(req.organizationId);

        // Rol bazlı filtreleme
        if (req.user.role === 'personel') {
            // Personel sadece kendini görebilir
            personel = personel.filter(p => p.created_by === req.user.id);
        } else if (req.user.role === 'yonetici') {
            // Yönetici tüm personelleri görebilir (kendisi ve astları)
            // Filtreleme yapmıyoruz, tüm personelleri gösterebilir
        }
        // Organizasyon sahibi herkesi görebilir

        res.json(personel);
    } catch (error) {
        console.error('Personel getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Yeni personel ekle
app.post('/api/personel', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        // Organizasyon ve oluşturan kişi bilgilerini ekle
        const personelData = {
            ...req.body,
            organization_id: req.organizationId,
            created_by: req.user.id
        };

        const result = await dbOperations.addPersonel(personelData);
        res.json({ id: result.id, message: 'Personel başarıyla eklendi' });
    } catch (error) {
        console.error('Personel ekleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel güncelleme
app.put('/api/personel/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        await dbOperations.updatePersonel(req.params.id, req.body, req.organizationId);
        res.json({ message: 'Personel başarıyla güncellendi' });
    } catch (error) {
        console.error('Personel güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel silme
app.delete('/api/personel/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        await dbOperations.deletePersonel(req.params.id, req.organizationId);
        res.json({ message: 'Personel başarıyla silindi' });
    } catch (error) {
        console.error('Personel silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel notlarını getir (organizasyon bazlı)
app.get('/api/personel/:id/notlar', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        let notlar = await dbOperations.getPersonelNotes(req.params.id, req.organizationId);

        // Rol bazlı filtreleme
        if (req.user.role === 'personel') {
            // Personel sadece kendi oluşturduğu notları görebilir
            notlar = notlar.filter(not => not.created_by === req.user.id);
        } else if (req.user.role === 'yonetici') {
            // Yönetici sadece kendi yazdığı notları görebilir
            notlar = notlar.filter(not => not.created_by === req.user.id);
        }
        // Organizasyon sahibi tüm notları görebilir

        res.json(notlar);
    } catch (error) {
        console.error('Notlar getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Yeni not ekle
app.post('/api/notlar', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        // Organizasyon ve oluşturan kişi bilgilerini ekle
        const noteData = {
            ...req.body,
            created_by: req.user.id,
            organization_id: req.organizationId
        };

        const result = await dbOperations.addNote(noteData);
        res.json({ id: result.id, message: 'Not başarıyla eklendi' });
    } catch (error) {
        console.error('Not ekleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Not güncelleme (sadece not sahibi veya organizasyon sahibi)
app.put('/api/notlar/:id', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        // Not sahibi kontrolü yapılacak (updateNote fonksiyonunda)
        await dbOperations.updateNote(req.params.id, req.body, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Not başarıyla güncellendi' });
    } catch (error) {
        console.error('Not güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Not silme (sadece not sahibi veya organizasyon sahibi)
app.delete('/api/notlar/:id', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        await dbOperations.deleteNote(req.params.id, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Not başarıyla silindi' });
    } catch (error) {
        console.error('Not silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel görevlerini getir (organizasyon bazlı)
app.get('/api/personel/:id/gorevler', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const gorevler = await dbOperations.getPersonelTasks(req.params.id, req.organizationId);
        res.json(gorevler);
    } catch (error) {
        console.error('Görevler getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Kullanıcının kendi görevlerini getir
app.get('/api/my-tasks', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        // Kullanıcının atandığı görevleri getir
        const tasks = await new Promise((resolve, reject) => {
            if (useSupabase) {
                resolve([]); // Şimdilik boş
            } else {
                db.all(
                    `SELECT g.*, p.ad, p.soyad 
                     FROM gorevler g 
                     LEFT JOIN personel p ON g.personel_id = p.id 
                     WHERE g.assigned_to = ? AND g.organization_id = ?
                     ORDER BY g.created_at DESC`,
                    [req.user.id, req.organizationId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            }
        });

        res.json(tasks);
    } catch (error) {
        console.error('Kullanıcı görevleri getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Yeni görev ekle (sadece organizasyon sahibi ve yönetici)
app.post('/api/gorevler', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        // Personel ID'sinden kullanıcı ID'sini bul
        let assignedToUserId = null;
        if (req.body.personel_id) {
            // Personel adı ile kullanıcı adını eşleştir
            if (useSupabase) {
                // Supabase için implement edilecek
                assignedToUserId = null;
            } else {
                const personelAndUser = await new Promise((resolve, reject) => {
                    db.get(`
            SELECT p.ad, p.soyad, u.id as user_id, u.full_name
            FROM personel p
            LEFT JOIN users u ON (p.ad || ' ' || p.soyad) = u.full_name
            WHERE p.id = ? AND u.organization_id = ?
          `, [req.body.personel_id, req.organizationId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                assignedToUserId = personelAndUser?.user_id;

                // Eğer tam eşleşme bulunamazsa, personeli oluşturan kullanıcıyı kullan
                if (!assignedToUserId) {
                    const personel = await new Promise((resolve, reject) => {
                        db.get('SELECT created_by FROM personel WHERE id = ? AND organization_id = ?',
                            [req.body.personel_id, req.organizationId], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                    });
                    assignedToUserId = personel?.created_by;
                }
            }
        }

        // Organizasyon ve oluşturan kişi bilgilerini ekle
        const taskData = {
            ...req.body,
            created_by: req.user.id,
            organization_id: req.organizationId,
            assigned_to: assignedToUserId || req.user.id // Eğer kullanıcı bulunamazsa görevi oluşturana ata
        };

        const result = await dbOperations.addTask(taskData);
        res.json({ id: result.id, message: 'Görev başarıyla eklendi' });
    } catch (error) {
        console.error('Görev ekleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Görev durumunu güncelle (görev sahibi, atanan kişi veya yöneticiler)
app.put('/api/gorevler/:id', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        await dbOperations.updateTask(req.params.id, req.body, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Görev başarıyla güncellendi' });
    } catch (error) {
        console.error('Görev güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Görev silme (sadece görev oluşturan veya organizasyon sahibi)
app.delete('/api/gorevler/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        await dbOperations.deleteTask(req.params.id, req.user.id, req.user.role, req.organizationId);
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

// İK Uzmanı Seviyesinde Kapsamlı Personel Analizi
app.get('/api/personel/:id/hr-analysis', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Personel bilgilerini al - SUPABASE UYUMLU
        let personnelInfo;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('personel')
                .select(`
                    *,
                    organizations!organization_id(name)
                `)
                .eq('id', personnelId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                personnelInfo = {
                    ...data,
                    organizasyon_adi: data.organizations?.name || 'Bilinmiyor'
                };
            }
        } else {
            // SQLite fallback
            personnelInfo = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT p.*, 
                           COALESCE(o.name, 'Bilinmiyor') as organizasyon_adi
                    FROM personel p
                    LEFT JOIN organizations o ON p.organization_id = o.id
                    WHERE p.id = ?
                `, [personnelId], (err, row) => {
                    if (err) {
                        // Eğer JOIN hatası alırsak, basit sorgu yap
                        db.get(`SELECT * FROM personel WHERE id = ?`, [personnelId], (err2, row2) => {
                            if (err2) reject(err2);
                            else {
                                if (row2) {
                                    row2.organizasyon_adi = 'Bilinmiyor';
                                }
                                resolve(row2);
                            }
                        });
                    } else {
                        resolve(row);
                    }
                });
            });
        }

        if (!personnelInfo) {
            return res.status(404).json({ error: 'Personel bulunamadı' });
        }

        // Tüm notları al - SUPABASE UYUMLU
        let notes;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .select(`
                    id, personel_id, not_metni, tarih, kategori,
                    users!created_by(full_name, username)
                `)
                .eq('personel_id', personnelId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            notes = (data || []).map(note => ({
                ...note,
                kategori: note.kategori || 'genel',
                created_by_name: note.users?.full_name || note.users?.username || 'Sistem'
            }));
        } else {
            // SQLite fallback
            notes = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT n.id, n.personel_id, n.not_metni, n.tarih, 
                           COALESCE(n.kategori, 'genel') as kategori,
                           COALESCE(u.full_name, u.username, 'Sistem') as created_by_name
                    FROM notlar n
                    LEFT JOIN users u ON n.created_by = u.id
                    WHERE n.personel_id = ?
                    ORDER BY n.tarih DESC
                `, [personnelId], (err, rows) => {
                    if (err) {
                        // Eğer JOIN hatası alırsak, basit sorgu yap
                        db.all(`
                            SELECT id, personel_id, not_metni, tarih, 
                                   COALESCE(kategori, 'genel') as kategori,
                                   'Sistem' as created_by_name
                            FROM notlar 
                            WHERE personel_id = ?
                            ORDER BY tarih DESC
                        `, [personnelId], (err2, rows2) => {
                            if (err2) reject(err2);
                            else resolve(rows2 || []);
                        });
                    } else {
                        resolve(rows || []);
                    }
                });
            });
        }

        // Performans puanlarını al - SUPABASE UYUMLU (gorevler tablosundan)
        let performanceScores;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .select('gorev_baslik, performans_puani, created_at')
                .eq('personel_id', personnelId)
                .not('performans_puani', 'is', null)
                .order('created_at', { ascending: false });

            if (error) {
                console.log('Performans puanları alınamadı:', error.message);
                performanceScores = [];
            } else {
                performanceScores = (data || []).map(item => ({
                    gorev_adi: item.gorev_baslik,
                    puan: item.performans_puani || 3,
                    tarih: item.created_at
                }));
            }
        } else {
            // SQLite fallback
            performanceScores = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT gorev_baslik as gorev_adi, 
                           COALESCE(performans_puani, 3) as puan, 
                           created_at as tarih
                    FROM gorevler
                    WHERE personel_id = ? AND performans_puani IS NOT NULL
                    ORDER BY created_at DESC
                `, [personnelId], (err, rows) => {
                    if (err) {
                        console.log('Performans puanları alınamadı:', err.message);
                        resolve([]); // Hata durumunda boş array döndür
                    } else {
                        resolve(rows || []);
                    }
                });
            });
        }

        // Gemini API ile kapsamlı analiz yap
        const personnelData = {
            personnelInfo,
            notes,
            performanceScores
        };

        console.log(`🤖 ${personnelInfo.ad} ${personnelInfo.soyad} için İK analizi başlatılıyor...`);
        console.log(`📊 Analiz verileri: ${notes.length} not, ${performanceScores.length} performans puanı`);

        let hrAnalysis;
        try {
            hrAnalysis = await advancedAI.analyzePersonnelComprehensive(personnelData);
            
            // Debug: Gemini'den gelen veriyi logla
            console.log('🤖 Gemini API response keys:', Object.keys(hrAnalysis));
            console.log('🤖 Executive summary keys:', hrAnalysis.executive_summary ? Object.keys(hrAnalysis.executive_summary) : 'yok');
            console.log('🤖 Manager action plan keys:', hrAnalysis.manager_action_plan ? Object.keys(hrAnalysis.manager_action_plan) : 'yok');
            
            // Tam veriyi logla (ilk 1000 karakter)
            console.log('🤖 Gemini tam response (ilk kısım):', JSON.stringify(hrAnalysis, null, 2).substring(0, 1000));
            
            // Eğer manager_action_plan yoksa uyar ama mock kullanma
            if (!hrAnalysis.manager_action_plan || !hrAnalysis.business_impact) {
                console.log('⚠️ Gemini API eksik veri döndürdü!');
                console.log('❌ Eksik bölümler:', {
                    manager_action_plan: !hrAnalysis.manager_action_plan,
                    business_impact: !hrAnalysis.business_impact,
                    follow_up_schedule: !hrAnalysis.follow_up_schedule
                });
            }
        } catch (error) {
            console.log('⚠️ Gemini API hatası, mock analiz kullanılıyor:', error.message);
            // Mock analiz (test amaçlı)
            hrAnalysis = generateMockHRAnalysis(personnelData);
        }

        // Data summary ve personnel info'yu hesapla
        const dataSummary = {
            total_notes: notes.length,
            positive_notes: notes.filter(n => n.kategori === 'olumlu').length,
            negative_notes: notes.filter(n => n.kategori === 'olumsuz').length,
            performance_scores: performanceScores.length
        };

        const personnelInfo_formatted = {
            id: personnelInfo.id,
            name: `${personnelInfo.ad} ${personnelInfo.soyad}`,
            position: personnelInfo.pozisyon,
            organization: personnelInfo.organizasyon_adi
        };

        // Analiz verisine metadata ekle
        const enrichedAnalysis = {
            ...hrAnalysis,
            _metadata: {
                data_summary: dataSummary,
                personnel_info: personnelInfo_formatted
            }
        };

        // Analiz sonucunu veritabanına kaydet
        let analysisId;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('hr_analysis_reports')
                .insert([{
                    personel_id: parseInt(personnelId),
                    analysis_data: enrichedAnalysis,
                    overall_risk_level: hrAnalysis.executive_summary.overall_risk_level,
                    immediate_action_required: hrAnalysis.executive_summary.immediate_action_required ? 1 : 0,
                    created_by: req.user.id
                }])
                .select('id')
                .single();

            if (error) throw error;
            analysisId = data.id;
        } else {
            // SQLite fallback
            analysisId = await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO hr_analysis_reports (
                        personel_id, 
                        analysis_data, 
                        overall_risk_level,
                        immediate_action_required,
                        created_at,
                        created_by
                    ) VALUES (?, ?, ?, ?, datetime('now'), ?)
                `, [
                    personnelId,
                    JSON.stringify(enrichedAnalysis),
                    hrAnalysis.executive_summary.overall_risk_level,
                    hrAnalysis.executive_summary.immediate_action_required ? 1 : 0,
                    req.user.id
                ], function (err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
        }

        console.log(`✅ İK analizi tamamlandı. Rapor ID: ${analysisId}`);

        res.json({
            success: true,
            analysis_id: analysisId,
            personnel_info: personnelInfo_formatted,
            data_summary: dataSummary,
            hr_analysis: hrAnalysis,
            generated_at: new Date().toISOString(),
            generated_by: req.user.full_name || req.user.username || 'Bilinmiyor'
        });

    } catch (error) {
        console.error('İK analizi hatası:', error);
        res.status(500).json({
            error: 'İK analizi sırasında hata oluştu',
            details: error.message
        });
    }
});

// Test endpoint - Personel bilgilerini kontrol et
app.get('/api/test/personel/:id', authenticateToken, async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Basit personel sorgusu
        const personnel = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM personel WHERE id = ?', [personnelId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            personnel: personnel,
            columns: personnel ? Object.keys(personnel) : []
        });

    } catch (error) {
        console.error('Test hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personelin Son İK Analizini Getir
app.get('/api/personel/:id/last-hr-analysis', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Son analiz raporunu getir - SUPABASE UYUMLU
        let lastReport;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('hr_analysis_reports')
                .select(`
                    *,
                    personel!personel_id(ad, soyad)
                `)
                .eq('personel_id', personnelId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                lastReport = {
                    ...data,
                    personel_adi: `${data.personel.ad} ${data.personel.soyad}`
                };
            }
        } else {
            // SQLite fallback
            lastReport = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT har.*, p.ad || ' ' || p.soyad as personel_adi
                    FROM hr_analysis_reports har
                    JOIN personel p ON har.personel_id = p.id
                    WHERE har.personel_id = ?
                    ORDER BY har.created_at DESC
                    LIMIT 1
                `, [personnelId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }

        if (!lastReport) {
            return res.json({
                success: false,
                message: 'Bu personel için analiz raporu bulunamadı'
            });
        }

        // Analiz verisini parse et
        const analysisData = useSupabase ? lastReport.analysis_data : JSON.parse(lastReport.analysis_data);

        // Debug temizlendi

        // Personel bilgilerini ekle - SUPABASE UYUMLU
        let personnelInfo;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('personel')
                .select('*')
                .eq('id', personnelId)
                .maybeSingle();

            if (error) throw error;
            personnelInfo = data;
        } else {
            // SQLite fallback
            personnelInfo = await new Promise((resolve, reject) => {
                db.get(`SELECT * FROM personel WHERE id = ?`, [personnelId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }

        // Metadata'dan veri al (eğer varsa)
        const metadata = analysisData._metadata || {};
        const savedDataSummary = metadata.data_summary;
        const savedPersonnelInfo = metadata.personnel_info;

        // Orijinal format ile uyumlu hale getir
        const formattedResult = {
            success: true,
            analysis_id: lastReport.id,
            personnel_info: savedPersonnelInfo || {
                id: personnelInfo.id,
                name: `${personnelInfo.ad} ${personnelInfo.soyad}`,
                position: personnelInfo.pozisyon,
                organization: personnelInfo.organizasyon_adi || 'Bilinmiyor'
            },
            data_summary: savedDataSummary || {
                total_notes: 0,
                positive_notes: 0,
                negative_notes: 0,
                performance_scores: 0
            },
            hr_analysis: analysisData,
            generated_at: lastReport.created_at,
            generated_by: 'Sistem'
        };

        res.json({
            success: true,
            analysis: formattedResult
        });

    } catch (error) {
        console.error('Son analiz getirme hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Son analiz getirilirken hata oluştu'
        });
    }
});

// İK Analizi Geçmişini Getir
app.get('/api/personel/:id/hr-analysis-history', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Tüm analiz raporlarını getir - SUPABASE UYUMLU
        let reports;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('hr_analysis_reports')
                .select(`
                    id,
                    created_at,
                    overall_risk_level,
                    immediate_action_required,
                    users!created_by(full_name, username)
                `)
                .eq('personel_id', personnelId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            reports = (data || []).map(report => ({
                id: report.id,
                created_at: report.created_at,
                overall_risk_level: report.overall_risk_level,
                immediate_action_required: report.immediate_action_required,
                created_by_name: report.users?.full_name || report.users?.username || 'Bilinmiyor'
            }));
        } else {
            // SQLite fallback
            reports = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT har.id, har.created_at, har.overall_risk_level, 
                           har.immediate_action_required,
                           COALESCE(u.full_name, u.username, 'Bilinmiyor') as created_by_name
                    FROM hr_analysis_reports har
                    LEFT JOIN users u ON har.created_by = u.id
                    WHERE har.personel_id = ?
                    ORDER BY har.created_at DESC
                `, [personnelId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        }

        res.json({
            success: true,
            reports: reports
        });

    } catch (error) {
        console.error('Analiz geçmişi getirme hatası:', error);
        res.status(500).json({
            error: 'Analiz geçmişi getirilirken hata oluştu'
        });
    }
});

// Belirli Bir İK Analizini Getir
app.get('/api/hr-analysis/:reportId', authenticateToken, async (req, res) => {
    try {
        const reportId = req.params.reportId;

        // Belirli analiz raporunu getir - SUPABASE UYUMLU
        let report;
        if (useSupabase) {
            const { data, error } = await supabase
                .from('hr_analysis_reports')
                .select(`
                    *,
                    personel!personel_id(ad, soyad, pozisyon),
                    users!created_by(full_name, username)
                `)
                .eq('id', reportId)
                .maybeSingle();

            if (error) throw error;
            report = data;
        } else {
            // SQLite fallback
            report = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT har.*, 
                           p.ad, p.soyad, p.pozisyon,
                           COALESCE(u.full_name, u.username, 'Bilinmiyor') as created_by_name
                    FROM hr_analysis_reports har
                    JOIN personel p ON har.personel_id = p.id
                    LEFT JOIN users u ON har.created_by = u.id
                    WHERE har.id = ?
                `, [reportId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }

        if (!report) {
            return res.status(404).json({ error: 'Analiz raporu bulunamadı' });
        }

        // Analiz verisini parse et
        const analysisData = useSupabase ? report.analysis_data : JSON.parse(report.analysis_data);

        // Debug: Veri yapısını logla
        console.log('🔍 Analiz verisi yapısı:', {
            hasExecutiveSummary: !!analysisData.executive_summary,
            hasManagerActionPlan: !!analysisData.manager_action_plan,
            hasMetadata: !!analysisData._metadata,
            keys: Object.keys(analysisData),
            executiveSummaryKeys: analysisData.executive_summary ? Object.keys(analysisData.executive_summary) : 'yok',
            managerActionPlanKeys: analysisData.manager_action_plan ? Object.keys(analysisData.manager_action_plan) : 'yok'
        });

        // Eğer executive_summary yoksa, tüm veriyi logla
        if (!analysisData.executive_summary) {
            console.log('❌ Executive summary yok! Tüm veri:', JSON.stringify(analysisData, null, 2));
        }

        // Debug temizlendi

        // Metadata'dan veri al (eğer varsa)
        const metadata = analysisData._metadata || {};
        const savedDataSummary = metadata.data_summary;
        const savedPersonnelInfo = metadata.personnel_info;

        // Orijinal format ile uyumlu hale getir
        const formattedResult = {
            success: true,
            analysis_id: report.id,
            personnel_info: savedPersonnelInfo || {
                id: report.personel_id,
                name: useSupabase ? `${report.personel.ad} ${report.personel.soyad}` : `${report.ad} ${report.soyad}`,
                position: useSupabase ? report.personel.pozisyon : report.pozisyon,
                organization: 'Bilinmiyor'
            },
            data_summary: savedDataSummary || {
                total_notes: 0,
                positive_notes: 0,
                negative_notes: 0,
                performance_scores: 0
            },
            hr_analysis: analysisData,
            generated_at: report.created_at,
            generated_by: useSupabase ? (report.users?.full_name || report.users?.username || 'Bilinmiyor') : report.created_by_name
        };

        res.json(formattedResult);

    } catch (error) {
        console.error('Analiz getirme hatası:', error);
        res.status(500).json({
            error: 'Analiz getirilirken hata oluştu'
        });
    }
});

// İK Analizi PDF İndir
app.get('/api/personel/:id/hr-analysis-pdf', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const personnelId = req.params.id;

        // Son analiz raporunu getir
        const lastReport = await new Promise((resolve, reject) => {
            db.get(`
                SELECT har.*, p.ad || ' ' || p.soyad as personel_adi
                FROM hr_analysis_reports har
                JOIN personel p ON har.personel_id = p.id
                WHERE har.personel_id = ?
                ORDER BY har.created_at DESC
                LIMIT 1
            `, [personnelId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!lastReport) {
            return res.status(404).json({ error: 'Analiz raporu bulunamadı' });
        }

        // Analiz verisini parse et
        const analysisData = JSON.parse(lastReport.analysis_data);

        // Personel bilgilerini al
        const personnelInfo = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM personel WHERE id = ?`, [personnelId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // HTML içeriği oluştur
        const htmlContent = generatePDFHTML(personnelInfo, analysisData, lastReport.created_at);

        // HTML response headers (PDF görünümü için)
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="IK-Analizi-${personnelInfo.ad}-${personnelInfo.soyad}-${new Date().toISOString().split('T')[0]}.html"`);

        res.send(htmlContent);

    } catch (error) {
        console.error('PDF oluşturma hatası:', error);
        res.status(500).json({ error: 'PDF oluşturulurken hata oluştu' });
    }
});

// PDF HTML İçeriği Oluştur
function generatePDFHTML(personnelInfo, analysisData, createdAt) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>İK Analizi - ${personnelInfo.ad} ${personnelInfo.soyad}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 25px; }
            .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .risk-critical { background: #f8d7da; padding: 10px; border-left: 4px solid #dc3545; }
            .risk-high { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; }
            .risk-medium { background: #d1ecf1; padding: 10px; border-left: 4px solid #17a2b8; }
            .risk-low { background: #d4edda; padding: 10px; border-left: 4px solid #28a745; }
            .action-item { background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
            ul { padding-left: 20px; }
            li { margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>İnsan Kaynakları Analiz Raporu</h1>
            <h2>${personnelInfo.ad} ${personnelInfo.soyad}</h2>
            <p><strong>Pozisyon:</strong> ${personnelInfo.pozisyon}</p>
            <p><strong>Rapor Tarihi:</strong> ${new Date(createdAt).toLocaleDateString('tr-TR')}</p>
            <button onclick="window.print()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 10px;">
                🖨️ PDF Olarak Yazdır
            </button>
        </div>

        <div class="section">
            <h2>Yönetici Özeti</h2>
            <div class="risk-${analysisData.executive_summary.overall_risk_level}">
                <strong>Genel Risk Seviyesi:</strong> ${getRiskLevelText(analysisData.executive_summary.overall_risk_level)}
            </div>
            <h3>Ana Endişeler:</h3>
            <ul>
                ${analysisData.executive_summary.primary_concerns.map(concern => `<li>${concern}</li>`).join('')}
            </ul>
            <h3>Güçlü Yanlar:</h3>
            <ul>
                ${analysisData.executive_summary.key_strengths.map(strength => `<li>${strength}</li>`).join('')}
            </ul>
        </div>

        <div class="section">
            <h2>Mağaza Müdürü İçin Eylem Planı</h2>
            <h3>Acil Eylemler:</h3>
            ${analysisData.manager_action_plan.immediate_actions.map(action => `
                <div class="action-item">
                    <strong>${action.action}</strong><br>
                    <strong>Öncelik:</strong> ${action.priority}<br>
                    <strong>Zaman:</strong> ${action.timeline}<br>
                    <strong>Beklenen Sonuç:</strong> ${action.expected_outcome}<br>
                    <strong>Kanıtlar:</strong> ${action.evidence.join(', ')}
                </div>
            `).join('')}
            
            <h3>İzleme Planı:</h3>
            <ul>
                <li><strong>Günlük Kontroller:</strong> ${analysisData.manager_action_plan.monitoring_plan.daily_checks.join(', ')}</li>
                <li><strong>Haftalık Gözden Geçirme:</strong> ${analysisData.manager_action_plan.monitoring_plan.weekly_reviews.join(', ')}</li>
                <li><strong>Aylık Değerlendirme:</strong> ${analysisData.manager_action_plan.monitoring_plan.monthly_evaluation.join(', ')}</li>
            </ul>
        </div>

        <div class="section">
            <h2>İş Etkisi</h2>
            <p><strong>Mevcut Etki:</strong> ${analysisData.business_impact.current_impact}</p>
            <p><strong>Potansiyel Riskler:</strong> ${analysisData.business_impact.potential_risks.join(', ')}</p>
            <p><strong>Takım Morali:</strong> ${analysisData.business_impact.team_morale_effect}</p>
        </div>

        <div class="footer">
            <p>Bu rapor AI destekli analiz sistemi tarafından oluşturulmuştur.</p>
            <p>Personel Takip Sistemi - ${new Date().getFullYear()}</p>
        </div>
    </body>
    </html>
    `;
}

function getRiskLevelText(level) {
    const levels = {
        'critical': '🔴 KRİTİK',
        'high': '🟠 YÜKSEK',
        'medium': '🟡 ORTA',
        'low': '🟢 DÜŞÜK'
    };
    return levels[level] || level;
}

// İK Analiz Raporlarını Listele
app.get('/api/hr-analysis-reports', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const reports = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    har.*,
                    p.ad || ' ' || p.soyad as personel_adi,
                    p.pozisyon,
                    COALESCE(u.full_name, u.username, 'Bilinmiyor') as created_by_name
                FROM hr_analysis_reports har
                JOIN personel p ON har.personel_id = p.id
                LEFT JOIN users u ON har.created_by = u.id
                WHERE p.organization_id = ? OR p.organization_id IS NULL
                ORDER BY har.created_at DESC
                LIMIT 50
            `, [req.user.organization_id || 0], (err, rows) => {
                if (err) {
                    // Eğer organization_id kolonu yoksa, basit sorgu yap
                    db.all(`
                        SELECT 
                            har.*,
                            p.ad || ' ' || p.soyad as personel_adi,
                            p.pozisyon,
                            'Sistem' as created_by_name
                        FROM hr_analysis_reports har
                        JOIN personel p ON har.personel_id = p.id
                        ORDER BY har.created_at DESC
                        LIMIT 50
                    `, [], (err2, rows2) => {
                        if (err2) reject(err2);
                        else resolve(rows2 || []);
                    });
                } else {
                    resolve(rows || []);
                }
            });
        });

        // JSON verisini parse et
        const reportsWithParsedData = reports.map(report => ({
            ...report,
            analysis_summary: {
                risk_level: report.overall_risk_level,
                immediate_action: report.immediate_action_required === 1,
                report_date: report.created_at
            }
        }));

        res.json({
            success: true,
            reports: reportsWithParsedData,
            total_count: reports.length
        });

    } catch (error) {
        console.error('İK raporları listeleme hatası:', error);
        res.status(500).json({ error: 'Raporlar listelenirken hata oluştu' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server ${PORT} portunda çalışıyor`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Database: ${useSupabase ? 'Supabase (PostgreSQL)' : 'SQLite'}`);
    console.log(`✅ Server başarıyla başlatıldı`);
});

// Kullanici rolunu guncelle (sadece organizasyon sahibi)
app.put('/api/organization/members/:userId/role', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        // Geçerli roller
        const validRoles = ['personel', 'yonetici', 'organizasyon_sahibi'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Geçersiz rol' });
        }

        // Kullanıcının aynı organizasyonda olduğunu kontrol et
        if (useSupabase) {
            const { data: userCheck, error: checkError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .eq('organization_id', req.user.organizationId)
                .maybeSingle();

            if (checkError) throw checkError;

            if (!userCheck) {
                return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
            }

            // Kendi rolünü değiştirmeye çalışıyor mu?
            if (parseInt(userId) === req.user.id) {
                return res.status(400).json({ error: 'Kendi rolünüzü değiştiremezsiniz' });
            }

            // Rolü güncelle
            const { error: updateError } = await supabase
                .from('users')
                .update({ role })
                .eq('id', userId);

            if (updateError) throw updateError;
        } else {
            // SQLite fallback
            const userCheck = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ? AND organization_id = ?', [userId, req.user.organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!userCheck) {
                return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
            }

            // Kendi rolünü değiştirmeye çalışıyor mu?
            if (parseInt(userId) === req.user.id) {
                return res.status(400).json({ error: 'Kendi rolünüzü değiştiremezsiniz' });
            }

            // Rolü güncelle
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function (err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        res.json({
            success: true,
            message: 'Kullanıcı rolü başarıyla güncellendi'
        });

    } catch (error) {
        console.error('Rol güncelleme hatası:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            userId: userId,
            organizationId: req.user.organizationId
        });

        // Supabase hatalarını daha anlaşılır hale getir
        if (error.code === 'PGRST116') {
            res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        } else {
            res.status(500).json({ error: 'Rol güncellenirken hata oluştu' });
        }
    }
});

// Kullaniciyi organizasyondan cikar (sadece organizasyon sahibi)
app.delete('/api/organization/members/:userId', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const { userId } = req.params;

        // Kullanıcının aynı organizasyonda olduğunu kontrol et
        const userCheck = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ? AND organization_id = ?', [userId, req.user.organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!userCheck) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Kendi kendini silmeye çalışıyor mu?
        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
        }

        // Organizasyon sahibini silmeye çalışıyor mu?
        if (userCheck.role === 'organizasyon_sahibi') {
            return res.status(400).json({ error: 'Organizasyon sahibi silinemez' });
        }

        // Kullanıcıyı sil
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({
            success: true,
            message: 'Kullanıcı başarıyla silindi'
        });

    } catch (error) {
        console.error('Kullanıcı silme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Debug endpoint - Supabase baglantisini test et
app.get('/api/test/supabase', async (req, res) => {
    try {
        console.log('Supabase test baslatiliyor...');
        console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Var' : 'Yok');
        console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Var' : 'Yok');
        console.log('useSupabase:', useSupabase);

        if (useSupabase) {
            // Basit bir sorgu test et
            const { data, error } = await supabase
                .from('organizations')
                .select('count')
                .limit(1);

            if (error) {
                console.error('Supabase test hatası:', error);
                return res.status(500).json({
                    error: 'Supabase bağlantı hatası',
                    details: error.message
                });
            }

            res.json({
                success: true,
                message: 'Supabase baglantisi calisiyor',
                useSupabase: true,
                data: data
            });
        } else {
            res.json({
                success: true,
                message: 'SQLite kullaniliyor',
                useSupabase: false
            });
        }
    } catch (error) {
        console.error('Test endpoint hatası:', error);
        res.status(500).json({
            error: 'Test hatası',
            message: error.message
        });
    }
});

// Debug endpoint - Environment variables kontrol
app.get('/api/test/env', (req, res) => {
    res.json({
        NODE_ENV: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        useSupabase: useSupabase
    });
});