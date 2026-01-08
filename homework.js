// homework.js - مدیریت ارسال تکالیف

let allHomeworks = [];
let currentHwId = null;
let selectedFileBase64 = null;
let selectedFileType = null; // 'voice' or 'image'
let mediaRecorder = null;
let audioChunks = [];

// شروع
window.onload = () => {
    // چک کردن لاگین
    const savedUser = localStorage.getItem(DB_KEY + 'creds');
    if(!savedUser) { window.location.href = 'index.html'; return; }
    RankSystem.init(JSON.parse(savedUser).jsonData);
    
    loadHomeworks();
};

async function loadHomeworks() {
    const list = document.getElementById('homeworkList');
    list.innerHTML = '';
    document.getElementById('loading').classList.remove('hidden');

    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'get_homeworks' })
        });
        const data = await res.json();
        
        document.getElementById('loading').classList.add('hidden');
        if(data.status === 'success') {
            allHomeworks = data.data;
            renderList();
        } else { list.innerHTML = '<p>خطا در دریافت اطلاعات</p>'; }
    } catch(e) {
        document.getElementById('loading').classList.add('hidden');
        list.innerHTML = '<p style="color:red">عدم اتصال به اینترنت</p>';
    }
}

function renderList() {
    const container = document.getElementById('homeworkList');
    container.innerHTML = '';
    const user = JSON.parse(localStorage.getItem(DB_KEY + 'creds')).username;

    if(allHomeworks.length === 0) { container.innerHTML = '<p style="color:#777;">هیچ تکلیفی تعریف نشده است.</p>'; return; }

    allHomeworks.forEach(hw => {
        const sub = hw.submissions ? hw.submissions[user] : null;
        let statusHtml = '';
        let actionHtml = '';

        if(sub) {
            // قبلاً ارسال کرده
            if(sub.status === 'graded') {
                let badge = '';
                if(sub.score === 'excellent') badge = '💎 عالی (+50 XP)';
                else if(sub.score === 'verygood') badge = '🥇 خیلی خوب (+30 XP)';
                else if(sub.score === 'good') badge = '🙂 خوب (+15 XP)';
                else badge = '⚠️ نیاز به تلاش (+5 XP)';
                
                statusHtml = `<span class="hw-status status-graded">${badge}</span>`;
                actionHtml = `<div class="feedback-box"><b>💬 نظر معلم:</b><br>${sub.feedback || 'بدون توضیح'}</div>`;
            } else {
                statusHtml = `<span class="hw-status status-pending">🟡 در انتظار بررسی</span>`;
                actionHtml = `<button class="btn btn-danger" onclick="deleteSubmission('${hw.id}')" style="font-size:0.8rem; padding:5px 10px; width:auto; margin-top:10px;">🗑️ حذف فایل و ارسال مجدد</button>`;
            }
        } else {
            // هنوز ارسال نکرده
            statusHtml = `<span class="hw-status" style="background:#eee; color:#555;">⚪ انجام نشده</span>`;
            actionHtml = `<button class="btn btn-blue" onclick="openSubmitModal('${hw.id}', '${hw.title}')">✍️ انجام تکلیف</button>`;
        }

        container.innerHTML += `
            <div class="hw-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${hw.title}</strong>
                    ${statusHtml}
                </div>
                <div class="hw-desc">${hw.desc || 'توضیحاتی ندارد.'}</div>
                <div style="font-size:0.75rem; color:#aaa;">تاریخ: ${hw.date}</div>
                ${actionHtml}
            </div>
        `;
    });
}

// --- مودال و انتخاب فایل ---
function openSubmitModal(id, title) {
    currentHwId = id;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('submitModal').style.display = 'flex';
    resetModal();
}
function closeSubmitModal() { document.getElementById('submitModal').style.display = 'none'; stopRecord(); }

function showType(type) {
    document.getElementById('voiceSection').classList.add('hidden');
    document.getElementById('imageSection').classList.add('hidden');
    selectedFileType = type;
    
    if(type === 'voice') document.getElementById('voiceSection').classList.remove('hidden');
    else document.getElementById('imageSection').classList.remove('hidden');
    
    document.getElementById('btnSend').classList.remove('hidden');
}

function resetModal() {
    selectedFileBase64 = null;
    selectedFileType = null;
    document.getElementById('voiceSection').classList.add('hidden');
    document.getElementById('imageSection').classList.add('hidden');
    document.getElementById('btnSend').classList.add('hidden');
    document.getElementById('imgPreview').style.display = 'none';
    document.getElementById('audioPreview').style.display = 'none';
    document.getElementById('recordStatus').innerText = "برای ضبط لمس کنید";
}

// --- 1. لاجیک عکس ---
function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        // چک حجم (زیر 5 مگ)
        if(file.size > 5 * 1024 * 1024) { alert("حجم عکس نباید بیشتر از ۵ مگابایت باشد."); return; }

        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imgPreview').src = e.target.result;
            document.getElementById('imgPreview').style.display = 'block';
            selectedFileBase64 = e.target.result; // دیتا آماده ارسال
        };
        reader.readAsDataURL(file);
    }
}

// --- 2. لاجیک ضبط صدا (Voice Recorder) ---
async function toggleRecord() {
    const btn = document.getElementById('micBtn');
    const status = document.getElementById('recordStatus');

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        // شروع ضبط
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' }); // یا wav
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = document.getElementById('audioPreview');
                audio.src = audioUrl;
                audio.style.display = 'block';
                
                // تبدیل به Base64 برای ارسال
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    selectedFileBase64 = reader.result;
                };
            };

            mediaRecorder.start();
            btn.classList.add('recording');
            status.innerText = "درحال ضبط... (برای توقف لمس کنید)";
        } catch(e) {
            alert("دسترسی به میکروفون داده نشد یا خطا رخ داد.");
        }
    } else {
        // توقف ضبط
        stopRecord();
    }
}

function stopRecord() {
    if(mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        document.getElementById('micBtn').classList.remove('recording');
        document.getElementById('recordStatus').innerText = "ضبط شد. آماده ارسال.";
    }
}

// --- 3. ارسال به سرور ---
async function submitFinal() {
    if(!selectedFileBase64) return alert("فایلی انتخاب نشده!");
    
    const btn = document.getElementById('btnSend');
    btn.innerText = "درحال ارسال...";
    btn.disabled = true;

    const saved = JSON.parse(localStorage.getItem(DB_KEY + 'creds'));

    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: 'submit_homework',
                username: saved.username,
                hw_id: currentHwId,
                file_data: selectedFileBase64,
                file_type: selectedFileType
            })
        });
        const data = await res.json();
        if(data.status === 'success') {
            alert("✅ تکلیف با موفقیت ارسال شد!");
            closeSubmitModal();
            loadHomeworks();
        } else { alert("خطا: " + data.message); }
    } catch(e) { alert("خطا در ارسال."); }
    
    btn.innerText = "📤 ارسال نهایی";
    btn.disabled = false;
}

async function deleteSubmission(hwId) {
    if(!confirm("آیا مطمئن هستید؟ فایل شما پاک می‌شود.")) return;
    const saved = JSON.parse(localStorage.getItem(DB_KEY + 'creds'));
    
    await fetch(API_URL, {
        method: 'POST', headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'delete_my_submission', username: saved.username, hw_id: hwId })
    });
    loadHomeworks();
}