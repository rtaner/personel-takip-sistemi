// Route koruma sistemi

// Sayfa yetki kontrolü
class RouteGuard {
    constructor() {
        this.userInfo = null;
        this.authToken = null;
        this.init();
    }

    init() {
        // Auth bilgilerini yükle
        this.loadAuthInfo();
        
        // Sayfa değişikliklerini dinle
        window.addEventListener('popstate', () => {
            this.checkPageAccess();
        });
    }

    loadAuthInfo() {
        this.authToken = localStorage.getItem('authToken');
        const userInfoStr = localStorage.getItem('userInfo');
        
        if (userInfoStr) {
            try {
                this.userInfo = JSON.parse(userInfoStr);
            } catch (error) {
                console.error('Kullanıcı bilgileri parse edilemedi:', error);
                this.userInfo = null;
            }
        }
    }

    // Kullanıcının belirli bir role sahip olup olmadığını kontrol et
    hasRole(requiredRoles) {
        if (!this.userInfo || !this.userInfo.role) {
            return false;
        }

        if (Array.isArray(requiredRoles)) {
            return requiredRoles.includes(this.userInfo.role);
        }

        return this.userInfo.role === requiredRoles;
    }

    // Kullanıcının belirli bir yetkiye sahip olup olmadığını kontrol et
    hasPermission(permission) {
        if (!this.userInfo || !this.userInfo.role) {
            return false;
        }

        const role = this.userInfo.role;
        const permissions = {
            // Organizasyon sahibi tüm yetkilere sahip
            'organizasyon_sahibi': [
                'manage_users', 'create_invite_code', 'view_all_personnel', 
                'view_all_notes', 'view_all_tasks', 'assign_tasks', 
                'view_stats', 'delete_personnel', 'edit_personnel'
            ],
            // Yönetici sınırlı yetkilere sahip
            'yonetici': [
                'view_all_personnel', 'view_all_tasks', 'assign_tasks', 
                'view_stats', 'edit_personnel'
            ],
            // Personel sadece kendi verilerini görebilir
            'personel': [
                'view_own_tasks', 'update_own_tasks'
            ]
        };

        return permissions[role] && permissions[role].includes(permission);
    }

    // Sayfa erişim kontrolü
    checkPageAccess() {
        const currentPath = window.location.pathname;
        
        // Auth sayfası hariç tüm sayfalar için auth kontrolü
        if (currentPath !== '/auth.html' && !this.authToken) {
            this.redirectToAuth();
            return false;
        }

        return true;
    }

    // Auth sayfasına yönlendir
    redirectToAuth() {
        window.location.href = '/auth.html';
    }

    // Yetkisiz erişim sayfası göster
    showUnauthorizedPage() {
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                padding: 20px;
            ">
                <div style="
                    background: rgba(255, 255, 255, 0.1);
                    padding: 40px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    max-width: 500px;
                ">
                    <i class="fas fa-exclamation-triangle" style="font-size: 4rem; margin-bottom: 20px; color: #ffd700;"></i>
                    <h1 style="margin-bottom: 20px;">Yetkisiz Erişim</h1>
                    <p style="margin-bottom: 30px; font-size: 1.1rem;">
                        Bu sayfaya erişim yetkiniz bulunmamaktadır.
                    </p>
                    <button onclick="window.history.back()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">
                        <i class="fas fa-arrow-left"></i> Geri Dön
                    </button>
                    <button onclick="window.location.href='/'" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-home"></i> Ana Sayfa
                    </button>
                </div>
            </div>
        `;
    }

    // Element'leri rol bazında göster/gizle
    applyRoleBasedVisibility() {
        // data-role attribute'u olan elementleri kontrol et
        const roleElements = document.querySelectorAll('[data-role]');
        
        roleElements.forEach(element => {
            const requiredRoles = element.getAttribute('data-role').split(',').map(r => r.trim());
            
            if (this.hasRole(requiredRoles)) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });

        // data-permission attribute'u olan elementleri kontrol et
        const permissionElements = document.querySelectorAll('[data-permission]');
        
        permissionElements.forEach(element => {
            const requiredPermission = element.getAttribute('data-permission');
            
            if (this.hasPermission(requiredPermission)) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });
    }

    // Rol bazlı buton durumlarını ayarla
    applyRoleBasedButtonStates() {
        const buttons = document.querySelectorAll('button[data-permission]');
        
        buttons.forEach(button => {
            const requiredPermission = button.getAttribute('data-permission');
            
            if (!this.hasPermission(requiredPermission)) {
                button.disabled = true;
                button.title = 'Bu işlem için yetkiniz yok';
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            }
        });
    }

    // Kullanıcı menüsü göster
    showUserMenu(event) {
        event.stopPropagation();
        
        // Mevcut menüyü kapat
        const existingMenu = document.getElementById('user-menu-dropdown');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'user-menu-dropdown';
        menu.className = 'user-menu-dropdown';
        menu.innerHTML = `
            <div class="menu-item" onclick="showUserProfile()">
                <i class="fas fa-user"></i> Profil
            </div>
            ${this.hasPermission('view_stats') ? `
                <div class="menu-item" onclick="showOrganizationStats()">
                    <i class="fas fa-chart-bar"></i> İstatistikler
                </div>
            ` : ''}
            ${this.hasPermission('manage_users') ? `
                <div class="menu-item" onclick="showUserManagement()">
                    <i class="fas fa-users-cog"></i> Kullanıcı Yönetimi
                </div>
            ` : ''}
            ${this.hasPermission('create_invite_code') ? `
                <div class="menu-item" onclick="showInviteCodeManager()">
                    <i class="fas fa-link"></i> Davet Kodu
                </div>
            ` : ''}
            <div class="menu-divider"></div>
            <div class="menu-item" onclick="logout()">
                <i class="fas fa-sign-out-alt"></i> Çıkış Yap
            </div>
        `;

        // Menüyü konumlandır
        const rect = event.target.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.zIndex = '1000';

        document.body.appendChild(menu);

        // Dışarı tıklandığında menüyü kapat
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }
}

// Global RouteGuard instance
const routeGuard = new RouteGuard();

// Global fonksiyonlar
function showUserMenu(event) {
    routeGuard.showUserMenu(event);
}

// Sayfa yüklendiğinde rol bazlı görünürlük uygula
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        routeGuard.applyRoleBasedVisibility();
        routeGuard.applyRoleBasedButtonStates();
    }, 100);
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouteGuard;
}