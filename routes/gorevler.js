const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, filterByOrganization } = require('../middleware/auth');
const { validateTask } = require('../middleware/validation');
const { useSupabase, db } = require('../config/database');

// Yeni görev ekle (sadece organizasyon sahibi ve yönetici)
router.post('/', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), validateTask, async (req, res) => {
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

        const result = await req.dbOperations.addTask(taskData);
        res.json({ id: result.id, message: 'Görev başarıyla eklendi' });
    } catch (error) {
        console.error('Görev ekleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Görev durumunu güncelle (görev sahibi, atanan kişi veya yöneticiler)
router.put('/:id', authenticateToken, filterByOrganization, async (req, res) => {
    try {
        await req.dbOperations.updateTask(req.params.id, req.body, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Görev başarıyla güncellendi' });
    } catch (error) {
        console.error('Görev güncelleme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

// Görev silme (sadece görev oluşturan veya organizasyon sahibi)
router.delete('/:id', authenticateToken, filterByOrganization, requireRole(['organizasyon_sahibi', 'yonetici']), async (req, res) => {
    try {
        await req.dbOperations.deleteTask(req.params.id, req.user.id, req.user.role, req.organizationId);
        res.json({ message: 'Görev başarıyla silindi' });
    } catch (error) {
        console.error('Görev silme hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;