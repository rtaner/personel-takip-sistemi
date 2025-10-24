const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, filterByOrganization } = require('../middleware/auth');
const { validatePersonel } = require('../middleware/validation');

// Tüm personeli getir (organizasyon bazlı)
router.get('/', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        let personel = await req.dbOperations.getPersonel(req.organizationId);

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
router.post('/', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), validatePersonel, async (req, res) => {
    try {
        // Organizasyon ve oluşturan kişi bilgilerini ekle
        const personelData = {
            ...req.body,
            organization_id: req.organizationId,
            created_by: req.user.id
        };

        const result = await req.dbOperations.addPersonel(personelData);
        res.json({ id: result.id, message: 'Personel başarıyla eklendi' });
    } catch (error) {
        console.error('Personel ekleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel güncelleme
router.put('/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), validatePersonel, async (req, res) => {
    try {
        await req.dbOperations.updatePersonel(req.params.id, req.body, req.organizationId);
        res.json({ message: 'Personel başarıyla güncellendi' });
    } catch (error) {
        console.error('Personel güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel silme
router.delete('/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi']), async (req, res) => {
    try {
        await req.dbOperations.deletePersonel(req.params.id, req.organizationId);
        res.json({ message: 'Personel başarıyla silindi' });
    } catch (error) {
        console.error('Personel silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel notlarını getir (organizasyon bazlı)
router.get('/:id/notlar', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        let notlar = await req.dbOperations.getPersonelNotes(req.params.id, req.organizationId);

        // Rol bazlı filtreleme
        if (req.user.role === 'personel') {
            // Personel sadece kendi notlarını görebilir
            notlar = notlar.filter(n => n.created_by === req.user.id);
        }

        res.json(notlar);
    } catch (error) {
        console.error('Notlar getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Personel görevlerini getir (organizasyon bazlı)
router.get('/:id/gorevler', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        const gorevler = await req.dbOperations.getPersonelTasks(req.params.id, req.organizationId);
        res.json(gorevler);
    } catch (error) {
        console.error('Görevler getirme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;