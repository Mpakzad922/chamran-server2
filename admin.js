// admin.js - مدیریت کامل (کاربران، نمرات، تکالیف)

let ADMIN_TOKEN = "";
let ALL_USERS = [];
let ALL_HOMEWORKS = [];
let META_EXAMS = {};
let META_LESSONS = {};
let NOTIFICATIONS = [];

// --- 1. ورود ---
function doLogin() {
    const pass = document.getElementById('adminPass').value.trim();
    if(pass) {
        ADMIN_TOKEN = pass;
        fetchData();
    } else alert("رمز را وارد کنید");
}

async function fetchData() {
    const loading = document.createElement('div');
    loading.className = 'modal-overlay show';
    loading.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loading);

    try {
        // دریافت کاربران و متادیتا
        const resUser = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'get_all_users', admin_token: ADMIN_TOKEN })
        });
        const dUser = await resUser.json();

        // دریافت لیست تکالیف (برای پیدا کردن فایل‌های کاربر)
        const resHw = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'get_homeworks' })
        });
        const dHw = await resHw.json();

        if(dUser.status === 'success') {
            ALL_USERS = dUser.users.map(u => {
                try { u.parsedData = JSON.parse(u.json); } catch(e) { u.parsedData = {}; }
                return u;
            });
            META_EXAMS = dUser.meta.exams || {};
            META_LESSONS = dUser.meta.lessons || {};
            NOTIFICATIONS = dUser.notifications || [];
            ALL_HOMEWORKS = dHw.data || [];

            document.getElementById('loginOverlay').classList.remove('show');
            document.getElementById('mainApp').classList.remove('hidden');
            processData();
        } else { alert(dUser.message); }
    } catch(e) { console.error(e); alert("خطا در ارتباط"); }
    
    loading.remove();
}

function processData() {
    renderUsersList(ALL_USERS);
    renderLessonsStats();
    renderExamsStats();
    renderRanking();
    renderNotifications();
}

function switchTab(t) {
    document.querySelectorAll('.section').forEach(e => e.classList.add('hidden'));
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// --- 2. لیست کاربران ---
function renderUsersList(users) {
    const list = document.getElementById('usersList');
    list.innerHTML = '';
    const now = Date.now();

    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'card user-card';
        div.onclick = () => showUserDetail(u);
        
        // وضعیت آنلاین
        const diff = (now - (u.ts || 0)) / 60000;
        let status = diff < 10 ? '<span class="status-dot st-online"></span>' : (diff < 60 ? '<span class="status-dot st-recent"></span>' : '<span class="status-dot st-offline"></span>');
        
        div.innerHTML = `
            <div>
                <div style="font-weight:bold;">${u.n} ${status}</div>
                <div style="font-size:0.8rem; color:#777;">${u.u}</div>
            </div>
            <div style="text-align:left;">
                <span style="color:var(--gem); font-weight:bold;">${u.parsedData.gem || 0} 💎</span><br>
                <span style="color:var(--blue); font-size:0.8rem;">${u.parsedData.xp || 0} XP</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function filterUsers() {
    const q = document.getElementById('searchBox').value.toLowerCase();
    renderUsersList(ALL_USERS.filter(u => u.n.includes(q) || u.u.toLowerCase().includes(q)));
}

// --- 3. جزئیات کاربر (پروفایل + تصحیح) ---
function showUserDetail(user) {
    document.getElementById('modalTitle').innerText = user.n;
    const d = user.parsedData;
    const body = document.getElementById('modalBody');
    
    // هدر: امتیازات و عملیات
    let html = `
        <div class="profile-header">
            <span class="stat-badge" style="color:var(--blue)">${d.xp || 0} XP</span>
            <span class="stat-badge" style="color:var(--gem)">${d.gem || 0} 💎</span>
            <div style="margin-top:10px; display:flex; justify-content:center; gap:5px; flex-wrap:wrap;">
                <button onclick="adminOp('give_xp','${user.u}')" class="btn btn-outline" style="width:auto; padding:5px 10px; font-size:0.8rem;">+XP</button>
                <button onclick="adminOp('give_gem','${user.u}')" class="btn btn-outline" style="width:auto; padding:5px 10px; font-size:0.8rem;">+💎</button>
                <button onclick="adminOp('ban_user','${user.u}')" class="btn btn-danger" style="width:auto; padding:5px 10px; font-size:0.8rem;">مسدود</button>
            </div>
        </div>
    `;

    // بخش جدید: تکالیف ارسال شده 📤
    html += `<div class="section-title">📤 تکالیف ارسال شده</div>`;
    let hwFound = false;
    
    ALL_HOMEWORKS.forEach(hw => {
        if(hw.submissions && hw.submissions[user.u]) {
            hwFound = true;
            const sub = hw.submissions[user.u];
            const isGraded = sub.status === 'graded';
            
            // نمایش فایل (ویس یا عکس)
            let fileDisplay = '';
            if(sub.type === 'voice' || sub.fileUrl.endsWith('.mp3') || sub.fileUrl.endsWith('.wav')) {
                fileDisplay = `<audio controls src="${API_URL}${sub.fileUrl}" style="width:100%; margin-top:5px;"></audio>`;
            } else {
                fileDisplay = `<img src="${API_URL}${sub.fileUrl}" style="max-width:100%; border-radius:10px; margin-top:5px;">`;
            }

            html += `
                <div class="hw-card">
                    <div style="font-weight:bold; color:var(--primary);">${hw.title}</div>
                    <div style="font-size:0.8rem; color:#777;">تاریخ ارسال: ${sub.date}</div>
                    ${fileDisplay}
                    
                    <div class="hw-actions">
                        ${isGraded ? `<div style="color:green; font-weight:bold; margin-bottom:5px;">✅ نمره داده شده: ${sub.score}</div>` : ''}
                        
                        <label style="font-size:0.8rem;">نمره کیفی:</label>
                        <select id="grade_${hw.id}" style="margin-bottom:5px;">
                            <option value="excellent">💎 عالی (+50 XP)</option>
                            <option value="verygood">🥇 خیلی خوب (+30 XP)</option>
                            <option value="good">🙂 خوب (+15 XP)</option>
                            <option value="normal">⚠️ نیاز به تلاش (+5 XP)</option>
                        </select>
                        <input id="feed_${hw.id}" placeholder="نظر شما (بازخورد)..." value="${sub.feedback || ''}">
                        <button onclick="submitGrade('${hw.id}', '${user.u}')" class="btn btn-accent" style="padding:8px; font-size:0.9rem;">${isGraded ? 'ویرایش نمره' : 'ثبت نمره'}</button>
                    </div>
                </div>
            `;
        }
    });
    if(!hwFound) html += `<p style="color:#999; text-align:center;">تکلیفی ارسال نکرده است.</p>`;

    // بخش آزمون‌ها
    html += `<div class="section-title">📝 نمرات آزمون</div>`;
    Object.keys(META_EXAMS).forEach(eid => {
        if(d.exams && d.exams[eid] !== undefined) {
            html += `<div class="list-row"><span>${META_EXAMS[eid].title}</span><span style="font-weight:bold;">${d.exams[eid]}</span></div>`;
        }
    });

    body.innerHTML = html;
    document.getElementById('detailModal').style.display = 'flex';
}

function closeModal() { document.getElementById('detailModal').style.display = 'none'; }

// --- 4. عملیات ادمین ---
async function adminOp(type, user) {
    let amount = 0;
    if(type.includes('give')) {
        amount = prompt("مقدار را وارد کنید:");
        if(!amount) return;
    }
    if(type === 'ban_user' && !confirm("مطمئن هستید؟")) return;

    await fetch(API_URL, {
        method: 'POST', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'admin_op', admin_token: ADMIN_TOKEN, target_user: user, op_type: type, amount: amount })
    });
    alert("انجام شد");
    fetchData(); // رفرش برای دیدن تغییرات
    closeModal();
}

async function submitGrade(hwId, user) {
    const score = document.getElementById(`grade_${hwId}`).value;
    const feedback = document.getElementById(`feed_${hwId}`).value;

    const res = await fetch(API_URL, {
        method: 'POST', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: 'grade_homework',
            admin_token: ADMIN_TOKEN,
            target_user: user,
            hw_id: hwId,
            score_quality: score,
            feedback_text: feedback
        })
    });
    
    if((await res.json()).status === 'success') {
        alert("✅ نمره ثبت شد و XP اضافه گردید.");
        fetchData(); // رفرش دیتا
        // نکته: مودال باز می‌ماند تا ادمین بتواند ادامه دهد، ولی دیتا رفرش می‌شود (چون ما fetchData زدیم ولی showUserDetail دوباره صدا زده نشد).
        // بهتر است مودال بسته شود:
        closeModal();
    } else alert("خطا");
}

// --- 5. سایر تب‌ها (آمار و اعلانات) ---
// (کد این بخش‌ها مشابه قبل است و برای کوتاهی تکرار نمی‌کنم، ولی در فایل نهایی وجود دارند)
// ... توابع renderLessonsStats, renderExamsStats, renderRanking, sendNotification ...
// برای اینکه فایل کامل باشد، کپی توابع قبلی را اینجا قرار می‌دهم:

function renderLessonsStats() {
    const c = document.getElementById('lessonsStats'); c.innerHTML='';
    Object.keys(META_LESSONS).forEach(lid => {
        let count=0; ALL_USERS.forEach(u => { if(u.parsedData.completed && u.parsedData.completed.includes(lid)) count++; });
        c.innerHTML += `<div class="list-row"><span>${META_LESSONS[lid]}</span><span class="stat-badge">${count} نفر</span></div>`;
    });
}
function renderExamsStats() {
    const c = document.getElementById('examsStats'); c.innerHTML='';
    Object.keys(META_EXAMS).forEach(eid => {
        let sum=0, cnt=0; ALL_USERS.forEach(u => { if(u.parsedData.exams && u.parsedData.exams[eid]){ sum+=parseFloat(u.parsedData.exams[eid]); cnt++; }});
        c.innerHTML += `<div class="list-row"><span>${META_EXAMS[eid].title}</span><span class="stat-badge">میانگین: ${cnt? (sum/cnt).toFixed(1) : 0}</span></div>`;
    });
}
function renderRanking() {
    const c = document.getElementById('rankingList'); c.innerHTML='';
    [...ALL_USERS].sort((a,b)=>(b.parsedData.xp||0)-(a.parsedData.xp||0)).slice(0,10).forEach((u,i)=> {
        c.innerHTML += `<div class="list-row"><b>#${i+1} ${u.n}</b><span style="color:var(--gold); font-weight:bold;">${u.parsedData.xp||0} XP</span></div>`;
    });
}
function renderNotifications() {
    const c = document.getElementById('notifHistoryList'); c.innerHTML='';
    NOTIFICATIONS.forEach(n => c.innerHTML += `<div class="list-row"><span>${n.text}</span><button onclick="delNotif('${n.id}')" style="color:red; border:none; background:none;">🗑️</button></div>`);
}
async function sendNotification() {
    await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'save_notification', admin_token:ADMIN_TOKEN, notif_text:document.getElementById('notifTxt').value, notif_type:document.getElementById('notifType').value}) });
    fetchData(); alert("ارسال شد");
}
async function delNotif(id) {
    if(confirm("حذف؟")) { await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'delete_notification', admin_token:ADMIN_TOKEN, id}) }); fetchData(); }
}
async function downloadBackup() {
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ALL_USERS));
    a.download = "backup.json"; a.click();
}