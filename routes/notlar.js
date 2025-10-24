const express = require('express');
const router = express.Router();
const { authenticateToken, filterByOrganization } = require('../middleware/auth');
const { validateNote } = require('../middleware/validation');

// Yeni not ekle
router.post('/', authenticateToken, filterByOrganization, validateNote, async (req, res) => {
    try {
        // Organizasyon ve oluşturan kişi bilgilerini ekle
        const noteData = {
            ...req.body,
            created_by: req.user.id,
            organization_id: req.organizationId
        };

        const result = await req.dbOperations.addNote(noteData);
        res.json({ id: result.id, message: 'Not başarıyla eklendi' });
    } catch (error) {
        console.error('Not ekleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Not güncelleme (sadece not sahibi veya organizasyon sahibi)
router.put('/:id', authenticateToken, filterByOrganization, validateNote, async (req, res) => {
    try {
        // Not sahibi kontrolü yapılacak (updateNote fonksiyonunda)
        await req.dbOperations.updateNote(req.params.id, req.body, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Not başarıyla güncellendi' });
    } catch (error) {
        console.error('Not güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Not silme (sadece not sahibi veya organizasyon sahibi)
router.delete('/:id', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        await req.dbOperations.deleteNote(req.params.id, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Not başarıyla silindi' });
    } catch (error) {
        console.error('Not silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;