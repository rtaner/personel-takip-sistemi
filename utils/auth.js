const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

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

// Yardımcı fonksiyon: Davet kodu oluşturma
function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

module.exports = {
    generateToken,
    hashPassword,
    verifyPassword,
    generateInviteCode
};