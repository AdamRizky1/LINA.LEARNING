// js/study.js — layar belajar: sesi, modul, jalur kurikulum, peta materi, slide, kuis.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
function startSession(data, trans){
  session = {
    data: data,
    trans: trans,
    startedAt: Date.now(),
    scoreSum: 0,
    scoreN: 0,
    tabInt: 0,
    faceInt: 0,
    answers: [],
    quizDone: false
  };
  buildJalur(data);
  renderPeta(data);
  renderModule(data);
  renderSlides(data);
  renderQuiz(data);
  updateJalurUI();
  setTab('modul');
  $('study-title').textContent = data.judul || 'Sesi belajar';
  setStatus($('gen-status'), '');
  updateGenReady();
  show('screen-study');
  startFocus();
  tickTime();
}

function tickTime(){
  if (sessionTimeLoop) clearTimeout(sessionTimeLoop);
  if (!session || $('screen-study').classList.contains('hide')){
    sessionTimeLoop = null;
    return;
  }
  $('study-time').textContent = fmtDur((Date.now() - session.startedAt) / 1000) + ' berjalan';
  sessionTimeLoop = setTimeout(tickTime, 1000);
}

function renderModule(data){
  var ill = data.ilustrasi || {};
  var h = '';
  if (!data.ringkasan && !(data.modul || []).length){
    $('pane-modul').innerHTML = '<p class="note">Modul nggak dibuat \u2014 kamu cuma milih kuis '
      + 'waktu mulai belajar.</p>';
    return;
  }
  if (ill.hero) h += '<div class="fig">' + ill.hero + '</div>';
  if (data.ringkasan) h += '<p class="note">' + esc(data.ringkasan) + '</p>';
  (data.modul || []).forEach(function(m, i){
    h += (i ? '<hr class="rule">' : '')
      + '<h2 id="mod-' + i + '" style="margin-top:' + (i ? '22px' : '10px') + '">'
      + esc(m.judul || ('Bagian ' + (i + 1))) + '</h2>';
    if (ill.modul && ill.modul[i]) h += '<div class="fig">' + ill.modul[i] + '</div>';
    String(m.isi || '').split(/\n{2,}/).forEach(function(par){
      if (par.trim()) h += '<p>' + esc(par.trim()) + '</p>';
    });
    if (m.analogi) h += '<div class="analogi"><b>Cara gampang nangkepnya:</b> ' + esc(m.analogi) + '</div>';
    if (m.poin && m.poin.length){
      h += '<p style="margin-bottom:4px"><b>Poin penting:</b></p><ul>';
      m.poin.forEach(function(p){ h += '<li>' + esc(p) + '</li>'; });
      h += '</ul>';
    }
  });
  $('pane-modul').innerHTML = h;
}

// ===== Jalur belajar (kurikulum) + peta materi (mind map) =====
function buildJalur(data){
  var nq = (data.kuis || []).length;
  var quizStep = { judul: 'Uji pemahaman',
    deskripsi: 'Kuis ' + nq + ' soal buat ngecek seberapa paham materinya.', menit: 10 };
  var ks = (Array.isArray(data.kurikulum) ? data.kurikulum : []).filter(function(k){
    return k && k.judul; }).slice(0, 6);
  if (!ks.length){
    // Cadangan kalau model nggak ngasih kurikulum: susun dari struktur modul.
    ks = [{ judul: 'Mulai di sini',
      deskripsi: String(data.ringkasan || 'Baca ringkasannya dulu buat gambaran besar.').slice(0, 110),
      menit: 5 }];
    (data.modul || []).forEach(function(m, i){
      var isi = String(m.isi || '');
      ks.push({ judul: m.judul || ('Bagian ' + (i + 1)),
        deskripsi: String((m.poin && m.poin[0]) || m.analogi || isi).slice(0, 110),
        menit: Math.max(4, Math.round(isi.length / 400) * 5 || 4) });
    });
  }
  ks.push(quizStep);
  session.jalur = ks;
  session.jalurDone = ks.map(function(){ return false; });
  var h = '';
  ks.forEach(function(k, i){
    h += '<button class="jstep" type="button" data-i="' + i + '">'
      + '<span class="jdot" aria-hidden="true"></span>'
      + '<span class="jt">' + esc(k.judul) + '</span>'
      + (k.deskripsi ? '<span class="jd">' + esc(String(k.deskripsi)) + '</span>' : '')
      + '<span class="jm">kurang lebih ' + (k.menit || 5) + ' menit</span>'
      + '</button>';
  });
  $('jalur-track').innerHTML = h;
  Array.prototype.forEach.call($('jalur-track').querySelectorAll('.jstep'), function(b){
    b.addEventListener('click', function(){
      var i = +b.getAttribute('data-i');
      session.jalurDone[i] = true;
      updateJalurUI();
      jalurLompat(i);
    });
  });
  $('jalur').classList.remove('hide');
}
function jalurLompat(i){
  var ks = session.jalur || [];
  if (i === ks.length - 1){
    setTab('quiz');
    setTimeout(function(){ $('pane-quiz').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    return;
  }
  setTab('modul');
  var nMod = (session.data.modul || []).length;
  var target = i > 0 ? document.getElementById('mod-' + Math.min(i - 1, Math.max(nMod - 1, 0))) : $('pane-modul');
  if (target) setTimeout(function(){ target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
}
function updateJalurUI(){
  if (!session || !session.jalur) return;
  var ks = session.jalur, done = session.jalurDone || [];
  var n = 0, cur = done.findIndex(function(d){ return !d; });
  Array.prototype.forEach.call($('jalur-track').querySelectorAll('.jstep'), function(b, i){
    var isDone = !!done[i] || (i === ks.length - 1 && session.quizDone);
    b.classList.toggle('done', isDone);
    b.classList.toggle('cur', !isDone && i === cur);
    if (isDone) n++;
  });
  var pct = ks.length ? Math.round(n / ks.length * 100) : 0;
  $('jalur-fill').style.width = pct + '%';
  $('jalur-note').textContent = pct >= 100 ? 'Kurikulum kelar, bagus!'
    : (n ? n + ' dari ' + ks.length + ' tahap selesai' : 'Mulai dari tahap pertama');
}
function renderPeta(data){
  if (genSel.peta === false){
    $('pane-peta').innerHTML = '<p class="note">Peta materi nggak dibuat \u2014 kamu nggak milih '
      + 'peta waktu mulai belajar.</p>';
    return;
  }
  var h = '<ul class="tree"><li><span class="tnode tnode-root"><span>' + esc(data.judul || 'Materi')
    + '</span><small class="tsub">peta materi</small></span><ul>';
  (data.modul || []).forEach(function(m, i){
    var poin = (m.poin || []).slice(0, 4);
    h += '<li><button class="tnode" type="button" data-mod="' + i + '">'
      + esc(m.judul || ('Bagian ' + (i + 1)))
      + (poin.length ? '<span class="tmeta">' + poin.length + ' poin</span>' : '')
      + '</button>';
    if (poin.length){
      h += '<ul>';
      poin.forEach(function(p){ h += '<li><span class="tnode tnode-leaf">' + esc(p) + '</span></li>'; });
      h += '</ul>';
    }
    h += '</li>';
  });
  h += '<li><button class="tnode" type="button" data-quiz="1">Uji pemahaman'
    + '<span class="tmeta">' + (data.kuis || []).length + ' soal</span></button></li>'
    + '</ul></li></ul>';
  $('pane-peta').innerHTML = h;
  Array.prototype.forEach.call($('pane-peta').querySelectorAll('button.tnode'), function(b){
    b.addEventListener('click', function(){
      if (b.hasAttribute('data-quiz')){ setTab('quiz'); return; }
      var i = +b.getAttribute('data-mod');
      setTab('modul');
      var t = document.getElementById('mod-' + i);
      if (t) setTimeout(function(){ t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    });
  });
}

var slideData = [], slideIdx = 0, quizData = [], quizIdx = 0;

function renderSlides(data){
  slideData = data.slide || [];
  slideIdx = 0;
  drawSlide();
}
function drawSlide(){
  var s = slideData[slideIdx];
  if (!s){
    $('slidebox').innerHTML = '<p class="note">' + (genSel.slide === false
      ? 'Slide nggak dibuat \u2014 kamu nggak milih slide waktu mulai belajar.'
      : 'Nggak ada slide.') + '</p>';
    $('sl-cnt').textContent = '';
    $('sl-prev').disabled = true;
    $('sl-next').disabled = true;
    return;
  }
  var ill = (session && session.data && session.data.ilustrasi) || {};
  var svg = (ill.slide && ill.slide[slideIdx]) || defaultSlideSvg(slideIdx);
  var h = '<h2>' + esc(s.judul || '') + '</h2>'
    + '<div class="fig">' + svg + '</div><ul>';
  (s.isi || []).forEach(function(b){ h += '<li>' + esc(b) + '</li>'; });
  h += '</ul>';
  if (s.catatan) h += '<p class="note">' + esc(s.catatan) + '</p>';
  $('slidebox').innerHTML = h;
  $('sl-cnt').textContent = (slideIdx + 1) + ' / ' + slideData.length;
  $('sl-prev').disabled = slideIdx === 0;
  $('sl-next').disabled = slideIdx === slideData.length - 1;
}
$('sl-prev').addEventListener('click', function(){
  if (slideIdx > 0){ slideIdx--; drawSlide(); }
});
$('sl-next').addEventListener('click', function(){
  if (slideIdx < slideData.length - 1){ slideIdx++; drawSlide(); }
});
document.addEventListener('keydown', function(e){
  if ($('screen-study').classList.contains('hide')) return;
  if ($('pane-slide').classList.contains('hide')) return;
  if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
  if (e.key === 'ArrowLeft') $('sl-prev').click();
  if (e.key === 'ArrowRight') $('sl-next').click();
});

function renderQuiz(data){
  quizData = data.kuis || [];
  quizIdx = 0;
  if (session) session.answers = [];
  drawQuiz();
}
function drawQuiz(){
  var box = $('pane-quiz');
  if (!quizData.length){
    box.innerHTML = '<p class="note">' + (genSel.kuis === false
      ? 'Kuis nggak dibuat \u2014 kamu nggak milih kuis waktu mulai belajar.'
      : 'Nggak ada soal.') + '</p>';
    return;
  }
  if (quizIdx >= quizData.length){
    var benar = session ? session.answers.filter(function(a){ return a.benar; }).length : 0;
    if (session) session.quizDone = true;
    updateJalurUI();
    var msg;
    if (benar === quizData.length) msg = 'Sempurna, semua bener.';
    else if (benar >= Math.ceil(quizData.length * 0.7)) msg = 'Lumayan bagus. Yang salah dibaca lagi bagiannya.';
    else msg = 'Sepertinya perlu baca modulnya lagi, terus coba kuisnya sekali lagi.';
    box.innerHTML = '<div class="slidebox" style="align-items:flex-start">'
      + '<h2>Skor kuis: ' + benar + '/' + quizData.length + '</h2>'
      + '<p>' + msg + ' Jawaban per soal kelihatan di laporan akhir.</p>'
      + '<button class="btn2" id="quiz-retry" type="button" style="margin-top:10px">Ulangi kuis</button></div>';
    $('quiz-retry').addEventListener('click', function(){
      quizIdx = 0;
      if (session) session.answers = [];
      drawQuiz();
    });
    return;
  }
  var q = quizData[quizIdx];
  var h = '<p class="note">Soal ' + (quizIdx + 1) + '/' + quizData.length + '</p>'
    + '<h2 style="max-width:60ch">' + esc(q.tanya || '') + '</h2>';
  (q.pilihan || []).forEach(function(opt, i){
    h += '<button class="quiz-opt" type="button" data-i="' + i + '">' + esc(opt) + '</button>';
  });
  h += '<div id="quiz-explain" class="explain hide"></div>';
  box.innerHTML = h;
  var answered = false;
  Array.prototype.forEach.call(box.querySelectorAll('.quiz-opt'), function(btn){
    btn.addEventListener('click', function(){
      if (answered) return;
      answered = true;
      var pick = parseInt(btn.getAttribute('data-i'), 10);
      var right = typeof q.jawaban === 'number' ? q.jawaban : parseInt(q.jawaban, 10) || 0;
      if (session) session.answers.push({
        tanya: q.tanya, pilih: pick, benar: pick === right, jelas: q.jelas || ''
      });
      Array.prototype.forEach.call(box.querySelectorAll('.quiz-opt'), function(b2, i){
        b2.disabled = true;
        if (i === right) b2.classList.add('right');
        else if (i === pick) b2.classList.add('wrong');
      });
      var ex = $('quiz-explain');
      ex.classList.remove('hide');
      ex.textContent = (pick === right ? 'Benar. ' : 'Kurang tepat. ') + (q.jelas || '');
      var nb = document.createElement('button');
      nb.className = 'btn';
      nb.type = 'button';
      nb.style.marginTop = '12px';
      nb.textContent = quizIdx === quizData.length - 1 ? 'Lihat skor' : 'Soal berikutnya';
      nb.addEventListener('click', function(){
        quizIdx++;
        drawQuiz();
      });
      box.appendChild(nb);
    });
  });
}

function setTab(name){
  [['tab-modul','pane-modul'],['tab-slide','pane-slide'],['tab-quiz','pane-quiz'],
   ['tab-peta','pane-peta']].forEach(function(p){
    var on = p[0] === 'tab-' + name;
    $(p[0]).setAttribute('aria-selected', on ? 'true' : 'false');
    $(p[1]).classList.toggle('hide', !on);
  });
}
$('tab-modul').addEventListener('click', function(){ setTab('modul'); });
$('tab-slide').addEventListener('click', function(){ setTab('slide'); });
$('tab-quiz').addEventListener('click', function(){ setTab('quiz'); });
$('tab-peta').addEventListener('click', function(){ setTab('peta'); });

// ── Mesin fokus — logika dari alynne.edu (study-mode.tsx):
//    DETEKTOR adalah gerbang skor: di alynne useFocusDetector(enabled, isRunning)
//    cuma jalan (dan UI skor cuma dirender) pas tracker-nya aktif — stream
//    kamera+mic SATU getUserMedia. Jadi tanpa kamera nyala = NGGAK ada sampel
//    dan angka fokus nggak muncul. Pas detektor jalan:
//    skor sampel = wajah terdeteksi (60) + ketenangan mic (40 - noise*0.4),
//    UI live pakai rata-rata 20 sampel terakhir, laporan pakai rata-rata
//    sepanjang detektor nyala. Wajah dicek tiap 1,5 dtk: FaceDetector API
//    kalau browser punya, kalau nggak fallback skin-tone + frame-diff.
//    Tab yang disembunyiin pas detektor jalan = sampel 0 (gangguan).
var foc = { camOn: false, stream: null, faceOk: null, prevFace: null, anim: null, faceLoop: null,
            camLost: false, deadStreak: 0, lastErr: null,
            audioCtx: null, srcNode: null, analyser: null, noiseArr: null, noise: 0,
            hist: [] };
var camReqTok = 0; // penanda permintaan getUserMedia biar klik ganda nggak bocorkan stream
var FACE_CHECK_MS = 1500; // frekuensi cek wajah — persis alynne.edu

// ── Sensitivitas + smart warning (alynne.edu): studyFocusSensitivity 0-100
// (default 0.5 → 50); threshold detik = max(3, round((50 - sens)/3)) →
// 50 ≈ 3 dtk, 35 ≈ 5 dtk, 20 ≈ 10 dtk. Distracted = rata-rata jendela 20
// sampel < 35; bertahan ≥ threshold → popup peringatan; antar-popup
// dikunci 30 dtk (biar nggak spam); fokus pulih → tracking di-reset.
