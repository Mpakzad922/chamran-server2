// exam.js - مدیریت آزمون‌ها

const EXAM_STATE_KEY = "chamran_exam_active_session_v8"; 
let currentUser = null;
let examsMap = {};
let currentExamId = null;
let currentQuestions = [];
let currentQIndex = 0;
let userAnswers = {};
let timerInterval;

// شروع برنامه
window.onload = init;

function init() {
    const savedUser = localStorage.getItem(DB_KEY + 'creds');
    if(!savedUser) { window.location.href = 'index.html'; return; }
    
    try {
        currentUser = JSON.parse(savedUser);
        document.getElementById('welcomeText').innerText = `سلام ${currentUser.displayName}`;
        if(currentUser.jsonData) RankSystem.init(currentUser.jsonData);
        
        // چک کردن حالت مرور تاریخچه
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('mode') === 'history_review') {
            prepareReviewMode(urlParams.get('target'));
        } else {
            fetchExams();
        }
    } catch(e) { window.location.href = 'index.html'; }
}

async function fetchExams() {
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_exams' }) });
        const data = await res.json();
        if(data.status === 'success') {
            processExams(data.data || []);
            checkActiveSession();
        }
    } catch(e) { document.getElementById('loading').innerHTML = `<span style="color:red">❌ خطا در اتصال</span>`; }
}

function processExams(list) {
    examsMap = {};
    const container = document.getElementById('examList');
    container.innerHTML = '';
    document.getElementById('loading').style.display = 'none';

    if(list.length === 0) { container.innerHTML = "<p>آزمونی یافت نشد.</p>"; return; }

    list.reverse().forEach(ex => {
        examsMap[ex.id] = ex;
        const sId = String(ex.id);
        const score = RankSystem.data.exams[sId]; 
        const isTaken = (score !== undefined);

        const div = document.createElement('div');
        div.className = `exam-item ${isTaken ? 'locked' : ''}`;
        
        if(isTaken) {
            let quality = score >= 20 ? "💎 فوق‌العاده" : (score >= 17 ? "🥇 خیلی خوب" : (score >= 12 ? "🙂 خوب" : "⚠️ قابل قبول"));
            let color = score >= 15 ? '#27ae60' : (score < 10 ? '#c0392b' : '#f39c12');
            
            div.innerHTML = `
                <div style="text-align:right"><h4>${ex.title}</h4><small>انجام شده</small></div>
                <div style="text-align:left">
                    <span style="font-weight:bold; color:${color}; font-size:0.9rem;">${quality}</span><br>
                    <button onclick="goToReview('${sId}')" style="background:none; border:none; color:#2980b9; cursor:pointer; font-size:0.8rem;">🔍 مرور</button>
                </div>`;
        } else {
            const newBadge = ex.is_new ? '<div class="new-badge">جدید 🔥</div>' : '';
            div.innerHTML = `
                ${newBadge}
                <div><h4>${ex.title}</h4><small>${toPersianNum(ex.time)} دقیقه</small></div>
                <button class="btn btn-accent" style="width:auto; margin:0;" onclick="showIntro('${ex.id}')">شروع</button>`;
        }
        container.appendChild(div);
    });
}

function showIntro(id) {
    const ex = examsMap[id];
    if(ex.pass && prompt("رمز آزمون:") !== ex.pass) return alert("رمز اشتباه است");
    
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('introCard').classList.remove('hidden');
    
    document.getElementById('introTitle').innerText = ex.title;
    document.getElementById('introQCount').innerText = toPersianNum(ex.questions.length);
    document.getElementById('introTime').innerText = toPersianNum(ex.time);
    
    const r = ex.rewards || { excellent: 300, good: 100, normal: 20 };
    document.getElementById('rewEx').innerText = `${r.excellent} XP`;
    document.getElementById('rewVg').innerText = `${r.good} XP`;
    document.getElementById('rewNr').innerText = `${r.normal} XP`;
    
    currentExamId = id;
}

function startExamNow() { startExam(currentExamId); }

function startExam(id) {
    const ex = examsMap[id];
    currentExamId = id;
    currentQuestions = ex.questions;
    userAnswers = {};
    currentQIndex = 0;
    
    // ذخیره وضعیت برای جلوگیری از پریدن آزمون
    localStorage.setItem(EXAM_STATE_KEY, JSON.stringify({ id, start: Date.now(), end: Date.now() + ex.time*60000 }));
    
    showExamUI(ex.time * 60);
}

function checkActiveSession() {
    const saved = localStorage.getItem(EXAM_STATE_KEY);
    if(saved) {
        const sess = JSON.parse(saved);
        if(examsMap[sess.id]) {
            const remaining = Math.floor((sess.end - Date.now())/1000);
            if(remaining > 0) {
                if(confirm("یک آزمون ناتمام دارید. ادامه می‌دهید؟")) {
                    currentExamId = sess.id;
                    currentQuestions = examsMap[sess.id].questions;
                    userAnswers = {}; 
                    currentQIndex = 0;
                    showExamUI(remaining);
                } else { localStorage.removeItem(EXAM_STATE_KEY); }
            } else { localStorage.removeItem(EXAM_STATE_KEY); }
        }
    }
}

function showExamUI(time) {
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('introCard').classList.add('hidden');
    document.getElementById('examArea').classList.remove('hidden');
    
    let t = time;
    timerInterval = setInterval(() => {
        t--;
        const m = Math.floor(t/60), s = t%60;
        document.getElementById('timer').innerText = `${m}:${s<10?'0'+s:s}`;
        if(t<=0) { clearInterval(timerInterval); alert("زمان تمام شد!"); finishExam(true); }
    }, 1000);
    loadQuestion();
}

function loadQuestion() {
    const q = currentQuestions[currentQIndex];
    document.getElementById('qProgress').innerText = `سوال ${toPersianNum(currentQIndex+1)} از ${toPersianNum(currentQuestions.length)}`;
    document.getElementById('questionText').innerText = q.q;
    
    const imgEl = document.getElementById('questionImage');
    if(q.img) { imgEl.src = q.img; imgEl.style.display = 'block'; } else imgEl.style.display = 'none';
    
    const cont = document.getElementById('optionsContainer');
    cont.innerHTML = '';
    q.options.forEach((opt, i) => {
        const val = i+1;
        const div = document.createElement('div');
        div.className = `option ${userAnswers[currentQIndex]==val ? 'selected' : ''}`;
        
        let content = opt;
        if(opt.startsWith('http') || opt.startsWith('/uploads')) content = `<img src="${opt}" onclick="event.stopPropagation(); openLightbox(this.src)">`;
        
        div.innerHTML = `<b>${val})</b> ${content}`;
        div.onclick = () => { userAnswers[currentQIndex] = val; loadQuestion(); };
        cont.appendChild(div);
    });

    if(currentQIndex < currentQuestions.length-1) {
        document.getElementById('btnNext').classList.remove('hidden');
        document.getElementById('btnFinish').classList.add('hidden');
    } else {
        document.getElementById('btnNext').classList.add('hidden');
        document.getElementById('btnFinish').classList.remove('hidden');
    }
}

function nextQuestion() { currentQIndex++; loadQuestion(); }

function finishExam(forced = false) {
    clearInterval(timerInterval);
    localStorage.removeItem(EXAM_STATE_KEY);

    let correct = 0, wrong = 0, empty = 0;
    let wrongIndices = [];

    currentQuestions.forEach((q, i) => {
        if(!userAnswers[i]) empty++;
        else if(userAnswers[i] == q.correct) correct++;
        else { wrong++; wrongIndices.push(i+1); }
    });

    const score = parseFloat(((correct / currentQuestions.length) * 20).toFixed(1));
    const sId = String(currentExamId);

    // ذخیره در رنک سیستم
    RankSystem.data.exams[sId] = score;
    RankSystem.data.exam_details[sId] = {
        score: score, wrong: wrongIndices, answers: userAnswers, date: new Date().toLocaleDateString('fa-IR')
    };
    RankSystem.saveToLocal(); 

    // ارسال به سرور برای تایید و دریافت پاداش واقعی
    SyncManager.addToQueue('claim_reward', {
        reward_type: 'exam', reward_id: currentExamId, user_answers: userAnswers
    });

    showReportCard(score, correct, wrong, empty);
}

function showReportCard(score, correct, wrong, empty) {
    document.getElementById('examArea').classList.add('hidden');
    document.getElementById('reportCard').classList.remove('hidden');

    document.getElementById('resCorrect').innerText = toPersianNum(correct);
    document.getElementById('resWrong').innerText = toPersianNum(wrong);
    document.getElementById('resEmpty').innerText = toPersianNum(empty);

    setTimeout(() => { document.getElementById('scorePointer').style.left = ((score/20)*100) + '%'; }, 200);

    let qText = "نیاز به تلاش"; 
    let color = "#c0392b";
    
    if(score >= 20) { qText = "💎 فوق‌العاده"; color="#8e44ad"; launchConfetti(); }
    else if(score >= 17) { qText = "🥇 خیلی خوب"; color="#2ecc71"; launchConfetti(); }
    else if(score >= 12) { qText = "🙂 خوب"; color="#2980b9"; }
    else if(score >= 8) { qText = "⚠️ قابل قبول"; color="#f1c40f"; }
    
    const qEl = document.getElementById('qualitativeScore');
    qEl.innerText = qText; qEl.style.color = color;
    
    document.getElementById('btnReview').classList.remove('hidden');
    document.getElementById('xpMsg').style.display = 'block';
}

function startReviewMode() {
    document.getElementById('reportCard').classList.add('hidden');
    document.getElementById('reviewArea').classList.remove('hidden');
    renderReview(currentQuestions, userAnswers);
}

function goToReview(id) {
    window.location.href = `azmoon.html?mode=history_review&target=${id}`;
}

async function prepareReviewMode(targetId) {
    document.getElementById('loading').innerText = "بازیابی پاسخ‌برگ...";
    const sTargetId = String(targetId);
    let myData = (RankSystem.data.exam_details || {})[sTargetId];
    
    // اگر دیتا نبود، سعی کن از سرور بگیری (لاگین سایلنت)
    if(!myData) {
       // اینجا می‌توان لاجیک fetch دوباره را گذاشت ولی معمولا رنک سیستم دیتا دارد
    }

    // گرفتن لیست آزمون‌ها برای پیدا کردن سوالات
    let examList = [];
    try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, { method: 'POST', headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: 'get_exams' }) });
        const d = await res.json();
        examList = d.data || [];
    } catch(e) {}

    const exam = examList.find(e => String(e.id) === sTargetId);

    if(exam && myData) {
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('reviewArea').classList.remove('hidden');
        renderReview(exam.questions, myData.answers || {});
    } else { 
        alert("اطلاعات آزمون یافت نشد."); 
        window.location.href = 'azmoon.html'; 
    }
}

function renderReview(questions, answers) {
    const c = document.getElementById('reviewContent');
    c.innerHTML = '';
    questions.forEach((q, i) => {
        const uAns = answers[i];
        let html = `<div class="review-q"><b>سوال ${toPersianNum(i+1)}:</b> ${q.q}`;
        if(q.img) html += `<br><img src="${q.img}" onclick="openLightbox(this.src)" style="max-width:100%; border-radius:10px; margin:10px auto;">`;
        
        q.options.forEach((op, idx) => {
            const val = idx+1;
            let color = "#fff", border = "#eee";
            if(val == q.correct) { color = "#d4edda"; border = "#c3e6cb"; } 
            else if(val == uAns) { color = "#f8d7da"; border = "#f5c6cb"; } 
            
            let content = (op.startsWith('http') || op.startsWith('/uploads')) ? `<img src="${op}" style="max-height:100px;">` : op;
            html += `<div style="background:${color}; border:1px solid ${border}; padding:10px; margin:5px 0; border-radius:10px;">${toPersianNum(val)}) ${content}</div>`;
        });
        
        if(q.desc || q.desc_img) {
            html += `<div style="background:#fff3cd; padding:10px; margin-top:10px; border-radius:8px; font-size:0.9rem;">💡 <b>توضیح:</b> ${q.desc || ''}`;
            if(q.desc_img) html += `<br><img src="${q.desc_img}" onclick="openLightbox(this.src)" style="max-width:100%; border-radius:8px; margin-top:5px;">`;
            html += `</div>`;
        }
        html += `</div>`;
        c.innerHTML += html;
    });
}

function openLightbox(src) { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').style.display = 'flex'; }
function toPersianNum(n) { return n.toString().replace(/\d/g, x => ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'][x]); }