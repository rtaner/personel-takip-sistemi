require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Import modüler yapı
const { generateToken, hashPassword, verifyPassword, generateInviteCode } = require('./utils/auth');
const { supabase, useSupabase, db } = require('./config/database');
const { authenticateToken, requireRole, filterByOrganization } = require('./middleware/auth');
const { validatePersonel, validateNote, validateTask, errorHandler } = require('./middleware/validation');

// Route imports
const authRoutes = require('./routes/auth');
const personelRoutes = require('./routes/personel');
const notlarRoutes = require('./routes/notlar');
const gorevlerRoutes = require('./routes/gorevler');
const organizationRoutes = require('./routes/organization');
const userRoutes = require('./routes/user');

// TODO: dbOperations'ı utils/database.js'e taşı (1156 satır - çok büyük)
// Şimdilik server.js'de kalacak

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

// Database konfigürasyonu config/database.js'e taşındı

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

// Yardımcı fonksiyonlar utils/auth.js'e taşındı

// Auth fonksiyonları utils/auth.js'e taşındı

// Middleware'ler middleware/auth.js'e taşındı

// Veritabanı işlemleri - utils/database.js'e taşındı
const dbOperations = require('./utils/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// dbOperations'ı tüm route'larda kullanılabilir hale getir
app.use((req, res, next) => {
    req.dbOperations = dbOperations;
    next();
});



console.log(`🗄️ Veritabanı: ${useSupabase ? 'Supabase (PostgreSQL)' : 'SQLite'}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 Supabase URL: ${process.env.SUPABASE_URL ? 'Configured ✅' : 'Not configured ❌'}`);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/personel', personelRoutes);
app.use('/api/notlar', notlarRoutes);
app.use('/api/gorevler', gorevlerRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/user', userRoutes);

// =====================================================
// ORGANIZATION API ENDPOINTS
// =====================================================

// Auth route'ları routes/auth.js'e taşındı

// Temel organization route'ları routes/organization.js'e taşındı



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


// Personel route'ları routes/personel.js'e taşındı

// Personel CRUD route'ları taşındı

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
app.delete('/api/personel/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi']), async (req, res) => {
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
        const tasks = await new Promise(async (resolve, reject) => {
            if (useSupabase) {
                try {
                    const { data, error } = await supabase
                        .from('gorevler')
                        .select(`
                            *,
                            personel!inner(ad, soyad)
                        `)
                        .eq('assigned_to', req.user.id)
                        .eq('organization_id', req.organizationId)
                        .order('created_at', { ascending: false });

                    if (error) throw error;

                    // Supabase sonucunu SQLite formatına dönüştür
                    const formattedTasks = data.map(task => ({
                        ...task,
                        ad: task.personel?.ad,
                        soyad: task.personel?.soyad
                    }));

                    resolve(formattedTasks);
                } catch (error) {
                    reject(error);
                }
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

// Test endpoint - Refactor sırasında sistem sağlığını kontrol için
app.get('/api/health-check', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: useSupabase ? 'Supabase' : 'SQLite',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Error handling middleware (en sonda olmalı)
app.use(errorHandler);

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