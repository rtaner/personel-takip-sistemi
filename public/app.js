// Global değişkenler
let currentPersonelId = null;
let currentPersonelName = null;
let isRecording = false;
let recognition = null;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    loadPersonel();
    setupSpeechRecognition();
});

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
}

// Personel yükleme
async function loadPersonel() {
    try {
        const response = await fetch('/api/personel');
        const personel = await response.json();
        
        const container = document.getElementById('personel-list');
        container.innerHTML = '';
        
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
    }
}

// Personel detayını göster
function showPersonelDetail(personelId, personelName) {
    currentPersonelId = personelId;
    currentPersonelName = personelName;
    
    // Detay sekmesini göster
    document.getElementById('detay-tab-btn').style.display = 'block';
    document.getElementById('personel-detay-baslik').textContent = personelName + ' - Detaylar';
    
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
            headers: {
                'Content-Type': 'application/json'
            },
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
            fetch(`/api/personel/${personelId}/notlar`),
            fetch(`/api/personel/${personelId}/gorevler`)
        ]);
        
        const notes = await notesResponse.json();
        const tasks = await tasksResponse.json();
        
        // Tüm aktiviteleri birleştir ve tarihe göre sırala
        const activities = [];
        
        // Notları ekle
        notes.forEach(note => {
            activities.push({
                type: 'note',
                date: note.tarih,
                content: note.not_metni,
                noteType: note.kategori, // artık olumlu/olumsuz olacak
                id: note.id
            });
        });
        
        // Görevleri ekle
        tasks.forEach(task => {
            activities.push({
                type: 'task',
                date: task.atanma_tarihi,
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
                activityDiv.innerHTML = `
                    <div class="activity-header">
                        <span class="activity-type note">Not</span>
                        <div class="activity-actions">
                            <span class="note-type-badge note-type-${activity.noteType}">${activity.noteType === 'olumlu' ? 'Olumlu' : 'Olumsuz'}</span>
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
                                        ${[1,2,3,4,5].map(i => `
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

// Notları yükleme
async function loadNotes(personelId) {
    try {
        const response = await fetch(`/api/personel/${personelId}/notlar`);
        const notlar = await response.json();
        
        const container = document.getElementById('notlar-list');
        container.innerHTML = '';
        
        if (notlar.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Henüz not bulunmuyor.</p>';
            return;
        }
        
        notlar.forEach(not => {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'note-item';
            noteDiv.innerHTML = `
                <div class="note-header">
                    <span class="note-date">${formatDateTime(not.tarih)}</span>
                    <span class="note-category">${getCategoryName(not.kategori)}</span>
                </div>
                <p>${not.not_metni}</p>
            `;
            container.appendChild(noteDiv);
        });
    } catch (error) {
        console.error('Notlar yüklenirken hata:', error);
    }
}

// Yeni not ekleme (tip ile birlikte)
async function addNoteWithType(noteType) {
    if (!currentPersonelId) return;
    
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
            headers: {
                'Content-Type': 'application/json'
            },
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

// Personel görevlerini yükleme
function loadPersonelTasks() {
    const select = document.getElementById('gorev-personel-select');
    const personelId = select.value;
    
    if (!personelId) {
        document.getElementById('gorev-form-container').style.display = 'none';
        return;
    }
    
    currentGorevPersonelId = personelId;
    const selectedText = select.options[select.selectedIndex].text;
    document.getElementById('selected-gorev-personel-name').textContent = selectedText + ' - Görevler';
    document.getElementById('gorev-form-container').style.display = 'block';
    
    loadTasks(personelId);
}

// Görevleri yükleme
async function loadTasks(personelId) {
    try {
        const response = await fetch(`/api/personel/${personelId}/gorevler`);
        const gorevler = await response.json();
        
        const container = document.getElementById('gorevler-list');
        container.innerHTML = '';
        
        if (gorevler.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Henüz görev bulunmuyor.</p>';
            return;
        }
        
        gorevler.forEach(gorev => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task-item';
            taskDiv.innerHTML = `
                <div class="task-header">
                    <h4>${gorev.gorev_baslik}</h4>
                    <span class="task-status status-${gorev.durum.replace(' ', '-')}">${getStatusName(gorev.durum)}</span>
                </div>
                <p>${gorev.gorev_aciklama || 'Açıklama yok'}</p>
                <p><strong>Atanma:</strong> ${formatDateTime(gorev.atanma_tarihi)}</p>
                ${gorev.bitis_tarihi ? `<p><strong>Bitiş:</strong> ${formatDate(gorev.bitis_tarihi)}</p>` : ''}
                
                <div class="task-actions" style="margin-top: 15px;">
                    <select onchange="updateTaskStatus(${gorev.id}, this.value)" style="margin-right: 10px;">
                        <option value="beklemede" ${gorev.durum === 'beklemede' ? 'selected' : ''}>Beklemede</option>
                        <option value="devam-ediyor" ${gorev.durum === 'devam-ediyor' ? 'selected' : ''}>Devam Ediyor</option>
                        <option value="tamamlandi" ${gorev.durum === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                    </select>
                    
                    ${gorev.durum === 'tamamlandi' ? `
                        <div class="performance-rating">
                            <span>Performans:</span>
                            ${[1,2,3,4,5].map(i => `
                                <button onclick="updatePerformance(${gorev.id}, ${i})" 
                                        class="${gorev.performans_puani === i ? 'selected' : ''}">${i}</button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            container.appendChild(taskDiv);
        });
    } catch (error) {
        console.error('Görevler yüklenirken hata:', error);
    }
}

// Yeni görev ekleme
async function addTask(event) {
    event.preventDefault();
    
    if (!currentPersonelId) return;
    
    const gorevData = {
        personel_id: currentPersonelId,
        gorev_baslik: document.getElementById('gorev-baslik').value,
        gorev_aciklama: document.getElementById('gorev-aciklama').value,
        bitis_tarihi: document.getElementById('bitis-tarihi').value
    };
    
    try {
        const response = await fetch('/api/gorevler', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gorevData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            hideTaskForm();
            loadActivities(currentPersonelId);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev eklenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Görev durumu güncelleme
async function updateTaskStatus(gorevId, durum) {
    try {
        const response = await fetch(`/api/gorevler/${gorevId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ durum })
        });
        
        if (response.ok) {
            loadActivities(currentPersonelId);
        }
    } catch (error) {
        console.error('Görev durumu güncellenirken hata:', error);
    }
}

// Performans puanı güncelleme
async function updatePerformance(gorevId, puan) {
    try {
        const response = await fetch(`/api/gorevler/${gorevId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                performans_puani: puan,
                durum: 'tamamlandi' // Durumu da koruyalım
            })
        });
        
        if (response.ok) {
            loadActivities(currentPersonelId);
        }
    } catch (error) {
        console.error('Performans puanı güncellenirken hata:', error);
    }
}

// Sesli not alma
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
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    // Ayarlar
    recognition.continuous = false; // Sürekli dinleme kapalı (daha stabil)
    recognition.interimResults = true; // Ara sonuçları göster
    recognition.lang = 'tr-TR'; // Türkçe
    recognition.maxAlternatives = 1; // Tek alternatif
    
    recognition.onstart = function() {
        console.log('Ses tanıma başladı');
        const statusElement = document.getElementById('voice-status');
        const btnElement = document.getElementById('voice-btn');
        const btnTextElement = document.getElementById('voice-btn-text');
        
        if (statusElement) statusElement.textContent = '🎤 Dinleniyor...';
        if (btnElement) btnElement.classList.add('recording');
        if (btnTextElement) btnTextElement.textContent = 'Durdur';
    };
    
    recognition.onresult = function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Sonucu textarea'ya ekle
        if (finalTranscript) {
            const textArea = document.getElementById('not-metni');
            if (textArea) {
                const currentText = textArea.value;
                const newText = currentText ? currentText + ' ' + finalTranscript : finalTranscript;
                textArea.value = newText;
            }
        }
        
        // Ara sonuçları göster
        const statusElement = document.getElementById('voice-status');
        if (statusElement && interimTranscript) {
            statusElement.textContent = '🎤 ' + interimTranscript;
        }
    };
    
    recognition.onend = function() {
        console.log('Ses tanıma bitti');
        isRecording = false;
        
        const statusElement = document.getElementById('voice-status');
        const btnElement = document.getElementById('voice-btn');
        const btnTextElement = document.getElementById('voice-btn-text');
        
        if (statusElement) statusElement.textContent = '';
        if (btnElement) btnElement.classList.remove('recording');
        if (btnTextElement) btnTextElement.textContent = 'Sesli Not';
    };
    
    recognition.onerror = function(event) {
        console.error('Ses tanıma hatası:', event.error);
        isRecording = false;
        
        const statusElement = document.getElementById('voice-status');
        const btnElement = document.getElementById('voice-btn');
        
        let errorMessage = 'Hata oluştu';
        
        switch(event.error) {
            case 'no-speech':
                errorMessage = 'Ses algılanamadı';
                break;
            case 'audio-capture':
                errorMessage = 'Mikrofon erişimi yok';
                break;
            case 'not-allowed':
                errorMessage = 'Mikrofon izni reddedildi';
                break;
            case 'network':
                errorMessage = 'Ağ hatası';
                break;
            default:
                errorMessage = 'Ses tanıma hatası: ' + event.error;
        }
        
        if (statusElement) statusElement.textContent = '❌ ' + errorMessage;
        if (btnElement) btnElement.classList.remove('recording');
        
        const btnTextElement = document.getElementById('voice-btn-text');
        if (btnTextElement) btnTextElement.textContent = 'Sesli Not';
        
        // 3 saniye sonra hata mesajını temizle
        setTimeout(() => {
            if (statusElement) statusElement.textContent = '';
        }, 3000);
    };
}

async function toggleVoiceRecording() {
    if (!recognition) {
        alert('Tarayıcınız ses tanımayı desteklemiyor');
        return;
    }
    
    if (isRecording) {
        recognition.stop();
        isRecording = false;
        document.getElementById('voice-status').textContent = 'Durduruldu';
        return;
    }
    
    try {
        // Mikrofon izni kontrolü
        const permission = await navigator.permissions.query({name: 'microphone'});
        
        if (permission.state === 'denied') {
            alert('Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından mikrofon iznini açın.');
            return;
        }
        
        document.getElementById('voice-status').textContent = 'Başlatılıyor...';
        recognition.start();
        isRecording = true;
        
    } catch (error) {
        console.error('Mikrofon başlatma hatası:', error);
        
        // Fallback - direkt başlatmayı dene
        try {
            document.getElementById('voice-status').textContent = 'Başlatılıyor...';
            recognition.start();
            isRecording = true;
        } catch (startError) {
            console.error('Ses tanıma başlatılamadı:', startError);
            alert('Mikrofon başlatılamadı. Lütfen mikrofon iznini kontrol edin.');
            document.getElementById('voice-status').textContent = '';
        }
    }
}

// Yardımcı fonksiyonlar
function formatDate(dateString) {
    if (!dateString) return 'Belirtilmemiş';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR');
}

function formatDateTime(dateString) {
    if (!dateString) return 'Belirtilmemiş';
    const date = new Date(dateString);
    return date.toLocaleString('tr-TR');
}



function getStatusName(status) {
    const statuses = {
        'beklemede': 'Beklemede',
        'devam-ediyor': 'Devam Ediyor',
        'tamamlandi': 'Tamamlandı'
    };
    return statuses[status] || status;
}

function getStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '★';
        } else {
            stars += '☆';
        }
    }
    return stars;
}

// Personel silme
async function deletePersonel(personelId, personelName) {
    if (!confirm(`"${personelName}" adlı personeli ve tüm kayıtlarını silmek istediğinizden emin misiniz?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/personel/${personelId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Personel başarıyla silindi!');
            loadPersonel();
            // Eğer silinen personelin detay sayfasındaysak ana sayfaya dön
            if (currentPersonelId == personelId) {
                showTab('personel');
                document.getElementById('detay-tab-btn').style.display = 'none';
            }
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Personel silinirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Personel düzenleme
function editPersonel(personelId, ad, soyad, pozisyon) {
    const newAd = prompt('Ad:', ad);
    if (newAd === null) return;
    
    const newSoyad = prompt('Soyad:', soyad);
    if (newSoyad === null) return;
    
    const newPozisyon = prompt('Pozisyon:', pozisyon);
    if (newPozisyon === null) return;
    
    updatePersonel(personelId, newAd.trim(), newSoyad.trim(), newPozisyon.trim());
}

// Personel güncelleme
async function updatePersonel(personelId, ad, soyad, pozisyon) {
    if (!ad || !soyad) {
        alert('Ad ve soyad boş olamaz!');
        return;
    }
    
    try {
        const response = await fetch(`/api/personel/${personelId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ad, soyad, pozisyon })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Personel başarıyla güncellendi!');
            loadPersonel();
            // Eğer güncellenenen personelin detay sayfasındaysak başlığı güncelle
            if (currentPersonelId == personelId) {
                const newName = `${ad} ${soyad}`;
                document.getElementById('personel-detay-baslik').textContent = newName + ' - Detaylar';
                currentPersonelName = newName;
            }
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Personel güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Not silme
async function deleteNote(noteId) {
    if (!confirm('Bu notu silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/notlar/${noteId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            loadActivities(currentPersonelId);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Not silinirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Not düzenleme - Gelişmiş modal
function editNote(noteId, content, noteType) {
    showNoteEditModal(noteId, content, noteType);
}

// Not düzenleme modalını göster
function showNoteEditModal(noteId, content, noteType) {
    // Modal HTML'i oluştur
    const modalHtml = `
        <div id="note-edit-modal" class="modal-overlay">
            <div class="modal-content">
                <h3>Not Düzenle</h3>
                <textarea id="edit-note-text" rows="4" placeholder="Not içeriği...">${content}</textarea>
                <div class="note-edit-buttons">
                    <button class="btn btn-success" onclick="saveNoteEdit(${noteId}, 'olumlu')">
                        <i class="fas fa-thumbs-up"></i> Olumlu Kaydet
                    </button>
                    <button class="btn btn-danger" onclick="saveNoteEdit(${noteId}, 'olumsuz')">
                        <i class="fas fa-thumbs-down"></i> Olumsuz Kaydet
                    </button>
                    <button class="btn btn-secondary" onclick="closeNoteEditModal()">
                        <i class="fas fa-times"></i> İptal
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Modal'ı sayfaya ekle
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Textarea'ya focus ver
    document.getElementById('edit-note-text').focus();
}

// Not düzenlemeyi kaydet
function saveNoteEdit(noteId, noteType) {
    const newContent = document.getElementById('edit-note-text').value.trim();
    
    if (!newContent) {
        alert('Not içeriği boş olamaz!');
        return;
    }
    
    updateNote(noteId, newContent, noteType);
    closeNoteEditModal();
}

// Not düzenleme modalını kapat
function closeNoteEditModal() {
    const modal = document.getElementById('note-edit-modal');
    if (modal) {
        modal.remove();
    }
}

// Not güncelleme
async function updateNote(noteId, content, noteType) {
    if (!content) {
        alert('Not içeriği boş olamaz!');
        return;
    }
    
    try {
        const response = await fetch(`/api/notlar/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ not_metni: content, kategori: noteType })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            loadActivities(currentPersonelId);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Not güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Görev silme
async function deleteTask(taskId) {
    if (!confirm('Bu görevi silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/gorevler/${taskId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            loadActivities(currentPersonelId);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev silinirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Görev düzenleme - Modal ile
function editTask(taskId, baslik, aciklama, bitisTarihi, performans) {
    showTaskEditModal(taskId, baslik, aciklama, bitisTarihi, performans);
}

// Görev düzenleme modalını göster
function showTaskEditModal(taskId, baslik, aciklama, bitisTarihi, performans) {
    const modalHtml = `
        <div id="task-edit-modal" class="modal-overlay">
            <div class="modal-content task-modal">
                <h3>Görev Düzenle</h3>
                
                <div class="form-group">
                    <label>Görev Başlığı:</label>
                    <input type="text" id="edit-task-title" value="${baslik}" placeholder="Görev başlığı...">
                </div>
                
                <div class="form-group">
                    <label>Görev Açıklaması:</label>
                    <textarea id="edit-task-description" rows="3" placeholder="Görev açıklaması...">${aciklama}</textarea>
                </div>
                
                <div class="form-group">
                    <label>Bitiş Tarihi:</label>
                    <input type="date" id="edit-task-date" value="${bitisTarihi}">
                </div>
                
                ${performans > 0 ? `
                    <div class="form-group">
                        <label>Performans Puanı:</label>
                        <div class="star-edit-section">
                            <div class="stars-edit">
                                ${[1,2,3,4,5].map(i => `
                                    <span class="star-edit ${performans >= i ? 'filled' : ''}" 
                                          onclick="setEditStarRating(${i})" 
                                          data-rating="${i}" 
                                          title="${i} yıldız">★</span>
                                `).join('')}
                            </div>
                            <span id="star-rating-text">${performans}/5</span>
                        </div>
                    </div>
                ` : ''}
                
                <div class="task-edit-buttons">
                    <button class="btn btn-success" onclick="saveTaskEdit(${taskId}, ${performans})">
                        <i class="fas fa-save"></i> Kaydet
                    </button>
                    <button class="btn btn-secondary" onclick="closeTaskEditModal()">
                        <i class="fas fa-times"></i> İptal
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('edit-task-title').focus();
}

// Yıldız puanını ayarla
function setEditStarRating(rating) {
    const stars = document.querySelectorAll('.star-edit');
    const ratingText = document.getElementById('star-rating-text');
    
    console.log('Yıldız puanı ayarlanıyor:', rating); // Debug için
    
    stars.forEach((star, index) => {
        star.dataset.rating = index + 1; // Her yıldızın kendi puanını ayarla
        
        if (index < rating) {
            star.classList.add('filled');
        } else {
            star.classList.remove('filled');
        }
    });
    
    if (ratingText) {
        ratingText.textContent = `${rating}/5`;
    }
}

// Yıldız hover efekti - Event delegation ile
document.addEventListener('mouseover', function(e) {
    if (e.target.classList.contains('star-edit')) {
        const rating = parseInt(e.target.dataset.rating);
        const starsContainer = e.target.parentElement;
        const stars = starsContainer.querySelectorAll('.star-edit');
        
        stars.forEach((star, index) => {
            if (index < rating) {
                star.style.color = '#ffc107';
            } else {
                star.style.color = '#ddd';
            }
        });
    }
});

// Yıldız hover çıkış efekti
document.addEventListener('mouseout', function(e) {
    if (e.target.classList.contains('star-edit')) {
        const starsContainer = e.target.parentElement;
        const stars = starsContainer.querySelectorAll('.star-edit');
        
        stars.forEach(star => {
            // Orijinal duruma dön
            star.style.color = '';
        });
    }
});

// Görev düzenlemeyi kaydet
function saveTaskEdit(taskId, hasPerformance) {
    const title = document.getElementById('edit-task-title').value.trim();
    const description = document.getElementById('edit-task-description').value.trim();
    const date = document.getElementById('edit-task-date').value;
    
    if (!title) {
        alert('Görev başlığı boş olamaz!');
        return;
    }
    
    const taskData = {
        gorev_baslik: title,
        gorev_aciklama: description,
        bitis_tarihi: date || null
    };
    
    // Eğer performans puanı varsa ekle
    if (hasPerformance > 0) {
        // Seçili yıldız sayısını bul
        const filledStars = document.querySelectorAll('.star-edit.filled');
        const rating = filledStars.length > 0 ? filledStars.length : hasPerformance;
        
        console.log('Seçili yıldız sayısı:', rating); // Debug için
        
        taskData.performans_puani = rating;
        taskData.durum = 'tamamlandi';
    }
    
    updateTaskDetails(taskId, taskData);
    closeTaskEditModal();
}

// Görev düzenleme modalını kapat
function closeTaskEditModal() {
    const modal = document.getElementById('task-edit-modal');
    if (modal) {
        modal.remove();
    }
}

// Görev detaylarını güncelleme
async function updateTaskDetails(taskId, taskData) {
    try {
        const response = await fetch(`/api/gorevler/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            loadActivities(currentPersonelId);
        } else {
            alert('Hata: ' + result.error);
        }
    } catch (error) {
        console.error('Görev güncellenirken hata:', error);
        alert('Bir hata oluştu!');
    }
}

// Menü toggle fonksiyonları
function toggleCardMenu(event, personelId) {
    event.stopPropagation(); // Kartın tıklama olayını engelle
    
    const menu = document.getElementById(`menu-${personelId}`);
    const allMenus = document.querySelectorAll('.menu-dropdown');
    
    // Diğer menüleri kapat
    allMenus.forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    
    // Bu menüyü aç/kapat
    menu.classList.toggle('show');
}

function toggleActivityMenu(event, menuId) {
    event.stopPropagation();
    
    const menu = document.getElementById(`menu-${menuId}`);
    const allMenus = document.querySelectorAll('.menu-dropdown');
    
    // Diğer menüleri kapat
    allMenus.forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });
    
    // Bu menüyü aç/kapat
    menu.classList.toggle('show');
}

// Sayfa tıklandığında menüleri kapat
document.addEventListener('click', function() {
    const allMenus = document.querySelectorAll('.menu-dropdown');
    allMenus.forEach(menu => menu.classList.remove('show'));
});