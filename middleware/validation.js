// Input validation middleware'leri

// Personel validasyonu
const validatePersonel = (req, res, next) => {
    const { ad, soyad, pozisyon } = req.body;
    
    if (!ad || ad.trim().length < 2) {
        return res.status(400).json({ 
            error: 'Geçersiz ad',
            details: 'Ad en az 2 karakter olmalıdır' 
        });
    }
    
    if (!soyad || soyad.trim().length < 2) {
        return res.status(400).json({ 
            error: 'Geçersiz soyad',
            details: 'Soyad en az 2 karakter olmalıdır' 
        });
    }
    
    if (!pozisyon || pozisyon.trim().length < 2) {
        return res.status(400).json({ 
            error: 'Geçersiz pozisyon',
            details: 'Pozisyon en az 2 karakter olmalıdır' 
        });
    }
    
    next();
};

// Not validasyonu
const validateNote = (req, res, next) => {
    const { not_metni, kategori } = req.body;
    
    if (!not_metni || not_metni.trim().length < 5) {
        return res.status(400).json({ 
            error: 'Geçersiz not',
            details: 'Not en az 5 karakter olmalıdır' 
        });
    }
    
    if (kategori && !['olumlu', 'olumsuz', 'genel'].includes(kategori)) {
        return res.status(400).json({ 
            error: 'Geçersiz kategori',
            details: 'Kategori olumlu, olumsuz veya genel olmalıdır' 
        });
    }
    
    next();
};

// Görev validasyonu
const validateTask = (req, res, next) => {
    const { gorev_baslik, gorev_aciklama } = req.body;
    
    if (!gorev_baslik || gorev_baslik.trim().length < 3) {
        return res.status(400).json({ 
            error: 'Geçersiz görev başlığı',
            details: 'Görev başlığı en az 3 karakter olmalıdır' 
        });
    }
    
    if (gorev_aciklama && gorev_aciklama.trim().length < 5) {
        return res.status(400).json({ 
            error: 'Geçersiz görev açıklaması',
            details: 'Görev açıklaması en az 5 karakter olmalıdır' 
        });
    }
    
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('❌ Hata:', err);
    
    // JWT hataları
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token süresi dolmuş' });
    }
    
    // Database hataları
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Veri çakışması' });
    }
    
    // Genel hata
    res.status(500).json({ 
        error: 'Sunucu hatası',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Bir hata oluştu'
    });
};

module.exports = {
    validatePersonel,
    validateNote,
    validateTask,
    errorHandler
};