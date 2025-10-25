// Database operations - server.js'den taşındı
const { supabase, useSupabase, db } = require('../config/database');
const { generateInviteCode } = require('./auth');

const dbOperations = {
    // Personel işlemleri
    async getPersonel(organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('personel')
                .select('*')
                .eq('aktif', true);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.order('ad', { ascending: true });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                let sql = 'SELECT * FROM personel WHERE aktif = 1';
                let params = [];

                if (organizationId) {
                    sql += ' AND organization_id = ?';
                    params.push(organizationId);
                }

                sql += ' ORDER BY ad, soyad';

                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    },

    async addPersonel(personelData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('personel')
                .insert([personelData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { ad, soyad, pozisyon, telefon, email, baslangic_tarihi, organization_id, created_by } = personelData;
                db.run(
                    'INSERT INTO personel (ad, soyad, pozisyon, telefon, email, baslangic_tarihi, organization_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [ad, soyad, pozisyon, telefon, email, baslangic_tarihi, organization_id, created_by],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updatePersonel(id, personelData, organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('personel')
                .update(personelData)
                .eq('id', id);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.select();

            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { ad, soyad, pozisyon } = personelData;
                let sql = 'UPDATE personel SET ad = ?, soyad = ?, pozisyon = ? WHERE id = ?';
                let params = [ad, soyad, pozisyon, id];

                if (organizationId) {
                    sql += ' AND organization_id = ?';
                    params.push(organizationId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes });
                });
            });
        }
    },

    async deletePersonel(id, organizationId = null) {
        if (useSupabase) {
            // Önce organizasyon kontrolü yap
            if (organizationId) {
                const { data: personel } = await supabase
                    .from('personel')
                    .select('id')
                    .eq('id', id)
                    .eq('organization_id', organizationId)
                    .maybeSingle();

                if (!personel) {
                    throw new Error('Personel bulunamadı veya erişim yetkiniz yok');
                }
            }

            // Önce notları ve görevleri sil
            await supabase.from('notlar').delete().eq('personel_id', id);
            await supabase.from('gorevler').delete().eq('personel_id', id);

            const { error } = await supabase
                .from('personel')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                db.serialize(() => {
                    // Organizasyon kontrolü
                    if (organizationId) {
                        db.get('SELECT id FROM personel WHERE id = ? AND organization_id = ?', [id, organizationId], (err, row) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            if (!row) {
                                reject(new Error('Personel bulunamadı veya erişim yetkiniz yok'));
                                return;
                            }

                            // Silme işlemini yap
                            db.run('DELETE FROM notlar WHERE personel_id = ?', [id]);
                            db.run('DELETE FROM gorevler WHERE personel_id = ?', [id]);
                            db.run('DELETE FROM personel WHERE id = ?', [id], function (err) {
                                if (err) reject(err);
                                else resolve({ changes: this.changes });
                            });
                        });
                    } else {
                        db.run('DELETE FROM notlar WHERE personel_id = ?', [id]);
                        db.run('DELETE FROM gorevler WHERE personel_id = ?', [id]);
                        db.run('DELETE FROM personel WHERE id = ?', [id], function (err) {
                            if (err) reject(err);
                            else resolve({ changes: this.changes });
                        });
                    }
                });
            });
        }
    },

    // Not işlemleri
    async getPersonelNotes(personelId, organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('notlar')
                .select(`
                    *,
                    users!created_by(username, full_name)
                `)
                .eq('personel_id', personelId);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                let sql = `
                    SELECT n.*, u.username, u.full_name as created_by_name 
                    FROM notlar n 
                    LEFT JOIN users u ON n.created_by = u.id 
                    WHERE n.personel_id = ?
                `;
                let params = [personelId];

                if (organizationId) {
                    sql += ' AND n.organization_id = ?';
                    params.push(organizationId);
                }

                sql += ' ORDER BY n.tarih DESC';

                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    },

    async addNote(noteData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('notlar')
                .insert([noteData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { personel_id, not_metni, kategori, created_by, organization_id } = noteData;
                db.run(
                    'INSERT INTO notlar (personel_id, not_metni, kategori, created_by, organization_id) VALUES (?, ?, ?, ?, ?)',
                    [personel_id, not_metni, kategori || 'genel', created_by, organization_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updateNote(id, noteData, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - sadece not sahibi veya organizasyon sahibi güncelleyebilir
            let query = supabase
                .from('notlar')
                .update(noteData)
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (userRole !== 'organizasyon_sahibi') {
                query = query.eq('created_by', userId);
            }

            const { data, error } = await query.select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Not bulunamadı veya güncelleme yetkiniz yok');
            }
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                const { not_metni, kategori } = noteData;
                let sql = 'UPDATE notlar SET not_metni = ?, kategori = ? WHERE id = ? AND organization_id = ?';
                let params = [not_metni, kategori, id, organizationId];

                if (userRole !== 'organizasyon_sahibi') {
                    sql += ' AND created_by = ?';
                    params.push(userId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Not bulunamadı veya güncelleme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    async deleteNote(id, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - sadece not sahibi veya organizasyon sahibi silebilir
            let query = supabase
                .from('notlar')
                .delete()
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (userRole !== 'organizasyon_sahibi') {
                query = query.eq('created_by', userId);
            }

            const { error, count } = await query;

            if (error) throw error;
            if (count === 0) {
                throw new Error('Not bulunamadı veya silme yetkiniz yok');
            }
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                let sql = 'DELETE FROM notlar WHERE id = ? AND organization_id = ?';
                let params = [id, organizationId];

                if (userRole !== 'organizasyon_sahibi') {
                    sql += ' AND created_by = ?';
                    params.push(userId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Not bulunamadı veya silme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    // Görev işlemleri
    async getPersonelTasks(personelId, organizationId = null) {
        if (useSupabase) {
            let query = supabase
                .from('gorevler')
                .select(`
                    *,
                    created_by_user:users!gorevler_created_by_fkey(username, full_name),
                    assigned_to_user:users!gorevler_assigned_to_fkey(username, full_name)
                `)
                .eq('personel_id', personelId);

            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                let sql = `
                    SELECT g.*, 
                           u1.username as created_by_username, u1.full_name as created_by_name,
                           u2.username as assigned_to_username, u2.full_name as assigned_to_name
                    FROM gorevler g 
                    LEFT JOIN users u1 ON g.created_by = u1.id 
                    LEFT JOIN users u2 ON g.assigned_to = u2.id 
                    WHERE g.personel_id = ?
                `;
                let params = [personelId];

                if (organizationId) {
                    sql += ' AND g.organization_id = ?';
                    params.push(organizationId);
                }

                sql += ' ORDER BY g.created_at DESC';

                db.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    },

    async addTask(taskData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('gorevler')
                .insert([taskData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi, created_by, assigned_to, organization_id } = taskData;
                db.run(
                    'INSERT INTO gorevler (personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi, created_by, assigned_to, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [personel_id, gorev_baslik, gorev_aciklama, bitis_tarihi, created_by, assigned_to, organization_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async updateTask(id, taskData, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - görev sahibi, atanan kişi veya yöneticiler güncelleyebilir
            let query = supabase
                .from('gorevler')
                .update(taskData)
                .eq('id', id)
                .eq('organization_id', organizationId);

            // Sadece organizasyon sahibi ve yönetici tüm görevleri güncelleyebilir
            if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                // Personel sadece kendine atanan görevleri güncelleyebilir
                query = query.eq('assigned_to', userId);
            }

            const { data, error } = await query.select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Görev bulunamadı veya güncelleme yetkiniz yok');
            }
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                // Tüm alanları güncelle
                const fields = [];
                const values = [];

                if (taskData.gorev_baslik !== undefined) {
                    fields.push('gorev_baslik = ?');
                    values.push(taskData.gorev_baslik);
                }
                if (taskData.gorev_aciklama !== undefined) {
                    fields.push('gorev_aciklama = ?');
                    values.push(taskData.gorev_aciklama);
                }
                if (taskData.bitis_tarihi !== undefined) {
                    fields.push('bitis_tarihi = ?');
                    values.push(taskData.bitis_tarihi);
                }
                if (taskData.durum !== undefined) {
                    fields.push('durum = ?');
                    values.push(taskData.durum);
                }
                if (taskData.performans_puani !== undefined) {
                    fields.push('performans_puani = ?');
                    values.push(taskData.performans_puani);
                }
                if (taskData.assigned_to !== undefined) {
                    fields.push('assigned_to = ?');
                    values.push(taskData.assigned_to);
                }

                values.push(id);
                values.push(organizationId);

                let sql = `UPDATE gorevler SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`;

                // Yetki kontrolü
                if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                    sql += ' AND assigned_to = ?';
                    values.push(userId);
                }

                db.run(sql, values, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Görev bulunamadı veya güncelleme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    async deleteTask(id, userId, userRole, organizationId) {
        if (useSupabase) {
            // Yetki kontrolü - sadece görev oluşturan veya organizasyon sahibi/yönetici silebilir
            let query = supabase
                .from('gorevler')
                .delete()
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                query = query.eq('created_by', userId);
            }

            const { error, count } = await query;

            if (error) throw error;
            if (count === 0) {
                throw new Error('Görev bulunamadı veya silme yetkiniz yok');
            }
            return { success: true };
        } else {
            return new Promise((resolve, reject) => {
                let sql = 'DELETE FROM gorevler WHERE id = ? AND organization_id = ?';
                let params = [id, organizationId];

                if (!['organizasyon_sahibi', 'yonetici'].includes(userRole)) {
                    sql += ' AND created_by = ?';
                    params.push(userId);
                }

                db.run(sql, params, function (err) {
                    if (err) reject(err);
                    else if (this.changes === 0) {
                        reject(new Error('Görev bulunamadı veya silme yetkiniz yok'));
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            });
        }
    },

    // Auth işlemleri
    async createUser(userData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .insert([userData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { username, password_hash, full_name, organization_id, role } = userData;
                db.run(
                    'INSERT INTO users (username, password_hash, full_name, organization_id, role) VALUES (?, ?, ?, ?, ?)',
                    [username, password_hash, full_name, organization_id, role || 'personel'],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async getUserByUsername(username) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE username = ? AND is_active = 1',
                    [username],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async getUserById(userId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM users WHERE id = ? AND is_active = 1',
                    [userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async createOrganization(orgData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .insert([orgData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                const { name, invite_code, owner_id } = orgData;
                db.run(
                    'INSERT INTO organizations (name, invite_code, owner_id) VALUES (?, ?, ?)',
                    [name, invite_code, owner_id],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    }
                );
            });
        }
    },

    async getOrganizationByInviteCode(inviteCode) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('invite_code', inviteCode)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM organizations WHERE invite_code = ? AND is_active = 1',
                    [inviteCode],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async updateUserSession(userId, sessionToken, expiresAt) {
        if (useSupabase) {
            const { error } = await supabase
                .from('users')
                .update({
                    session_token: sessionToken,
                    session_expires_at: expiresAt,
                    last_login: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) throw error;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET session_token = ?, session_expires_at = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                    [sessionToken, expiresAt, userId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    async updateUserOrganization(userId, organizationId) {
        if (useSupabase) {
            const { error } = await supabase
                .from('users')
                .update({ organization_id: organizationId })
                .eq('id', userId);

            if (error) throw error;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET organization_id = ? WHERE id = ?',
                    [organizationId, userId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    // Organizasyon işlemleri
    async getOrganizationMembers(organizationId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, full_name, role, is_active, created_at, last_login')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.all(
                    'SELECT id, username, full_name, role, is_active, created_at, last_login FROM users WHERE organization_id = ? AND is_active = 1 ORDER BY created_at',
                    [organizationId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
        }
    },

    async updateUserRole(userId, newRole, organizationId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId)
                .eq('organization_id', organizationId)
                .select();

            if (error) throw error;
            return data[0];
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET role = ? WHERE id = ? AND organization_id = ?',
                    [newRole, userId, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        }
    },

    async getOrganizationStats(organizationId) {
        if (useSupabase) {
            // Kullanıcı sayısı
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, role')
                .eq('organization_id', organizationId)
                .eq('is_active', true);

            if (usersError) throw usersError;

            // Personel sayısı
            const { data: personel, error: personelError } = await supabase
                .from('personel')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('aktif', true);

            if (personelError) throw personelError;

            // Not sayısı
            const { data: notlar, error: notlarError } = await supabase
                .from('notlar')
                .select('id')
                .eq('organization_id', organizationId);

            if (notlarError) throw notlarError;

            // Görev sayısı
            const { data: gorevler, error: gorevlerError } = await supabase
                .from('gorevler')
                .select('id, durum')
                .eq('organization_id', organizationId);

            if (gorevlerError) throw gorevlerError;

            return {
                totalUsers: users.length,
                usersByRole: {
                    organizasyon_sahibi: users.filter(u => u.role === 'organizasyon_sahibi').length,
                    yonetici: users.filter(u => u.role === 'yonetici').length,
                    personel: users.filter(u => u.role === 'personel').length
                },
                totalPersonel: personel.length,
                totalNotes: notlar.length,
                totalTasks: gorevler.length,
                tasksByStatus: {
                    beklemede: gorevler.filter(g => g.durum === 'beklemede').length,
                    devam_ediyor: gorevler.filter(g => g.durum === 'devam_ediyor').length,
                    tamamlandi: gorevler.filter(g => g.durum === 'tamamlandi').length
                }
            };
        } else {
            return new Promise((resolve, reject) => {
                // Paralel sorgular için Promise.all kullan
                const queries = [
                    // Kullanıcı sayıları
                    new Promise((res, rej) => {
                        db.all(
                            'SELECT role, COUNT(*) as count FROM users WHERE organization_id = ? AND is_active = 1 GROUP BY role',
                            [organizationId],
                            (err, rows) => err ? rej(err) : res(rows)
                        );
                    }),
                    // Personel sayısı
                    new Promise((res, rej) => {
                        db.get(
                            'SELECT COUNT(*) as count FROM personel WHERE organization_id = ? AND aktif = 1',
                            [organizationId],
                            (err, row) => err ? rej(err) : res(row)
                        );
                    }),
                    // Not sayısı
                    new Promise((res, rej) => {
                        db.get(
                            'SELECT COUNT(*) as count FROM notlar WHERE organization_id = ?',
                            [organizationId],
                            (err, row) => err ? rej(err) : res(row)
                        );
                    }),
                    // Görev sayıları
                    new Promise((res, rej) => {
                        db.all(
                            'SELECT durum, COUNT(*) as count FROM gorevler WHERE organization_id = ? GROUP BY durum',
                            [organizationId],
                            (err, rows) => err ? rej(err) : res(rows)
                        );
                    })
                ];

                Promise.all(queries)
                    .then(([userRoles, personelCount, noteCount, taskStatuses]) => {
                        const usersByRole = {
                            organizasyon_sahibi: 0,
                            yonetici: 0,
                            personel: 0
                        };

                        userRoles.forEach(row => {
                            usersByRole[row.role] = row.count;
                        });

                        const tasksByStatus = {
                            beklemede: 0,
                            devam_ediyor: 0,
                            tamamlandi: 0
                        };

                        taskStatuses.forEach(row => {
                            tasksByStatus[row.durum] = row.count;
                        });

                        resolve({
                            totalUsers: Object.values(usersByRole).reduce((a, b) => a + b, 0),
                            usersByRole,
                            totalPersonel: personelCount.count,
                            totalNotes: noteCount.count,
                            totalTasks: Object.values(tasksByStatus).reduce((a, b) => a + b, 0),
                            tasksByStatus
                        });
                    })
                    .catch(reject);
            });
        }
    },

    async generateNewInviteCode(organizationId) {
        let newCode;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            newCode = generateInviteCode();
            attempts++;

            // Kod benzersiz mi kontrol et
            const existing = await this.getOrganizationByInviteCode(newCode);
            if (!existing) {
                break;
            }
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            throw new Error('Benzersiz davet kodu oluşturulamadı');
        }

        // Organizasyonun davet kodunu güncelle
        if (useSupabase) {
            const { error } = await supabase
                .from('organizations')
                .update({ invite_code: newCode })
                .eq('id', organizationId);

            if (error) throw error;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE organizations SET invite_code = ? WHERE id = ?',
                    [newCode, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else resolve({ invite_code: newCode });
                    }
                );
            });
        }

        return { invite_code: newCode };
    },

    async getOrganizationById(organizationId) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', organizationId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.get(
                    'SELECT * FROM organizations WHERE id = ? AND is_active = 1',
                    [organizationId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
        }
    },

    async updateOrganization(organizationId, updateData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .update({
                    name: updateData.name,
                    updated_at: new Date().toISOString()
                })
                .eq('id', organizationId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE organizations SET name = ? WHERE id = ? AND is_active = 1',
                    [updateData.name, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Organizasyon bulunamadı'));
                        else resolve({ id: organizationId, changes: this.changes });
                    }
                );
            });
        }
    },

    async updateOrganizationInviteCode(organizationId, inviteCode) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('organizations')
                .update({
                    invite_code: inviteCode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', organizationId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE organizations SET invite_code = ? WHERE id = ? AND is_active = 1',
                    [inviteCode, organizationId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Organizasyon bulunamadı'));
                        else resolve({ id: organizationId, changes: this.changes });
                    }
                );
            });
        }
    },

    async updateUserProfile(userId, updateData) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({
                    full_name: updateData.full_name
                })
                .eq('id', userId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET full_name = ? WHERE id = ? AND is_active = 1',
                    [updateData.full_name, userId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Kullanıcı bulunamadı'));
                        else resolve({ id: userId, changes: this.changes });
                    }
                );
            });
        }
    },

    async updateUserPassword(userId, passwordHash) {
        if (useSupabase) {
            const { data, error } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash
                })
                .eq('id', userId)
                .eq('is_active', true)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            return new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET password_hash = ? WHERE id = ? AND is_active = 1',
                    [passwordHash, userId],
                    function (err) {
                        if (err) reject(err);
                        else if (this.changes === 0) reject(new Error('Kullanıcı bulunamadı'));
                        else resolve({ id: userId, changes: this.changes });
                    }
                );
            });
        }
    },

    // AI Analiz sonuçlarını kaydet
    async saveNoteAnalysis(noteId, analysis) {
        if (useSupabase) {
            // Supabase için implement edilecek
            return null;
        } else {
            return new Promise((resolve, reject) => {
                // Her yetkinlik için ayrı kayıt
                const competencyIds = {
                    communication: 1,
                    teamwork: 2,
                    problem_solving: 3,
                    customer_focus: 4,
                    reliability: 5
                };

                const insertPromises = Object.keys(analysis.scores).map(competency => {
                    const score = analysis.scores[competency];
                    return new Promise((res, rej) => {
                        db.run(`
                            INSERT INTO note_analysis 
                            (note_id, competency_id, likert_score, confidence_level, ai_reasoning)
                            VALUES (?, ?, ?, ?, ?)
                        `, [
                            noteId,
                            competencyIds[competency],
                            score.score,
                            score.confidence,
                            score.reasoning
                        ], function (err) {
                            if (err) rej(err);
                            else res(this.lastID);
                        });
                    });
                });

                Promise.all(insertPromises)
                    .then(results => resolve(results))
                    .catch(err => reject(err));
            });
        }
    },

    // Personel yetkinlik özetini güncelle
    async updatePersonnelCompetencySummary(personnelId, analysis) {
        if (useSupabase) {
            // Supabase için implement edilecek
            return null;
        } else {
            return new Promise((resolve, reject) => {
                const competencyIds = {
                    communication: 1,
                    teamwork: 2,
                    problem_solving: 3,
                    customer_focus: 4,
                    reliability: 5
                };

                const updatePromises = Object.keys(analysis.scores).map(competency => {
                    const score = analysis.scores[competency];
                    const competencyId = competencyIds[competency];

                    return new Promise((res, rej) => {
                        // Mevcut özeti al
                        db.get(`
                            SELECT current_score, note_count 
                            FROM personnel_competency_summary 
                            WHERE personel_id = ? AND competency_id = ?
                        `, [personnelId, competencyId], (err, row) => {
                            if (err) {
                                rej(err);
                                return;
                            }

                            if (row) {
                                // Mevcut kayıt var, güncelle
                                const newNoteCount = row.note_count + 1;
                                const newScore = ((row.current_score * row.note_count) + score.score) / newNoteCount;
                                const trend = newScore > row.current_score ? 'up' :
                                    newScore < row.current_score ? 'down' : 'stable';

                                db.run(`
                                    UPDATE personnel_competency_summary 
                                    SET previous_score = current_score,
                                        current_score = ?,
                                        trend_direction = ?,
                                        note_count = ?,
                                        last_updated = CURRENT_TIMESTAMP
                                    WHERE personel_id = ? AND competency_id = ?
                                `, [newScore, trend, newNoteCount, personnelId, competencyId], function (err) {
                                    if (err) rej(err);
                                    else res(this.changes);
                                });
                            } else {
                                // Yeni kayıt oluştur
                                db.run(`
                                    INSERT INTO personnel_competency_summary 
                                    (personel_id, competency_id, current_score, previous_score, trend_direction, note_count)
                                    VALUES (?, ?, ?, ?, ?, ?)
                                `, [personnelId, competencyId, score.score, score.score, 'stable', 1], function (err) {
                                    if (err) rej(err);
                                    else res(this.lastID);
                                });
                            }
                        });
                    });
                });

                Promise.all(updatePromises)
                    .then(results => resolve(results))
                    .catch(err => reject(err));
            });
        }
    }
};

module.exports = dbOperations;