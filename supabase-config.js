const { createClient } = require('@supabase/supabase-js');

// Supabase yapılandırması
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

// Supabase istemcisini oluştur
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase bağlantısı kuruldu');
} else {
    console.log('⚠️ Supabase bilgileri bulunamadı, SQLite kullanılacak');
}

module.exports = { supabase };