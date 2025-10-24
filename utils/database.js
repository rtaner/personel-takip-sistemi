const { supabase, useSupabase, db } = require('../config/database');
const { generateInviteCode } = require('./auth');

// Veritabanı işlemleri - server.js'den taşındı
// Bu dosya server.js'deki dbOperations objesini içerir
// Şimdilik server.js'de kalacak, sonra buraya taşınacak

// Geçici export - server.js'deki dbOperations'ı kullan
module.exports = {
    // Bu fonksiyonlar server.js'den import edilecek
    // Şimdilik placeholder
};