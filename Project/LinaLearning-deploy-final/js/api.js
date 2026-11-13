// js/api.js — klien API Kenari: chatComplete, fallback model, pesan error.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
function explainErr(err){
  if (err && err.cors){
    return 'Request keblokir browser (CORS). Coba muat ulang halaman, kalau masih gitu '
      + 'kabari pemilik situsnya.';
  }
  if (err && err.code === 401) return 'API key ditolak (401, token expired or incorrect). '
    + 'Key-nya bawaan aplikasi, coba muat ulang halaman atau kabari pemilik situsnya.';
  if (err && err.code === 404) return 'Model atau endpoint API nggak ketemu (404). '
    + 'Kabari pemilik situsnya, konfigurasi API-nya perlu dibenahi.';
  if (err && err.code === 429) return 'Kena limit (429). Tunggu sebentar, coba lagi.';
  if (err && err.code === 503) return 'Model utama & cadangan lagi gangguan di server API (503). '
    + 'Nggak ada yang salah dari sisi kamu, coba lagi beberapa menit.';
  return (err && err.message) ? err.message : 'Gagal manggil API.';
}

function chatUrl(){
  if (cfg.chatProxy) return cfg.chatProxy + encodeURIComponent(cfg.base + '/chat/completions');
  return cfg.base + '/chat/completions';
}
function tunggu(ms){
  return new Promise(function(res){ setTimeout(res, ms); });
}
// chatComplete: panggil /chat/completions dengan rantai model + retry.
// Urutan: model utama (opts.model || cfg.chatModel) lalu cfg.chatFallbacks.
// Error sementara (5xx / 429 / network) dicoba ulang maksimal 2x di model yang
// sama dengan jeda naik, baru turun ke model berikutnya — supaya gangguan
// upstream per-model (503 all_providers_failed) nggak bikin siswa macet.
function chatComplete(messages, opts){
  opts = opts || {};
  var chain = [opts.model || cfg.chatModel];
  Array.prototype.forEach.call(cfg.chatFallbacks || [], function(m){
    if (m && chain.indexOf(m) < 0) chain.push(m);
  });
  function coba(i, tryNo){
    var model = chain[i];
    return fetch(chatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: opts.temperature == null ? 0.4 : opts.temperature,
        max_tokens: opts.maxTokens || 8192
      })
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(j){
        if (!res.ok){
          var e = new Error((j.error && j.error.message) || ('HTTP ' + res.status));
          e.code = res.status;
          var sementara = res.status >= 500 || res.status === 429;
          if (sementara && tryNo < 2){
            return tunggu((tryNo + 1) * 2000).then(function(){ return coba(i, tryNo + 1); });
          }
          if (i + 1 < chain.length) return coba(i + 1, 0);
          throw e;
        }
        var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!c){
          if (i + 1 < chain.length) return coba(i + 1, 0);
          throw new Error('Balasan API kosong atau bentuknya beda dari yang diperkirakan.');
        }
        return c;
      });
    }, function(){
      if (tryNo < 2){
        return tunggu((tryNo + 1) * 2000).then(function(){ return coba(i, tryNo + 1); });
      }
      if (i + 1 < chain.length) return coba(i + 1, 0);
      var e = new Error('network');
      e.cors = true;
      throw e;
    });
  }
  return coba(0, 0);
}

var audioBlob = null, audioName = '', docName = '';
var mediaRec = null, recChunks = [], recTimer = null, recSec = 0;
var recArming = false, recReqTok = 0, recLastData = 0, finishDone = true, recFailMsg = null;

