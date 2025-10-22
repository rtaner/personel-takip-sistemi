// Auth sayfası JavaScript fonksiyonları

// Sayfa yüklendiğinde çalışacak
document.addEventListener('DOMContentLoaded', function() {
    // Eğer zaten giriş yapılmışsa ana sayfaya yönlendir
    const token = localStorage.getItem('authToken');
    if (token) {
        verifyToken(token);
    }
});

// Auth form değiştirme
function showAuthForm(formType) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.auth-tab');
    
    // Tüm formları gizle
    loginForm.classList.remove('active');
    registerForm.classList.remove('active');
    
    // Tüm tabları pasif yap
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Seçilen formu göster
    if (formType === 'login') {
        loginForm.classList.add('active');
        tabs[0].classList.add('active');
    } else {
        registerForm.classList.add('active');
        tabs[1].classList.add('active');
    }
    
    // Hata mesajlarını temizle
    hideMessages();
}

// Mesajları gizle
function hideMessages() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
}

// Hata mesajı göster
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('success-message').style.display = 'none';
}

// Başarı mesajı göster
function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
}

// Loading göster/gizle
function showLoading(show = true) {
    const loading = document.getElementById('loading');
    const forms = document.querySelectorAll('.auth-form');
    
    if (show) {
        loading.style.display = 'block';
        forms.forEach(form => form.style.display = 'none');
    } else {
        loading.style.display = 'none';
        forms.forEach(form => {
            if (form.classList.contains('active')) {
                form.style.display = 'block';
            }
        });
    }
}

// Giriş işlemi
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showError('Lütfen tüm alanları doldurun');
        return;
    }
    
    showLoading(true);
    hideMessages();
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Token'ı localStorage'a kaydet
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userInfo', JSON.stringify(data.user));
            localStorage.setItem('tokenExpires', data.expiresAt);
            
            showSuccess('Giriş başarılı! Yönlendiriliyorsunuz...');
            
            // 1 saniye sonra ana sayfaya yönlendir
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } else {
            showError(data.error || 'Giriş başarısız');
        }
        
    } catch (error) {
        console.error('Giriş hatası:', error);
        showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
        showLoading(false);
    }
}

// Kayıt işlemi
async function handleRegister(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    const inviteCode = document.getElementById('register-invite-code').value.trim();
    
    // Validasyon
    if (!fullName || !username || !password || !passwordConfirm) {
        showError('Lütfen tüm zorunlu alanları doldurun');
        return;
    }
    
    if (password !== passwordConfirm) {
        showError('Şifreler eşleşmiyor');
        return;
    }
    
    if (password.length < 6) {
        showError('Şifre en az 6 karakter olmalı');
        return;
    }
    
    // Davet kodu varsa doğrula
    if (inviteCode) {
        const isValidInvite = await validateInviteCode(inviteCode);
        if (!isValidInvite) {
            return; // Hata mesajı validateInviteCode içinde gösterilir
        }
    }
    
    showLoading(true);
    hideMessages();
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName,
                username,
                password,
                inviteCode: inviteCode || undefined
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccess('Kayıt başarılı! Giriş formuna yönlendiriliyorsunuz...');
            
            // Formu temizle ve giriş formuna geç
            document.getElementById('register-form').reset();
            setTimeout(() => {
                // Manuel olarak form değiştir - CSS display ile zorla
                const loginForm = document.getElementById('login-form');
                const registerForm = document.getElementById('register-form');
                
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
                
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
                
                // Tab'ları değiştir
                document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.auth-tab')[0].classList.add('active');
                
                // Kullanıcı adını doldur
                document.getElementById('login-username').value = username;
                document.getElementById('login-password').focus();
                
                console.log('Form geçişi tamamlandı'); // Debug için
            }, 1000);
            
        } else {
            showError(data.error || 'Kayıt başarısız');
        }
        
    } catch (error) {
        console.error('Kayıt hatası:', error);
        showError('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
        showLoading(false);
    }
}

// Davet kodu doğrulama
async function validateInviteCode(inviteCode) {
    try {
        const response = await fetch(`/api/organization/invite-code/${inviteCode}/validate`);
        const data = await response.json();
        
        if (response.ok && data.valid) {
            showSuccess(`${data.organization.name} organizasyonuna katılacaksınız.`);
            return true;
        } else {
            showError(data.error || 'Geçersiz davet kodu');
            return false;
        }
    } catch (error) {
        console.error('Davet kodu doğrulama hatası:', error);
        showError('Davet kodu doğrulanamadı');
        return false;
    }
}

// Token doğrulama
async function verifyToken(token) {
    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Token geçerli, ana sayfaya yönlendir
                window.location.href = '/';
                return;
            }
        }
        
        // Token geçersiz, temizle
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpires');
        
    } catch (error) {
        console.error('Token doğrulama hatası:', error);
        // Token doğrulanamadı, temizle
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpires');
    }
}

// Davet kodu input'una event listener ekle
document.addEventListener('DOMContentLoaded', function() {
    const inviteCodeInput = document.getElementById('register-invite-code');
    let validateTimeout;
    
    if (inviteCodeInput) {
        inviteCodeInput.addEventListener('input', function() {
            const code = this.value.trim();
            
            // Önceki timeout'u temizle
            clearTimeout(validateTimeout);
            
            if (code.length >= 6) {
                // 500ms bekle, sonra doğrula
                validateTimeout = setTimeout(() => {
                    validateInviteCode(code);
                }, 500);
            } else {
                hideMessages();
            }
        });
    }
    
    // Tab butonlarına event listener ekle
    const tabButtons = document.querySelectorAll('.auth-tab');
    tabButtons.forEach((button, index) => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            if (index === 0) {
                showAuthForm('login');
            } else {
                showAuthForm('register');
            }
        });
    });
});