// creator.js - مدیریت ساخت محتوا

let ADMIN_TOKEN = "";
let ALL_DATA = { lessons: [], exams: [], homeworks: [] };
let UPLOAD_TARGET_ID = null;
let EDIT_MODE = false;
let EDIT_ID = null;

// --- ورود و دسترسی ---
function checkLogin() {
    const t = document.getElementById('adminTokenInput').value.trim();
    if(t) {
        ADMIN_TOKEN = t;
        document.getElementById('loginOverlay').classList.remove('show'); // کلاس show را بردار
        document.getElementById('loginOverlay').style.display = 'none'; // برای اطمینان
        document.getElementById('mainContainer').classList.remove('hidden');
        document.getElementById('mainContainer').style.display = 'block';
        fetchHistory();
    } else { alert("رمز را وارد کنید"); }
}

function switchTab(t) {
    document.querySelectorAll('.section').forEach(e => e.classList.remove('active'));
    document.getElementById('tab-'+t).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function toggleForm() {
    const type = document.getElementById('contentType').value;
    document.getElementById('lessonForm').style.display = 'none';
    document.getElementById('examForm').style.display = 'none';
    document.getElementById('homeworkForm').style.display = 'none'; // مخفی کردن فرم تکلیف
    
    if(type === 'lesson') document.getElementById('lessonForm').style.display = 'block';
    else if(type === 'exam') document.getElementById('examForm').style.display = 'block';
    else if(type === 'homework') document.getElementById('homeworkForm').style.display = 'block'; // نمایش فرم تکلیف
}

// --- آپلود عکس ---
const fileInput = document.getElementById('globalFileInput');
function triggerUpload(targetId) { UPLOAD_TARGET_ID = targetId; fileInput.click(); }

fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        const file = this.files[0];
        const btn = document.querySelector(`button[onclick="triggerUpload('${UPLOAD_TARGET_ID}')"]`);
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳";

        const reader = new FileReader();
        reader.onload = function(e) {
            fetch(API_URL, {
                method: 'POST', headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'upload_file', admin_token: ADMIN_TOKEN, file_data: e.target.result, file_name: file.name })
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') {
                    document.getElementById(UPLOAD_TARGET_ID).value = API_URL + data.url;
                    btn.innerHTML = "✅"; setTimeout(() => btn.innerHTML = originalText, 2000);
                } else { alert(data.message); btn.innerHTML = "❌"; }
            });
        };
        reader.readAsDataURL(file);
    }
    this.value = '';
});

// --- ذخیره محتوا ---
async function saveLesson() {
    const title = document.getElementById('l_title').value;
    const link = document.getElementById('l_link').value;
    const attach = Array.from(document.querySelectorAll('#attach_container .row')).map(row => 
        `${row.querySelector('.att-name').value}|${row.querySelector('.att-link').value}`).join(',');

    if(!title || !link) return alert("عنوان و لینک الزامی است");

    const payload = { 
        action: EDIT_MODE ? 'edit_lesson' : 'save_lesson', 
        admin_token: ADMIN_TOKEN, 
        title, link, attach, 
        is_new: document.getElementById('isNewContent').checked 
    };
    if(EDIT_MODE) payload.lesson_id = EDIT_ID;

    await sendReq(payload);
}

async function saveHomework() {
    const title = document.getElementById('hw_title').value;
    const desc = document.getElementById('hw_desc').value;

    if(!title) return alert("عنوان تکلیف الزامی است");

    // فعلا ویرایش تکلیف نداریم، فقط ساخت و حذف (طبق لاجیک سرور)
    // اگر بخواهیم ویرایش بگذاریم باید در سرور هم اضافه شود. فعلا فقط save
    const payload = {
        action: 'save_homework_task',
        admin_token: ADMIN_TOKEN,
        hw_title: title,
        hw_desc: desc
    };

    await sendReq(payload);
}

async function saveExam() {
    const title = document.getElementById('e_title').value;
    const questions = Array.from(document.querySelectorAll('.q-box')).map(el => ({
        q: el.querySelector('.q-txt').value,
        img: el.querySelector('.q-img').value,
        options: [1,2,3,4].map(i => el.querySelector(`.op${i}-img`).value || el.querySelector(`.op${i}`).value),
        correct: el.querySelector('.correct-ans').value,
        desc: el.querySelector('.exp-txt').value,
        desc_img: el.querySelector('.exp-img').value
    }));

    if(!title || questions.length===0) return alert("عنوان و سوالات الزامی است");

    const payload = {
        action: EDIT_MODE ? 'edit_exam' : 'save_exam',
        admin_token: ADMIN_TOKEN,
        title, time: document.getElementById('e_time').value,
        pass: document.getElementById('e_pass').value,
        questions,
        is_new: document.getElementById('isNewContent').checked,
        rewards: {
            excellent: document.getElementById('r_excellent').value,
            good: document.getElementById('r_good').value,
            normal: document.getElementById('r_normal').value
        }
    };
    if(EDIT_MODE) payload.exam_id = EDIT_ID;

    await sendReq(payload);
}

async function sendReq(body) {
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json();
    if(data.status === 'success') {
        alert("✅ انجام شد");
        if(EDIT_MODE) cancelEdit();
        else {
            // ریست فرم‌ها
            document.querySelectorAll('input').forEach(i => i.value='');
            document.getElementById('questions_area').innerHTML='';
            addQuestion();
        }
        fetchHistory();
    } else alert(data.message);
}

// --- مدیریت تاریخچه ---
async function fetchHistory() {
    const r1 = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_lessons'}) });
    const r2 = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_exams'}) });
    const r3 = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'get_homeworks'}) });
    
    ALL_DATA.lessons = (await r1.json()).data || [];
    ALL_DATA.exams = (await r2.json()).data || [];
    ALL_DATA.homeworks = (await r3.json()).data || []; // دریافت تکالیف
    
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('contentList');
    list.innerHTML = '';
    const q = document.getElementById('searchBox').value.toLowerCase();

    // نمایش درس‌ها
    ALL_DATA.lessons.forEach(l => {
        if(l.title.toLowerCase().includes(q))
            list.innerHTML += createCard('🎬 درس', l.title, l.id, 'lesson', 'var(--accent)');
    });

    // نمایش آزمون‌ها
    ALL_DATA.exams.forEach(e => {
        if(e.title.toLowerCase().includes(q))
            list.innerHTML += createCard('📝 آزمون', e.title, e.id, 'exam', 'var(--blue)');
    });

    // نمایش تکالیف
    ALL_DATA.homeworks.forEach(h => {
        if(h.title.toLowerCase().includes(q))
            list.innerHTML += createCard('📤 تکلیف', h.title, h.id, 'homework', 'var(--warning)');
    });
}

function createCard(type, title, id, actionType, color) {
    // برای تکالیف دکمه ویرایش نمی‌گذاریم (چون فعلا پیاده‌سازی نشده در بک‌اند)
    const editBtn = actionType !== 'homework' ? `<button class="btn btn-outline" style="padding:5px 10px; font-size:0.8rem;" onclick='loadForEdit("${actionType}", ${id})'>✏️</button>` : '';
    
    return `
    <div class="history-card" style="border-right-color:${color}">
        <div><strong>${type}:</strong> ${title}</div>
        <div style="display:flex; gap:5px;">
            ${editBtn}
            <button class="btn btn-danger" style="padding:5px 10px; font-size:0.8rem;" onclick="deleteItem('${actionType}', '${id}')">🗑️</button>
        </div>
    </div>`;
}

async function deleteItem(type, id) {
    if(!confirm("حذف شود؟")) return;
    const actionMap = { 'lesson': 'delete_lesson_global', 'exam': 'delete_exam_global', 'homework': 'delete_homework_global' };
    const idKey = type === 'lesson' ? 'lesson_id' : (type === 'exam' ? 'exam_id' : 'hw_id');
    
    await sendReq({ action: actionMap[type], admin_token: ADMIN_TOKEN, [idKey]: id });
}

// توابع کمکی فرم
function addAttachRow() {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<input class="att-name" placeholder="نام فایل" style="flex:1"><input class="att-link" placeholder="لینک" dir="ltr" style="flex:2"><button class="btn btn-danger" style="width:auto; padding:5px;" onclick="this.parentElement.remove()">X</button>`;
    document.getElementById('attach_container').appendChild(div);
}

function addQuestion(qData=null) {
    const div = document.createElement('div');
    div.className = 'q-box';
    const qId = Date.now();
    
    // محتوای HTML سوال (خلاصه شده برای جلوگیری از شلوغی، مشابه قبل)
    // نکته: اینجا دقیقا همان HTML مرحله قبل را می‌گذاریم که فیلدهای سوال و گزینه و عکس داشت
    // برای کوتاه شدن اینجا نمیارم ولی در فایل نهایی باید باشه.
    // ... (کد ساختن باکس سوال که در ورژن قبلی بود)
    div.innerHTML = `
        <span class="del-q" onclick="this.parentElement.remove()">حذف</span>
        <input class="q-txt" placeholder="صورت سوال" value="${qData?qData.q:''}" style="margin-bottom:5px;">
        <input class="q-img" placeholder="لینک عکس سوال" value="${qData?qData.img:''}" dir="ltr" style="margin-bottom:10px;">
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
            ${[1,2,3,4].map(i => `<input class="op${i}" placeholder="گزینه ${i}" value="${qData?qData.options[i-1]:''}"><input class="op${i}-img" placeholder="عکس گزینه ${i}" value="${qData && qData.options[i-1].startsWith('http')?qData.options[i-1]:''}" dir="ltr">`).join('')}
        </div>
        
        <div class="row" style="margin-top:10px;">
            <label>پاسخ:</label>
            <select class="correct-ans">
                <option value="1" ${qData&&qData.correct=='1'?'selected':''}>۱</option>
                <option value="2" ${qData&&qData.correct=='2'?'selected':''}>۲</option>
                <option value="3" ${qData&&qData.correct=='3'?'selected':''}>۳</option>
                <option value="4" ${qData&&qData.correct=='4'?'selected':''}>۴</option>
            </select>
        </div>
        <textarea class="exp-txt" placeholder="توضیح تشریحی">${qData?qData.desc:''}</textarea>
        <input class="exp-img" placeholder="عکس تشریحی" value="${qData?qData.desc_img:''}" dir="ltr">
    `;
    document.getElementById('questions_area').appendChild(div);
}

function loadForEdit(type, id) {
    const item = ALL_DATA[type+'s'].find(i => String(i.id) === String(id));
    if(!item) return;
    
    EDIT_MODE = true; EDIT_ID = id;
    document.getElementById('editModeBadge').style.display = 'block';
    document.getElementById('editTargetName').innerText = item.title;
    
    switchTab('create');
    document.getElementById('contentType').value = type;
    toggleForm();
    
    if(type === 'lesson') {
        document.getElementById('l_title').value = item.title;
        document.getElementById('l_link').value = item.link;
    } else if (type === 'exam') {
        document.getElementById('e_title').value = item.title;
        document.getElementById('e_time').value = item.time;
        document.getElementById('questions_area').innerHTML='';
        item.questions.forEach(q => addQuestion(q));
    }
}

function cancelEdit() {
    EDIT_MODE = false; EDIT_ID = null;
    document.getElementById('editModeBadge').style.display = 'none';
    document.querySelectorAll('input').forEach(i => i.value='');
    document.getElementById('questions_area').innerHTML='';
    addQuestion();
}

addQuestion(); // یک سوال پیش‌فرض