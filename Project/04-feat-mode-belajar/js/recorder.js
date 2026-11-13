// js/recorder.js — fitur suara ke teks: perekam mic & upload file audio.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
function killRecInterval(){
  if (recTimer){ clearInterval(recTimer); recTimer = null; }
}
function recIsLive(){
  return !!(mediaRec && mediaRec.state === 'recording');
}
// Satu sumber kebenaran buat tombol/pill/badge: semua kejadian (klik, izin mic,
// stop, error, track dicabut) lewat sini, biar tampilan nggak pernah beda
// dengan kondisi perekam yang sebenarnya.
function updateRecUI(){
  var b = $('btn-rec');
  if (recArming){
    b.disabled = true;
    b.textContent = 'Menyiapkan mic\u2026';
  } else {
    b.disabled = false;
    b.textContent = recIsLive() ? 'Stop' : 'Mulai rekam';
  }
  $('rec-time').textContent = recIsLive() ? fmtDur(recSec) : '';
  $('rec-live').classList.toggle('hide', !recIsLive());
}
function stopRec(msg){
  recFailMsg = msg || null;
  killRecInterval();
  recArming = false;
  updateRecUI(); // tombol & indikator langsung manut sebelum onstop dateng
  try { if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop(); } catch(e){ finishRec(); }
  setTimeout(function(){
    if (mediaRec && mediaRec.state !== 'inactive') finishRec(); // jaga-jaga kalau onstop nggak dateng
  }, 2000);
}
function finishRec(){
  if (finishDone) return;
  finishDone = true;
  killRecInterval();
  recArming = false;
  var durTimer = recSec, fail = recFailMsg;
  recFailMsg = null;
  var stream = mediaRec && mediaRec.stream;
  if (stream) stream.getTracks().forEach(function(t){ t.stop(); });
  var blob = new Blob(recChunks, { type: (mediaRec && mediaRec.mimeType) || 'audio/webm' });
  recChunks = [];
  mediaRec = null;
  updateRecUI();
  if (!blob.size){
    audioBlob = null; audioName = '';
    setStatus($('asr-status'), fail ? (fail + ' Datanya kosong, coba rekam lagi.')
      : 'Rekaman-nya kosong \u2014 mic-nya mungkin nggak jalan. Coba rekam lagi.', 'err');
    updateGenReady();
    return;
  }
  audioBlob = blob;
  audioName = 'rekaman.webm';
  updateGenReady();
  $('rec-done').classList.remove('hide');
  $('rec-audio').src = URL.createObjectURL(blob);
  setStatus($('asr-status'), 'Rekaman ' + fmtDur(durTimer) + ' siap ditranskrip. Tekan "Mulai transkrip".');
  cekDurasiAsli(durTimer, fail); // pasang pesan yang lebih jujur kalau durasi aslinya beda
  updateGenReady();
}
// WebM dari MediaRecorder kadang nggak nulis durasi (player nampilin Infinity).
// Sekalian jujur soal durasi: kalau hitungan timer beda jauh dari durasi asli,
// bilang ke user, jangan sok cocok.
function cekDurasiAsli(durTimer, fail){
  var a = $('rec-audio');
  var done = function(d){
    if (!isFinite(d) || d <= 0) return;
    if (fail){
      setStatus($('asr-status'), fail + ' Yang ke-capture ' + fmtDur(d) + ' dari hitungan '
        + fmtDur(durTimer) + ' \u2014 datanya masih bisa ditranskrip.', 'err');
    } else if (Math.abs(d - durTimer) > 2 && durTimer >= 3){
      setStatus($('asr-status'), 'Durasi asli rekaman ' + fmtDur(d) + ' (timer sempat ngitung '
        + fmtDur(durTimer) + ') \u2014 mic-nya mungkin sempat terputus, tapi datanya aman buat ditranskrip.', 'ok');
    } // else: pesan awal dari finishRec udah pas, biarin aja
    updateGenReady();
  };
  a.onloadedmetadata = function(){
    var d = a.duration;
    if (d === Infinity){
      a.currentTime = 1e101; // trik benerin durasi webm yang Infinity
      a.ontimeupdate = function(){
        a.ontimeupdate = null;
        d = a.duration;
        a.currentTime = 0;
        done(d);
      };
    } else done(d);
  };
}
// Dipanggil pas logout/bersih-bersih layar: rekaman yang masih jalan, track mic,
// sama timer-nya WAJIB ikut dimatiin — interval bocor bikin hitungan durasi bohong.
function teardownRec(){
  recReqTok++; // batalin getUserMedia yang masih ngantre
  recArming = false;
  finishDone = true;
  recFailMsg = null;
  killRecInterval();
  if (mediaRec){
    try { if (mediaRec.state !== 'inactive') mediaRec.stop(); } catch(e){}
    if (mediaRec.stream) mediaRec.stream.getTracks().forEach(function(t){ t.stop(); });
  }
  mediaRec = null;
  recChunks = [];
  recSec = 0;
  audioBlob = null;
  audioName = '';
  updateRecUI();
  $('rec-done').classList.add('hide');
  $('rec-audio').removeAttribute('src');
}

function setSrc(m){
  $('rec-pane').classList.toggle('hide', m !== 'rec');
  $('up-pane').classList.toggle('hide', m !== 'up');
  $('src-rec').setAttribute('aria-pressed', m === 'rec' ? 'true' : 'false');
  $('src-up').setAttribute('aria-pressed', m === 'up' ? 'true' : 'false');
}
$('src-rec').addEventListener('click', function(){ setSrc('rec'); });
$('src-up').addEventListener('click', function(){ setSrc('up'); });

function readyToTranscribe(msg){
  setStatus($('asr-status'), msg, 'ok');
  $('in-trans').classList.add('hide');
  updateGenReady();
}

$('btn-rec').addEventListener('click', function(){
  if (recArming) return; // lagi nunggu izin mic — klik dobel jangan bikin perekam kedua
  if (recIsLive()){ stopRec(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    setStatus($('asr-status'), 'Browser ini nggak support rekam mic.', 'err'); return;
  }
  killRecInterval(); // interval bocor dari sesi lain bikin hitungan ngebut
  recReqTok++;
  var myTok = recReqTok;
  recArming = true;
  finishDone = false;
  recChunks = []; recSec = 0;
  updateRecUI();
  setStatus($('asr-status'), 'Nunggu izin mic\u2026', 'wait');
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream){
    if (myTok !== recReqTok){ // rekamannya udah batal (logout/di-reset)
      stream.getTracks().forEach(function(t){ t.stop(); });
      return;
    }
    recArming = false;
    recLastData = Date.now();
    try { mediaRec = new MediaRecorder(stream); }
    catch(e){
      stream.getTracks().forEach(function(t){ t.stop(); });
      finishDone = true;
      updateRecUI();
      setStatus($('asr-status'), 'Browser ini nggak bisa buka perekam suaranya.', 'err');
      return;
    }
    mediaRec.ondataavailable = function(e){
      recLastData = Date.now();
      if (e.data && e.data.size) recChunks.push(e.data);
    };
    mediaRec.onerror = function(){
      stopRec('Perekamnya error di tengah jalan.');
    };
    mediaRec.onstop = finishRec;
    stream.getTracks().forEach(function(t){
      t.addEventListener('ended', function(){
        if (recIsLive()) stopRec('Mic-nya tiba-tiba terputus.');
      });
    });
    mediaRec.start(1000); // chunk per detik: ada denyut data buat deteksi rekaman mati
    $('rec-done').classList.add('hide');
    killRecInterval();
    recTimer = setInterval(function(){
      recSec++;
      if (recIsLive() && !document.hidden && Date.now() - recLastData > 5000){
        stopRec('Rekaman berhenti sendiri di tengah jalan (nggak ada data 5 detik).');
        return;
      }
      updateRecUI();
    }, 1000);
    updateRecUI();
    setStatus($('asr-status'), 'Sedang merekam\u2026 tekan Stop kalau udah selesai.', 'wait');
  }).catch(function(){
    if (myTok !== recReqTok) return;
    recArming = false;
    finishDone = true;
    updateRecUI();
    setStatus($('asr-status'), 'Izin mic ditolak atau nggak ada mic.', 'err');
  });
});

$('in-audio').addEventListener('change', function(){
  var f = this.files[0];
  if (!f) return;
  audioBlob = f;
  audioName = f.name;
  updateGenReady();
  $('up-info').textContent = f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
  readyToTranscribe('File siap ditranskrip. Tekan "Mulai transkrip".');
});

$('btn-asr').addEventListener('click', function(){
  if (!audioBlob){
    setStatus($('asr-status'), 'Rekam atau pilih audionya dulu.', 'err');
    return;
  }
  var st = $('asr-status');
  var btn = this;
  btn.disabled = true;
  setStatus(st, 'Membaca audio\u2026', 'wait');
  var AC = window.AudioContext || window.webkitAudioContext;
  var ac = new AC();
  audioBlob.arrayBuffer()
    .then(function(buf){
      return ac.decodeAudioData(buf);
    })
    .then(function(ab){
      return ac.close().then(function(){ return resample16k(ab); });
    })
    .then(function(pcm){
      var chunkSec = 25;
      var perChunk = 16000 * chunkSec;
      var total = Math.ceil(pcm.length / perChunk);
      var texts = [];
      var i = 0;
      function next(){
        if (i >= total){
          var full = texts.join(' ').replace(/\s+/g, ' ').trim();
          btn.disabled = false;
          if (!full){
            setStatus(st, 'Transkripnya kosong. Coba cek audionya.', 'err');
            return;
          }
          $('in-trans').classList.remove('hide');
          $('in-trans').value = full;
          updateGenReady();
          setStatus(st, 'Transkrip kelar, ' + total + ' bagian (' + full.length + ' karakter). '
            + 'Cek dulu, ada salah dengar bisa dibetulin langsung.', 'ok');
          return;
        }
        setStatus(st, 'Transkrip bagian ' + (i + 1) + '/' + total + '\u2026', 'wait');
        var slice = pcm.subarray(i * perChunk, Math.min((i + 1) * perChunk, pcm.length));
        var form = new FormData();
        form.append('file', wavBlob(slice), 'bagian' + i + '.wav');
        form.append('model', cfg.asrModel);
        return fetch(cfg.base + '/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + cfg.key },
          body: form
        }).then(function(r){
          return r.json().catch(function(){ return {}; });
        }).then(function(j){
          if (j.text){ texts.push(j.text); i++; return next(); }
          if (j.error){
            var e = new Error('ASR: ' + (j.error.message || JSON.stringify(j.error)));
            e.code = j.error.code;
            throw e;
          }
          throw new Error('Balasan ASR nggak jelas.');
        });
      }
      return next();
    })
    .catch(function(err){
      btn.disabled = false;
      var msg = (err && err.message) ? err.message : 'Gagal memproses audio.';
      if (/decode|EncodingError/i.test(msg + ' ' + ((err && err.name) || ''))){
        msg = 'Format audionya nggak bisa dibaca browser. Coba wav/mp3/m4a/webm/ogg yang valid.';
      }
      setStatus(st, msg, 'err');
    });
});

function resample16k(ab){
  var off = new OfflineAudioContext(1, Math.max(1, Math.ceil(ab.duration * 16000)), 16000);
  var src = off.createBufferSource();
  src.buffer = ab;
  src.connect(off.destination);
  src.start();
  return off.startRendering().then(function(r){
    return r.getChannelData(0).slice();
  });
}

function wavBlob(f32){
  var n = f32.length;
  var buf = new ArrayBuffer(44 + n * 2);
  var v = new DataView(buf);
  function str(o, s){ for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (var i = 0; i < n; i++){
    var s = Math.max(-1, Math.min(1, f32[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

$('in-doc').addEventListener('change', function(){
  var f = this.files[0];
  if (!f) return;
  docName = f.name;
  updateGenReady();
  if (/\.pdf$/i.test(f.name)){ extractPdf(f); return; }
  if (/\.docx$/i.test(f.name)){ extractDocx(f); return; }
  if (/\.rtf$/i.test(f.name)){ extractRtf(f); return; }
  f.text().then(function(t){
    if (looksBinary(t)){
      $('doc-info').textContent = 'Format "' + f.name + '" nggak bisa dibaca browser (misal .doc lama, '
        + '.pptx, atau .pages). Simpan ulang sebagai .docx/.pdf, atau tempel teksnya manual.';
      return;
    }
    if (!appendMateri(t)){
      $('doc-info').textContent = 'File ' + f.name + ' kosong isinya.';
      return;
    }
    $('doc-info').textContent = f.name + ' dimuat (' + t.length + ' karakter). Digabung ke kolom materi.';
  }).catch(function(){
    $('doc-info').textContent = 'Gagal baca file-nya. Tempel teksnya manual aja di kolom materi.';
  });
});
