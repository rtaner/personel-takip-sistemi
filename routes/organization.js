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

module.exports = router;