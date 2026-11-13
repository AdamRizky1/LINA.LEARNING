// js/auth.js — form login & daftar akun via /api/auth (backend lina-auth + Turso).
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
// ===== Auth: masuk/daftar via /api/auth (backend lina-auth + Turso) =====
var meUser = null;
function authPost(path, data, onOk, onErr){
  fetch(path, {method: 'POST', credentials: 'same-origin',
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
  .then(function(r){ return r.json().then(function(j){ return {st: r.status, j: j}; }); })
  .then(function(x){
    if (x.st < 400 && x.j && x.j.ok) onOk(x.j.user);
    else onErr((x.j && x.j.error) || 'gagal_' + x.st);
  })
  .catch(function(){ onErr('jaringan'); });
}
function loginSukses(u){
  meUser = u;
  profile = { nama: u.nama, ortu: u.ortu_email };
  saveJSON('lina_profile', profile);
  enterHome();
}
function pesanAuth(err){
  if (err === 'login_salah') return 'Username atau password salah.';
  if (err === 'username_dipakai') return 'Username udah dipakai \u2014 pakai yang lain atau pilih tab Masuk.';
  if (err === 'username_tidak_valid') return 'Username 3 sampai 24 huruf/angka (boleh titik atau underscore).';
  if (err === 'password_terlalu_pendek') return 'Password minimal 6 karakter.';
  if (err === 'email_ortu_tidak_valid') return 'Email orang tuanya belum valid.';
  if (err === 'terlalu_sering') return 'Terlalu sering mencoba \u2014 tunggu beberapa menit ya.';
  if (err === 'origin_ditolak') return 'Request diblokir \u2014 buka lewat linalearning.my.id.';
  if (err === 'jaringan') return 'Server nggak bisa dihubungi \u2014 cek koneksi, terus coba lagi.';
  if (err === 'db_gangguan' || err === 'db_belum_dikonfigurasi') return 'Database lagi gangguan \u2014 coba beberapa saat lagi.';
  return 'Gagal (' + err + ') \u2014 coba lagi.';
}
var loginMode = 'masuk';
function setLoginMode(m){
  loginMode = m;
  $('tab-masuk').className = m === 'masuk' ? 'btn' : 'btn2';
  $('tab-daftar').className = m === 'daftar' ? 'btn' : 'btn2';
  $('lg-daftar-fields').classList.toggle('hide', m !== 'daftar');
  $('lg-pass').setAttribute('autocomplete', m === 'daftar' ? 'new-password' : 'current-password');
  $('btn-login').textContent = m === 'daftar' ? 'Daftar & masuk' : 'Masuk';
  $('login-title').textContent = m === 'daftar' ? 'Bikin akun' : 'Masuk dulu';
  setStatus($('login-status'), '');
}
$('tab-masuk').addEventListener('click', function(){ setLoginMode('masuk'); });
$('tab-daftar').addEventListener('click', function(){ setLoginMode('daftar'); });

$('form-login').addEventListener('submit', function(e){
  e.preventDefault();
  var st = $('login-status');
  var user = $('lg-user').value.trim(), pass = $('lg-pass').value;
  if (loginMode === 'masuk'){
    if (!user || !pass){ setStatus(st, 'Isi username dan password dulu.', 'err'); return; }
    setStatus(st, 'Masuk\u2026', 'wait');
    authPost('/api/auth/login', {username: user, password: pass}, loginSukses,
      function(err){ setStatus(st, pesanAuth(err), 'err'); });
    return;
  }
  var nama = $('lg-nama').value.trim(), ortu = $('lg-ortu').value.trim();
  if (!nama || !ortu || !user || pass.length < 6){
    setStatus(st, 'Lengkapi semua kolom (password minimal 6 karakter).', 'err');
    return;
  }
  setStatus(st, 'Mendaftarkan akun\u2026', 'wait');
  authPost('/api/auth/register', {username: user, password: pass, nama: nama, ortu: ortu},
    loginSukses, function(err){ setStatus(st, pesanAuth(err), 'err'); });
});

$('btn-logout').addEventListener('click', function(){
  teardownRec(); // jangan ninggalin perekam + timer hidup pas keluar
  session = null;
  if (typeof foc !== 'undefined' && foc.loop) stopFocus();
  if (sessionTimeLoop){ clearTimeout(sessionTimeLoop); sessionTimeLoop = null; }
  // Bersihin jejak user lama di perangkat ini (perangkat kelas sering dipakai bergantian)
  profile = null;
  meUser = null;
  histList = [];
  saveJSON('lina_history', []);
  localStorage.removeItem('lina_profile');
  fetch('/api/auth/logout', {method: 'POST', credentials: 'same-origin'}).catch(function(){});
  show('screen-landing'); // keluar akun = balik ke dashboard tamu
});

