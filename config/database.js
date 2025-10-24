const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
let useSupabase = false;

// Supabase istemcisini oluştur
if (process.env.USE_SUPABASE === 'true' && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    useSupabase = true;
    console.log('✅ Supabase bağlantısı kuruldu');

    // Bağlantıyı test et
    supabase.from('users').select('count', { count: 'exact', head: true })
        .then(({ error }) => {
            if (error) {
                console.error('❌ Supabase bağlantı testi başarısız:', error.message);
            } else {
                console.log('✅ Supabase bağlantı testi başarılı');
            }
        })
        .catch(err => {
            console.error('❌ Supabase bağlantı testi hatası:', err.message);
        });
} else {
    console.log('⚠️ Supabase bilgileri bulunamadı, SQLite kullanılacak');
}

// SQLite veritabanı (fallback)
const dbPath = process.env.DB_PATH || 'personel_takip.db';
const db = new sqlite3.Database(dbPath);

module.exports = {
    supabase,
    useSupabase,
    db,
    dbPath
};