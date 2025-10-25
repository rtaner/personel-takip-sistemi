const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');

// Kullanıcı profil bilgilerini getir
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await req.dbOperations.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        // Organizasyon adını al
        let organizationName = null;
        if (user.organization_id) {
            const organization = await req.dbOperations.getOrganizationById(user.organization_id);
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
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name } = req.body;

        if (!full_name || full_name.trim().length === 0) {
            return res.status(400).json({ error: 'Ad soyad boş olamaz' });
        }

        if (full_name.trim().length > 100) {
            return res.status(400).json({ error: 'Ad soyad çok uzun (maksimum 100 karakter)' });
        }

        await req.dbOperations.updateUserProfile(req.user.id, {
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
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gereklidir' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır' });
        }

        // Mevcut şifreyi kontrol et
        const user = await req.dbOperations.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Mevcut şifre yanlış' });
        }

        // Yeni şifreyi hash'le
        const newPasswordHash = await bcrypt.hash(new_password, 10);

        await req.dbOperations.updateUserPassword(req.user.id, newPasswordHash);

        res.json({
            success: true,
            message: 'Şifre başarıyla değiştirildi'
        });

    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = router;