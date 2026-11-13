// js/core.js — inti aplikasi: konfigurasi API via config.js, util global, state.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
// Konfigurasi API: nilai asli (base URL, key, nama model) dibaca dari config.js
// (window.LINA_CONFIG) yang tidak di-push ke repo — lihat config.example.js.
// Jobdesk 2 model (berdasar keunggulan benchmark) — hanya dua ini, dua-duanya murah:
//   - glm-5-3-flash  → modul & slide: konteks 1M, kuat menyusun dokumen panjang terstruktur
//   - gpt-6-luna     → kuis: cepat & konsisten untuk tugas terstruktur berulang (JSON soal)
var DEFAULT_CONFIG = {
  base: 'https://kenari.id/v1',
  key: '', // diisi di config.js (jangan pernah hardcode / di-push ke repo)
  chatModel: 'glm-5-3-flash',
  // Cadangan kalau upstream model utama lagi mati (mis. 503 upstream unavailable).
  // chatComplete turun ke daftar ini berurutan (duplikat dibuang), jadi rantainya
  // saling back-up dua arah: modul/slide glm→luna, kuis luna→glm. Dites 12 Nov 2026:
  // dua-duanya hidup; glm sempat 503 sementara (upstream down), luna tetap aman.
  chatFallbacks: ['gpt-6-luna', 'glm-5-3-flash'],
  quizModel: 'gpt-6-luna',
  asrModel: 'whisper-large-v3-turbo',
  chatProxy: ''
};

function loadJSON(k, fb){
  try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return fb; }
}
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
// Config lama di localStorage (masa-masa ada panel Pengaturan) dibuang sekalian
// supaya tidak ada config basi yang menimpa default baru.
localStorage.removeItem('lina_config');
var cfg = Object.assign({}, DEFAULT_CONFIG, window.LINA_CONFIG || {});
// Peringatan kalau config.js belum dibuat / key kosong (lihat config.example.js).
if (!cfg.key){
  console.warn('[LinaLearning] API key kosong: salin config.example.js jadi config.js lalu isi key.');
  var nokeyBanner = document.createElement('div');
  nokeyBanner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b91c1c;color:#fff;font:600 12.5px/1.4 Inter,sans-serif;padding:8px 14px;text-align:center';
  nokeyBanner.textContent = 'API key belum diisi \u2014 salin config.example.js jadi config.js dan isi key Kenari di dalamnya.';
  document.body.appendChild(nokeyBanner);
}
var profile = loadJSON('lina_profile', null);
var histList = loadJSON('lina_history', []);
var session = null;

function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function updateNav(id){
  document.body.classList.toggle('nav-off', id === 'screen-login');
  document.body.classList.toggle('guest', id === 'screen-landing' || id === 'screen-about');
  var onHome = id === 'screen-home' || id === 'screen-login' || id === 'screen-landing' || id === 'screen-about';
  $('nav-beranda').classList.toggle('on', onHome);
  $('nav-study').classList.toggle('on', id === 'screen-study');
}
function show(id){
  ['screen-landing','screen-about','screen-login','screen-home','screen-study','screen-report'].forEach(function(s){
    $(s).classList.toggle('hide', s !== id);
  });
  updateNav(id);
  window.scrollTo(0, 0);
}
function setStatus(el, msg, cls){
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'status' + (cls ? ' ' + cls : '');
}
function fmtDur(sec){
  sec = Math.max(0, Math.round(sec));
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ' mnt ' + (s < 10 ? '0' : '') + s + ' dtk';
}
function fmtDate(ts){
  var d = new Date(ts);
  return d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) +
    ', ' + d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
}

