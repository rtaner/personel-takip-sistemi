const express = require('express');
const router = express.Router();
const { generateToken, hashPassword, verifyPassword, generateInviteCode } = require('../utils/auth');
const { authenticateToken } = require('../middleware/auth');

// dbOperations'ı server.js'den import etmek yerine, geçici olarak req.dbOperations kullanacağız
// Bu, server.js'de middleware olarak eklenecek

// Kullanıcı Kaydı
router.post('/register', async (req, res) => {
    try {
        console.log('🔥 Kayit islemi basladi:', req.body);
        const { username, password, fullName, inviteCode } = req.body;

        // Validasyon
        if (!username || !password || !fullName) {
            console.log('❌ Validasyon hatasi: Eksik alanlar');
            return res.status(400).json({ error: 'Tüm alanlar gerekli' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }

        // Kullanıcı adı kontrolü
        console.log('🔍 Kullanici adi kontrolu:', username);
        const existingUser = await req.dbOperations.getUserByUsername(username);
        if (existingUser) {
            console.log('❌ Kullanici adi zaten var:', username);
            return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanımda' });
        }

        // Şifreyi hash'le
        console.log('🔐 Sifre hashleniyor...');
        const passwordHash = await hashPassword(password);
        console.log('✅ Sifre hashlendi');

        let organizationId = null;
        let role = 'organizasyon_sahibi'; // İlk kullanıcı organizasyon sahibi

        // Davet kodu varsa organizasyon bul
        if (inviteCode) {
            const organization = await req.dbOperations.getOrganizationByInviteCode(inviteCode);
            if (!organization) {
                return res.status(404).json({ error: 'Geçersiz davet kodu' });
            }
            organizationId = organization.id;
            role = 'personel'; // Davet ile gelenler personel
        }

        // Kullanıcı oluştur
        console.log('👤 Kullanici olusturuluyor:', { username, fullName, organizationId, role });
        const newUser = await req.dbOperations.createUser({
            username,
            password_hash: passwordHash,
            full_name: fullName,
            organization_id: organizationId,
            role
        });
        console.log('✅ Kullanici olusturuldu:', newUser.id);

        // Eğer davet kodu yoksa (ilk kullanıcı), organizasyon oluştur
        if (!inviteCode) {
            const orgName = fullName + ' Organizasyonu';
            const newInviteCode = generateInviteCode();

            const organization = await req.dbOperations.createOrganization({
                name: orgName,
                invite_code: newInviteCode,
                owner_id: newUser.id
            });

            // Kullanıcının organizasyon ID'sini güncelle
            organizationId = organization.id;
            await req.dbOperations.updateUserOrganization(newUser.id, organizationId);
        }

        // Kullanıcıyı personel tablosuna da ekle (görev atanabilmesi için)
        try {
            const [firstName, ...lastNameParts] = fullName.split(' ');
            const lastName = lastNameParts.join(' ') || firstName;

            await req.dbOperations.addPersonel({
                ad: firstName,
                soyad: lastName,
                pozisyon: role === 'organizasyon_sahibi' ? 'Organizasyon Sahibi' :
                    role === 'yonetici' ? 'Yönetici' : 'Personel',
                telefon: '', // Boş bırak, sonra güncellenebilir
                email: '', // Boş bırak, sonra güncellenebilir
                baslangic_tarihi: new Date().toISOString().split('T')[0],
                organization_id: organizationId,
                created_by: newUser.id
            });
        } catch (personelError) {
            console.error('Personel kaydı oluşturulamadı:', personelError);
            // Personel kaydı başarısız olsa bile kullanıcı kaydı devam etsin
        }

        res.status(201).json({
            success: true,
            message: 'Kayıt başarılı',
            user: {
                id: newUser.id,
                username,
                fullName,
                role,
                organizationId
            }
        });

    } catch (error) {
        console.error('Kayıt hatası:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            stack: error.stack
        });

        // Supabase hatalarını daha anlaşılır hale getir
        if (error.code === 'PGRST116') {
            res.status(400).json({ error: 'Veri bulunamadı veya oluşturulamadı' });
        } else if (error.message && error.message.includes('violates not-null constraint')) {
            res.status(400).json({ error: 'Gerekli alanlar eksik' });
        } else {
            res.status(500).json({ error: 'Sunucu hatası' });
        }
    }
});

// Kullanıcı Girişi
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validasyon
        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        // Kullanıcıyı bul
        const user = await req.dbOperations.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }

        // Şifre kontrolü
        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }

        // JWT token oluştur
        const token = generateToken(user);

        // Session bilgilerini güncelle
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 2); // 2 gün

        await req.dbOperations.updateUserSession(user.id, token, expiresAt.toISOString());

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                organizationId: user.organization_id
            },
            expiresAt: expiresAt.toISOString()
        });

    } catch (error) {
        console.error('Giriş hatası:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });

        // Supabase hatalarını daha anlaşılır hale getir
        if (error.code === 'PGRST116') {
            res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        } else {
            res.status(500).json({ error: 'Sunucu hatası' });
        }
    }
});

// Kullanıcı Çıkışı
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // Session token'ı temizle
        await req.dbOperations.updateUserSession(req.user.id, null, null);

        res.json({
            success: true,
            message: 'Çıkış başarılı'
        });

    } catch (error) {
        console.error('Çıkış hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Token Doğrulama
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            organizationId: req.user.organizationId
        }
    });
});

module.exports = router;