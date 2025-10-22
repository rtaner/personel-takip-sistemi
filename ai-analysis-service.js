// AI Analiz Servisi - Gemini API ile Gelişmiş Personel Analizi

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalysisService {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Yetkinlik tanımları
    this.competencies = {
      communication: "İletişim becerisi, açık ve etkili konuşma, dinleme",
      teamwork: "Takım çalışması, işbirliği, uyum",
      problem_solving: "Problem çözme, analitik düşünce, yaratıcılık",
      customer_focus: "Müşteri odaklılık, hizmet kalitesi, empati",
      reliability: "Güvenilirlik, zamanında teslim, sorumluluk"
    };

    // Davranış kategorileri
    this.behaviorCategories = {
      work_discipline: "İş Disiplini / Sorumluluk",
      corporate_culture: "Kurum Kültürü / İlişkiler",
      basic_rules: "Temel Kurallar / Hijyen",
      performance: "Performans / Çözüm Odaklılık",
      task_performance: "Görev Performansı"
    };

    // Risk seviyeleri
    this.riskLevels = {
      critical: "Kritik - Acil müdahale gerekli",
      high: "Yüksek - Resmi süreç başlatılmalı",
      medium: "Orta - İzleme ve koçluk gerekli",
      low: "Düşük - Takdir ve teşvik"
    };
  }

  async analyzeNote(noteText, noteType) {
    try {
      const prompt = this.createAnalysisPrompt(noteText, noteType);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();

      return this.parseAnalysisResult(analysisText);
    } catch (error) {
      console.error('AI analiz hatası:', error);
      return this.getFallbackAnalysis(noteType);
    }
  }

  createAnalysisPrompt(noteText, noteType) {
    return `
Sen uzman bir İnsan Kaynakları analisti ve davranış uzmanısın. Aşağıdaki personel notunu derinlemesine analiz et.

NOT: "${noteText}"
NOT TÜRÜ: ${noteType === 'olumlu' ? 'Olumlu' : 'Olumsuz'}

ANALİZ KRİTERLERİ:

1. DAVRANIŞSAL KATEGORİLER:
- İş Disiplini/Sorumluluk: Raporlama, zaman yönetimi, prosedür uyumu
- Kurum Kültürü/İlişkiler: Sosyal beceri, dil kullanımı, takım uyumu
- Temel Kurallar/Hijyen: Hijyen, görgü kuralları, temel standartlar
- Performans/Çözüm Odaklılık: Problem çözme, stres yönetimi, katkı
- Görev Performansı: Spesifik görev başarısı

2. RİSK DEĞERLENDİRMESİ:
- Kritik: İşten çıkarma riski, güvenlik sorunu
- Yüksek: Disiplin süreci, resmi uyarı gerekli
- Orta: Koçluk, eğitim gerekli
- Düşük: Takdir, pozitif pekiştirme

3. YETKİNLİK PUANLAMA (1-5):
- İletişim, Takım Çalışması, Problem Çözme, Müşteri Odaklılık, Güvenilirlik

ÇIKTI FORMATI (JSON):
{
  "behavior_analysis": {
    "primary_category": "kategori_adı",
    "risk_level": "critical/high/medium/low", 
    "risk_explanation": "risk açıklaması",
    "behavioral_pattern": "tekrarlayan/yeni/gelişen"
  },
  "competency_scores": {
    "communication": { "score": X, "confidence": 0.X, "reasoning": "detaylı açıklama" },
    "teamwork": { "score": X, "confidence": 0.X, "reasoning": "detaylı açıklama" },
    "problem_solving": { "score": X, "confidence": 0.X, "reasoning": "detaylı açıklama" },
    "customer_focus": { "score": X, "confidence": 0.X, "reasoning": "detaylı açıklama" },
    "reliability": { "score": X, "confidence": 0.X, "reasoning": "detaylı açıklama" }
  },
  "hr_recommendations": {
    "immediate_actions": ["acil eylem 1", "acil eylem 2"],
    "coaching_areas": ["koçluk alanı 1", "koçluk alanı 2"],
    "monitoring_points": ["izleme noktası 1", "izleme noktası 2"],
    "positive_reinforcement": ["pekiştirme 1", "pekiştirme 2"]
  },
  "business_impact": {
    "severity": "critical/high/medium/low",
    "affected_areas": ["etkilenen alan 1", "etkilenen alan 2"],
    "timeline": "acil/30_gun/90_gun"
  },
  "key_insights": ["içgörü 1", "içgörü 2", "içgörü 3"],
  "follow_up_required": true/false
}

Sadece JSON formatında cevap ver, başka açıklama ekleme.
        `;
  }

  parseAnalysisResult(analysisText) {
    try {
      // JSON'u temizle ve parse et
      const cleanJson = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('JSON parse hatası:', error);
      return this.getFallbackAnalysis('olumlu');
    }
  }

  getFallbackAnalysis(noteType) {
    // AI başarısız olursa varsayılan puanlar
    const baseScore = noteType === 'olumlu' ? 4 : 2;

    return {
      scores: {
        communication: { score: baseScore, confidence: 0.5, reasoning: "Otomatik değerlendirme" },
        teamwork: { score: baseScore, confidence: 0.5, reasoning: "Otomatik değerlendirme" },
        problem_solving: { score: baseScore, confidence: 0.5, reasoning: "Otomatik değerlendirme" },
        customer_focus: { score: baseScore, confidence: 0.5, reasoning: "Otomatik değerlendirme" },
        reliability: { score: baseScore, confidence: 0.5, reasoning: "Otomatik değerlendirme" }
      },
      overall_sentiment: noteType === 'olumlu' ? 'positive' : 'negative',
      key_insights: ["Otomatik analiz"],
      recommendations: ["Manuel inceleme önerilir"]
    };
  }

  async analyzePersonnelComprehensive(personnelData) {
    try {
      const prompt = this.createComprehensiveAnalysisPrompt(personnelData);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text();

      return this.parseComprehensiveAnalysis(analysisText);
    } catch (error) {
      console.error('Kapsamlı analiz hatası:', error);
      return this.getFallbackComprehensiveAnalysis(personnelData);
    }
  }

  createComprehensiveAnalysisPrompt(personnelData) {
    const { personnelInfo, notes, performanceScores } = personnelData;

    // Notları kategorilere ayır
    const positiveNotes = notes.filter(n => n.kategori === 'olumlu');
    const negativeNotes = notes.filter(n => n.kategori === 'olumsuz');

    return `
Sen uzman bir İnsan Kaynakları analisti ve davranış uzmanısın. Aşağıdaki personelin tüm verilerini analiz ederek, mağaza müdürüne yönelik kapsamlı bir İK raporu hazırla.

PERSONEL BİLGİLERİ:
Ad: ${personnelInfo.ad} ${personnelInfo.soyad}
Pozisyon: ${personnelInfo.pozisyon}
Toplam Not Sayısı: ${notes.length} (${positiveNotes.length} olumlu, ${negativeNotes.length} olumsuz)

OLUMLU NOTLAR (${positiveNotes.length} adet):
${positiveNotes.map((note, i) => `${i + 1}. ${note.not_metni} (${note.tarih})`).join('\n')}

OLUMSUZ NOTLAR (${negativeNotes.length} adet):
${negativeNotes.map((note, i) => `${i + 1}. ${note.not_metni} (${note.tarih})`).join('\n')}

PERFORMANS PUANLARI:
${performanceScores.map(score => `• ${score.gorev_baslik}: ${score.performans_puani}/5`).join('\n')}

ANALİZ KRİTERLERİ:

1. DAVRANIŞSAL KATEGORİZASYON:
Her notu şu kategorilere ayır ve analiz et:
- İş Disiplini/Sorumluluk: Raporlama, zaman yönetimi, prosedür uyumu
- Kurum Kültürü/İlişkiler: Sosyal beceri, dil kullanımı, takım uyumu  
- Temel Kurallar/Hijyen: Hijyen, görgü kuralları, temel standartlar
- Performans/Çözüm Odaklılık: Problem çözme, stres yönetimi, katkı
- Görev Performansı: Spesifik görev başarısı

2. RİSK DEĞERLENDİRMESİ:
- Kritik: İşten çıkarma riski, güvenlik/hijyen sorunu
- Yüksek: Disiplin süreci, resmi uyarı gerekli
- Orta: Koçluk, eğitim gerekli
- Düşük: Takdir, pozitif pekiştirme

3. İK UZMANI YAKLAŞIMI:
- Tekrarlanan sorunları ağırlaştır
- Hijyen/güvenlik ihlallerini kritik say
- Somut eylem planları öner
- Yasal süreçleri dikkate al

ÇIKTI FORMATI (JSON):
{
  "behavioral_category_analysis": {
    "work_discipline": {
      "positive_count": X,
      "negative_count": X,
      "main_themes": ["tema 1", "tema 2"],
      "risk_assessment": "critical/high/medium/low",
      "evidence": ["kanıt 1", "kanıt 2"]
    },
    "corporate_culture": {
      "positive_count": X,
      "negative_count": X,
      "main_themes": ["tema 1", "tema 2"],
      "risk_assessment": "critical/high/medium/low",
      "evidence": ["kanıt 1", "kanıt 2"]
    },
    "basic_rules": {
      "positive_count": X,
      "negative_count": X,
      "main_themes": ["tema 1", "tema 2"],
      "risk_assessment": "critical/high/medium/low",
      "evidence": ["kanıt 1", "kanıt 2"]
    },
    "performance_focus": {
      "positive_count": X,
      "negative_count": X,
      "main_themes": ["tema 1", "tema 2"],
      "risk_assessment": "critical/high/medium/low",
      "evidence": ["kanıt 1", "kanıt 2"]
    },
    "task_performance": {
      "high_scores": X,
      "low_scores": X,
      "inconsistency_level": "high/medium/low",
      "main_themes": ["tema 1", "tema 2"]
    }
  },
  "executive_summary": {
    "overall_risk_level": "critical/high/medium/low",
    "primary_concerns": ["endişe 1", "endişe 2"],
    "key_strengths": ["güçlü yan 1", "güçlü yan 2"],
    "immediate_action_required": true/false,
    "summary_assessment": "kısa genel değerlendirme"
  },
  "hr_recommendations": {
    "priority_1_critical": [
      {
        "category": "kategori adı",
        "action": "somut eylem",
        "justification": "gerekçe",
        "timeline": "acil/1_hafta/1_ay",
        "legal_implications": "yasal boyut varsa",
        "documentation_required": true/false
      }
    ],
    "priority_2_coaching": [
      {
        "area": "alan",
        "method": "yöntem",
        "duration": "süre",
        "success_metrics": ["ölçüt 1", "ölçüt 2"],
        "resources_needed": ["kaynak 1", "kaynak 2"]
      }
    ],
    "priority_3_monitoring": {
      "daily_observations": ["gözlem 1", "gözlem 2"],
      "weekly_check_ins": ["kontrol 1", "kontrol 2"],
      "monthly_review": ["değerlendirme 1", "değerlendirme 2"],
      "escalation_triggers": ["tetikleyici 1", "tetikleyici 2"]
    },
    "positive_reinforcement": [
      {
        "strength": "güçlü yan",
        "recognition_method": "takdir yöntemi",
        "development_opportunity": "geliştirme fırsatı"
      }
    ]
  },
  "competency_assessment": {
    "communication": { "score": X, "confidence": 0.X, "reasoning": "açıklama", "development_need": "high/medium/low" },
    "teamwork": { "score": X, "confidence": 0.X, "reasoning": "açıklama", "development_need": "high/medium/low" },
    "problem_solving": { "score": X, "confidence": 0.X, "reasoning": "açıklama", "development_need": "high/medium/low" },
    "customer_focus": { "score": X, "confidence": 0.X, "reasoning": "açıklama", "development_need": "high/medium/low" },
    "reliability": { "score": X, "confidence": 0.X, "reasoning": "açıklama", "development_need": "high/medium/low" }
  },
  "business_impact_analysis": {
    "current_performance_impact": "etki açıklaması",
    "team_morale_risk": "high/medium/low",
    "customer_service_impact": "etki açıklaması",
    "operational_efficiency": "etki açıklaması",
    "cost_implications": "maliyet analizi",
    "reputation_risk": "high/medium/low"
  },
  "action_timeline": {
    "immediate_24h": ["eylem 1", "eylem 2"],
    "this_week": ["eylem 1", "eylem 2"],
    "this_month": ["eylem 1", "eylem 2"],
    "next_3_months": ["eylem 1", "eylem 2"]
  }
}

Sadece JSON formatında cevap ver, başka açıklama ekleme.
        `;
  }

  parseComprehensiveAnalysis(analysisText) {
    try {
      const cleanJson = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      const newFormat = JSON.parse(cleanJson);

      // Yeni formatı eski formata dönüştür
      return this.convertToOldFormat(newFormat);
    } catch (error) {
      console.error('Kapsamlı analiz JSON parse hatası:', error);
      return this.getFallbackComprehensiveAnalysis();
    }
  }

  convertToOldFormat(newFormat) {
    // Debug: Gelen formatı logla
    console.log('🔄 AI Format dönüştürme - Gelen keys:', Object.keys(newFormat));
    console.log('🔄 Executive summary var mı:', !!newFormat.executive_summary);
    console.log('🔄 HR recommendations var mı:', !!newFormat.hr_recommendations);
    console.log('🔄 Business impact var mı:', !!newFormat.business_impact_analysis);
    
    // Yeni AI formatını frontend'in beklediği eski formata dönüştür
    const safeExecutiveSummary = newFormat.executive_summary || {};

    return {
      executive_summary: {
        overall_risk_level: safeExecutiveSummary.overall_risk_level || "medium",
        primary_concerns: Array.isArray(safeExecutiveSummary.primary_concerns) ? safeExecutiveSummary.primary_concerns : ["Analiz hatası"],
        key_strengths: Array.isArray(safeExecutiveSummary.key_strengths) ? safeExecutiveSummary.key_strengths : ["Manuel inceleme gerekli"],
        immediate_action_required: safeExecutiveSummary.immediate_action_required !== undefined ? safeExecutiveSummary.immediate_action_required : true
      },
      behavioral_analysis: newFormat.behavioral_category_analysis ? {
        work_discipline: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.work_discipline?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.work_discipline?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.work_discipline?.evidence || [],
          pattern: "stable"
        },
        corporate_culture: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.corporate_culture?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.corporate_culture?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.corporate_culture?.evidence || [],
          pattern: "stable"
        },
        basic_rules: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.basic_rules?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.basic_rules?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.basic_rules?.evidence || [],
          pattern: "stable"
        },
        performance: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.performance_focus?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.performance_focus?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.performance_focus?.evidence || [],
          pattern: "stable"
        }
      } : {
        work_discipline: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" },
        corporate_culture: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" },
        basic_rules: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" },
        performance: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" }
      },
      competency_scores: newFormat.competency_assessment || {
        communication: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        teamwork: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        problem_solving: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        customer_focus: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        reliability: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" }
      },
      manager_action_plan: {
        immediate_actions: this.convertCriticalActions(newFormat.hr_recommendations?.priority_1_critical || []),
        coaching_plan: Array.isArray(newFormat.hr_recommendations?.priority_2_coaching) ? newFormat.hr_recommendations.priority_2_coaching : [],
        monitoring_plan: this.safeMonitoringPlan(newFormat.hr_recommendations?.priority_3_monitoring),
        escalation_triggers: Array.isArray(newFormat.hr_recommendations?.priority_3_monitoring?.escalation_triggers) ? newFormat.hr_recommendations.priority_3_monitoring.escalation_triggers : []
      },
      business_impact: newFormat.business_impact_analysis ? {
        current_impact: newFormat.business_impact_analysis.current_performance_impact || "Bilinmiyor",
        potential_risks: [newFormat.business_impact_analysis.team_morale_risk, newFormat.business_impact_analysis.reputation_risk].filter(Boolean),
        cost_implications: newFormat.business_impact_analysis.cost_implications || "Bilinmiyor",
        team_morale_effect: newFormat.business_impact_analysis.team_morale_risk || "medium"
      } : {
        current_impact: "Bilinmiyor",
        potential_risks: [],
        cost_implications: "Bilinmiyor",
        team_morale_effect: "medium"
      },
      follow_up_schedule: {
        next_review_date: "1 hafta içinde",
        review_frequency: "Haftalık",
        success_indicators: newFormat.action_timeline?.this_week || ["Gelişim takibi"]
      }
    };

    // Debug: Dönüştürülmüş formatı logla
    const result = {
      executive_summary: {
        overall_risk_level: safeExecutiveSummary.overall_risk_level || "medium",
        primary_concerns: Array.isArray(safeExecutiveSummary.primary_concerns) ? safeExecutiveSummary.primary_concerns : ["Analiz hatası"],
        key_strengths: Array.isArray(safeExecutiveSummary.key_strengths) ? safeExecutiveSummary.key_strengths : ["Manuel inceleme gerekli"],
        immediate_action_required: safeExecutiveSummary.immediate_action_required !== undefined ? safeExecutiveSummary.immediate_action_required : true
      },
      behavioral_analysis: newFormat.behavioral_category_analysis ? {
        work_discipline: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.work_discipline?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.work_discipline?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.work_discipline?.evidence || [],
          pattern: "stable"
        },
        corporate_culture: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.corporate_culture?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.corporate_culture?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.corporate_culture?.evidence || [],
          pattern: "stable"
        },
        basic_rules: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.basic_rules?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.basic_rules?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.basic_rules?.evidence || [],
          pattern: "stable"
        },
        performance: {
          score: this.riskToScore(newFormat.behavioral_category_analysis.performance_focus?.risk_assessment),
          risk_level: newFormat.behavioral_category_analysis.performance_focus?.risk_assessment || "medium",
          evidence: newFormat.behavioral_category_analysis.performance_focus?.evidence || [],
          pattern: "stable"
        }
      } : {
        work_discipline: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" },
        corporate_culture: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" },
        basic_rules: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" },
        performance: { score: 3, risk_level: "medium", evidence: [], pattern: "stable" }
      },
      competency_scores: newFormat.competency_assessment || {
        communication: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        teamwork: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        problem_solving: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        customer_focus: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" },
        reliability: { score: 3, confidence: 0.5, reasoning: "Analiz eksik", chain_effect: "Bilinmiyor" }
      },
      manager_action_plan: {
        immediate_actions: this.convertCriticalActions(newFormat.hr_recommendations?.priority_1_critical || []),
        coaching_plan: Array.isArray(newFormat.hr_recommendations?.priority_2_coaching) ? newFormat.hr_recommendations.priority_2_coaching : [],
        monitoring_plan: this.safeMonitoringPlan(newFormat.hr_recommendations?.priority_3_monitoring),
        escalation_triggers: Array.isArray(newFormat.hr_recommendations?.priority_3_monitoring?.escalation_triggers) ? newFormat.hr_recommendations.priority_3_monitoring.escalation_triggers : []
      },
      business_impact: newFormat.business_impact_analysis ? {
        current_impact: newFormat.business_impact_analysis.current_performance_impact || "Bilinmiyor",
        potential_risks: [newFormat.business_impact_analysis.team_morale_risk, newFormat.business_impact_analysis.reputation_risk].filter(Boolean),
        cost_implications: newFormat.business_impact_analysis.cost_implications || "Bilinmiyor",
        team_morale_effect: newFormat.business_impact_analysis.team_morale_risk || "medium"
      } : {
        current_impact: "Bilinmiyor",
        potential_risks: [],
        cost_implications: "Bilinmiyor",
        team_morale_effect: "medium"
      },
      follow_up_schedule: {
        next_review_date: "1 hafta içinde",
        review_frequency: "Haftalık",
        success_indicators: newFormat.action_timeline?.this_week || ["Gelişim takibi"]
      }
    };

    console.log('✅ Dönüştürülmüş format keys:', Object.keys(result));
    console.log('✅ Manager action plan var mı:', !!result.manager_action_plan);
    console.log('✅ Business impact var mı:', !!result.business_impact);

    return result;
  }

  riskToScore(riskLevel) {
    const riskScoreMap = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    return riskScoreMap[riskLevel] || 3;
  }

  convertCriticalActions(criticalActions) {
    if (!Array.isArray(criticalActions)) {
      return [{
        action: "Manuel İK incelemesi yapın",
        priority: "high",
        timeline: "acil",
        evidence: ["AI analizi eksik"],
        expected_outcome: "Doğru değerlendirme"
      }];
    }

    return criticalActions.map(action => ({
      action: action.action || "Eylem belirtilmemiş",
      priority: action.timeline === 'acil' ? 'critical' : 'high',
      timeline: action.timeline || "1_hafta",
      evidence: Array.isArray(action.evidence) ? action.evidence : [action.justification || "Gerekçe belirtilmemiş"],
      expected_outcome: "Davranış iyileştirmesi"
    }));
  }

  safeMonitoringPlan(monitoringPlan) {
    if (!monitoringPlan || typeof monitoringPlan !== 'object') {
      return {
        daily_checks: ["Manuel takip gerekli"],
        weekly_reviews: ["Haftalık değerlendirme"],
        monthly_evaluation: ["Aylık gözden geçirme"],
        escalation_triggers: ["Kritik durum tespiti"]
      };
    }

    return {
      daily_checks: Array.isArray(monitoringPlan.daily_observations) ? monitoringPlan.daily_observations :
        Array.isArray(monitoringPlan.daily_checks) ? monitoringPlan.daily_checks : ["Manuel takip gerekli"],
      weekly_reviews: Array.isArray(monitoringPlan.weekly_check_ins) ? monitoringPlan.weekly_check_ins :
        Array.isArray(monitoringPlan.weekly_reviews) ? monitoringPlan.weekly_reviews : ["Haftalık değerlendirme"],
      monthly_evaluation: Array.isArray(monitoringPlan.monthly_review) ? monitoringPlan.monthly_review :
        Array.isArray(monitoringPlan.monthly_evaluation) ? monitoringPlan.monthly_evaluation : ["Aylık gözden geçirme"],
      escalation_triggers: Array.isArray(monitoringPlan.escalation_triggers) ? monitoringPlan.escalation_triggers : ["Kritik durum tespiti"]
    };
  }

  getFallbackComprehensiveAnalysis(personnelData = null) {
    return {
      executive_summary: {
        overall_risk_level: "medium",
        primary_concerns: ["Veri analizi başarısız oldu"],
        key_strengths: ["Manuel inceleme gerekli"],
        immediate_action_required: true
      },
      behavioral_analysis: {
        work_discipline: { score: 3, risk_level: "medium", evidence: ["Otomatik analiz"], pattern: "stable" },
        corporate_culture: { score: 3, risk_level: "medium", evidence: ["Otomatik analiz"], pattern: "stable" },
        basic_rules: { score: 3, risk_level: "medium", evidence: ["Otomatik analiz"], pattern: "stable" },
        performance: { score: 3, risk_level: "medium", evidence: ["Otomatik analiz"], pattern: "stable" }
      },
      competency_scores: {
        communication: { score: 3, confidence: 0.1, reasoning: "Analiz başarısız", chain_effect: "Bilinmiyor" },
        teamwork: { score: 3, confidence: 0.1, reasoning: "Analiz başarısız", chain_effect: "Bilinmiyor" },
        problem_solving: { score: 3, confidence: 0.1, reasoning: "Analiz başarısız", chain_effect: "Bilinmiyor" },
        customer_focus: { score: 3, confidence: 0.1, reasoning: "Analiz başarısız", chain_effect: "Bilinmiyor" },
        reliability: { score: 3, confidence: 0.1, reasoning: "Analiz başarısız", chain_effect: "Bilinmiyor" }
      },
      manager_action_plan: {
        immediate_actions: [{
          action: "Manuel İK incelemesi yapın",
          priority: "high",
          timeline: "acil",
          evidence: ["AI analizi başarısız oldu"],
          expected_outcome: "Doğru değerlendirme"
        }],
        coaching_plan: [],
        monitoring_plan: {
          daily_checks: ["Manuel takip"],
          weekly_reviews: ["İK ile görüşme"],
          monthly_evaluation: ["Kapsamlı değerlendirme"]
        },
        escalation_triggers: ["AI analiz hatası"]
      },
      business_impact: {
        current_impact: "Değerlendirme yapılamadı",
        potential_risks: ["Analiz eksikliği"],
        cost_implications: "Bilinmiyor",
        team_morale_effect: "Bilinmiyor"
      },
      follow_up_schedule: {
        next_review_date: "1 hafta içinde",
        review_frequency: "Haftalık",
        success_indicators: ["Manuel değerlendirme tamamlanması"]
      }
    };
  }
}

module.exports = AIAnalysisService;