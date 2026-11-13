// js/focus.js — penghitung fokus: webcam, tab, noise, peringatan.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
function fokusSens(){
  var v = parseInt(localStorage.getItem('lina-focus-sens') || '50', 10);
  return (v === 20 || v === 35 || v === 50) ? v : 50;
}
function distractionThresholdSec(){ return Math.max(3, Math.round((50 - fokusSens()) / 3)); }
var warn = { start: 0, cooldown: 0 };
function hideWarn(){ var p = $('warn-pop'); if (p) p.classList.add('hide'); }
function warnReset(){ warn.start = 0; warn.cooldown = 0; hideWarn(); }
(function initSens(){
  var sel = $('fokus-sens');
  if (!sel) return;
  sel.value = String(fokusSens());
  sel.addEventListener('change', function(){
    try{ localStorage.setItem('lina-focus-sens', sel.value); }catch(e){}
  });
})();

// Popup peringatan — pesan kontekstual persis DistractedPopup alynne.edu:
// wajah ilang + hening, wajah ilang aja, suara berisik, atau semangat umum;
// plus status wajah/suara/skor kayak di popup aslinya.
function showWarnPopup(){
  var face = foc.faceOk === true, m;
  if (!face && foc.noise < 20)
    m = { t: 'Wajahmu tidak terdeteksi', d: 'Pastikan kamu ada di depan kamera dan pencahayaan cukup.' };
  else if (!face)
    m = { t: 'Kamu terlihat tidak fokus', d: 'Nunduk atau meninggalkan layar? Ayo balik fokus belajarnya!' };
  else if (foc.noise > 50)
    m = { t: 'Suara sekitar terlalu berisik', d: 'Coba cari tempat yang lebih tenang agar bisa fokus.' };
  else
    m = { t: 'Yuk fokus lagi!', d: 'Tetap semangat belajarnya, kamu pasti bisa!' };
  $('warn-title').textContent = m.t;
  $('warn-desc').textContent = m.d;
  var avg = 0, i;
  for (i = 0; i < foc.hist.length; i++) avg += foc.hist[i];
  avg = foc.hist.length ? Math.round(avg / foc.hist.length) : 0;
  var good = '#34D399', mid = '#fbbf24', bad = '#f87171';
  var sCol = foc.noise < 30 ? good : foc.noise < 60 ? mid : bad;
  $('warn-stats').innerHTML =
    '<span><span style="color:' + (face ? good : bad) + '">&#9679;</span> Wajah ' + (face ? 'terlihat' : 'tidak terlihat') + '</span>' +
    '<span><span style="color:' + sCol + '">&#9679;</span> Suara ' + (foc.noise < 30 ? 'tenang' : foc.noise < 60 ? 'sedang' : 'berisik') + '</span>' +
    '<span><span style="color:' + (avg > 60 ? good : avg > 30 ? mid : bad) + '">&#9679;</span> Skor ' + avg + '%</span>';
  $('warn-pop').classList.remove('hide');
}
$('warn-ok').addEventListener('click', hideWarn); // dismiss = tutup aja; cooldown tetap jalan

// Pasang AnalyserNode di stream detektor (kamera+mic satu stream — persis alynne.edu).
function attachNoiseAnalyser(src){
  try{
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = new AC();
    var analyser = ctx.createAnalyser();
    analyser.fftSize = 256; // persis alynne.edu → 128 bin frekuensi
    // Node sumber WAJIB disimpan: kalau nggak direferensikan, Chromium bisa
    // meng-collect node-nya dan stream-nya jadi hening diam-diam.
    foc.srcNode = ctx.createMediaStreamSource(src);
    foc.srcNode.connect(analyser);
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function(){});
    foc.audioCtx = ctx;
    foc.analyser = analyser;
    foc.noiseArr = new Uint8Array(analyser.frequencyBinCount);
  }catch(e){}
}
function dropMicNoise(){
  if (foc.audioCtx){ try{ foc.audioCtx.close(); }catch(e){} }
  foc.srcNode = null;
  foc.audioCtx = null; foc.analyser = null; foc.noiseArr = null;
}

function startFocus(){
  if (foc.anim || foc.faceLoop) stopFocus();
  foc.camOn = false;
  foc.camLost = false;
  foc.faceOk = null;
  foc.prevFace = null;
  foc.deadStreak = 0;
  foc.hist = [];
  foc.noise = 0;
  foc.anim = requestAnimationFrame(noiseLoop);
  foc.faceLoop = setInterval(faceCheck, FACE_CHECK_MS);
  document.addEventListener('visibilitychange', onVisChange);
  updateFocusUI();
}
function stopFocus(){
  if (foc.anim){ cancelAnimationFrame(foc.anim); foc.anim = null; }
  if (foc.faceLoop){ clearInterval(foc.faceLoop); foc.faceLoop = null; }
  dropMicNoise();
  document.removeEventListener('visibilitychange', onVisChange);
  stopCam();
}
function onVisChange(){
  if (!session) return;
  if (document.hidden) session.tabInt++;
  updateFocusUI();
}
// Loop analisis suara + skor (rAF) — alur persis alynne.edu:
// noise = rata-rata magnitudo frekuensi (0-100), lalu skor = wajah + ketenangan.
// Sampel CUMA diakumulasi pas detektor jalan (kamera nyala) — gerbang skor.
function noiseLoop(){
  if (!session){ foc.anim = null; return; }
  if (foc.camOn){
    if (foc.analyser){
      foc.analyser.getByteFrequencyData(foc.noiseArr);
      var sum = 0, i;
      for (i = 0; i < foc.noiseArr.length; i++) sum += foc.noiseArr[i];
      foc.noise = Math.min(100, (sum / foc.noiseArr.length / 128) * 100);
    } else {
      foc.noise = 0; // track audio belum siap → dianggap tenang dulu
    }
    var score;
    if (document.visibilityState !== 'visible'){
      score = 0; // ninggalin tab = gangguan penuh (sampel 0, bukan cuma kehilangan 60)
    } else {
      var faceScore = foc.faceOk === true ? 60 : 0; // persis alynne.edu
      var quietScore = Math.max(0, 40 - foc.noise * 0.4);
      score = Math.round(faceScore + quietScore);
    }
    foc.hist.push(score);
    if (foc.hist.length > 20) foc.hist.shift(); // jendela 20 sampel — persis alynne.edu
    session.scoreSum += score;
    session.scoreN++;
    // Smart warning (alynne.edu): distracted = rata-rata jendela < 35;
    // bertahan ≥ threshold detik → popup, dikunci 30 dtk antar-popup.
    var avg = 0, hi;
    for (hi = 0; hi < foc.hist.length; hi++) avg += foc.hist[hi];
    avg = foc.hist.length ? avg / foc.hist.length : 100;
    if (avg < 35){
      if (!warn.start) warn.start = Date.now();
      var el = (Date.now() - warn.start) / 1000;
      var cd = (Date.now() - warn.cooldown) / 1000;
      if (el >= distractionThresholdSec() && cd > 30){
        showWarnPopup();
        warn.start = 0;
        warn.cooldown = Date.now();
      }
    } else {
      warn.start = 0;
      warn.cooldown = 0; // pulih → reset penuh (persis alynne.edu)
    }
  } else {
    foc.noise = 0; // detektor mati → nggak ada pengukuran, nggak ada sampel
  }
  updateFocusUI();
  foc.anim = requestAnimationFrame(noiseLoop);
}
// Kamera ketutup/dimatiin paksa/track-nya mati → wajah pasti ilang, jangan nyangkut nilai lama.
// msg boleh dispesifikin pemicunya (track mati / frame item / frame beku) biar
// pengguna tahu BENERAN kenapa — bukan vonis blanket "kamera berhenti".
function faceLost(msg){
  foc.lastErr = msg || 'kamera berhenti/tertutup, sementara dihitung nggak fokus.';
  if (session && foc.prevFace === true) session.faceInt++;
  foc.prevFace = false;
  foc.faceOk = false;
  updateFocusUI();
  if (foc.camOn) setStatus($('face-status'), foc.lastErr, 'err');
}
// Tombol kamera buka popup pengingat cahaya dulu (permintaan: biar pengguna
// disiapin ruangannya sebelum deteksi jalan). getUserMedia baru jalan dari
// tombol di popup.
$('btn-cam').addEventListener('click', function(){
  if (foc.camOn){
    stopCam();
    updateFocusUI();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    setStatus($('face-status'), 'Browser ini nggak support webcam.', 'err');
    return;
  }
  $('light-pop').classList.remove('hide');
});
$('light-no').addEventListener('click', function(){
  $('light-pop').classList.add('hide');
});
$('light-ok').addEventListener('click', function(){
  $('light-pop').classList.add('hide');
  startCam();
});
function startCam(){
  var myTok = ++camReqTok;
  // Satu getUserMedia untuk kamera + mic — persis alynne.edu; stream inilah
  // yang jadi detektor fokus (wajah dari video, noise dari audio).
  navigator.mediaDevices.getUserMedia({
    video: { width: 240, height: 180, facingMode: 'user' },
    audio: true
  })
    .then(function(stream){
      // Izin keluar pas pengguna udah batal/sudah klik lagi → stop langsung, jangan
      // bocorkan stream (lampu LED kamera bisa nyala sendiri gara-gara ini).
      if (myTok !== camReqTok){
        stream.getTracks().forEach(function(t){ t.stop(); });
        return;
      }
      if (foc.stream) foc.stream.getTracks().forEach(function(t){ t.stop(); });
      foc.stream = stream;
      foc.camOn = true;
      foc.camLost = false;
      foc.deadStreak = 0;
      framePrev = null;
      $('cam').srcObject = stream;
      $('cam').classList.remove('hide');
      $('camoff').classList.add('hide');
      $('btn-cam').textContent = 'Matikan kamera';
      // srcObject doang belum tentu muter di semua browser: video bisa ke-pause
      // selamanya → preview item padahal track hidup → canvas baca frame item →
      // keliru dilaporkan "kamera berhenti". Play() eksplisit itu wajib.
      var pp = $('cam').play();
      if (pp && pp.catch) pp.catch(function(){});
      skinPrev = null;
      attachNoiseAnalyser(stream); // mic dari stream detektor → sumber noise
      setStatus($('face-status'), 'detektor fokus jalan (wajah cek tiap 1,5 dtk + mic, kecerahan ngikutin ruangan).');
      // Kalau laptop ditutup/kamera dicabut, track-nya jadi 'ended' atau 'mute' —
      // elemen <video>-nya masih nampilin frame terakhir yang beku, jadi wajib kita tangkep
      // di sini biar nggak dianggap masih fokus. 'ended' = mati beneran (UI balik ke
      // kondisi mati), 'mute' = terinterupsi (masih mungkin pulih).
      var vt = stream.getVideoTracks()[0];
      if (vt){
        vt.addEventListener('ended', cameraDied);
        vt.addEventListener('mute', faceLost);
        // Ruangan gelap: minta auto-exposure kontinu ke kamera biar kecerahan
        // ngikutin ruangan; nggak semua track/browser support → diabaikan aja.
        try{
          if (vt.applyConstraints)
            vt.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] }).catch(function(){});
        }catch(e){}
      }
    })
    .catch(function(){
      if (myTok !== camReqTok) return;
      setStatus($('face-status'), 'Izin kamera/mic ditolak atau nggak ada webcam.', 'err');
    });
}
function stopCam(){
  camReqTok++; // batalin permintaan getUserMedia yang masih ngantre (kalau ada)
  if (foc.stream){
    foc.stream.getTracks().forEach(function(t){ t.stop(); });
    foc.stream = null;
  }
  dropMicNoise(); // detektor mati → analyser ikut mati (nggak ada pengukuran nyangkut)
  warnReset(); // detektor off → tracking gangguan di-reset (persis alynne.edu)
  foc.camOn = false;
  foc.camLost = false;
  foc.faceOk = null;
  foc.prevFace = null;
  foc.deadStreak = 0;
  foc.lastErr = null;
  framePrev = null;
  skinPrev = null;
  $('cam').srcObject = null;
  $('cam').style.filter = '';
  $('cam').classList.add('hide');
  $('camoff').classList.remove('hide');
  $('btn-cam').textContent = 'Nyalakan kamera';
  setStatus($('face-status'), 'deteksi wajah: kamera mati');
}
// Kamera mati dari LUAR (dicabut, dimatiin OS, track 'ended') → bukan pilihan pengguna.
// UI wajib balik ke kondisi mati beneran (tombol "Nyalakan kamera", preview ilang),
// dan tick selama kameranya belum dinyalain lagi dihitung gangguan, bukan fokus.
function cameraDied(){
  stopCam();
  foc.camLost = true;
  foc.faceOk = null;
  setStatus($('face-status'),
    'kamera mati/dicabut, klik "Nyalakan kamera" buat lanjut deteksi.', 'err');
  updateFocusUI();
}
function setFace(has){
  if (session && foc.prevFace === true && !has) session.faceInt++;
  foc.prevFace = has;
  foc.faceOk = has;
  updateFocusUI();
}
var skinCv = null, skinPrev = null;
// Kecerahan rata-rata frame (luma 0-255, sampling tiap 4 piksel) + gain
// pencerahan buat ruangan remang: mean < 60 → piksel dikali gain (maks 4×)
// biar ambang deteksi (r > 80 dll.) tetap bermakna walau kamera nggak sempat
// auto-expose. Ruangan terang → gain 1 (nggak diubah).
function lumaMean(d){
  var s = 0, n = 0, i;
  for (i = 0; i < d.length; i += 16){
    s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    n++;
  }
  return s / Math.max(1, n);
}
function darkGain(mean){
  return mean < 60 ? Math.min(4, 70 / Math.max(mean, 8)) : 1;
}
// Fallback tanpa FaceDetector — ambang & rumus persis alynne.edu:
// kulit > 15% di area tengah 40x45 DAN gerak antar-frame nggak heboh
// (rata selisih piksel < 30; gerak heboh = mungkin lagi mangkal dari kamera).
function skinFaceCheck(v){
  try{
    if (!v.videoWidth) return false;
    if (!skinCv){
      skinCv = document.createElement('canvas');
      skinCv.width = 80; skinCv.height = 60;
    }
    var cx = skinCv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(v, 0, 0, 80, 60);
    var frame = cx.getImageData(0, 0, 80, 60).data;
    var diffSum = 0, i;
    if (skinPrev){
      for (i = 0; i < frame.length; i += 16) diffSum += Math.abs(frame[i] - skinPrev[i]);
    }
    skinPrev = new Uint8ClampedArray(frame);
    // Ruangan remang: piksel gelap → ambang kulit nggak bakal kecapai walau
    // wajahnya ada. Piksel dinilai pakai gain; perbandingan gerak (diff) tetap
    // pakai nilai mentah biar nggak salah tangkap gara-gara gain naik-turun.
    var gain = darkGain(lumaMean(frame));
    var skinPixels = 0;
    var startX = 20, endX = 60, startY = 5, endY = 50;
    for (var y = startY; y < endY; y++){
      for (var x = startX; x < endX; x++){
        var idx = (y * 80 + x) * 4;
        var r = Math.min(255, frame[idx] * gain), g = Math.min(255, frame[idx + 1] * gain), b = Math.min(255, frame[idx + 2] * gain);
        if (r > 80 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && r < 250) skinPixels++;
      }
    }
    var skinRatio = skinPixels / ((endX - startX) * (endY - startY));
    var motion = diffSum / (frame.length / 16) > 30;
    return skinRatio > 0.15 && !motion;
  } catch(e){ return false; }
}
// Frame kamera ketutup fisik (stiker, tangan, lid) hampir rata warnanya DAN beku
// (nggak berubah antar cek). Kamera hidup di ruangan gelap pun tetap "gerak" gara-gara
// noise sensor + auto-exposure, jadi penilaian hidup/mati pakai DUA sinyal:
//   std   = seberapa bervariasi terang di dalam 1 frame (frame tertutup → ~0)
//   moved = seberapa banyak piksel berubah vs cek sebelumnya (frame beku → ~0)
//   mean  = kecerahan rata-rata (buat bedain "kamar gelap" vs "lensa tertutup")
var frameCv = null;
var framePrev = null;
var detectCv = null;
// Ambil frame video buat jalur FaceDetector; kalau gelap (mean < 60), terangin
// pakai gain dulu (deteksi jalan di canvas yang udah dicerahkan) — ruangan
// normal tetap pakai video mentah, alur alynne.edu nggak berubah.
function grabDetectFrame(v){
  try{
    if (!v.videoWidth) return { mean: 100, cv: null };
    if (!detectCv) detectCv = document.createElement('canvas');
    detectCv.width = v.videoWidth; detectCv.height = v.videoHeight;
    var cx = detectCv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(v, 0, 0);
    var im = cx.getImageData(0, 0, detectCv.width, detectCv.height);
    var d = im.data;
    var mean = lumaMean(d);
    if (mean < 60){
      var gain = darkGain(mean);
      for (var i = 0; i < d.length; i += 4){
        d[i] = Math.min(255, d[i] * gain);
        d[i + 1] = Math.min(255, d[i + 1] * gain);
        d[i + 2] = Math.min(255, d[i + 2] * gain);
      }
      cx.putImageData(im, 0, 0);
    }
    return { mean: mean, cv: detectCv };
  } catch(e){ return { mean: 100, cv: null }; }
}
function frameStatus(){
  try{
    var v = $('cam');
    if (!v.videoWidth) return { ready: false };
    if (!frameCv){
      frameCv = document.createElement('canvas');
      frameCv.width = 32; frameCv.height = 24;
    }
    var cx = frameCv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(v, 0, 0, 32, 24);
    var d = cx.getImageData(0, 0, 32, 24).data;
    var n = d.length / 4, sum = 0, sum2 = 0, i;
    var cur = new Float32Array(n);
    for (i = 0; i < d.length; i += 4){
      var l = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      cur[i / 4] = l; sum += l; sum2 += l * l;
    }
    var mean = sum / n;
    var std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    var hadPrev = !!(framePrev && framePrev.length === n);
    var moved = 0;
    if (hadPrev){
      var ch = 0, j;
      for (j = 0; j < n; j++) if (Math.abs(cur[j] - framePrev[j]) >= 1) ch++;
      moved = ch / n;
    }
    framePrev = cur;
    return { ready: true, std: std, moved: moved, mean: mean, first: !hadPrev };
  } catch(e){ return { ready: false }; }
}
function faceCheck(){
  if (!foc.camOn) return;
  var v = $('cam');
  // 0) Self-heal: video element ke-pause (autoplay kena kebijakan browser, tab dibuka
  //    ulang, dll.) → preview item padahal track-nya hidup. Jangan langsung salahkan
  //    kamera — cobain mainkan lagi dulu.
  if (v.paused && v.srcObject){ var pp = v.play(); if (pp && pp.catch) pp.catch(function(){}); }
  // 1) Track-nya masih hidup nggak? Kamera ketutup/laptop ditutup bikin track mati atau mute,
  //    tapi <video> tetap nampilin frame terakhir — deteksi di frame beku itu yang bikin
  //    "kamera ditutup tapi dianggap fokus".
  var tr = foc.stream ? foc.stream.getVideoTracks()[0] : null;
  if (tr && tr.readyState === 'ended'){ cameraDied(); return; }
  var trackOk = !!tr && tr.readyState === 'live' && !tr.muted;
  // 2) Frame-nya beneran ada isinya (bukan item/beku karena kamera ketutup fisik)?
  var fs = frameStatus();
  // Ruangan remang: sensor dapet gain ISO tinggi, noise antar frame naik, jadi
  // ambang "hidup" dilonggarkan biar kamar gelap nggak salah dilapor kamera beku.
  // Lensa tertutup beneran vonisnya mean < 10 DAN std < 2 (hitam nyaris rata).
  var dark = fs.ready && fs.mean < 60;
  // Wajah ketemu = bukti kuat frame valid (lensa ketutup/item nggak mungkin
  // nampilin wajah), jadi vonis beku/item cuma dipertimbangkan kalau wajah
  // NGGAK ketemu. Pengguna duduk diam membaca → frame nyaris identik → dulu
  // salah dilapor "kamera beku" dan poin wajahnya dibuang (skor anjlok
  // padahal status "wajah terlihat"). Sekarang: diam = fokus, bukan gangguan.
  // Cek pertama juga dilonggarkan: serahkan ke deteksi wajah, jangan vonis
  // sebelum ada pembanding.
  var weak = !trackOk || (fs.ready &&
    !(fs.first || fs.moved > (dark ? 0.004 : 0.02) || (fs.std > 2.5 && fs.moved > 0.002)));
  if (!trackOk){ faceMiss(true, fs, dark); return; }
  // Preview ikut diterangin biar pengguna tetap lihat wajahnya di kamar gelap.
  // CSS filter cuma penampilan; frame yang dibaca detektor tetap mentah (canvas
  // yang dikasih gain sendiri), jadi pencerahannya nggak dobel.
  $('cam').style.filter = dark ? 'brightness(' + darkGain(fs.mean).toFixed(2) + ')' : '';
  // ── Deteksi wajah gaya alynne.edu: FaceDetector API kalau browser punya,
  // kalau nggak: skin-tone + frame-diff (lihat skinFaceCheck). Tanpa model online.
  if (window.FaceDetector){
    // Ruangan gelap → deteksi di frame yang udah diterangin (canvas); normal →
    // video mentah (persis alynne.edu).
    var gD = grabDetectFrame(v);
    var srcDet = (gD.mean < 60 && gD.cv) ? gD.cv : v;
    new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }).detect(srcDet)
      .then(function(faces){
        if (faces && faces.length){ foc.deadStreak = 0; foc.lastErr = null; setFace(true); }
        else faceMiss(weak, fs, dark);
      })
      .catch(function(){
        // Deteksi error → jangan pakai nilai lama (bisa nyangkut "wajah kelihatan" selamanya).
        faceLost();
      });
  } else {
    if (skinFaceCheck(v)){ foc.deadStreak = 0; foc.lastErr = null; setFace(true); }
    else faceMiss(weak, fs, dark);
  }
}
// Wajah nggak ketemu. Frame valid → cukup "wajah tidak terlihat" (gangguan
// biasa, pesan error nggak perlu). Frame syak (beku/item/track mati) → jalur
// anti-cheat: wajib 2x berturut-turut baru dinyatakan bermasalah, vonisnya
// JUJUR per penyebab biar pengguna nggak dikira-kira "kamera mati" padahal
// kamar gelap atau lensa ketutup.
function faceMiss(weak, fs, dark){
  setFace(false);
  if (!weak) return;
  foc.deadStreak++;
  if (foc.deadStreak < 2) return;
  if (!fs || !fs.ready){ faceLost(); return; }
  if (fs.mean < 10 && fs.std < 2)
    faceLost('frame kamera item, lensa bisa ketutup atau kamera lagi dipakai aplikasi lain. Sementara dihitung nggak fokus.');
  else if (!fs.first && fs.moved < (dark ? 0.004 : 0.02))
    faceLost('frame kamera beku (nggak berubah-ubah), matikan lalu nyalakan lagi kameranya. Sementara dihitung nggak fokus.');
  else
    faceLost();
}
function updateFocusUI(){
  if (!session) return;
  // angka yang tampil = rata-rata sepanjang sesi (sama dengan angka di laporan)
  var pct = session.scoreN ? Math.round(session.scoreSum / session.scoreN) + '%' : '0%';
  if ($('st-focus').textContent !== pct) $('st-focus').textContent = pct;
  $('st-tab').textContent = session.tabInt;
  $('st-face').textContent = session.faceInt;
  var _pctN = session.scoreN ? Math.round(session.scoreSum / session.scoreN) : null;
  var _tile = $('tile-focus'), _ctx = $('ctx-focus'), _fsv = $('fs-val');
  if (_tile) _tile.classList.remove('good','mid','bad');
  if (_pctN == null){ if (_ctx) _ctx.textContent = 'menunggu'; if (_fsv) _fsv.textContent = '0%'; }
  else if (_pctN >= 80){ if (_tile) _tile.classList.add('good'); if (_ctx) _ctx.textContent = 'Fokus bagus'; if (_fsv) _fsv.textContent = _pctN + '%'; }
  else if (_pctN >= 50){ if (_tile) _tile.classList.add('mid'); if (_ctx) _ctx.textContent = 'Lumayan'; if (_fsv) _fsv.textContent = _pctN + '%'; }
  else { if (_tile) _tile.classList.add('bad'); if (_ctx) _ctx.textContent = 'Banyak gangguan'; if (_fsv) _fsv.textContent = _pctN + '%'; }
  if (foc.camLost && !foc.camOn){
    setStatus($('face-status'), 'kamera mati/dicabut, klik "Nyalakan kamera".', 'err');
  } else if (foc.camOn){
    var trk = foc.stream ? foc.stream.getVideoTracks()[0] : null;
    var trkOk = !!trk && trk.readyState === 'live' && !trk.muted;
    if (!trkOk) setStatus($('face-status'),
      foc.lastErr || 'kamera berhenti/tertutup, dihitung nggak fokus.', 'err');
    else if (foc.faceOk === true) setStatus($('face-status'), 'wajah terlihat');
    else if (foc.faceOk === false) setStatus($('face-status'), 'wajah tidak terlihat');
  }
}

var currentReport = null;

$('btn-finish').addEventListener('click', function(){
  if (!session) return;
  $('confirm-overlay').classList.remove('hide');
});

