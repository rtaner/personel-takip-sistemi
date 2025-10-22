// Organizasyon yönetimi JavaScript fonksiyonları

let authToken = null;
let userInfo = null;
let organizationData = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    // Auth kontrolü yap
    if (!checkAuth()) {
        return;
    }
    
    // Yetki kontrolü - sadece organizasyon sahibi erişebilir
    if (!routeGuard.hasRole('organizasyon_sahibi')) {
        routeGuard.showUnauthorizedPage();
        return;
    }
    
    setupUserInterface();
    loadDashboardData();
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
                <span class="user-role">Organizasyon Sahibi</span>
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
    
    // Sekme özel yükleme işlemleri
    switch(tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'invite':
            loadInviteCode();
            break;
        case 'settings':
            loadOrganizationSettings();
            break;
    }
}

// Dashboard verilerini yükle
async function loadDashboardData() {
    try {
        console.log('Dashboard verileri yükleniyor...');
        const response = await fetch('/api/organization/stats', {
            headers: getAuthHeaders()
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Dashboard verileri:', data);
            organizationData = data;
            displayStats(data.stats);
            displayRecentUsers();
        } else {
            const errorText = await response.text();
            console.error('İstatistikler yüklenemedi:', response.status, errorText);
        }
    } catch (error) {
        console.error('Dashboard yükleme hatası:', error);
    }
}

// İstatistikleri göster
function displayStats(stats) {
    const statsContent = document.getElementById('stats-content');
    
    statsContent.innerHTML = `
        <div class="stat-item">
            <div class="stat-number">${stats.totalUsers}</div>
            <div class="stat-label">Toplam Kullanıcı</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.totalPersonel}</div>
            <div class="stat-label">Personel Sayısı</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.totalNotes}</div>
            <div class="stat-label">Toplam Not</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.totalTasks}</div>
            <div class="stat-label">Toplam Görev</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.usersByRole.organizasyon_sahibi}</div>
            <div class="stat-label">Org. Sahibi</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.usersByRole.yonetici}</div>
            <div class="stat-label">Yönetici</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.tasksByStatus.beklemede}</div>
            <div class="stat-label">Bekleyen Görev</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.tasksByStatus.tamamlandi}</div>
            <div class="stat-label">Tamamlanan</div>
        </div>
    `;
}

// Son kullanıcıları göster
async function displayRecentUsers() {
    try {
        const response = await fetch('/api/organization/members', {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            const recentUsers = data.members.slice(0, 5); // Son 5 kullanıcı
            
            const recentUsersDiv = document.getElementById('recent-users');
            
            if (recentUsers.length === 0) {
                recentUsersDiv.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Henüz kullanıcı bulunmuyor</p>
                    </div>
                `;
                return;
            }
            
            recentUsersDiv.innerHTML = recentUsers.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <div class="user-name">${user.full_name}</div>
                        <div class="user-role">${getRoleDisplayName(user.role)}</div>
                    </div>
                    <span class="role-badge ${getRoleBadgeClass(user.role)}">${getRoleDisplayName(user.role)}</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Kullanıcılar yüklenemedi:', error);
    }
}

// Kullanıcıları yükle
async function loadUsers() {
    try {
        const response = await fetch('/api/organization/members', {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            displayUsers(data.members);
        } else {
            console.error('Kullanıcılar yüklenemedi');
        }
    } catch (error) {
        console.error('Kullanıcı yükleme hatası:', error);
    }
}

// Kullanıcıları göster
function displayUsers(users) {
    const usersList = document.getElementById('users-list');
    
    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Henüz kullanıcı bulunmuyor</p>
            </div>
        `;
        return;
    }
    
    usersList.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">${user.full_name}</div>
                <div class="user-role">@${user.username} • ${formatDate(user.created_at)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <select onchange="changeUserRole(${user.id}, this.value)" ${user.id === userInfo.id ? 'disabled' : ''}>
                    <option value="personel" ${user.role === 'personel' ? 'selected' : ''}>Personel</option>
                    <option value="yonetici" ${user.role === 'yonetici' ? 'selected' : ''}>Yönetici</option>
                    <option value="organizasyon_sahibi" ${user.role === 'organizasyon_sahibi' ? 'selected' : ''}>Org. Sahibi</option>
                </select>
                <span class="role-badge ${getRoleBadgeClass(user.role)}">${getRoleDisplayName(user.role)}</span>
            </div>
        </div>
    `).join('');
}

// Kullanıcı rolünü değiştir
async function changeUserRole(userId, newRole) {
    if (!confirm('Kullanıcının rolünü değiştirmek istediğinizden emin misiniz?')) {
        loadUsers(); // Seçimi geri al
        return;
    }
    
    try {
        const response = await fetch(`/api/organization/member/${userId}/role`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            alert('Kullanıcı rolü başarıyla güncellendi');
            loadUsers();
        } else {
            const error = await response.json();
            alert('Hata: ' + error.error);
            loadUsers();
        }
    } catch (error) {
        console.error('Rol güncelleme hatası:', error);
        alert('Rol güncellenirken hata oluştu');
        loadUsers();
    }
}

// Davet kodunu yükle
async function loadInviteCode() {
    if (organizationData && organizationData.organization) {
        displayInviteCode(organizationData.organization.inviteCode);
    } else {
        // Organizasyon verisi yoksa tekrar yükle
        loadDashboardData().then(() => {
            if (organizationData && organizationData.organization) {
                displayInviteCode(organizationData.organization.inviteCode);
            }
        });
    }
}

// Davet kodunu göster
function displayInviteCode(inviteCode) {
    const inviteCodeDisplay = document.getElementById('invite-code-display');
    inviteCodeDisplay.textContent = inviteCode;
}

// Davet kodunu kopyala (davet kodu sekmesinden)
function copyInviteCode() {
    const inviteCodeElement = document.getElementById('invite-code-display');
    const inviteCode = inviteCodeElement ? inviteCodeElement.textContent : organizationData.organization.inviteCode;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteCode).then(() => {
            alert('Davet kodu panoya kopyalandı!');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = inviteCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Davet kodu panoya kopyalandı!');
    }
}

// Mevcut davet kodunu kopyala (ayarlar sayfasından)
function copyCurrentInviteCode() {
    const inviteCodeInput = document.getElementById('custom-invite-code');
    const inviteCode = inviteCodeInput.value;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteCode).then(() => {
            alert('Davet kodu panoya kopyalandı!');
        });
    } else {
        // Fallback for older browsers
        inviteCodeInput.select();
        document.execCommand('copy');
        alert('Davet kodu panoya kopyalandı!');
    }
}

// Özel davet kodu güncelle
async function updateCustomInviteCode() {
    const customCode = document.getElementById('custom-invite-code').value.trim();
    
    if (!customCode) {
        alert('Davet kodu boş olamaz!');
        return;
    }
    
    if (customCode === organizationData.organization.inviteCode) {
        alert('Davet kodu zaten aynı.');
        return;
    }
    
    // Kod formatı kontrolü
    if (customCode.length < 3 || customCode.length > 20) {
        alert('Davet kodu 3-20 karakter arasında olmalıdır!');
        return;
    }
    
    // Sadece harf, rakam ve tire içerebilir
    if (!/^[a-zA-Z0-9-_]+$/.test(customCode)) {
        alert('Davet kodu sadece harf, rakam, tire (-) ve alt çizgi (_) içerebilir!');
        return;
    }
    
    if (!confirm(`Davet kodunu "${customCode}" olarak değiştirmek istediğinizden emin misiniz? Eski kod geçersiz hale gelecektir.`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/organization/invite-code/custom', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ inviteCode: customCode })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Organizasyon verisini güncelle
            organizationData.organization.inviteCode = data.inviteCode;
            
            alert('Davet kodu başarıyla güncellendi!');
            
            // Diğer sekmelerdeki verileri de yenile
            loadDashboardData();
            
        } else {
            const error = await response.json();
            alert('Hata: ' + error.error);
            
            // Eski kodu geri yükle
            document.getElementById('custom-invite-code').value = organizationData.organization.inviteCode;
        }
    } catch (error) {
        console.error('Davet kodu güncelleme hatası:', error);
        alert('Davet kodu güncellenirken hata oluştu');
        
        // Eski kodu geri yükle
        document.getElementById('custom-invite-code').value = organizationData.organization.inviteCode;
    }
}

// Rastgele davet kodu oluştur
async function generateRandomInviteCode() {
    if (!confirm('Rastgele yeni davet kodu oluşturmak istediğinizden emin misiniz? Eski kod geçersiz hale gelecektir.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/organization/invite-code', {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Input'u güncelle
            document.getElementById('custom-invite-code').value = data.inviteCode;
            
            // Organizasyon verisini güncelle
            organizationData.organization.inviteCode = data.inviteCode;
            
            alert('Rastgele davet kodu oluşturuldu!');
            
            // Diğer sekmelerdeki verileri de yenile
            loadDashboardData();
            
        } else {
            const error = await response.json();
            alert('Hata: ' + error.error);
        }
    } catch (error) {
        console.error('Davet kodu oluşturma hatası:', error);
        alert('Davet kodu oluşturulurken hata oluştu');
    }
}

// Eski fonksiyon - geriye uyumluluk için
async function regenerateInviteCode() {
    return generateRandomInviteCode();
}

// Organizasyon ayarlarını yükle
function loadOrganizationSettings() {
    const settingsDiv = document.getElementById('organization-settings');
    
    if (organizationData && organizationData.organization) {
        settingsDiv.innerHTML = `
            <form id="organization-settings-form" onsubmit="updateOrganizationSettings(event)">
                <div class="form-group">
                    <label>Organizasyon Adı</label>
                    <input type="text" id="org-name" value="${organizationData.organization.name}" required>
                    <small class="form-help">Organizasyonunuzun görünen adı</small>
                </div>
                
                <div class="form-group">
                    <label>Oluşturulma Tarihi</label>
                    <input type="text" value="${formatDate(organizationData.organization.createdAt)}" readonly>
                    <small class="form-help">Bu alan değiştirilemez</small>
                </div>
                
                <div class="form-group">
                    <label>Davet Kodu</label>
                    <div style="display: flex; gap: 10px; align-items: stretch;">
                        <input type="text" id="custom-invite-code" value="${organizationData.organization.inviteCode}" 
                               style="flex: 1; font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 2px; padding: 15px;"
                               placeholder="Özel davet kodunuzu girin (örn: 1854)">
                        <button type="button" class="btn btn-secondary" onclick="copyCurrentInviteCode()" style="min-width: 100px;">
                            <i class="fas fa-copy"></i> Kopyala
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <button type="button" class="btn btn-success" onclick="updateCustomInviteCode()" style="flex: 1;">
                            <i class="fas fa-save"></i> Davet Kodunu Güncelle
                        </button>
                        <button type="button" class="btn btn-warning" onclick="generateRandomInviteCode()" style="flex: 1;">
                            <i class="fas fa-random"></i> Rastgele Kod Oluştur
                        </button>
                    </div>
                    <small class="form-help">
                        <i class="fas fa-info-circle"></i> 
                        Özel davet kodunuzu belirleyebilirsiniz (örn: 1854, SIRKET2024, vb.) veya rastgele kod oluşturabilirsiniz
                    </small>
                </div>
                
                <div class="form-actions" style="margin-top: 30px;">
                    <button type="submit" class="btn btn-success">
                        <i class="fas fa-save"></i> Değişiklikleri Kaydet
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="loadOrganizationSettings()">
                        <i class="fas fa-undo"></i> İptal
                    </button>
                </div>
            </form>
            
            <div class="settings-info" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                <h4 style="margin-bottom: 15px; color: #333;">
                    <i class="fas fa-info-circle"></i> Organizasyon Bilgileri
                </h4>
                <div class="info-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div class="info-item">
                        <strong>Toplam Üye:</strong> ${organizationData.stats.totalUsers}
                    </div>
                    <div class="info-item">
                        <strong>Personel Sayısı:</strong> ${organizationData.stats.totalPersonel}
                    </div>
                    <div class="info-item">
                        <strong>Toplam Görev:</strong> ${organizationData.stats.totalTasks}
                    </div>
                    <div class="info-item">
                        <strong>Toplam Not:</strong> ${organizationData.stats.totalNotes}
                    </div>
                </div>
            </div>
        `;
    } else {
        settingsDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <p style="text-align: center; margin-top: 20px;">Organizasyon ayarları yükleniyor...</p>
        `;
        
        // Organizasyon verisi yoksa yükle
        loadDashboardData().then(() => {
            loadOrganizationSettings();
        });
    }
}

// Organizasyon ayarlarını güncelle
async function updateOrganizationSettings(event) {
    event.preventDefault();
    
    const orgName = document.getElementById('org-name').value.trim();
    
    if (!orgName) {
        alert('Organizasyon adı boş olamaz!');
        return;
    }
    
    if (orgName === organizationData.organization.name) {
        alert('Herhangi bir değişiklik yapılmadı.');
        return;
    }
    
    try {
        const response = await fetch('/api/organization/settings', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name: orgName
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Organizasyon verisini güncelle
            organizationData.organization.name = orgName;
            
            alert('Organizasyon ayarları başarıyla güncellendi!');
            
            // Diğer sekmelerdeki verileri de yenile
            loadDashboardData();
            
        } else {
            const error = await response.json();
            alert('Hata: ' + error.error);
        }
    } catch (error) {
        console.error('Ayarlar güncelleme hatası:', error);
        alert('Ayarlar güncellenirken hata oluştu');
    }
}

// Kullanıcıları yenile
function refreshUsers() {
    loadUsers();
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

function getRoleBadgeClass(role) {
    const badgeClasses = {
        'organizasyon_sahibi': 'owner',
        'yonetici': 'manager',
        'personel': 'employee'
    };
    return badgeClasses[role] || 'employee';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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