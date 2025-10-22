// Profil yönetimi JavaScript fonksiyonları

let authToken = null;
let userInfo = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    // Auth kontrolü yap
    if (!checkAuth()) {
        return;
    }
    
    setupUserInterface();
    loadUserProfile();
});

// Auth kontrolü
function checkAuth() {
    authToken = localStorage.getItem('authToken');
    const userInfoStr = localStorage.getItem('userInfo');
    const tokenExpires = localStorage.getItem('tokenExpires');
    
    if (!authToken) {
        window.location.href = '/auth.html';
        return false;
    }
    
    if (tokenExpires && new Date(tokenExpires) < new Date()) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpires');
        window.location.href = '/auth.html';
        return false;
    }
    
    try {
        userInfo = JSON.parse(userInfoStr);
    } catch (error) {
        console.error('Kullanıcı bilgileri parse edilemedi:', error);
        window.location.href = '/auth.html';
        return false;
    }
    
    return true;
}

// Kullanıcı arayüzünü ayarla
function setupUserInterface() {
    const header = document.querySelector('header');
    if (header && userInfo) {
        let userInfoDiv = document.getElementById('user-info');
        if (!userInfoDiv) {
            userInfoDiv = document.createElement('div');
            userInfoDiv.id = 'user-info';
            userInfoDiv.className = 'user-info';
            header.appendChild(userInfoDiv);
        }
        
        userInfoDiv.innerHTML = `
            <div class="user-details">
                <span class="user-name">${userInfo.fullName}</span>
                <span class="user-role">${getRoleDisplayName(userInfo.role)}</span>
            </div>
            <div class="user-actions">
                <button class="btn btn-secondary btn-sm" onclick="window.location.href='/'">
                    <i class="fas fa-home"></i> Ana Sayfa
                </button>
                <button class="btn btn-danger btn-sm" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Çıkış
                </button>
            </div>
        `;
    }
}

// API istekleri için auth header
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

// Sekme değiştirme
function showTab(tabName, event) {
    // Tüm sekmeleri gizle
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Tüm butonları pasif yap
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Seçilen sekmeyi göster
    document.getElementById(tabName + '-tab').classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Kullanıcı profilini yükle
async function loadUserProfile() {
    try {
        const response = await fetch('/api/user/profile', {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const profile = await response.json();
            
            // Form alanlarını doldur
            document.getElementById('full-name').value = profile.full_name;
            document.getElementById('username').value = profile.username;
            document.getElementById('role').value = getRoleDisplayName(profile.role);
            document.getElementById('organization').value = profile.organization_name || 'Bilinmiyor';
            
        } else {
            console.error('Profil yüklenemedi');
            alert('Profil bilgileri yüklenirken hata oluştu');
        }
    } catch (error) {
        console.error('Profil yükleme hatası:', error);
        alert('Profil bilgileri yüklenirken hata oluştu');
    }
}

// Profil güncelleme
async function updateProfile(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('full-name').value.trim();
    
    if (!fullName) {
        alert('Ad soyad boş olamaz!');
        return;
    }
    
    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                full_name: fullName
            })
        });
        
        if (response.ok) {
            // LocalStorage'daki kullanıcı bilgilerini güncelle
            userInfo.fullName = fullName;
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            
            alert('Profil başarıyla güncellendi!');
            setupUserInterface(); // Header'ı güncelle
        } else {
            const error = await response.json();
            alert('Hata: ' + error.error);
        }
    } catch (error) {
        console.error('Profil güncelleme hatası:', error);
        alert('Profil güncellenirken hata oluştu');
    }
}

// Şifre değiştirme
async function updatePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Tüm alanları doldurun!');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('Yeni şifre en az 6 karakter olmalıdır!');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('Yeni şifreler eşleşmiyor!');
        return;
    }
    
    try {
        const response = await fetch('/api/user/password', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        
        if (response.ok) {
            alert('Şifre başarıyla değiştirildi!');
            clearPasswordForm();
        } else {
            const error = await response.json();
            alert('Hata: ' + error.error);
        }
    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        alert('Şifre değiştirilirken hata oluştu');
    }
}

// Şifre formunu temizle
function clearPasswordForm() {
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
}

// Yardımcı fonksiyonlar
function getRoleDisplayName(role) {
    const roleNames = {
        'organizasyon_sahibi': 'Organizasyon Sahibi',
        'yonetici': 'Yönetici',
        'personel': 'Personel'
    };
    return roleNames[role] || role;
}

// Çıkış yapma
async function logout() {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
        } catch (error) {
            console.error('Logout hatası:', error);
        } finally {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            localStorage.removeItem('tokenExpires');
            window.location.href = '/auth.html';
        }
    }
}