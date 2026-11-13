// js/report.js — laporan sesi, simpan DB, kirim email orang tua, init.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
function finishSession(){
  if (!session) return;
  evsFinalize();
  var dur = Math.round((Date.now() - session.startedAt) / 1000);
  var rep = {
    ts: Date.now(),
    judul: session.data.judul || 'Sesi belajar',
    durasi: dur,
    fokus: session.scoreN ? Math.round(session.scoreSum / session.scoreN) : null,
    tab: session.tabInt,
    wajah: session.faceInt,
    benar: session.answers.filter(function(a){ return a.benar; }).length,
    soal: session.answers.length,
    ringkasan: session.data.ringkasan || '',
    trans: session.trans,
    evs: session.evs || { faceSec: 0, faceLostAt: 0, tabSec: 0, tabLostAt: 0, noiseN: 0, noiseSec: 0 },
    saran: null
  };
  histList.unshift(rep);
  histList = histList.slice(0, 20);
  saveJSON('lina_history', histList);
  stopFocus();
  if (sessionTimeLoop){ clearTimeout(sessionTimeLoop); sessionTimeLoop = null; }
  currentReport = rep;
  session = null;
  // Laporan tampil dulu; email baru dikirim setelah saran tindak lanjut siap.
  // AI ditunggu maksimal 9 detik — lebih lambat dari itu pakai template biar
  // pengiriman otomatis nggak macet gara-gara API.
  showReport(rep, false);
  setStatus($('send-status'), 'Menyusun saran tindak lanjut buat ortu\u2026', 'wait');
  Promise.race([
    saranAi(rep),
    tunggu(9000).then(function(){ return null; })
  ]).then(function(s){
    rep.saran = s || saranTemplate(rep);
    if (currentReport === rep) $('rep-table').innerHTML = repRows(rep);
    saveJSON('lina_history', histList);
    kirimLaporan(rep, true);
  });
}

// Rincian gangguan per kejadian + total durasinya. Kalau skor fokus rendah tapi
// semua counter kejadian 0, durasi kumulatif yang jelasin penyebabnya (wajah
// nggak pernah terdeteksi / suara berisik hampir sepanjang sesi) — jadi ortu
// nggak bingung "fokus 30% tapi gangguannya kok nggak ada".
function gangguanText(rep){
  var e = rep.evs || {}, p = [];
  var fSec = Math.round(e.faceSec || 0), tSec = Math.round(e.tabSec || 0), nSec = Math.round(e.noiseSec || 0);
  if (rep.wajah > 0) p.push('wajah hilang ' + rep.wajah + 'x' + (fSec > 0 ? ' (total ' + fSec + ' detik)' : ''));
  else if (fSec >= 10) p.push('wajah hampir nggak pernah terdeteksi kamera (total ' + fSec + ' detik)');
  if (rep.tab > 0) p.push('pindah tab ' + rep.tab + 'x' + (tSec > 0 ? ' (total ' + tSec + ' detik)' : ''));
  if (e.noiseN > 0) p.push('suara berisik ' + e.noiseN + 'x' + (nSec > 0 ? ' (total ' + nSec + ' detik)' : ''));
  else if (nSec >= 10) p.push('suara sekitar berisik (total ' + nSec + ' detik)');
  return p.length ? p.join(', ') : 'nggak ada yang berarti';
}
// 0/0 kelihatan kayak error — kuis yang nggak pernah dibuka bilang apa adanya.
function kuisText(rep){
  return rep.soal === 0 ? 'belum dikerjakan' : rep.benar + ' benar dari ' + rep.soal + ' soal';
}
// Template saran deterministik — fallback kalau AI gagal / key kosong, biar
// saran di email tetap ada dan tetap nyambung sama datanya.
function saranTemplate(rep){
  var p = [];
  if (rep.durasi < 300) p.push('Durasi belajarnya masih singkat, coba bikin jadwal rutin 15-30 menit per sesi dan dampingi anak di menit-menit awal biar cepat masuk.');
  if (rep.fokus != null && rep.fokus < 50) p.push('Fokusnya masih rendah, pastikan tempat belajar tenang, kamera mengarah ke anak, dan HP ditaruh jauh selama sesi.');
  else if (rep.fokus != null && rep.fokus < 80) p.push('Fokusnya lumayan; lingkungan yang lebih tenang biasanya bikin skor berikutnya naik.');
  if (rep.soal === 0) p.push('Kuisnya belum dikerjakan, ajak anak mencobanya supaya hafalan materinya teruji.');
  else if (rep.benar / Math.max(1, rep.soal) < 0.6) p.push('Nilai kuisnya masih di bawah 60%, sebaiknya beberapa bagian materi diulang besok sebelum lanjut.');
  if (!p.length) p.push('Hasilnya bagus, pertahankan ritme belajar seperti ini dan jangan lupa beri apresiasi buat anak.');
  return p.join(' ');
}
// Saran tindak lanjut via AI (chatComplete — rantai fallback model sudah ada di
// api.js). Gagal / key kosong → null, pemanggil otomatis pakai saranTemplate.
function saranAi(rep){
  if (!cfg || !cfg.key) return Promise.resolve(null);
  var p = 'Data sesi belajar anak dari aplikasi LinaLearning:\n'
    + '- Durasi: ' + fmtDur(rep.durasi) + '\n'
    + '- Skor fokus rata-rata: ' + (rep.fokus == null ? 'tidak terukur' : rep.fokus + '%') + '\n'
    + '- Kuis: ' + kuisText(rep) + '\n'
    + '- Gangguan: ' + gangguanText(rep) + '\n\n'
    + 'Berdasarkan data itu, tulis SATU paragraf pendek (maksimal 3 kalimat) berisi saran '
    + 'praktis untuk orang tua agar bisa mendampingi anak belajar lebih baik berikutnya. '
    + 'Bahasa Indonesia, nada hangat dan sopan, tanpa poin bernomor, tanpa markdown, tanpa sapaan. '
    + 'Balas hanya paragrafnya.';
  return chatComplete([{ role: 'user', content: p }], { temperature: 0.3, maxTokens: 400 })
    .then(function(t){
      t = (t || '').trim().replace(/\s+/g, ' ');
      return t ? t.slice(0, 600) : null;
    })
    .catch(function(){ return null; });
}

function reportText(rep){
  return [
    'Laporan belajar ' + profile.nama,
    'Tanggal   : ' + fmtDate(rep.ts),
    'Materi    : ' + rep.judul,
    'Durasi    : ' + fmtDur(rep.durasi),
    'Skor fokus: ' + (rep.fokus == null ? '-' : rep.fokus + '%'),
    'Gangguan  : ' + gangguanText(rep),
    'Kuis      : ' + kuisText(rep),
    '',
    'Saran tindak lanjut buat ortu:',
    rep.saran || '-',
    '',
    'Ringkasan materi:',
    rep.ringkasan
  ].join('\n');
}

function repRows(rep){
  return '<tr><th>Materi</th><td>' + esc(rep.judul) + '</td></tr>'
    + '<tr><th>Durasi belajar</th><td>' + fmtDur(rep.durasi) + '</td></tr>'
    + '<tr><th>Skor fokus</th><td>' + (rep.fokus == null ? '-' : rep.fokus + '%') + '</td></tr>'
    + '<tr><th>Gangguan</th><td>' + gangguanText(rep) + '</td></tr>'
    + '<tr><th>Skor kuis</th><td>' + kuisText(rep) + '</td></tr>'
    // rep lama (sebelum fitur saran) nggak punya field-nya → barisnya dilewati;
    // yang masih null berarti saran lagi disusun.
    + (rep.saran === undefined ? '' : '<tr><th>Saran tindak lanjut</th><td>' + esc(rep.saran || 'sedang disusun\u2026') + '</td></tr>')
    + '<tr><th>Ringkasan materi</th><td>' + esc(rep.ringkasan) + '</td></tr>';
}

// HTML email laporan (inline style, aman untuk klien email) — dikirim via MailKite
function reportHtml(rep){
  var th = 'padding:8px 10px;border:1px solid #e3e4f0;background:#f6f6fd;font-weight:600;width:180px;color:#1f2340';
  var td = 'padding:8px 10px;border:1px solid #e3e4f0;color:#1f2340';
  return '<div style="font-family:Inter,\'Segoe UI\',Arial,sans-serif;background:#f4f4fb;padding:24px">'
    + '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e4f0">'
    + '<div style="background:linear-gradient(120deg,#4f46e5,#7c3aed,#2563eb);padding:22px 26px;color:#ffffff">'
    + '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85">LinaLearning</div>'
    + '<h1 style="margin:8px 0 0;font-size:21px;line-height:1.3">Laporan belajar \u2014 ' + esc(profile.nama) + '</h1>'
    + '<div style="font-size:13px;opacity:.9;margin-top:4px">' + esc(fmtDate(rep.ts)) + '</div>'
    + '</div>'
    + '<table style="border-collapse:collapse;width:100%;font-size:14px">'
    + '<tr><td style="' + th + '">Materi</td><td style="' + td + '">' + esc(rep.judul) + '</td></tr>'
    + '<tr><td style="' + th + '">Durasi belajar</td><td style="' + td + '">' + fmtDur(rep.durasi) + '</td></tr>'
    + '<tr><td style="' + th + '">Skor fokus</td><td style="' + td + '">' + (rep.fokus == null ? '-' : rep.fokus + '%') + '</td></tr>'
    + '<tr><td style="' + th + '">Gangguan</td><td style="' + td + '">' + gangguanText(rep) + '</td></tr>'
    + '<tr><td style="' + th + '">Skor kuis</td><td style="' + td + '">' + kuisText(rep) + '</td></tr>'
    + '<tr><td style="' + th + '">Ringkasan materi</td><td style="' + td + '">' + esc(rep.ringkasan) + '</td></tr>'
    + '</table>'
    // Saran ditonjolin di kotak sendiri di atas footer — ortu sibuk cukup baca
    // bagian ini doang, ringkasan materi di bawahnya opsional.
    + (rep.saran === undefined ? ''
        : '<div style="margin:14px 26px 0;padding:12px 16px;background:#eef2ff;border:1px solid #dfe3ff;border-radius:10px;font-size:14px;color:#1f2340;line-height:1.55">'
          + '<b style="display:block;margin-bottom:4px">Saran tindak lanjut buat ortu</b>'
          + esc(rep.saran || 'sedang disusun\u2026') + '</div>')
    + '<div style="padding:16px 26px 22px;color:#8a8ca6;font-size:12px">Laporan otomatis dari LinaLearning \u00b7 linalearning.my.id</div>'
    + '</div></div>';
}

function showReport(rep, autoKirim){
  $('rep-head').textContent = profile.nama + ' \u2014 ' + fmtDate(rep.ts);
  $('rep-table').innerHTML = repRows(rep);
  $('rep-trans').textContent = rep.trans || '(kosong)';
  setStatus($('send-status'), '');
  $('send-note').textContent = 'Laporan ini dikirim otomatis ke email orang tua tiap sesi selesai \u2014 nggak perlu nekan apa-apa. '
    + 'Kalau nggak kelihatan di inbox, cek folder spam.';
  show('screen-report');
  simpanLaporanDb(rep);
  if (autoKirim) setTimeout(function(){ kirimLaporan(rep, true); }, 400);
}

// Simpan laporan ke DB (Turso via /api/laporan) — fire & forget. Gagal diabaikan:
// kirim email ortu tetap jalan, dan laporan lokal tetap tampil di layar.
function simpanLaporanDb(rep){
  try{
    fetch('/api/laporan', {method: 'POST', credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ts: rep.ts, judul: rep.judul || '', durasi: rep.durasi,
        fokus: rep.fokus, tab: rep.tab, wajah: rep.wajah, benar: rep.benar,
        soal: rep.soal, ringkasan: rep.ringkasan || '', trans: rep.trans || ''})})
      .catch(function(){});
  }catch(e){}
}

// Kirim laporan ke email ortu via /api/mail/send (MailKite), dipicu otomatis
// saat sesi selesai. Ngga ada lagi tombol kirim manual, jadi kalau gagal karena
// gangguan sementara, ulang sendiri maksimal 3x dengan jeda naik (error config
// kayak key ditolak nggak diulang — percuma).
function kirimLaporan(rep, otomatis, cobaKe){
  var st = $('send-status');
  cobaKe = cobaKe || 1;
  if (!profile.ortu){
    setStatus(st, 'Laporan nggak dikirim otomatis karena email ortu belum diisi di form awal.', 'err');
    return;
  }
  setStatus(st, (cobaKe > 1 ? 'Ulang kirim otomatis ke ' : 'Mengirim laporan otomatis ke ')
    + profile.ortu + '\u2026', 'wait');
  fetch('/api/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: profile.ortu,
      subject: 'Laporan belajar ' + profile.nama + ' \u2014 ' + fmtDate(rep.ts),
      html: reportHtml(rep),
      text: reportText(rep)
    })
  }).then(function(r){
    return r.json().then(function(j){ return { code: r.status, j: j }; });
  }).then(function(x){
    if (x.j && x.j.ok){
      setStatus(st, 'Laporan otomatis terkirim ke ' + profile.ortu
        + '. Orang tua tinggal cek inbox (atau folder spam).', 'ok');
    } else if (x.j && x.j.error === 'api_key_ditolak'){
      var e1 = new Error('server email nolak kunci API \u2014 pemilik situs perlu memperbarui kunci MailKite di server');
      e1.fatal = true; throw e1;
    } else if (x.j && x.j.error === 'domain_pengirim_belum_diterima'){
      var e2 = new Error('domain pengirim belum terhubung di akun MailKite \u2014 tambahkan & verifikasi domain dulu di dashboard');
      e2.fatal = true; throw e2;
    } else {
      throw new Error((x.j && (x.j.detail || x.j.error)) || 'HTTP ' + x.code);
    }
  }).catch(function(e){
    if (cobaKe < 3 && !(e && e.fatal)){
      setStatus(st, 'Gagal kirim (' + e.message + ') \u2014 ulang otomatis sebentar lagi\u2026', 'wait');
      setTimeout(function(){ kirimLaporan(rep, otomatis, cobaKe + 1); }, 4000 * cobaKe);
      return;
    }
    setStatus(st, 'Gagal kirim: ' + e.message + ' \u2014 laporan masih tampil di halaman ini.', 'err');
  });
}

$('btn-new').addEventListener('click', function(){
  session = null;
  currentReport = null;
  enterHome();
});

function renderHistory(){
  $('hist-sec').classList.remove('hide');
  if (!histList.length){
    $('hist').innerHTML = '<div class="hist-empty">Belum ada sesi. Mulai rekam atau isi materi di atas buat sesi pertama.</div>';
    return;
  }
  var h = '';
  histList.forEach(function(r){
    h += '<div class="hist-item"><div class="hi-main"><div class="hi-title">' + esc(r.judul) + '</div>'
      + '<div class="hi-meta">' + esc(fmtDate(r.ts)) + '</div></div>'
      + '<div class="hi-score">Fokus ' + (r.fokus == null ? 'nggak diukur' : r.fokus + '%') + ' \u00b7 kuis ' + (r.soal === 0 ? 'belum dikerjakan' : r.benar + '/' + r.soal) + '</div>'
      + '<button class="btn2 hist-open" data-ts="' + r.ts + '" type="button">Buka</button></div>';
  });
  $('hist').innerHTML = h;
  Array.prototype.forEach.call($('hist').querySelectorAll('.hist-open'), function(b){
    b.addEventListener('click', function(){
      var ts = +b.getAttribute('data-ts');
      var r = histList.filter(function(x){ return x.ts === ts; })[0];
      if (r){ currentReport = r; showReport(r, false); }
    });
  });
}

function resetHome(){
    $('who').innerHTML = '<div class="pname">' + esc(profile.nama) + '</div><div class="pemail">ortu: ' + esc(profile.ortu) + '</div>';
  var _av = $('btn-profile');
  if (_av) _av.textContent = (profile.nama.charAt(0) || 'L').toUpperCase();
  $('hello').textContent = 'Halo, ' + profile.nama + ' \u2014 siap belajar hari ini?';
  $('secure-warn').classList.toggle('hide', !!window.isSecureContext);
  teardownRec();
  $('in-audio').value = '';
  $('up-info').textContent = '';
  $('in-materi').value = '';
  $('in-doc').value = '';
  $('doc-info').textContent = '';
  docName = '';
  $('in-trans').value = '';
  $('in-trans').classList.add('hide');
  updateGenReady();
  $('btn-asr').disabled = false;
  setStatus($('asr-status'), '');
  setStatus($('gen-status'), '');
  $('pipe').classList.add('hide');
  renderHistory();
}

function enterHome(){
  resetHome();
  show('screen-home');
}

function init(){
  if (!window.isSecureContext) $('ctx-warn').classList.remove('hide');
  // Sesi login dicek dulu ke server; localStorage profile cuma cache doang.
  fetch('/api/auth/me', {credentials: 'same-origin'})
  .then(function(r){ return r.json().then(function(j){ return {st: r.status, j: j}; }); })
  .then(function(x){
    if (x.st === 200 && x.j && x.j.ok){
      meUser = x.j.user;
      profile = { nama: x.j.user.nama, ortu: x.j.user.ortu_email };
      saveJSON('lina_profile', profile);
      enterHome();
    } else {
      profile = null;
      meUser = null;
      localStorage.removeItem('lina_profile');
      show('screen-landing');
    }
  })
  .catch(function(){
    profile = null;
    show('screen-landing');
    setStatus($('login-status'),
      'Server nggak bisa dihubungi, cek koneksi internet, terus muat ulang.', 'err');
  });
}
init();

