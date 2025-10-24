const jwt = require('jsonwebtoken');

// Middleware: JWT Token Doğrulama
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Erişim tokenı gerekli' });
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

module.exports = {
    authenticateToken,
    requireRole,
    filterByOrganization
};