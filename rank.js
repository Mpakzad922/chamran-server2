// rank.js - هسته مرکزی و مدیریت دیتا

if (typeof API_URL === 'undefined') console.error("Config missing!");

// --- سیستم رتبه‌بندی و دیتا ---
const RankSystem = {
    data: { xp: 0, gem: 0, rank: "🐣 نوآموز", completed: [], playback: {}, exams: {}, exam_details: {} },
    
    init: function(serverJson) {
        if(serverJson && serverJson !== "{}") {
            try { 
                const parsed = typeof serverJson === 'string' ? JSON.parse(serverJson) : serverJson;
                this.data = { ...this.data, ...parsed };
            } catch(e) {}
        }
        this.updateUI();
        this.saveToLocal();
    },

    saveToLocal: function() {
        try {
            const saved = localStorage.getItem(DB_KEY + 'creds');
            if (saved) {
                const creds = JSON.parse(saved);
                creds.jsonData = JSON.stringify(this.data);
                localStorage.setItem(DB_KEY + 'creds', JSON.stringify(creds));
            }
        } catch(e) {}
    },

    updateUI: function() {
        const els = {
            xp: document.getElementById('user-xp'),
            gem: document.getElementById('user-gem'),
            rank: document.getElementById('user-rank')
        };
        if(els.xp) els.xp.innerText = `${this.data.xp} XP`;
        if(els.gem) els.gem.innerText = this.data.gem;
        if(els.rank) els.rank.innerText = this.data.rank;
    },

    savePosition: function(id, time) {
        this.data.playback[id] = Math.floor(time);
        this.saveToLocal();
        // هر 30 ثانیه سینک کن
        if(Math.floor(time) % 30 === 0) SyncManager.addToQueue('sync');
    },
    
    getLastPosition: function(id) { return this.data.playback[id] || 0; }
};

// --- مدیر همگام‌سازی (آفلاین/آنلاین) ---
const SyncManager = {
    queue: [],
    
    addToQueue: function(action, payload = {}) {
        let safeData = {};
        // در سینک معمولی فقط زمان پخش ارسال می‌شود (امنیت)
        if (action === 'sync') safeData = { playback: RankSystem.data.playback }; 
        else safeData = payload; // برای گزارش‌ها، دیتای کامل

        const item = {
            action: action,
            jsonData: JSON.stringify(action === 'sync' ? safeData : {}),
            ...payload,
            ts: Date.now()
        };

        const saved = localStorage.getItem(DB_KEY + 'creds');
        if(saved) {
            const creds = JSON.parse(saved);
            item.username = creds.username;
            item.password = creds.password;
        }
        this.send(item);
    },

    send: function(item) {
        if(!navigator.onLine) return; 

        fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        })
        .then(r => r.json())
        .then(data => {
            if(data.status === 'success' && data.serverData) {
                RankSystem.init(data.serverData); // آپدیت با دیتای سرور
            }
        })
        .catch(e => console.log("Sync Error", e));
    }
};

// --- تابع جشن (فقط یکبار اینجا تعریف می‌شود) ---
function launchConfetti() {
    const c = document.getElementById('confetti-canvas');
    if(!c) return;
    c.style.display = 'block';
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    
    const pieces = Array.from({length: 300}).map(() => ({
        x: Math.random() * c.width, y: Math.random() * c.height - c.height,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`, speed: Math.random() * 5 + 2
    }));

    function draw() {
        ctx.clearRect(0, 0, c.width, c.height);
        pieces.forEach(p => {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
            p.y += p.speed; if(p.y > c.height) p.y = -10;
        });
        if(c.style.display !== 'none') requestAnimationFrame(draw);
    }
    draw();
    setTimeout(() => { c.style.display = 'none'; }, 5000);
}