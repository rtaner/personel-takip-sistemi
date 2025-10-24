const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, filterByOrganization } = require('../middleware/auth');

// Organizasyon üyelerini getir
router.get('/members', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const members = await req.dbOperations.getOrganizationMembers(req.organizationId);
        res.json({
            success: true,
            members
        });
    } catch (error) {
        console.error('Üyeler getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Yeni davet kodu oluştur (sadece organizasyon sahibi)
router.post('/invite-code', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const result = await req.dbOperations.generateNewInviteCode(req.user.organizationId);
        res.json({
            success: true,
            invite_code: result.invite_code
        });
    } catch (error) {
        console.error('Davet kodu oluşturma hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Organizasyon istatistiklerini getir
router.get('/stats', authenticateToken, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        const stats = await req.dbOperations.getOrganizationStats(req.user.organizationId);
        
        // Organizasyon bilgilerini de ekle
        const organization = await req.dbOperations.getOrganizationById(req.user.organizationId);
        
        res.json({
            success: true,
            stats,
            organization
        });
    } catch (error) {
        console.error('İstatistikler getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Organizasyon ayarlarını güncelle (sadece organizasyon sahibi)
router.put('/settings', authenticateToken, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Organizasyon adı en az 2 karakter olmalıdır' });
        }

        // Organizasyon adını güncelle
        await req.dbOperations.updateOrganization(req.user.organizationId, {
            name: name.trim()
        });

        res.json({
            success: true,
            message: 'Organizasyon ayarları güncellendi'
        });
    } catch (error) {
        console.error('Ayarlar güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Kullanıcının rol yetkilerini kontrol et
router.get('/permissions', authenticateToken, (req, res) => {
    try {
        const userRole = req.user.role;
        
        const permissions = {
            can_edit_personnel: ['organizasyon_sahibi', 'yonetici'].includes(userRole),
            can_delete_personnel: userRole === 'organizasyon_sahibi',
            can_assign_tasks: ['organizasyon_sahibi', 'yonetici'].includes(userRole),
            can_view_all_notes: userRole === 'organizasyon_sahibi',
            can_manage_users: userRole === 'organizasyon_sahibi',
            can_view_analytics: ['organizasyon_sahibi', 'yonetici'].includes(userRole)
        };

        res.json({
            success: true,
            role: userRole,
            permissions
        });
    } catch (error) {
        console.error('Yetki kontrolü hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Davet kodu geçerliliğini kontrol et (public endpoint)
router.get('/invite-code/:code/validate', async (req, res) => {
    try {
        const { code } = req.params;
        
        const organization = await req.dbOperations.getOrganizationByInviteCode(code);
        
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
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;