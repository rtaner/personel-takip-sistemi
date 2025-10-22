// Global değişkenler
let currentPersonelId = null;
let currentPersonelName = null;
let isRecording = false;
let recognition = null;
let authToken = null;
let userInfo = null;

document.addEventListener('DOMContentLoaded', function () {
    // Auth kontrolü yap
    if (!checkAuth()) {
        return; // Auth başarısızsa fonksiyondan çık
    }

    loadPersonel();
    setupSpeechRecognition();
    setupUserInterface();
});

// Auth kontrolü
function checkAuth() {
    authToken = localStorage.getItem('authToken');
    const userInfoStr = localStorage.getItem('userInfo');
    const tokenExpires = localStorage.getItem('tokenExpires');

    // Token yoksa auth sayfasına yönlendir
    if (!authToken) {
        window.location.href = '/auth.html';
        return false;
    }

    // Token süresi dolmuşsa auth sayfasına yönlendir
    if (tokenExpires && new Date(tokenExpires) < new Date()) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpires');
        window.location.href = '/auth.html';
        return false;
    }

    // Kullanıcı bilgilerini parse et
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
async function setupUserInterface() {
    // Header'a kullanıcı bilgilerini ekle
    const header = document.querySelector('header');
    if (header) {
        // Organizasyon adını al
        let organizationName = 'Organizasyon';
        try {
            if (['organizasyon_sahibi', 'yonetici'].includes(userInfo.role)) {
                const response = await fetch('/api/organization/stats', {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    const data = await response.json();
                    organizationName = data.organization.name;
                }
            }
        } catch (error) {
            console.error('Organizasyon adı alınamadı:', error);
        }

        // Header içeriğini güncelle
        const headerContent = header.querySelector('.header-content');
        if (headerContent) {
            const orgInfo = headerContent.querySelector('p');
            if (orgInfo) {
                orgInfo.textContent = organizationName;
            }
        }

        // Mevcut kullanıcı bilgisi varsa güncelle, yoksa ekle
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
                <button class="btn btn-secondary btn-sm" onclick="showUserMenu(event)">
                    <i class="fas fa-user-cog"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Çıkış
                </button>
            </div>
        `;
    }
}

// Rol görünen adını getir
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
    try {
        // Sunucuya logout isteği gönder
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
    } catch (error) {
        console.error('Logout hatası:', error);
    } finally {
        // Local storage'ı temizle
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpires');

        // Auth sayfasına yönlendir
        window.location.href = '/auth.html';
    }
}

// API istekleri için auth header ekle
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}



// Personel yükleme
async function loadPersonel() {
    try {
        const response = await fetch('/api/personel', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Personel listesi alınamadı');
        }

        const personel = await response.json();

        const container = document.getElementById('personel-list');
        if (!container) {
            console.error('Personel listesi container bulunamadı');
            return;
        }

        container.innerHTML = '';

        if (personel.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Henüz personel bulunmuyor.</p>';
            return;
        }

        personel.forEach(p => {
            const card = document.createElement('div');
            card.className = 'personel-card';
            card.innerHTML = `
                <div class="card-content" onclick="showPersonelDetail(${p.id}, '${p.ad} ${p.soyad}')">
                    <h3>${p.ad} ${p.soyad}</h3>
                    <span class="pozisyon">${p.pozisyon || 'Personel'}</span>
                </div>
                <div class="card-menu">
                    <button class="menu-trigger" onclick="toggleCardMenu(event, ${p.id})">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="menu-dropdown" id="menu-${p.id}">
                        <button class="menu-item edit" onclick="editPersonel(${p.id}, '${p.ad}', '${p.soyad}', '${p.pozisyon || ''}')">
                            <i class="fas fa-edit"></i> Düzenle
                        </button>
                        <button class="menu-item delete" onclick="deletePersonel(${p.id}, '${p.ad} ${p.soyad}')">
                            <i class="fas fa-trash"></i> Sil
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Personel yüklenirken hata:', error);
        const container = document.getElementById('personel-list');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #f44336; padding: 20px;">Personel listesi yüklenirken hata oluştu.</p>';
        }
    }
}

// Personel detayını göster
function showPersonelDetail(personelId, personelName) {
    currentPersonelId = personelId;
    currentPersonelName = personelName;

    // Detay sekmesini göster
    document.getElementById('detay-tab-btn').style.display = 'block';
    document.getElementById('personel-detay-baslik').textContent = personelName + ' - Detaylar';

    // Son analiz verisini temizle (yeni personel seçildi)
    window.lastHRAnalysis = null;

    // Detay sekmesine geç
    showTab('detay');

    // Aktiviteleri yükle
    loadActivities(personelId);
}

// Form göster/gizle fonksiyonları
function showNoteForm() {
    document.getElementById('note-form').style.display = 'block';
    document.getElementById('task-form').style.display = 'none';
}

function hideNoteForm() {
    document.getElementById('note-form').style.display = 'none';
    document.getElementById('not-metni').value = '';
}

function showTaskForm() {
    document.getElementById('task-form').style.display = 'block';
    document.getElementById('note-form').style.display = 'none';

    // Form başlığını güncelle
    const formTitle = document.getElementById('task-form-title');
    if (formTitle) {
        formTitle.textContent = `${currentPersonelName} - Yeni Görev Ata`;
    }
}

function hideTaskForm() {
    document.getElementById('task-form').style.display = 'none';
    document.getElementById('task-form').querySelector('form').reset();
}

// Personel formu göster/gizle
function showPersonelForm() {
    document.getElementById('personel-form').style.display = 'block';
}

function hidePersonelForm() {
    document.getElementById('personel-form').style.display = 'none';
    document.getElementById('personel-form').querySelector('form').reset();
}

// Yeni personel ekleme
async function addPersonel(event) {
    event.preventDefault();

    const formData = {
        ad: document.getElementById('ad').value,
        soyad: document.getElementById('soyad').value,
        pozisyon: document.getElementById('pozisyon').value
    };

    try {
        const response = await fetch('/api/personel', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            alert('Personel başarıyla eklendi!');
            hidePersonelForm();
            loadPersonel();
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Personel eklenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Aktiviteleri yükleme (notlar ve görevler birlikte)
async function loadActivities(personelId) {
    try {
        // Notları ve görevleri paralel olarak yükle
        const [notesResponse, tasksResponse] = await Promise.all([
            fetch(`/api/personel/${personelId}/notlar`, {
                headers: getAuthHeaders()
            }),
            fetch(`/api/personel/${personelId}/gorevler`, {
                headers: getAuthHeaders()
            })
        ]);

        const notes = await notesResponse.json();
        const tasks = await tasksResponse.json();

        // Veri tiplerini kontrol et
        const notesArray = Array.isArray(notes) ? notes : [];
        const tasksArray = Array.isArray(tasks) ? tasks : [];

        // Tüm aktiviteleri birleştir ve tarihe göre sırala
        const activities = [];

        // Notları ekle
        notesArray.forEach(note => {
            activities.push({
                type: 'note',
                date: note.tarih,
                content: note.not_metni,
                noteType: note.kategori, // artık olumlu/olumsuz olacak
                id: note.id,
                createdBy: note.users?.full_name || note.users?.username || note.created_by_name || note.full_name || note.username || 'Bilinmeyen'
            });
        });

        // Görevleri ekle
        tasksArray.forEach(task => {
            activities.push({
                type: 'task',
                date: task.created_at,
                content: task.gorev_baslik,
                description: task.gorev_aciklama,
                status: task.durum,
                performance: task.performans_puani,
                id: task.id,
                endDate: task.bitis_tarihi
            });
        });

        // Tarihe göre sırala (en yeni en üstte)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Listeyi oluştur
        const container = document.getElementById('activities-list');
        container.innerHTML = '';

        if (activities.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Henüz aktivite bulunmuyor.</p>';
            return;
        }

        activities.forEach(activity => {
            const activityDiv = document.createElement('div');

            if (activity.type === 'note') {
                const noteClass = activity.noteType === 'olumlu' ? 'note-olumlu' : 'note-olumsuz';
                activityDiv.className = `activity-item ${noteClass}`;

                // Not oluşturan kişi bilgisi
                const createdByInfo = (['organizasyon_sahibi', 'yonetici'].includes(userInfo.role) && activity.createdBy)
                    ? `<span class="note-author">👤 ${activity.createdBy}</span>`
                    : '';

                activityDiv.innerHTML = `
                    <div class="activity-header">
                        <span class="activity-type note">Not</span>
                        <div class="activity-actions">
                            <span class="note-type-badge note-type-${activity.noteType}">${activity.noteType === 'olumlu' ? 'Olumlu' : 'Olumsuz'}</span>
                            ${createdByInfo}
                            <span class="activity-date">${formatDateTime(activity.date)}</span>
                            <div class="activity-menu">
                                <button class="menu-trigger" onclick="toggleActivityMenu(event, 'note-${activity.id}')">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div class="menu-dropdown" id="menu-note-${activity.id}">
                                    <button class="menu-item edit" onclick="editNote(${activity.id}, '${activity.content.replace(/'/g, "\\'")}', '${activity.noteType}')">
                                        <i class="fas fa-edit"></i> Düzenle
                                    </button>
                                    <button class="menu-item delete" onclick="deleteNote(${activity.id})">
                                        <i class="fas fa-trash"></i> Sil
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p>${activity.content}</p>
                `;
            } else {
                // Görev için renk belirleme
                let taskClass = 'task-olumlu';
                if (activity.status === 'tamamlandi' && activity.performance && activity.performance < 3) {
                    taskClass = 'task-olumsuz';
                }

                activityDiv.className = `activity-item ${taskClass}`;

                // Puanlanmış görev için özel görünüm
                if (activity.status === 'tamamlandi' && activity.performance) {
                    activityDiv.innerHTML = `
                        <div class="activity-header">
                            <span class="activity-type task">Görev Tamamlandı</span>
                            <div class="activity-actions">
                                <span class="activity-date">${formatDateTime(activity.date)}</span>
                                <div class="activity-menu">
                                    <button class="menu-trigger" onclick="toggleActivityMenu(event, 'task-${activity.id}')">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div class="menu-dropdown" id="menu-task-${activity.id}">
                                        <button class="menu-item edit" onclick="editTask(${activity.id}, '${activity.content.replace(/'/g, "\\'")}', '${activity.description ? activity.description.replace(/'/g, "\\'") : ''}', '${activity.endDate || ''}', ${activity.performance})">
                                            <i class="fas fa-edit"></i> Düzenle
                                        </button>
                                        <button class="menu-item delete" onclick="deleteTask(${activity.id})">
                                            <i class="fas fa-trash"></i> Sil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h4>${activity.content}</h4>
                        ${activity.description ? `<p>${activity.description}</p>` : ''}
                        ${activity.endDate ? `<p><strong>Bitiş Tarihi:</strong> ${formatDate(activity.endDate)}</p>` : ''}
                        <div class="performance-section">
                            <div class="performance-stars-display">
                                <span class="performance-label">Performans:</span>
                                <span class="performance-stars">${getStarRating(activity.performance)}</span>
                                <span class="performance-text">${activity.performance}/5 ${activity.performance >= 3 ? '(Başarılı)' : '(Geliştirilmeli)'}</span>
                            </div>
                        </div>
                    `;
                } else {
                    activityDiv.innerHTML = `
                        <div class="activity-header">
                            <span class="activity-type task">Görev</span>
                            <div class="activity-actions">
                                <span class="task-status status-${activity.status.replace(' ', '-')}">${getStatusName(activity.status)}</span>
                                <span class="activity-date">${formatDateTime(activity.date)}</span>
                                <div class="activity-menu">
                                    <button class="menu-trigger" onclick="toggleActivityMenu(event, 'task-${activity.id}')">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    <div class="menu-dropdown" id="menu-task-${activity.id}">
                                        <button class="menu-item edit" onclick="editTask(${activity.id}, '${activity.content.replace(/'/g, "\\'")}', '${activity.description ? activity.description.replace(/'/g, "\\'") : ''}', '${activity.endDate || ''}', ${activity.performance || 0})">
                                            <i class="fas fa-edit"></i> Düzenle
                                        </button>
                                        <button class="menu-item delete" onclick="deleteTask(${activity.id})">
                                            <i class="fas fa-trash"></i> Sil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <h4>${activity.content}</h4>
                        ${activity.description ? `<p>${activity.description}</p>` : ''}
                        ${activity.endDate ? `<p><strong>Bitiş Tarihi:</strong> ${formatDate(activity.endDate)}</p>` : ''}
                        
                        <div class="task-actions" style="margin-top: 15px;">
                            <select onchange="updateTaskStatus(${activity.id}, this.value)" style="margin-right: 10px;">
                                <option value="beklemede" ${activity.status === 'beklemede' ? 'selected' : ''}>Beklemede</option>
                                <option value="devam-ediyor" ${activity.status === 'devam-ediyor' ? 'selected' : ''}>Devam Ediyor</option>
                                <option value="tamamlandi" ${activity.status === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                            </select>
                            
                            ${activity.status === 'tamamlandi' ? `
                                <div class="star-rating">
                                    <div class="star-rating-row">
                                        <span>Performans Değerlendirmesi:</span>
                                    </div>
                                    <div class="stars">
                                        ${[1, 2, 3, 4, 5].map(i => `
                                            <span class="star ${activity.performance >= i ? 'filled' : ''}"
                                                   onclick="updatePerformance(${activity.id}, ${i})">★</span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
            }

            container.appendChild(activityDiv);
        });

    } catch (error) {
        console.error('Aktiviteler yüklenirken hata:', error);
    }
}

// Yardımcı fonksiyonlar
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
}

function getStatusName(status) {
    const statusNames = {
        'beklemede': 'Beklemede',
        'devam-ediyor': 'Devam Ediyor',
        'tamamlandi': 'Tamamlandı'
    };
    return statusNames[status] || status;
}

// Yeni not ekleme (tip ile birlikte)
async function addNoteWithType(noteType) {
    const notMetni = document.getElementById('not-metni').value.trim();
    if (!notMetni) {
        alert('Lütfen not metnini girin!');
        return;
    }

    const notData = {
        personel_id: currentPersonelId,
        not_metni: notMetni,
        kategori: noteType // olumlu veya olumsuz
    };

    try {
        const response = await fetch('/api/notlar', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(notData)
        });

        const result = await response.json();

        if (response.ok) {
            hideNoteForm();
            loadActivities(currentPersonelId);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Not eklenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Yeni görev ekleme
async function addTask(event) {
    event.preventDefault();

    const gorevData = {
        personel_id: currentPersonelId,
        gorev_baslik: document.getElementById('gorev-baslik').value,
        gorev_aciklama: document.getElementById('gorev-aciklama').value,
        bitis_tarihi: document.getElementById('bitis-tarihi').value
    };

    try {
        const response = await fetch('/api/gorevler', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(gorevData)
        });

        const result = await response.json();

        if (response.ok) {
            hideTaskForm();
            loadActivities(currentPersonelId);
            alert(`Görev ${currentPersonelName}'e başarıyla atandı!`);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev eklenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Sesli not alma için placeholder fonksiyon
function setupSpeechRecognition() {
    // Tarayıcı desteği kontrolü
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.log('Tarayıcı ses tanımayı desteklemiyor');
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.style.display = 'none';
        }
        return;
    }

    // Ses tanıma nesnesini oluştur
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    // Ayarlar
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'tr-TR'; // Türkçe
    recognition.maxAlternatives = 1;

    // Ses tanıma başladığında
    recognition.onstart = function () {
        isRecording = true;
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i> Dur';
            voiceBtn.classList.add('recording');
        }

        // Kullanıcıya bilgi ver
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = 'Dinleniyor... Konuşun';
            voiceStatus.style.color = '#28a745';
        }

        console.log('Ses tanıma başladı...');
    };

    // Sonuç geldiğinde
    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        console.log('Tanınan metin:', transcript);

        // Not textarea'sını bul
        const noteTextarea = document.getElementById('not-metni');
        console.log('Textarea bulundu mu?', !!noteTextarea);
        console.log('Mevcut textarea değeri:', noteTextarea?.value);

        if (noteTextarea) {
            const currentText = noteTextarea.value;
            const newText = currentText + (currentText ? ' ' : '') + transcript;
            noteTextarea.value = newText;

            console.log('Yeni metin:', newText);

            // Kullanıcıya geri bildirim ver
            showNotification('Ses metne çevrildi: ' + transcript, 'success');
        } else {
            console.error('Not textarea bulunamadı - ID: not-metni');
            // Tüm textarea'ları listele
            const allTextareas = document.querySelectorAll('textarea');
            console.log('Sayfadaki tüm textarea\'lar:', allTextareas);
        }
    };

    // Hata durumunda
    recognition.onerror = function (event) {
        console.error('Ses tanıma hatası:', event.error);
        isRecording = false;
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Sesli Not';
            voiceBtn.classList.remove('recording');
        }

        // Hata mesajını göster
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = 'Hata: ' + event.error;
            voiceStatus.style.color = '#dc3545';
        }

        showNotification('Ses tanıma hatası: ' + event.error, 'error');
    };

    // Ses tanıma bittiğinde
    recognition.onend = function () {
        isRecording = false;
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Sesli Not';
            voiceBtn.classList.remove('recording');
        }

        // Status temizle
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = '';
        }

        console.log('Ses tanıma bitti');
    };
}

// Placeholder fonksiyonlar
function toggleCardMenu(event, personelId) {
    event.stopPropagation();
    // Menu toggle logic
}

function editPersonel(id, ad, soyad, pozisyon) {
    // Edit personel logic
}

function deletePersonel(id, name) {
    // Delete personel logic
}

function toggleVoiceRecording() {
    if (!recognition) {
        showNotification('Ses tanıma desteklenmiyor', 'error');
        return;
    }

    if (isRecording) {
        // Kaydı durdur
        recognition.stop();
    } else {
        // Kaydı başlat
        try {
            recognition.start();
        } catch (error) {
            console.error('Ses tanıma başlatılamadı:', error);
            showNotification('Ses tanıma başlatılamadı', 'error');
        }
    }
}

function showUserMenu(event) {
    // User menu logic
}

// Kart menüsünü aç/kapat
function toggleCardMenu(event, personelId) {
    event.stopPropagation();

    // Diğer açık menüleri kapat
    document.querySelectorAll('.menu-dropdown').forEach(menu => {
        if (menu.id !== `menu-${personelId}`) {
            menu.style.display = 'none';
        }
    });

    const menu = document.getElementById(`menu-${personelId}`);
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }

    // Dışarı tıklandığında menüyü kapat
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        });
    }, 100);
}

// Personel düzenleme
function editPersonel(id, ad, soyad, pozisyon) {
    // Düzenleme formunu göster
    const form = document.getElementById('personel-form');
    const formTitle = form.querySelector('h3');

    // Form başlığını değiştir
    formTitle.textContent = 'Personel Düzenle';

    // Form alanlarını doldur
    document.getElementById('ad').value = ad;
    document.getElementById('soyad').value = soyad;
    document.getElementById('pozisyon').value = pozisyon;

    // Form submit fonksiyonunu değiştir
    const formElement = form.querySelector('form');
    formElement.onsubmit = function (event) {
        updatePersonel(event, id);
    };

    // Formu göster
    showPersonelForm();
}

// Personel güncelleme
async function updatePersonel(event, personelId) {
    event.preventDefault();

    const formData = {
        ad: document.getElementById('ad').value,
        soyad: document.getElementById('soyad').value,
        pozisyon: document.getElementById('pozisyon').value
    };

    try {
        const response = await fetch(`/api/personel/${personelId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            alert('Personel başarıyla güncellendi!');
            hidePersonelForm();
            loadPersonel();

            // Eğer güncellenen personelin detay sayfasındaysak başlığı güncelle
            if (currentPersonelId == personelId) {
                const newName = `${formData.ad} ${formData.soyad}`;
                currentPersonelName = newName;
                document.getElementById('personel-detay-baslik').textContent = newName + ' - Detaylar';
            }
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Personel güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Personel silme
function deletePersonel(id, name) {
    if (confirm(`${name} adlı personeli silmek istediğinizden emin misiniz?`)) {
        performDeletePersonel(id);
    }
}

// Personel silme işlemi
async function performDeletePersonel(personelId) {
    try {
        const response = await fetch(`/api/personel/${personelId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            alert('Personel başarıyla silindi!');
            loadPersonel();

            // Eğer silinen personelin detay sayfasındaysak ana sayfaya dön
            if (currentPersonelId == personelId) {
                showTab('personel');
                document.getElementById('detay-tab-btn').style.display = 'none';
                currentPersonelId = null;
                currentPersonelName = null;
            }
        } else {
            const result = await response.json();
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Personel silinirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Form iptal edildiğinde orijinal fonksiyonu geri yükle
function hidePersonelForm() {
    document.getElementById('personel-form').style.display = 'none';

    // Form başlığını sıfırla
    const form = document.getElementById('personel-form');
    const formTitle = form.querySelector('h3');
    formTitle.textContent = 'Yeni Personel Ekle';

    // Form alanlarını temizle
    document.getElementById('personel-form').querySelector('form').reset();

    // Form submit fonksiyonunu orijinal haline getir
    const formElement = form.querySelector('form');
    formElement.onsubmit = addPersonel;
}

// Aktivite menüsünü aç/kapat
function toggleActivityMenu(event, menuId) {
    event.stopPropagation();

    // Diğer açık menüleri kapat
    document.querySelectorAll('.menu-dropdown').forEach(menu => {
        if (menu.id !== `menu-${menuId}`) {
            menu.style.display = 'none';
        }
    });

    const menu = document.getElementById(`menu-${menuId}`);
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }

    // Dışarı tıklandığında menüyü kapat
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        });
    }, 100);
}

// Yıldız rating'i string olarak döndür
function getStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? '⭐' : '☆';
    }
    return stars;
}

// Not düzenleme
function editNote(noteId, content, noteType) {
    // Modal oluştur
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Not Düzenle</h3>
            <textarea id="edit-note-text" rows="4" style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; margin-bottom: 20px;">${content}</textarea>
            <div class="note-edit-buttons">
                <button class="btn btn-success" onclick="saveNoteEdit(${noteId}, 'olumlu')">
                    <i class="fas fa-thumbs-up"></i> Olumlu Not Kaydet
                </button>
                <button class="btn btn-danger" onclick="saveNoteEdit(${noteId}, 'olumsuz')">
                    <i class="fas fa-thumbs-down"></i> Olumsuz Not Kaydet
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">İptal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Not düzenlemeyi kaydet
async function saveNoteEdit(noteId, noteType) {
    const newContent = document.getElementById('edit-note-text').value.trim();
    if (!newContent) {
        alert('Lütfen not metnini girin!');
        return;
    }

    try {
        const response = await fetch(`/api/notlar/${noteId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                not_metni: newContent,
                kategori: noteType
            })
        });

        if (response.ok) {
            closeModal();
            loadActivities(currentPersonelId);
        } else {
            const result = await response.json();
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Not güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Not silme
async function deleteNote(noteId) {
    if (confirm('Bu notu silmek istediğinizden emin misiniz?')) {
        try {
            const response = await fetch(`/api/notlar/${noteId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                loadActivities(currentPersonelId);
            } else {
                const result = await response.json();
                alert('Hata: ' + result.error);
            }
        } catch (error) {
            console.error('Not silinirken hata:', error);
            alert('Bir hata oluştu!');
        }
    }
}

// Görev düzenleme
function editTask(taskId, title, description, endDate, performance) {
    // Modal oluştur
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content task-modal">
            <h3>Görev Düzenle</h3>
            <div class="form-group">
                <label>Görev Başlığı:</label>
                <input type="text" id="edit-task-title" value="${title}">
            </div>
            <div class="form-group">
                <label>Görev Açıklaması:</label>
                <textarea id="edit-task-description" rows="3">${description}</textarea>
            </div>
            <div class="form-group">
                <label>Bitiş Tarihi:</label>
                <input type="date" id="edit-task-enddate" value="${endDate}">
            </div>
            ${performance > 0 ? `
                <div class="form-group">
                    <label>Performans Puanı:</label>
                    <div class="star-edit-section">
                        <div class="stars-edit">
                            ${[1, 2, 3, 4, 5].map(i => `
                                <span class="star-edit ${performance >= i ? 'filled' : ''}" 
                                      onclick="setEditStarRating(${i})" data-rating="${i}">★</span>
                            `).join('')}
                        </div>
                        <span id="star-rating-text">${performance}/5</span>
                    </div>
                </div>
            ` : ''}
            <div class="task-edit-buttons">
                <button class="btn btn-success" onclick="saveTaskEdit(${taskId})">Kaydet</button>
                <button class="btn btn-secondary" onclick="closeModal()">İptal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Görev düzenleme yıldız rating
function setEditStarRating(rating) {
    document.querySelectorAll('.star-edit').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('filled');
        } else {
            star.classList.remove('filled');
        }
    });
    document.getElementById('star-rating-text').textContent = rating + '/5';
}

// Görev düzenlemeyi kaydet
async function saveTaskEdit(taskId) {
    const title = document.getElementById('edit-task-title').value.trim();
    const description = document.getElementById('edit-task-description').value.trim();
    const endDate = document.getElementById('edit-task-enddate').value;

    if (!title) {
        alert('Lütfen görev başlığını girin!');
        return;
    }

    const updateData = {
        gorev_baslik: title,
        gorev_aciklama: description,
        bitis_tarihi: endDate
    };

    // Performans puanı varsa ekle
    const starRatingText = document.getElementById('star-rating-text');
    if (starRatingText) {
        const rating = parseInt(starRatingText.textContent.split('/')[0]);
        updateData.performans_puani = rating;
    }

    try {
        const response = await fetch(`/api/gorevler/${taskId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            closeModal();
            loadActivities(currentPersonelId);
        } else {
            const result = await response.json();
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Görev silme
async function deleteTask(taskId) {
    if (confirm('Bu görevi silmek istediğinizden emin misiniz?')) {
        try {
            const response = await fetch(`/api/gorevler/${taskId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                loadActivities(currentPersonelId);
            } else {
                const result = await response.json();
                alert('Hata: ' + result.error);
            }
        } catch (error) {
            console.error('Görev silinirken hata:', error);
            alert('Bir hata oluştu!');
        }
    }
}

// Modal kapatma
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Görev durumu güncelleme
async function updateTaskStatus(gorevId, durum) {
    try {
        const response = await fetch(`/api/gorevler/${gorevId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ durum })
        });

        if (response.ok) {
            loadActivities(currentPersonelId);
        } else {
            const result = await response.json();
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev durumu güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Performans puanı güncelleme
async function updatePerformance(gorevId, puan) {
    try {
        const response = await fetch(`/api/gorevler/${gorevId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                performans_puani: puan,
                durum: 'tamamlandi' // Durumu da koruyalım
            })
        });

        if (response.ok) {
            loadActivities(currentPersonelId);
        } else {
            const result = await response.json();
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Performans puanı güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Sekme değiştirme
function showTab(tabName) {
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
    event.target.classList.add('active');

    // Sekme özel yükleme işlemleri
    if (tabName === 'my-work') {
        loadMyWork();
    } else if (tabName === 'dashboard') {
        // Dashboard açıldığında ana menüyü göster
        returnToDashboardMain();
    } else if (tabName === 'analysis') {
        loadPersonelForAnalysis();
    }
}

// İşlerim sekmesi içeriğini yükle
async function loadMyWork() {
    const container = document.getElementById('my-work-content');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Görevleriniz yükleniyor...</div>';

    try {
        // Kullanıcının görevlerini getir
        const response = await fetch('/api/my-tasks', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Görevler yüklenemedi');
        }

        const tasks = await response.json();
        const tasksArray = Array.isArray(tasks) ? tasks : [];

        container.innerHTML = '';

        if (tasksArray.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-briefcase"></i>
                    <p>Henüz size atanmış görev bulunmuyor.</p>
                </div>
            `;
            return;
        }

        // Görevleri duruma göre grupla
        const tasksByStatus = {
            'beklemede': [],
            'devam-ediyor': [],
            'tamamlandi': []
        };

        tasksArray.forEach(task => {
            tasksByStatus[task.durum].push(task);
        });

        // Her durum için bölüm oluştur
        Object.keys(tasksByStatus).forEach(status => {
            if (tasksByStatus[status].length > 0) {
                const section = document.createElement('div');
                section.className = 'task-section';

                const statusName = getStatusName(status);
                section.innerHTML = `
                    <h3 class="section-title">
                        <i class="fas fa-tasks"></i> ${statusName} (${tasksByStatus[status].length})
                    </h3>
                    <div class="tasks-grid" id="tasks-${status}"></div>
                `;

                container.appendChild(section);

                const tasksGrid = document.getElementById(`tasks-${status}`);

                tasksByStatus[status].forEach(task => {
                    const taskCard = document.createElement('div');
                    taskCard.className = `task-card status-${status}`;

                    const isOverdue = task.bitis_tarihi && new Date(task.bitis_tarihi) < new Date() && status !== 'tamamlandi';
                    if (isOverdue) {
                        taskCard.classList.add('overdue');
                    }

                    taskCard.innerHTML = `
                        <div class="task-header">
                            <h4>${task.gorev_baslik}</h4>
                            <span class="task-status status-${status}">${statusName}</span>
                        </div>
                        ${task.gorev_aciklama ? `<p class="task-description">${task.gorev_aciklama}</p>` : ''}
                        <div class="task-meta">
                            <div class="task-dates">
                                <span><i class="fas fa-calendar-plus"></i> Atanma: ${formatDate(task.atanma_tarihi)}</span>
                                ${task.bitis_tarihi ? `<span><i class="fas fa-calendar-check"></i> Bitiş: ${formatDate(task.bitis_tarihi)} ${isOverdue ? '<span class="overdue-badge">Gecikmiş</span>' : ''}</span>` : ''}
                            </div>
                            ${task.performans_puani ? `
                                <div class="task-performance">
                                    <span class="performance-label">Performans:</span>
                                    <span class="performance-stars">${getStarRating(task.performans_puani)}</span>
                                    <span class="performance-text">${task.performans_puani}/5</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="task-actions">
                            <select onchange="updateMyTaskStatus(${task.id}, this.value)" class="task-status-select">
                                <option value="beklemede" ${task.durum === 'beklemede' ? 'selected' : ''}>Beklemede</option>
                                <option value="devam-ediyor" ${task.durum === 'devam-ediyor' ? 'selected' : ''}>Devam Ediyor</option>
                                <option value="tamamlandi" ${task.durum === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                            </select>
                        </div>
                    `;

                    tasksGrid.appendChild(taskCard);
                });
            }
        });

    } catch (error) {
        console.error('İşlerim yüklenirken hata:', error);
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Görevler yüklenirken hata oluştu.</p>
                <button class="btn btn-primary" onclick="loadMyWork()">Tekrar Dene</button>
            </div>
        `;
    }
}

// Kendi görev durumunu güncelle
async function updateMyTaskStatus(taskId, newStatus) {
    try {
        const response = await fetch(`/api/gorevler/${taskId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ durum: newStatus })
        });

        if (response.ok) {
            loadMyWork(); // Sayfayı yenile
        } else {
            const result = await response.json();
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev durumu güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Dashboard widget'larını yükle (placeholder)
function loadDashboardWidgets() {
    // Dashboard yükleme mantığı buraya eklenecek
    console.log('Dashboard yükleniyor...');
}

// İK Uzmanı Analizi Oluştur
async function generateHRAnalysis() {
    if (!currentPersonelId || !currentPersonelName) {
        alert('Lütfen önce bir personel seçin');
        return;
    }

    if (!confirm(`${currentPersonelName} için İK uzmanı seviyesinde kapsamlı analiz yapılsın?\n\nBu analiz:\n• Tüm notları değerlendirir\n• Risk seviyesi belirler\n• Somut eylem planları önerir\n• Mağaza müdürü için tavsiyelerde bulunur\n\nİşlem 10-30 saniye sürebilir.`)) {
        return;
    }

    // Butonu devre dışı bırak
    const button = event.target;
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İK Analizi Yapılıyor...';

    try {
        const response = await fetch(`/api/personel/${currentPersonelId}/hr-analysis`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // İK analiz sonucunu göster
            showHRAnalysisModal(result);

            // Son analiz verisini sakla
            window.lastHRAnalysis = result;

        } else {
            alert(`⚠ İK analizi hatası: ${result.error || 'Bilinmeyen hata'}`);
        }

    } catch (error) {
        console.error('İK analizi hatası:', error);
        alert('⚠ İK analizi sırasında hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        // Butonu tekrar aktif et
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Son İK Analizini Görüntüle
async function showLastHRAnalysis() {
    if (!currentPersonelId) {
        alert('Lütfen önce bir personel seçin.');
        return;
    }

    // Önce bellekteki veriyi kontrol et
    if (window.lastHRAnalysis) {
        showHRAnalysisModal(window.lastHRAnalysis);
        return;
    }

    // Bellekte yoksa server'dan son raporu getir
    try {
        const response = await fetch(`/api/personel/${currentPersonelId}/last-hr-analysis`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (response.ok && result.success && result.analysis) {
            // Son analizi göster
            showHRAnalysisModal(result.analysis);
            // Bellekte sakla
            window.lastHRAnalysis = result.analysis;
        } else {
            alert('Bu personel için henüz İK analizi yapılmamış.\n\n"İK Uzmanı Analizi" butonuna tıklayarak yeni bir analiz oluşturun.');
        }
    } catch (error) {
        console.error('Son analiz getirme hatası:', error);
        alert('Son analiz getirilirken hata oluştu.');
    }
}

// İK Analiz Sonucunu Modal'da Göster
function showHRAnalysisModal(analysisResult) {
    // Debug: Frontend'e gelen veriyi logla
    console.log('🎨 Frontend - Gelen analiz verisi:', analysisResult);
    console.log('🎨 HR Analysis keys:', analysisResult.hr_analysis ? Object.keys(analysisResult.hr_analysis) : 'yok');
    console.log('🎨 Manager action plan var mı:', !!(analysisResult.hr_analysis && analysisResult.hr_analysis.manager_action_plan));
    console.log('🎨 Business impact var mı:', !!(analysisResult.hr_analysis && analysisResult.hr_analysis.business_impact));

    // Veri yapısını normalize et
    const personnel_info = analysisResult.personnel_info || {};
    const data_summary = analysisResult.data_summary || {
        total_notes: 0,
        positive_notes: 0,
        negative_notes: 0,
        performance_scores: 0
    };
    const hr_analysis = analysisResult.hr_analysis || {};
    const executive_summary = hr_analysis.executive_summary || {
        overall_risk_level: 'low',
        key_concerns: [],
        key_strengths: [],
        immediate_action_required: false
    };
    const manager_action_plan = hr_analysis.manager_action_plan || {
        immediate_actions: [],
        short_term_actions: [],
        long_term_actions: [],
        coaching_plan: [],
        monitoring_plan: {
            daily_checks: [],
            weekly_reviews: [],
            monthly_evaluation: []
        }
    };
    const competency_analysis = hr_analysis.competency_analysis || {};
    const behavioral_insights = hr_analysis.behavioral_insights || {
        patterns: [],
        recommendations: []
    };
    const business_impact = hr_analysis.business_impact || {
        current_impact: 'Değerlendirilmedi',
        potential_risks: [],
        cost_implications: 'Değerlendirilmedi',
        team_morale_effect: 'Değerlendirilmedi'
    };
    const follow_up_schedule = hr_analysis.follow_up_schedule || {
        next_review_date: 'Belirlenmedi',
        review_frequency: 'Belirlenmedi',
        success_indicators: []
    };
    const generated_at = analysisResult.generated_at;
    const generated_by = analysisResult.generated_by;

    // Debug: Normalize edilmiş verileri logla
    console.log('🎨 Manager action plan (normalize sonrası):', manager_action_plan);
    console.log('🎨 Business impact (normalize sonrası):', business_impact);

    // Modal HTML oluştur
    const modalHTML = `
        <div id="hr-analysis-modal" class="modal-overlay" onclick="closeHRAnalysisModal()">
            <div class="modal-content hr-analysis-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2><i class="fas fa-user-tie"></i> İK Uzmanı Analizi</h2>
                    <button class="modal-close" onclick="closeHRAnalysisModal()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <div class="analysis-section">
                        <h3><i class="fas fa-user"></i> Personel Bilgileri</h3>
                        <div class="info-grid">
                            <div><strong>Ad:</strong> ${personnel_info.name}</div>
                            <div><strong>Pozisyon:</strong> ${personnel_info.position}</div>
                            <div><strong>Organizasyon:</strong> ${personnel_info.organization}</div>
                        </div>
                        <div class="data-summary">
                            <span class="badge badge-info">${data_summary.total_notes} Toplam Not</span>
                            <span class="badge badge-success">${data_summary.positive_notes} Olumlu</span>
                            <span class="badge badge-danger">${data_summary.negative_notes} Olumsuz</span>
                            <span class="badge badge-secondary">${data_summary.performance_scores} Performans Puanı</span>
                        </div>
                    </div>

                    <div class="analysis-section">
                        <h3><i class="fas fa-exclamation-triangle"></i> Yönetici Özeti</h3>
                        <div class="risk-level risk-${executive_summary.overall_risk_level}">
                            <strong>Genel Risk Seviyesi:</strong> ${getRiskLevelText(executive_summary.overall_risk_level)}
                        </div>
                        <div class="concerns-strengths">
                            <div class="concerns">
                                <h4>Ana Endişeler:</h4>
                                <ul>
                                    ${(executive_summary.primary_concerns || executive_summary.key_concerns || []).map(concern => `<li>${concern}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="strengths">
                                <h4>Güçlü Yanlar:</h4>
                                <ul>
                                    ${(executive_summary.key_strengths || []).map(strength => `<li>${strength}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        ${executive_summary.immediate_action_required ?
            '<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> <strong>Acil Eylem Gerekli!</strong></div>' :
            '<div class="alert alert-success"><i class="fas fa-check-circle"></i> Rutin takip yeterli</div>'
        }
                    </div>

                    <div class="analysis-section">
                        <h3><i class="fas fa-tasks"></i> Mağaza Müdürü İçin Eylem Planı</h3>
                        
                        ${manager_action_plan.immediate_actions.length > 0 ? `
                        <div class="action-group">
                            <h4><i class="fas fa-bolt"></i> Acil Eylemler</h4>
                            ${(manager_action_plan.immediate_actions || []).map(action => `
                                <div class="action-item priority-${action.priority}">
                                    <div class="action-header">
                                        <strong>${action.action}</strong>
                                        <span class="priority-badge">${getPriorityText(action.priority)}</span>
                                    </div>
                                    <div class="action-details">
                                        <div><strong>Zaman:</strong> ${getTimelineText(action.timeline)}</div>
                                        <div><strong>Beklenen Sonuç:</strong> ${action.expected_outcome}</div>
                                        <div><strong>Kanıtlar:</strong> ${action.evidence.join(', ')}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}

                        ${(manager_action_plan.coaching_plan || []).length > 0 ? `
                        <div class="action-group">
                            <h4><i class="fas fa-chalkboard-teacher"></i> Koçluk Planı</h4>
                            ${(manager_action_plan.coaching_plan || []).map(coaching => `
                                <div class="coaching-item">
                                    <strong>${coaching.area}</strong> - ${coaching.method} (${coaching.duration})
                                    <div class="success-metrics">
                                        Başarı Ölçütleri: ${(coaching.success_metrics || []).join(', ')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}

                        <div class="action-group">
                            <h4><i class="fas fa-eye"></i> İzleme Planı</h4>
                            <div class="monitoring-grid">
                                <div>
                                    <strong>Günlük Kontroller:</strong>
                                    <ul>${((manager_action_plan.monitoring_plan || {}).daily_checks || []).map(check => `<li>${check}</li>`).join('')}</ul>
                                </div>
                                <div>
                                    <strong>Haftalık Gözden Geçirme:</strong>
                                    <ul>${((manager_action_plan.monitoring_plan || {}).weekly_reviews || []).map(review => `<li>${review}</li>`).join('')}</ul>
                                </div>
                                <div>
                                    <strong>Aylık Değerlendirme:</strong>
                                    <ul>${((manager_action_plan.monitoring_plan || {}).monthly_evaluation || []).map(eval => `<li>${eval}</li>`).join('')}</ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="analysis-section">
                        <h3><i class="fas fa-chart-line"></i> İş Etkisi</h3>
                        <div class="business-impact">
                            <div><strong>Mevcut Etki:</strong> ${business_impact.current_impact}</div>
                            <div><strong>Potansiyel Riskler:</strong> ${business_impact.potential_risks.join(', ')}</div>
                            <div><strong>Maliyet Etkileri:</strong> ${business_impact.cost_implications}</div>
                            <div><strong>Takım Morali:</strong> ${business_impact.team_morale_effect}</div>
                        </div>
                    </div>

                    <div class="analysis-section">
                        <h3><i class="fas fa-calendar-check"></i> Takip Programı</h3>
                        <div class="follow-up-info">
                            <div><strong>Sonraki İnceleme:</strong> ${follow_up_schedule.next_review_date}</div>
                            <div><strong>İnceleme Sıklığı:</strong> ${follow_up_schedule.review_frequency}</div>
                            <div><strong>Başarı Göstergeleri:</strong> ${follow_up_schedule.success_indicators.join(', ')}</div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="analysis-meta">
                        <small>Analiz Tarihi: ${new Date(generated_at).toLocaleString('tr-TR')} | Oluşturan: ${generated_by}</small>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-success" onclick="downloadHRAnalysisHTML()">
                            <i class="fas fa-download"></i> Raporu İndir
                        </button>
                        <button class="btn btn-secondary" onclick="closeHRAnalysisModal()">Kapat</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Modal'ı sayfaya ekle
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Modal'ı göster
    setTimeout(() => {
        document.getElementById('hr-analysis-modal').classList.add('show');
    }, 10);
}

// Yardımcı Fonksiyonlar
function getRiskLevelText(level) {
    const levels = {
        'critical': '🔴 KRİTİK',
        'high': '🟠 YÜKSEK',
        'medium': '🟡 ORTA',
        'low': '🟢 DÜŞÜK'
    };
    return levels[level] || level;
}

function getPriorityText(priority) {
    const priorities = {
        'critical': 'Kritik',
        'high': 'Yüksek',
        'medium': 'Orta',
        'low': 'Düşük'
    };
    return priorities[priority] || priority;
}

function getTimelineText(timeline) {
    const timelines = {
        'acil': 'Hemen',
        '1_hafta': '1 Hafta İçinde',
        '1_ay': '1 Ay İçinde'
    };
    return timelines[timeline] || timeline;
}

function closeHRAnalysisModal() {
    const modal = document.getElementById('hr-analysis-modal');
    if (modal) {
        modal.remove();
    }
}

// HTML Rapor İndirme
async function downloadHRAnalysisHTML() {
    if (!window.lastHRAnalysis) {
        alert('Rapor indirmek için önce analiz yapılmalı.');
        return;
    }

    try {
        const personnelId = window.lastHRAnalysis.personnel_info.id;
        const response = await fetch(`/api/personel/${personnelId}/hr-analysis-pdf`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            // HTML blob'unu al
            const blob = await response.blob();

            // İndirme linki oluştur
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${window.lastHRAnalysis.personnel_info.name}_IK_Analizi.html`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Rapor oluşturulamadı.');
        }
    } catch (error) {
        console.error('Rapor indirme hatası:', error);
        alert('Rapor indirilemedi.');
    }
}

// Personel verilerini export et
async function exportPersonelData(format) {
    if (!currentPersonelId) {
        alert('Lütfen önce bir personel seçin.');
        return;
    }

    try {
        const response = await fetch(`/api/personel/${currentPersonelId}/export/${format}`, {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            // Dosya adını response header'dan al
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `personel_rapor.${format === 'excel' ? 'csv' : 'html'}`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // Blob oluştur ve indir
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showNotification(`${format.toUpperCase()} raporu başarıyla indirildi!`, 'success');
        } else {
            let errorMessage = 'Bilinmeyen hata';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            showNotification(`Export hatası: ${errorMessage}`, 'error');
        }
    } catch (error) {
        console.error('Export hatası:', error);
        showNotification('Rapor indirme sırasında hata oluştu.', 'error');
    }
}

// Bildirim sistemi
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Dashboard personel seçimi ve işlemleri
let dashboardSelectedPersonelId = null;

function updateDashboardPersonel() {
    const select = document.getElementById('dashboard-personel-select');
    dashboardSelectedPersonelId = select.value;

    // Butonları etkinleştir/devre dışı bırak
    const buttons = [
        'dashboard-hr-analysis-btn',
        'dashboard-last-analysis-btn'
    ];

    const exportButtons = document.querySelectorAll('.export-buttons button');

    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = !dashboardSelectedPersonelId;
        }
    });

    exportButtons.forEach(btn => {
        btn.disabled = !dashboardSelectedPersonelId;
    });
}

function generateHRAnalysisFromDashboard() {
    if (!dashboardSelectedPersonelId) {
        showNotification('Lütfen önce bir personel seçin.', 'error');
        return;
    }

    // Geçici olarak currentPersonelId'yi ayarla
    const originalPersonelId = currentPersonelId;
    currentPersonelId = dashboardSelectedPersonelId;

    generateHRAnalysis().finally(() => {
        // Orijinal değeri geri yükle
        currentPersonelId = originalPersonelId;
    });
}

function showLastHRAnalysisFromDashboard() {
    if (!dashboardSelectedPersonelId) {
        showNotification('Lütfen önce bir personel seçin.', 'error');
        return;
    }

    // Geçici olarak currentPersonelId'yi ayarla
    const originalPersonelId = currentPersonelId;
    currentPersonelId = dashboardSelectedPersonelId;

    showLastHRAnalysis().finally(() => {
        // Orijinal değeri geri yükle
        currentPersonelId = originalPersonelId;
    });
}

function exportPersonelDataFromDashboard(format) {
    if (!dashboardSelectedPersonelId) {
        showNotification('Lütfen önce bir personel seçin.', 'error');
        return;
    }

    // Geçici olarak currentPersonelId'yi ayarla
    const originalPersonelId = currentPersonelId;
    currentPersonelId = dashboardSelectedPersonelId;

    exportPersonelData(format).finally(() => {
        // Orijinal değeri geri yükle
        currentPersonelId = originalPersonelId;
    });
}

// Dashboard personel listesini yükle
async function loadDashboardPersonelList() {
    try {
        const response = await fetch('/api/personel', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const personelList = await response.json();
            const select = document.getElementById('dashboard-personel-select');

            if (select) {
                // Mevcut seçenekleri temizle (ilk option hariç)
                select.innerHTML = '<option value="">Personel seçin...</option>';

                // Personelleri ekle
                personelList.forEach(personel => {
                    const option = document.createElement('option');
                    option.value = personel.id;
                    option.textContent = `${personel.ad} ${personel.soyad} - ${personel.pozisyon}`;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Dashboard personel listesi yüklenirken hata:', error);
    }
}

// Organizasyon yönetimi fonksiyonları
let organizationData = null;



// Organizasyon istatistiklerini yükle
async function loadOrganizationStats() {
    try {
        const response = await fetch('/api/organization/stats', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            organizationData = data;
            displayOrganizationStats(data.stats);
            displayRecentUsers(data);
        } else {
            document.getElementById('org-stats-content').innerHTML = '<div class="error">İstatistikler yüklenemedi.</div>';
        }
    } catch (error) {
        console.error('Organizasyon istatistikleri yüklenirken hata:', error);
        document.getElementById('org-stats-content').innerHTML = '<div class="error">İstatistikler yüklenirken hata oluştu.</div>';
    }
}

// Organizasyon istatistiklerini göster
function displayOrganizationStats(stats) {
    const statsContent = document.getElementById('org-stats-content');

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
            <div class="stat-number">${stats.usersByRole.organizasyon_sahibi || 0}</div>
            <div class="stat-label">Org. Sahibi</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.usersByRole.yonetici || 0}</div>
            <div class="stat-label">Yönetici</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.tasksByStatus.beklemede || 0}</div>
            <div class="stat-label">Bekleyen Görev</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">${stats.tasksByStatus.tamamlandi || 0}</div>
            <div class="stat-label">Tamamlanan</div>
        </div>
    `;
}

// Son kullanıcıları göster
async function displayRecentUsers(data) {
    try {
        const response = await fetch('/api/organization/members', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const membersData = await response.json();
            const recentUsers = membersData.members.slice(0, 5);

            const recentUsersContent = document.getElementById('recent-users-content');

            if (recentUsers.length === 0) {
                recentUsersContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Henüz kullanıcı bulunmuyor</p>
                    </div>
                `;
                return;
            }

            recentUsersContent.innerHTML = recentUsers.map(user => `
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
        console.error('Son kullanıcılar yüklenirken hata:', error);
    }
}

// Organizasyon kullanıcılarını yükle
async function loadOrganizationUsers() {
    try {
        const response = await fetch('/api/organization/members', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            displayOrganizationUsers(data.members);
        } else {
            document.getElementById('users-management-content').innerHTML = '<div class="error">Kullanıcılar yüklenemedi.</div>';
        }
    } catch (error) {
        console.error('Kullanıcı yükleme hatası:', error);
        document.getElementById('users-management-content').innerHTML = '<div class="error">Kullanıcılar yüklenirken hata oluştu.</div>';
    }
}

// Organizasyon kullanıcılarını göster
function displayOrganizationUsers(users) {
    const usersList = document.getElementById('users-management-content');

    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="empty-users">
                <i class="fas fa-users"></i>
                <h3>Henüz kullanıcı bulunmuyor</h3>
                <p>Organizasyonunuza kullanıcı davet etmek için davet kodu oluşturun</p>
            </div>
        `;
        return;
    }

    usersList.innerHTML = `
        <div class="user-management-grid">
            ${users.map(user => `
                <div class="user-card">
                    <div class="user-card-header">
                        <div class="user-avatar">
                            ${getUserInitials(user.full_name)}
                        </div>
                        <div class="user-info">
                            <h4>${user.full_name}</h4>
                            <p class="user-email">@${user.username}</p>
                        </div>
                    </div>
                    
                    <div class="user-meta">
                        <div class="user-meta-item">
                            <i class="fas fa-calendar-alt"></i>
                            <span>Katılım: ${formatDate(user.created_at)}</span>
                        </div>
                        <div class="user-meta-item">
                            <i class="fas fa-clock"></i>
                            <span>Son Giriş: ${user.last_login ? formatDate(user.last_login) : 'Hiç giriş yapmamış'}</span>
                        </div>
                    </div>

                    <div class="user-stats">
                        <div class="user-stat">
                            <div class="user-stat-number">${user.personnel_count || 0}</div>
                            <div class="user-stat-label">Personel</div>
                        </div>
                        <div class="user-stat">
                            <div class="user-stat-number">${user.task_count || 0}</div>
                            <div class="user-stat-label">Görev</div>
                        </div>
                    </div>

                    <div class="user-role-badge ${getRoleBadgeClass(user.role)}">
                        ${getRoleDisplayName(user.role)}
                    </div>

                    <div class="user-actions">
                        <button class="user-action-btn btn-edit-role" onclick="openRoleChangeModal(${user.id}, '${user.full_name}', '${user.role}')" ${user.id === userInfo?.id ? 'disabled' : ''}>
                            <i class="fas fa-user-cog"></i>
                            Rol Değiştir
                        </button>
                        <button class="user-action-btn btn-delete-user" onclick="deleteUser(${user.id}, '${user.full_name}')" ${user.id === userInfo?.id || user.role === 'organizasyon_sahibi' ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                            Sil
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}



// Organizasyon ayarlarını yükle
async function loadOrganizationSettings() {
    try {
        if (!organizationData) {
            const response = await fetch('/api/organization/stats', {
                headers: getAuthHeaders()
            });

            if (response.ok) {
                organizationData = await response.json();
            }
        }

        if (organizationData && organizationData.organization) {
            displayOrganizationSettings(organizationData);
        } else {
            document.getElementById('org-settings-content').innerHTML = '<div class="error">Organizasyon ayarları yüklenemedi.</div>';
        }
    } catch (error) {
        console.error('Organizasyon ayarları yüklenirken hata:', error);
        document.getElementById('org-settings-content').innerHTML = '<div class="error">Ayarlar yüklenirken hata oluştu.</div>';
    }
}

// Organizasyon ayarlarını göster
function displayOrganizationSettings(data) {
    const settingsContent = document.getElementById('org-settings-content');

    settingsContent.innerHTML = `
        <form id="organization-settings-form" onsubmit="updateOrganizationSettings(event)">
            <div class="form-group">
                <label>Organizasyon Adı</label>
                <input type="text" id="org-name" value="${data.organization.name}" required>
                <small class="form-help">Organizasyonunuzun görünen adı</small>
            </div>
            
            <div class="form-group">
                <label>Oluşturulma Tarihi</label>
                <input type="text" value="${formatDate(data.organization.createdAt)}" readonly>
                <small class="form-help">Bu alan değiştirilemez</small>
            </div>
            
            <div class="form-group">
                <label>Davet Kodu</label>
                <div style="display: flex; gap: 10px; align-items: stretch;">
                    <input type="text" id="custom-invite-code" value="${data.organization.inviteCode}" 
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
                    <strong>Toplam Üye:</strong> ${data.stats.totalUsers}
                </div>
                <div class="info-item">
                    <strong>Personel Sayısı:</strong> ${data.stats.totalPersonel}
                </div>
                <div class="info-item">
                    <strong>Toplam Görev:</strong> ${data.stats.totalTasks}
                </div>
                <div class="info-item">
                    <strong>Toplam Not:</strong> ${data.stats.totalNotes}
                </div>
            </div>
        </div>
    `;
}

// Organizasyon ayarlarını güncelle
async function updateOrganizationSettings(event) {
    event.preventDefault();

    const orgName = document.getElementById('org-name').value.trim();

    if (!orgName) {
        showNotification('Organizasyon adı boş olamaz!', 'error');
        return;
    }

    if (orgName === organizationData.organization.name) {
        showNotification('Herhangi bir değişiklik yapılmadı.', 'info');
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
            organizationData.organization.name = orgName;
            showNotification('Organizasyon ayarları başarıyla güncellendi!', 'success');
        } else {
            const error = await response.json();
            showNotification('Hata: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Ayarlar güncelleme hatası:', error);
        showNotification('Ayarlar güncellenirken hata oluştu', 'error');
    }
}

// Mevcut davet kodunu kopyala
function copyCurrentInviteCode() {
    const inviteCodeInput = document.getElementById('custom-invite-code');
    const inviteCode = inviteCodeInput.value;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(inviteCode).then(() => {
            showNotification('Davet kodu kopyalandı!', 'success');
        });
    } else {
        inviteCodeInput.select();
        document.execCommand('copy');
        showNotification('Davet kodu kopyalandı!', 'success');
    }
}

// Özel davet kodu güncelle
async function updateCustomInviteCode() {
    const customCode = document.getElementById('custom-invite-code').value.trim();

    if (!customCode) {
        showNotification('Davet kodu boş olamaz!', 'error');
        return;
    }

    if (customCode === organizationData.organization.inviteCode) {
        showNotification('Davet kodu zaten aynı.', 'info');
        return;
    }

    if (customCode.length < 3 || customCode.length > 20) {
        showNotification('Davet kodu 3-20 karakter arasında olmalıdır!', 'error');
        return;
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(customCode)) {
        showNotification('Davet kodu sadece harf, rakam, tire (-) ve alt çizgi (_) içerebilir!', 'error');
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
            organizationData.organization.inviteCode = data.inviteCode;
            showNotification('Davet kodu başarıyla güncellendi!', 'success');
        } else {
            const error = await response.json();
            showNotification('Hata: ' + error.error, 'error');
            document.getElementById('custom-invite-code').value = organizationData.organization.inviteCode;
        }
    } catch (error) {
        console.error('Davet kodu güncelleme hatası:', error);
        showNotification('Davet kodu güncellenirken hata oluştu', 'error');
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
            document.getElementById('custom-invite-code').value = data.inviteCode;
            organizationData.organization.inviteCode = data.inviteCode;
            showNotification('Rastgele davet kodu oluşturuldu!', 'success');
        } else {
            const error = await response.json();
            showNotification('Hata: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Davet kodu oluşturma hatası:', error);
        showNotification('Davet kodu oluşturulurken hata oluştu', 'error');
    }
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

// Dashboard bölüm değiştirme sistemi
function showDashboardSection(sectionName) {
    // Ana menüyü gizle
    const mainMenu = document.getElementById('dashboard-main-menu');
    if (mainMenu) {
        mainMenu.style.display = 'none';
    }

    // Tüm bölümleri gizle
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });

    // Seçilen bölümü göster
    const targetSection = document.getElementById(`dashboard-${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');

        // Bölüme özel yükleme işlemleri
        switch (sectionName) {
            case 'org-stats':
                loadOrganizationStats();
                break;
            case 'ai-analysis':
                loadPersonelForAIAnalysis();
                break;
            case 'user-management':
                loadOrganizationUsers();
                break;
            case 'export':
                loadPersonelForExport();
                break;
            case 'invite':
                loadInviteCode();
                break;
            case 'settings':
                loadOrganizationSettings();
                break;
        }
    }
}

// Dashboard ana menüye dön
function returnToDashboardMain() {
    // Tüm bölümleri gizle
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });

    // Ana menüyü göster
    const mainMenu = document.getElementById('dashboard-main-menu');
    if (mainMenu) {
        mainMenu.style.display = 'grid';
    }

    // Hoş geldin mesajını göster
    const welcomeSection = document.getElementById('dashboard-welcome');
    if (welcomeSection) {
        welcomeSection.classList.add('active');
    }
}

// Davet kodu kopyalama (dashboard için)
function copyInviteCode() {
    const codeInput = document.getElementById('invite-code');
    if (codeInput && codeInput.value) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(codeInput.value).then(() => {
                showNotification('Davet kodu kopyalandı!', 'success');
            });
        } else {
            // Fallback for older browsers
            codeInput.select();
            document.execCommand('copy');
            showNotification('Davet kodu kopyalandı!', 'success');
        }
    } else {
        showNotification('Davet kodu bulunamadı!', 'error');
    }
}

// Yeni davet kodu oluştur (dashboard için)
async function generateNewInviteCode() {
    if (!confirm('Yeni davet kodu oluşturmak istediğinizden emin misiniz? Eski kod geçersiz hale gelecektir.')) {
        return;
    }

    try {
        const response = await fetch('/api/organization/invite-code', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();

            // Modern tasarım için code display'i güncelle
            const codeDisplay = document.getElementById('invite-code-display');
            if (codeDisplay) {
                codeDisplay.textContent = data.inviteCode;
            }

            // Eski input alanı da varsa güncelle
            const codeInput = document.getElementById('invite-code');
            if (codeInput) {
                codeInput.value = data.inviteCode;
            }

            // Organizasyon verisini güncelle
            if (organizationData && organizationData.organization) {
                organizationData.organization.inviteCode = data.inviteCode;
            }

            showNotification('Yeni davet kodu oluşturuldu!', 'success');
        } else {
            const error = await response.json();
            showNotification('Hata: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Davet kodu oluşturma hatası:', error);
        showNotification('Davet kodu oluşturulamadı.', 'error');
    }
}

// AI Analiz için personel listesini yükle
async function loadPersonelForAIAnalysis() {
    try {
        const response = await fetch('/api/personel', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const personelList = await response.json();
            const analysisSelect = document.getElementById('ai-analysis-personel-select');

            if (analysisSelect) {
                analysisSelect.innerHTML = '<option value="">Personel seçin...</option>';
                personelList.forEach(personel => {
                    const option = document.createElement('option');
                    option.value = personel.id;
                    option.textContent = `${personel.ad} ${personel.soyad} - ${personel.pozisyon}`;
                    analysisSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('AI analiz personel listesi yüklenirken hata:', error);
    }
}

// AI analiz butonlarını güncelle
function updateAIAnalysisButtons() {
    const select = document.getElementById('ai-analysis-personel-select');
    const selectedPersonelId = select.value;

    const generateBtn = document.getElementById('generate-ai-analysis-btn');
    const showBtn = document.getElementById('show-last-ai-analysis-btn');
    const historyBtn = document.getElementById('show-analysis-history-btn');

    if (generateBtn) generateBtn.disabled = !selectedPersonelId;
    if (showBtn) showBtn.disabled = !selectedPersonelId;
    if (historyBtn) historyBtn.disabled = !selectedPersonelId;
}

// AI analiz oluştur (dashboard'dan)
async function generateAIAnalysis() {
    const select = document.getElementById('ai-analysis-personel-select');
    const selectedPersonelId = select.value;
    const selectedPersonelName = select.options[select.selectedIndex].text;

    if (!selectedPersonelId) {
        showNotification('Lütfen önce bir personel seçin.', 'error');
        return;
    }

    if (!confirm(`${selectedPersonelName} için İK uzmanı seviyesinde kapsamlı analiz yapılsın?\n\nBu analiz:\n• Tüm notları değerlendirir\n• Risk seviyesi belirler\n• Somut eylem planları önerir\n• Mağaza müdürü için tavsiyelerde bulunur\n\nİşlem 10-30 saniye sürebilir.`)) {
        return;
    }

    // Butonu devre dışı bırak
    const button = document.getElementById('generate-ai-analysis-btn');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İK Analizi Yapılıyor...';

    try {
        const response = await fetch(`/api/personel/${selectedPersonelId}/hr-analysis`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // İK analiz sonucunu göster
            showHRAnalysisModal(result);

            // Son analiz verisini sakla
            window.lastHRAnalysis = result;

            showNotification('İK analizi başarıyla tamamlandı!', 'success');
        } else {
            showNotification(`İK analizi hatası: ${result.error || 'Bilinmeyen hata'}`, 'error');
        }

    } catch (error) {
        console.error('İK analizi hatası:', error);
        showNotification('İK analizi sırasında hata oluştu. Lütfen tekrar deneyin.', 'error');
    } finally {
        // Butonu tekrar aktif et
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Son AI analizini göster (dashboard'dan)
async function showLastAIAnalysis() {
    const select = document.getElementById('ai-analysis-personel-select');
    const selectedPersonelId = select.value;

    if (!selectedPersonelId) {
        showNotification('Lütfen önce bir personel seçin.', 'error');
        return;
    }

    try {
        console.log('🔍 Son analiz getiriliyor, personel ID:', selectedPersonelId);

        const response = await fetch(`/api/personel/${selectedPersonelId}/last-hr-analysis`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        console.log('📡 Son analiz response status:', response.status);

        const result = await response.json();
        console.log('📊 Son analiz response data:', result);

        if (response.ok && result.success && result.analysis) {
            console.log('✅ Son analiz gösteriliyor');
            // Son analizi göster
            showHRAnalysisModal(result.analysis);
            // Bellekte sakla
            window.lastHRAnalysis = result.analysis;
        } else {
            console.error('❌ Son analiz bulunamadı:', result);
            showNotification('Bu personel için henüz İK analizi yapılmamış.\n\n"İK Analizi Yap" butonuna tıklayarak yeni bir analiz oluşturun.', 'info');
        }
    } catch (error) {
        console.error('Son analiz getirme hatası:', error);
        showNotification('Son analiz getirilirken hata oluştu.', 'error');
    }
}

// Analiz Geçmişini Göster
async function showAnalysisHistory() {
    const select = document.getElementById('ai-analysis-personel-select');
    const selectedPersonelId = select.value;

    if (!selectedPersonelId) {
        showNotification('Lütfen önce bir personel seçin.', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/personel/${selectedPersonelId}/hr-analysis-history`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showAnalysisHistoryModal(result.reports);
        } else {
            showNotification('Analiz geçmişi getirilemedi.', 'error');
        }
    } catch (error) {
        console.error('Analiz geçmişi getirme hatası:', error);
        showNotification('Analiz geçmişi getirilirken hata oluştu.', 'error');
    }
}

// Analiz Geçmişi Modal'ını Göster
function showAnalysisHistoryModal(reports) {
    if (!reports || reports.length === 0) {
        showNotification('Bu personel için analiz geçmişi bulunamadı.', 'info');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content analysis-history-modal">
            <div class="modal-header">
                <h3><i class="fas fa-history"></i> İK Analizi Geçmişi</h3>
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="analysis-history-list">
                    ${reports.map(report => `
                        <div class="analysis-history-item" onclick="loadSpecificAnalysis(${report.id})">
                            <div class="analysis-date">
                                <i class="fas fa-calendar"></i>
                                ${new Date(report.created_at).toLocaleString('tr-TR')}
                            </div>
                            <div class="analysis-info">
                                <div class="risk-level risk-${report.overall_risk_level}">
                                    ${report.overall_risk_level.toUpperCase()}
                                </div>
                                ${report.immediate_action_required ?
            '<div class="urgent-flag"><i class="fas fa-exclamation-triangle"></i> Acil Eylem Gerekli</div>' :
            ''
        }
                                <div class="created-by">
                                    <i class="fas fa-user"></i> ${report.created_by_name}
                                </div>
                            </div>
                            <div class="analysis-actions">
                                <i class="fas fa-eye"></i> Görüntüle
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Belirli Bir Analizi Yükle
async function loadSpecificAnalysis(reportId) {
    try {
        console.log('🔍 Analiz yükleniyor, ID:', reportId);

        const response = await fetch(`/api/hr-analysis/${reportId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        console.log('📡 Response status:', response.status);

        const result = await response.json();
        console.log('📊 Response data:', result);

        if (response.ok && result.success) {
            // Modal'ı kapat
            document.querySelector('.analysis-history-modal')?.closest('.modal-overlay')?.remove();

            console.log('✅ Analiz gösteriliyor');
            // Analizi göster
            showHRAnalysisModal(result);
        } else {
            console.error('❌ Analiz yüklenemedi:', result);
            showNotification('Analiz yüklenemedi.', 'error');
        }
    } catch (error) {
        console.error('Analiz yükleme hatası:', error);
        showNotification('Analiz yüklenirken hata oluştu.', 'error');
    }
}

// Davet kodu yükleme (modern tasarım için)
async function loadInviteCode() {
    try {
        // Organization stats endpoint'inden davet kodunu al
        const response = await fetch('/api/organization/stats', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            const codeDisplay = document.getElementById('invite-code-display');
            if (codeDisplay) {
                const inviteCode = data.organization?.inviteCode || 'Kod bulunamadı';
                codeDisplay.textContent = inviteCode;
            }
        }
    } catch (error) {
        console.error('Davet kodu yüklenirken hata:', error);
        const codeDisplay = document.getElementById('invite-code-display');
        if (codeDisplay) {
            codeDisplay.textContent = 'Yükleme hatası';
        }
    }
}

// Modern davet kodu kopyalama
function copyInviteCodeModern() {
    const codeDisplay = document.getElementById('invite-code-display');
    if (codeDisplay && codeDisplay.textContent) {
        const inviteCode = codeDisplay.textContent;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(inviteCode).then(() => {
                showNotification('Davet kodu kopyalandı!', 'success');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = inviteCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Davet kodu kopyalandı!', 'success');
        }
    } else {
        showNotification('Davet kodu bulunamadı!', 'error');
    }
}

// Personel export için yükleme
async function loadPersonelForExport() {
    try {
        const response = await fetch('/api/personel', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Personel verileri alınamadı');
        }

        const personelList = await response.json();

        // Export bölümünü göster
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });

        const exportSection = document.getElementById('dashboard-export-section');
        if (exportSection) {
            exportSection.classList.add('active');
        }

        // Ana menüyü gizle
        const mainMenu = document.getElementById('dashboard-main-menu');
        if (mainMenu) {
            mainMenu.style.display = 'none';
        }

        // Export dropdown'ını doldur
        const exportSelect = document.getElementById('export-personel-select');
        if (exportSelect && personelList.length > 0) {
            exportSelect.innerHTML = '<option value="">Personel seçin...</option>' +
                personelList.map(personel => `
                    <option value="${personel.id}">${personel.ad} ${personel.soyad} - ${personel.pozisyon || 'Belirtilmemiş'}</option>
                `).join('');
        } else if (exportSelect) {
            exportSelect.innerHTML = '<option value="">Henüz personel bulunmuyor</option>';
        }

    } catch (error) {
        console.error('Personel export yükleme hatası:', error);
        showNotification('Personel verileri yüklenirken hata oluştu', 'error');
    }
}

// Export butonlarini guncelle
function updateExportButtons() {
    const select = document.getElementById('export-personel-select');
    const excelBtn = document.getElementById('export-excel-btn');
    const pdfBtn = document.getElementById('export-pdf-btn');

    const isSelected = select && select.value !== '';

    if (excelBtn) excelBtn.disabled = !isSelected;
    if (pdfBtn) pdfBtn.disabled = !isSelected;
}

// Seçili personeli dışa aktar
async function exportSelectedPersonel(format) {
    const select = document.getElementById('export-personel-select');
    if (!select || !select.value) {
        showNotification('Lütfen bir personel seçin', 'error');
        return;
    }

    const personelId = select.value;

    try {
        // PDF butonu için pdf endpoint'ini kullan
        const response = await fetch(`/api/personel/${personelId}/export/${format}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Dışa aktarma başarısız');
        }

        // Dosyayı indir
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personel-${personelId}-${format}.${format === 'excel' ? 'xlsx' : 'html'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification(`${format === 'pdf' ? 'HTML' : format.toUpperCase()} dosyası başarıyla indirildi`, 'success');

    } catch (error) {
        console.error('Export hatası:', error);
        showNotification('Dışa aktarma sırasında hata oluştu', 'error');
    }
}

// Kullanici adinin bas harflerini al
function getUserInitials(fullName) {
    if (!fullName) return '?';
    const names = fullName.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

// Rol değiştirme modalını aç
function openRoleChangeModal(userId, userName, currentRole) {
    const modal = document.createElement('div');
    modal.className = 'role-change-modal';
    modal.innerHTML = `
        <div class="role-change-content">
            <h3><i class="fas fa-user-cog"></i> Rol Değiştir</h3>
            <p><strong>${userName}</strong> kullanıcısının rolünü değiştirin:</p>
            
            <div class="role-options">
                <label class="role-option ${currentRole === 'personel' ? 'selected' : ''}" onclick="selectRole(this, 'personel')">
                    <input type="radio" name="newRole" value="personel" ${currentRole === 'personel' ? 'checked' : ''}>
                    <div>
                        <strong>Personel</strong>
                        <div style="font-size: 12px; color: #666;">Sadece kendi bilgilerini görüntüleyebilir</div>
                    </div>
                </label>
                
                <label class="role-option ${currentRole === 'yonetici' ? 'selected' : ''}" onclick="selectRole(this, 'yonetici')">
                    <input type="radio" name="newRole" value="yonetici" ${currentRole === 'yonetici' ? 'checked' : ''}>
                    <div>
                        <strong>Yönetici</strong>
                        <div style="font-size: 12px; color: #666;">Tüm personeli yönetebilir, rapor alabilir</div>
                    </div>
                </label>
                
                <label class="role-option ${currentRole === 'organizasyon_sahibi' ? 'selected' : ''}" onclick="selectRole(this, 'organizasyon_sahibi')">
                    <input type="radio" name="newRole" value="organizasyon_sahibi" ${currentRole === 'organizasyon_sahibi' ? 'checked' : ''}>
                    <div>
                        <strong>Organizasyon Sahibi</strong>
                        <div style="font-size: 12px; color: #666;">Tam yetki, kullanıcı yönetimi</div>
                    </div>
                </label>
            </div>
            
            <div class="modal-actions">
                <button class="btn-modal-cancel" onclick="closeRoleChangeModal()">
                    <i class="fas fa-times"></i> İptal
                </button>
                <button class="btn-modal-save" onclick="saveRoleChange(${userId})">
                    <i class="fas fa-check"></i> Kaydet
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Modal dışına tıklanınca kapat
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRoleChangeModal();
        }
    });
}

// Rol seçimini güncelle
function selectRole(element, role) {
    document.querySelectorAll('.role-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    element.querySelector('input').checked = true;
}

// Rol değişikliğini kaydet
async function saveRoleChange(userId) {
    const selectedRole = document.querySelector('input[name="newRole"]:checked');
    if (!selectedRole) {
        showNotification('Lütfen bir rol seçin', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/organization/members/${userId}/role`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role: selectedRole.value })
        });

        if (response.ok) {
            showNotification('Kullanıcı rolü başarıyla güncellendi', 'success');
            closeRoleChangeModal();
            loadOrganizationUsers();
        } else {
            const error = await response.json();
            showNotification('Hata: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Rol güncelleme hatası:', error);
        showNotification('Rol güncellenirken hata oluştu', 'error');
    }
}

// Rol değiştirme modalını kapat
function closeRoleChangeModal() {
    const modal = document.querySelector('.role-change-modal');
    if (modal) {
        modal.remove();
    }
}

// Kullanıcı sil
async function deleteUser(userId, userName) {
    if (!confirm(`${userName} kullanıcısını organizasyondan çıkarmak istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
        return;
    }

    try {
        const response = await fetch(`/api/organization/members/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            showNotification('Kullanıcı başarıyla silindi', 'success');
            loadOrganizationUsers();
        } else {
            const error = await response.json();
            showNotification('Hata: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Kullanıcı silme hatası:', error);
        showNotification('Kullanıcı silinirken hata oluştu', 'error');
    }
}