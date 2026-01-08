// dashboard.js - لاجیک صفحه اصلی (پلیر، لاگین، لیست)

let currentUser = null;
let playlist = [];
let allExamsList = []; 
let activeVid = null;
let maxTime = 0;
let isDone = false;
let nextCheckTime = 300; // 5 دقیقه
let timerInterval = null;
let lastActivityTime = Date.now();
let isDragging = false;

const vid = document.getElementById('myVideo');
const container = document.getElementById('playerContainer');
const pBar = document.getElementById('progressBar');
const pThumb = document.getElementById('progressThumb');
const pContainer = document.getElementById('progressBarContainer');

// --- 1. شروع برنامه ---
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('intro-overlay').classList.add('move-down');
        document.querySelectorAll('.card').forEach(c => c.classList.add('show-content'));
        document.getElementById('loginFooterSig').classList.add('show');
        setTimeout(() => {
            document.getElementById('intro-overlay').style.display = 'none';
            checkAuth();
        }, 1200);
    }, 2500);
});

function toPersianNum(n) { return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); }
function getDeviceInfo() { return /Mobile|Android/i.test(navigator.userAgent) ? "📱 Mobile" : "💻 PC"; }

// --- 2. سیستم احراز هویت ---
async function checkAuth() {
    const savedUser = localStorage.getItem(DB_KEY + 'creds');
    
    if(savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            currentUser = userData;
            if(userData.jsonData) {
                RankSystem.init(userData.jsonData);
                document.getElementById('displayName').innerText = userData.displayName;
                showScreen('screen-library');
            }
        } catch(e) {}
        
        try {
            const creds = JSON.parse(savedUser);
            // سینک منیجر اتوماتیک دیتای جدید را می‌گیرد
            if(typeof SyncManager !== 'undefined') {
                // یک سینک خالی برای گرفتن آخرین وضعیت از سرور
                fetch(API_URL, {
                    method: 'POST', headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: 'login', username: creds.username, password: creds.password })
                })
                .then(r => r.json())
                .then(data => {
                    if(data.status === 'success') {
                        const updatedUser = { username: creds.username, password: creds.password, displayName: data.displayName, jsonData: data.jsonData };
                        localStorage.setItem(DB_KEY + 'creds', JSON.stringify(updatedUser));
                        currentUser = updatedUser;
                        RankSystem.init(data.jsonData);
                        document.getElementById('displayName').innerText = data.displayName;
                        
                        // رفرش لیست‌ها
                        fetchPlaylist(); 
                        fetchExamsForHistory();
                        RankSystem.loadWallOfFame();
                    }
                });
            }
        } catch(e) {
            if(!currentUser) showScreen('screen-login');
        }
    } else { showScreen('screen-login'); }
}

async function performLogin() {
    const u = document.getElementById('inpUser').value.trim();
    const p = document.getElementById('inpPass').value.trim();
    const btn = document.getElementById('btnLogin');
    const msg = document.getElementById('loginMsg');
    
    if(!u || !p) return msg.innerText = "لطفا نام کاربری و رمز را وارد کنید";
    
    btn.classList.add('btn-loading'); btn.innerText = "درحال بررسی..."; msg.innerText = "";

    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'login', username: u, password: p })
        });
        const data = await res.json();
        
        if(data.status === 'success') {
            const userData = { username: u, password: p, displayName: data.displayName, jsonData: data.jsonData };
            localStorage.setItem(DB_KEY + 'creds', JSON.stringify(userData));
            currentUser = userData;
            
            RankSystem.init(data.jsonData);
            document.getElementById('displayName').innerText = data.displayName;
            showScreen('screen-library');
            fetchPlaylist();
            fetchExamsForHistory();
            RankSystem.loadWallOfFame();

        } else { msg.innerText = data.message || "خطا در ورود"; }
    } catch(e) { msg.innerText = "خطا در اتصال به سرور."; }
    btn.classList.remove('btn-loading'); btn.innerText = "ورود امن 🔐";
}

function logout() {
    if(confirm("خروج از حساب کاربری؟")) {
        localStorage.removeItem(DB_KEY + 'creds');
        location.reload();
    }
}

function showScreen(id) {
    document.querySelectorAll('.card').forEach(c => {
        c.classList.remove('active'); 
        c.classList.add('hidden');
    });
    const target = document.getElementById(id);
    target.classList.remove('hidden');
    target.classList.add('active');
    setTimeout(() => target.classList.add('show-content'), 50);
}

// --- 3. مدیریت لیست درس‌ها ---
async function fetchPlaylist() {
    const listContainer = document.getElementById('video-list-container');
    if(!playlist.length) listContainer.innerHTML = `<div style="text-align:center; padding:20px;"><div class="spinner"></div><p style="color:#7f8c8d;">در حال دریافت درس‌ها...</p></div>`;
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_lessons' }) });
        const result = await res.json();
        if(result.status === 'success') {
            playlist = result.data.reverse(); 
            renderList();
        } 
    } catch (err) { 
        if(!playlist.length) listContainer.innerHTML = `<div style="text-align:center;color:#c0392b;"><p>⚠️ عدم دسترسی به اینترنت</p></div>`;
    }
}

function renderList() {
    const list = document.getElementById('video-list-container');
    list.innerHTML = "";
    if(!playlist || playlist.length === 0) { list.innerHTML = "<p style='text-align:center;'>📭 درسی یافت نشد.</p>"; return; }
    
    playlist.forEach(item => {
        const isCompleted = RankSystem.data.completed.includes(item.id.toString());
        const icon = isCompleted ? '✅' : '▶️';
        const hasFile = (item.attach && item.attach.length > 3);
        const newTag = item.is_new ? `<div class="new-badge">🆕 جدید</div>` : '';
        
        const el = document.createElement('div');
        el.className = `video-item ${isCompleted ? 'done' : ''}`;
        el.style.cssText = "background: #fff; border: 2px solid #f1f2f6; border-radius: 15px; margin-bottom: 15px; padding: 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; position: relative;";
        if(isCompleted) el.style.borderColor = "var(--accent)";
        
        el.onclick = () => playVideo(item);
        el.innerHTML = `${newTag}<div class="video-icon" style="font-size:1.5rem">${icon}</div><div class="video-info"><h4>${item.title}</h4><div style="font-size:0.8rem; color:#7f8c8d;">${isCompleted ? 'تکمیل شد' : 'برای مشاهده کلیک کنید'}${hasFile ? ' | 📎 فایل ضمیمه' : ''}</div></div>`;
        list.appendChild(el);
    });
}

// --- 4. منطق پلیر و ضد تقلب ---
function playVideo(item) {
    history.pushState({ page: 'player' }, "Player", "#player");
    activeVid = item;
    document.getElementById('videoTitle').innerText = item.title;
    isDone = RankSystem.data.completed.includes(item.id.toString());
    vid.src = item.link;
    lastActivityTime = Date.now();
    
    const dlContainer = document.getElementById('downloadContainer');
    dlContainer.innerHTML = ""; 
    if(item.attach && item.attach.length > 3) {
        item.attach.split(',').forEach((f, idx) => {
            const parts = f.split('|');
            const name = parts[0] || `فایل ${idx+1}`;
            const link = parts[1] || f;
            if(link.length > 5) dlContainer.innerHTML += `<a href="${link}" target="_blank" class="download-btn" style="display:block; margin-top:5px; padding:10px; border:1px solid #eee; border-radius:10px; text-decoration:none; color:#333;">📥 ${name}</a>`;
        });
    }
    
    const serverLastTime = RankSystem.getLastPosition(item.id);
    maxTime = isDone ? 999999 : serverLastTime;
    
    nextCheckTime = (isDone ? 999999 : (maxTime + 300));
    showScreen('screen-player');
    
    if(isDone) { updateProgressUI(100); document.getElementById('viewStatus').innerText = "تکمیل شد! ✅"; document.getElementById('viewPercent').innerText = "۱۰۰٪"; } 
    else { document.getElementById('viewStatus').innerText = "در حال تماشا..."; updateProgressUI(0); }
    
    if(serverLastTime > 5 && !isDone) { 
        if(confirm("ادامه پخش از جای قبلی؟")) vid.currentTime = serverLastTime; else vid.currentTime = 0; 
    } else vid.currentTime = 0;
}

function closePlayer() {
    vid.pause();
    if(document.fullscreenElement) document.exitFullscreen();
    renderList(); 
    showScreen('screen-library');
    if(window.location.hash === '#player') history.replaceState(null, null, ' ');
}

// دکمه بازگشت موبایل
window.addEventListener('popstate', (event) => {
    if (!document.getElementById('screen-player').classList.contains('hidden')) closePlayer();
});

// کنترل‌ها
function togglePlay() { if(vid.paused) vid.play(); else vid.pause(); updatePlayBtn(); }
function updatePlayBtn() { document.getElementById('playBtn').innerText = vid.paused ? '▶️' : '⏸️'; }
vid.addEventListener('play', updatePlayBtn);
vid.addEventListener('pause', updatePlayBtn);
vid.addEventListener('click', togglePlay);

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        if(container.requestFullscreen) container.requestFullscreen();
        else if(container.webkitRequestFullscreen) container.webkitRequestFullscreen();
    } else { if(document.exitFullscreen) document.exitFullscreen(); }
}

// درگ کردن نوار پیشرفت
pContainer.addEventListener('mousedown', startDrag);
pContainer.addEventListener('touchstart', startDrag, {passive: false});
document.addEventListener('mousemove', doDrag);
document.addEventListener('touchmove', doDrag, {passive: false});
document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

function startDrag(e) { isDragging = true; vid.pause(); doDrag(e); }
function doDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const rect = pContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let percent = (clientX - rect.left) / rect.width;
    if (percent < 0) percent = 0; if (percent > 1) percent = 1;
    let targetTime = percent * vid.duration;
    
    // ضد تقلب: جلو زدن ممنوع
    if (targetTime > maxTime + 2 && !isDone) { 
        targetTime = maxTime; 
        percent = maxTime / vid.duration; 
        document.getElementById('cheatAlert').style.display = 'block'; 
        setTimeout(() => document.getElementById('cheatAlert').style.display = 'none', 1000); 
    }
    updateProgressUI(percent * 100);
    const m = Math.floor(targetTime / 60); const s = Math.floor(targetTime % 60);
    document.getElementById('timeDisplay').innerText = `${m}:${s < 10 ? '0'+s : s}`;
    pContainer.dataset.targetTime = targetTime;
}
function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;
    const targetTime = parseFloat(pContainer.dataset.targetTime || vid.currentTime);
    vid.currentTime = targetTime;
    vid.play();
}
function updateProgressUI(percent) { pBar.style.width = percent + "%"; pThumb.style.left = percent + "%"; }

vid.addEventListener('timeupdate', () => {
    if (isDragging) return;
    const percent = (vid.currentTime / vid.duration) * 100;
    if(!isNaN(percent)) { updateProgressUI(percent); document.getElementById('viewPercent').innerText = toPersianNum(Math.floor(percent)) + "٪"; }
    const m = Math.floor(vid.currentTime / 60); const s = Math.floor(vid.currentTime % 60);
    document.getElementById('timeDisplay').innerText = `${m}:${s < 10 ? '0'+s : s}`;
    
    if(!vid.seeking && vid.currentTime > maxTime) { 
        maxTime = vid.currentTime; 
        RankSystem.savePosition(activeVid.id, vid.currentTime); 
    }
    
    if(!isDone && vid.currentTime > nextCheckTime) triggerSecurityCheck();
    if(vid.duration && percent >= 98 && !isDone) finishLesson();
});

// سوال امنیتی ریاضی
function triggerSecurityCheck() {
    vid.pause();
    const n1 = Math.floor(Math.random()*10)+1; const n2 = Math.floor(Math.random()*10)+1;
    window.securityResult = n1 + n2; 
    document.getElementById('mathQ').innerText = `${toPersianNum(n1)} + ${toPersianNum(n2)} = ؟`;
    document.getElementById('mathAns').value = "";
    document.getElementById('securityModal').style.display = 'flex';
    let timeLeft = 60;
    document.getElementById('timerDisplay').innerText = toPersianNum(timeLeft);
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timerDisplay').innerText = toPersianNum(timeLeft);
        if(timeLeft <= 0) { clearInterval(timerInterval); punishUser(); }
    }, 1000);
}

function checkSecurityAnswer() {
    function toEn(s) { return s.replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)); }
    if(parseInt(toEn(document.getElementById('mathAns').value)) === window.securityResult) {
        clearInterval(timerInterval); document.getElementById('securityModal').style.display = 'none'; 
        nextCheckTime = vid.currentTime + 300; vid.play();
    } else { document.getElementById('mathAns').style.borderColor = 'red'; }
}

function punishUser() {
    document.getElementById('securityModal').style.display = 'none'; 
    alert("⏰ زمان تمام شد! بازگشت به عقب."); 
    let penaltyTime = Math.max(0, vid.currentTime - 400); 
    vid.currentTime = penaltyTime; 
    maxTime = penaltyTime; 
    RankSystem.savePosition(activeVid.id, penaltyTime); 
}

function finishLesson() {
    if (isDone) return;
    isDone = true;
    vid.pause();
    if (document.fullscreenElement) document.exitFullscreen();
    document.getElementById('viewStatus').innerText = "تکمیل شد! ✅";
    
    SyncManager.addToQueue('claim_reward', { reward_type: 'lesson', reward_id: activeVid.id });
    setTimeout(() => { launchConfetti(); }, 300);
}

// توقف فیلم هنگام خروج از صفحه
document.addEventListener("visibilitychange", function() {
    if (document.hidden) { vid.pause(); updatePlayBtn(); }
});

// --- تاریخچه و اعلانات ---
async function fetchExamsForHistory() {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_exams' }) });
        const result = await res.json();
        if(result.status === 'success') { allExamsList = result.data; }
    } catch(e) {}
}

function openHistory() {
    document.getElementById('historyModal').style.display = 'flex';
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';
    const details = RankSystem.data.exam_details || {};
    const takenIds = Object.keys(details).reverse();
    
    if(takenIds.length === 0) { container.innerHTML = '<p style="text-align:center; color:#999;">هنوز در آزمونی شرکت نکرده‌اید.</p>'; return; }

    takenIds.forEach(eid => {
        const examInfo = allExamsList.find(e => String(e.id) === String(eid));
        if (!examInfo) return;
        const examDetail = details[eid];
        const score = parseFloat(examDetail.score || 0);
        let badgeColor = score >= 20 ? "#8e44ad" : (score >= 17 ? "#2ecc71" : (score >= 12 ? "#2980b9" : "#f1c40f"));
        
        container.innerHTML += `
            <div style="background:white; border:1px solid #eee; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-right:5px solid ${badgeColor};">
                <div><div style="font-weight:bold;">${examInfo.title}</div><div style="font-size:0.75rem; color:#999;">${examDetail.date}</div></div>
                <div style="font-weight:bold; color:${badgeColor};">${score}</div>
            </div>`;
    });
}

function showNotifications() {
    document.getElementById('notifModal').style.display = 'flex';
    document.getElementById('notifDot').style.display = 'none'; 
    const container = document.getElementById('notifListContainer');
    container.innerHTML = '';
    const list = RankSystem.notifications || [];
    
    if(list.length === 0) { container.innerHTML = '<p style="color:#999; text-align:center;">پیام جدیدی نیست.</p>'; }
    else {
        list.forEach(n => {
            container.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; font-size:0.9rem;">${n.text}<div style="font-size:0.7rem; color:#ccc; margin-top:4px;">${n.date}</div></div>`;
        });
    }
}
function closeNotif() { document.getElementById('notifModal').style.display='none'; }