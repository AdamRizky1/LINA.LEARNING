// js/generate.js — pipeline generate 3 fase: referensi web, modul/slide/kuis, ilustrasi SVG.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
// ===== Pilihan bahan yang dibuat (sesuai user, disimpan) =====
var genSel = loadJSON('lina_gensel', null);
if (!genSel || typeof genSel !== 'object'){
  genSel = { modul: true, slide: true, peta: true, kuis: true };
}
['modul','slide','peta','kuis'].forEach(function(k){
  if (typeof genSel[k] !== 'boolean') genSel[k] = true;
});
function renderGenPick(){
  Array.prototype.forEach.call(document.querySelectorAll('#gen-pick .gpick'), function(b){
    var on = genSel[b.getAttribute('data-k')] !== false;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
Array.prototype.forEach.call(document.querySelectorAll('#gen-pick .gpick'), function(b){
  b.addEventListener('click', function(){
    var k = b.getAttribute('data-k');
    genSel[k] = !(genSel[k] !== false);
    saveJSON('lina_gensel', genSel);
    renderGenPick();
  });
});
renderGenPick();

// ===== Pipeline auto-generate: klik "Mulai belajar" / nav "Mode belajar" =====
// Langsung lompat ke layar belajar; semua bahan yang dipilih disusun otomatis di
// sana dengan chip progres (Modul / Slide / Peta / Kuis) + kerangka placeholder.
var pipeBusy = false;
function pipeSet(k, state){
  var el = document.querySelector('#pipe-chips .pchip[data-k="' + k + '"]');
  if (!el) return;
  el.classList.remove('run', 'done', 'off', 'err');
  if (state) el.classList.add(state);
}
function pipeNote(msg){
  $('pipe-note').textContent = msg || '';
}
function pipeShow(on){
  $('pipe').classList.toggle('hide', !on);
  if (on){
    ['modul','slide','peta','kuis'].forEach(function(k){
      pipeSet(k, genSel[k] === false ? 'off' : '');
    });
  }
}
function renderSkel(){
  $('study-title').textContent = 'Nyusun bahan belajar\u2026';
  $('jalur').classList.add('hide');
  $('pane-modul').innerHTML = '<div class="skel w60"></div><div class="skel"></div>'
    + '<div class="skel w80"></div><div class="skel"></div>'
    + '<p class="note">Nyusun modul dari sumbermu\u2026 butuh 1 sampai 2 menit.</p>';
  $('slidebox').innerHTML = '<div class="skel skel-fig"></div><div class="skel w60"></div>'
    + '<div class="skel"></div>';
  $('sl-cnt').textContent = '';
  $('sl-prev').disabled = true;
  $('sl-next').disabled = true;
  $('pane-quiz').innerHTML = '<p class="note">Kuis nyusul begitu materinya siap.</p>';
  $('pane-peta').innerHTML = '<p class="note">Peta materi muncul begitu modulnya kelar.</p>';
}
function selesaiGen(err){
  pipeBusy = false;
  updateGenReady();
  if (err){
    ['modul','slide','peta','kuis'].forEach(function(k){
      var el = document.querySelector('#pipe-chips .pchip[data-k="' + k + '"]');
      if (el && !el.classList.contains('done') && !el.classList.contains('off')) pipeSet(k, 'err');
    });
    pipeNote('Gagal nyusun: ' + explainErr(err) + ' \u2014 balik ke Beranda buat coba lagi.');
    return;
  }
  pipeNote('Semua bahan siap. Selamat belajar!');
  setTimeout(function(){
    if (!pipeBusy && $('pipe-note').textContent.indexOf('siap') >= 0) pipeShow(false);
  }, 4000);
}
function autoGen(){
  var trans = $('in-trans').value.trim();
  var materi = $('in-materi').value.trim();
  if (!trans && !materi){
    setStatus($('gen-status'), 'Sumbernya masih kosong. Isi transkrip (langkah 3) atau materi '
      + '(langkah 2) dulu \u2014 salah satu aja udah cukup.', 'err');
    return;
  }
  if (pipeBusy) return;
  var needDoc = genSel.modul !== false || genSel.slide !== false || genSel.peta !== false;
  var needSlide = genSel.slide !== false;
  var needPeta = genSel.peta !== false;
  var needQuiz = genSel.kuis !== false;
  if (!needDoc && !needQuiz){
    setStatus($('gen-status'), 'Semua bahan dimatiin. Nyalain minimal satu di daftar '
      + '\u201cDibuat otomatis\u201d dulu ya.', 'err');
    return;
  }
  pipeBusy = true;
  setStatus($('gen-status'), '');
  show('screen-study');
  pipeShow(true);
  renderSkel();
  setTab('modul');
  var mDoc = cfg.chatModel, mQuiz = cfg.quizModel || cfg.chatModel;
  // Fase 1: kumpulin referensi dari web dulu biar materinya akurat.
  pipeNote('Nyari referensi di web dulu biar materinya akurat\u2026');
  cariWeb(trans, materi).then(function(refs){
    var refBlock = refs.length
      ? ('\n\nREFERENSI WEB (buat cek fakta dan nambahin yang kurang; jangan nyebut sumbernya di hasil):\n'
        + refs.map(function(r){ return '- ' + r.judul + ': ' + r.isi; }).join('\n'))
      : '';
    // Fase 2: nyusun tiap bahan yang user pilih. Modul+slide (GLM) paralel sama kuis (GPT Luna).
    var bagian = [];
    if (needDoc) bagian.push('modul' + (needSlide ? ' & slide' : '') + ' [' + mDoc + ']');
    if (needQuiz) bagian.push('kuis [' + mQuiz + ']');
    pipeNote((refs.length ? 'Nemu ' + refs.length + ' referensi web. ' : '')
      + 'Nyusun ' + bagian.join(' paralel sama ') + '. Butuh 1 sampai 2 menit, jangan ditutup halamannya.');
    var sysDoc = 'Kamu guru di Indonesia yang merangkum pelajaran jadi bahan belajar siswa. '
      + 'Balas HANYA JSON valid tanpa penjelasan lain, tanpa markdown, dengan bentuk: '
      + '{"judul":string,"ringkasan":string,"modul":[{"judul":string,"isi":string,"analogi":string,"poin":[string]}]'
      + (needSlide ? ',"slide":[{"judul":string,"isi":[string],"catatan":string}]' : '')
      + (needPeta ? ',"kurikulum":[{"judul":string,"deskripsi":string,"menit":number}]' : '')
      + '} '
      + 'Kolom "isi" boleh beberapa paragraf, pisahkan dengan dua newline. '
      + (needSlide ? 'Buat 4-6 bagian modul dan 8-12 slide. ' : 'Buat 4-6 bagian modul. ')
      + (needPeta
        ? 'Kolom "kurikulum" isi 3-6 tahapan urutan belajar mulai dari konsep paling dasar ke penerapan '
          + '(JANGAN masukkan tahap kuis, itu ditambahin otomatis); "judul" singkat, "deskripsi" 1 kalimat '
          + 'yang jelasin tahap itu, "menit" estimasi durasi belajar tahapnya dalam angka. '
        : '')
      + 'Pakai bahasa Indonesia yang jelas dan enak dibaca siswa. '
      + 'Kolom "analogi" isi 1-3 kalimat analogi atau perbandingan dari kehidupan sehari-hari yang '
      + 'paling kamu yakin bikin konsep bagian itu gampang dipahami; pilih sendiri cara jelasin yang '
      + 'paling cocok per konsep (analogi, cerita pendek, perbandingan sederhana). '
      + (!trans
        ? 'Sumbernya cuma materi tulisan di bawah; anggap itu materi pelajaran utamanya.'
        : (materi ? 'Kalau ada materi tambahan, gabungkan isinya dan patuhi materi tersebut.' : ''));
    var sysQuiz = 'Kamu guru di Indonesia yang bikin kuis pilihan ganda dari materi pelajaran. '
      + 'Balas HANYA JSON valid tanpa penjelasan lain, tanpa markdown, dengan bentuk: '
      + '{"kuis":[{"tanya":string,"pilihan":[string,string,string,string],"jawaban":0,"jelas":string}]} '
      + '"jawaban" adalah index pilihan yang benar (0-3). Buat 8 soal yang menyebar merata ke poin-poin '
      + 'penting materi, pengecohnya masuk akal. Pakai bahasa Indonesia yang jelas. '
      + (!trans
        ? 'Sumbernya cuma materi tulisan di bawah; anggap itu materi pelajaran utamanya.'
        : (materi ? 'Kalau ada materi tambahan, patuhi materi tersebut.' : ''));
    var usr = trans
      ? ('TRANSKRIP:\n' + trans + (materi ? '\n\nMATERI TAMBAHAN:\n' + materi : ''))
      : ('MATERI:\n' + materi);
    usr += refBlock;
    function tag(what, model){
      return function(err){
        err.message = what + ' [' + model + ']: ' + ((err && err.message) || 'gagal');
        throw err;
      };
    }
    var pDoc = !needDoc ? Promise.resolve(null) : chatComplete(
      [{ role: 'system', content: sysDoc }, { role: 'user', content: usr }],
      { temperature: 0.4, maxTokens: 8192, model: mDoc }
    ).then(function(raw){
      var d = parseLesson(raw);
      var ok = d && Array.isArray(d.modul) && d.modul.length
        && (!needSlide || (Array.isArray(d.slide) && d.slide.length));
      if (!ok){
        throw new Error('JSON modul/slide nggak lengkap. Coba lagi, kalau masih gitu muat ulang halamannya.');
      }
      return d;
    }).catch(tag('Modul', mDoc));
    var pQuiz = !needQuiz ? Promise.resolve(null) : chatComplete(
      [{ role: 'system', content: sysQuiz }, { role: 'user', content: usr }],
      { temperature: 0.4, maxTokens: 8192, model: mQuiz }
    ).then(function(raw){
      var d = parseLesson(raw);
      if (!d || !Array.isArray(d.kuis) || !d.kuis.length){
        throw new Error('JSON kuis nggak lengkap. Coba lagi, kalau masih gitu muat ulang halamannya.');
      }
      return d;
    }).catch(tag('Kuis', mQuiz));
    return Promise.all([pDoc, pQuiz]).then(function(rs){
      var d0 = rs[0], d1 = rs[1];
      var data = {
        judul: (d0 && d0.judul) || 'Sesi belajar',
        ringkasan: (d0 && d0.ringkasan) || '',
        modul: (d0 && d0.modul) || [],
        slide: (needSlide && d0 && d0.slide) || [],
        kuis: (d1 && d1.kuis) || [],
        kurikulum: (needPeta && d0 && Array.isArray(d0.kurikulum)) ? d0.kurikulum : null
      };
      // Fase 3: sesi langsung jalan (fokus & timer mulai sekarang), ilustrasi nyusul belakangan.
      startSession(data, trans);
      pipeSet('modul', data.modul.length ? 'done' : (genSel.modul === false ? 'off' : 'err'));
      pipeSet('slide', data.slide.length ? 'done' : (genSel.slide === false ? 'off' : 'err'));
      pipeSet('peta', (data.modul.length || data.kurikulum)
        ? 'done' : (genSel.peta === false ? 'off' : 'err'));
      pipeSet('kuis', data.kuis.length ? 'done' : (genSel.kuis === false ? 'off' : 'err'));
      pipeNote('Bahan kelar. Sekarang nggambar ilustrasinya\u2026');
      var pIll = (needDoc || needSlide)
        ? buatIlustrasi(data).catch(function(){ return { hero: '', modul: {}, slide: {} }; })
        : Promise.resolve(null);
      return pIll.then(function(ill){
        if (ill && session){
          session.data.ilustrasi = ill;
          renderModule(session.data);
          if (!$('pane-slide').classList.contains('hide')) drawSlide();
        }
        selesaiGen(null);
      });
    });
  }).catch(function(err){
    selesaiGen(err);
  });
}
$('btn-gen').addEventListener('click', autoGen);

function parseLesson(raw){
  var s = String(raw).replace(/```(json)?/g, '');
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch(e){ return null; }
}

// ===== Referensi web (Wikipedia Indonesia, API-nya CORS terbuka) =====
function fetchTimeout(url, ms){
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var t = ctrl ? setTimeout(function(){ ctrl.abort(); }, ms || 8000) : null;
  return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function(r){
    if (t) clearTimeout(t);
    return r;
  }, function(e){
    if (t) clearTimeout(t);
    throw e;
  });
}

function cariWeb(trans, materi){
  // Pilih kata kunci pakai model yang cepat, terus ambil ringkasan dari Wikipedia.
  var src = (trans ? trans.slice(0, 1000) : '') + (materi ? '\n' + materi.slice(0, 600) : '');
  return chatComplete([
    { role: 'system', content: 'Kamu pemilih kata kunci pencarian. Balas HANYA JSON array berisi '
      + '2-4 string kata kunci topik pelajaran berikut dalam bahasa Indonesia, tanpa penjelasan. '
      + 'Contoh bentuk: ["siklus air","evaporasi"]' },
    { role: 'user', content: src }
  ], { maxTokens: 512, temperature: 0.2, model: cfg.quizModel || cfg.chatModel })
  .then(function(raw){
    var kw = [];
    try { kw = JSON.parse(String(raw).replace(/```(json)?/g, '').trim()); } catch(e){ kw = []; }
    if (!Array.isArray(kw)) kw = [];
    kw = kw.filter(function(k){ return typeof k === 'string' && k.trim().length > 1; }).slice(0, 3);
    if (!kw.length) return [];
    return Promise.all(kw.map(wikiCari)).then(function(rs){
      var out = [];
      rs.forEach(function(r){ r.forEach(function(x){ if (x) out.push(x); }); });
      return out.slice(0, 5);
    });
  })
  .catch(function(){ return []; }); // gagal nyari web? lanjut aja tanpa referensi
}

function wikiCari(kw){
  var url = 'https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch='
    + encodeURIComponent(kw) + '&srlimit=2&format=json&origin=*';
  return fetchTimeout(url, 8000)
    .then(function(r){ return r.json(); })
    .then(function(j){
      var hits = ((j && j.query && j.query.search) || []).slice(0, 2);
      return Promise.all(hits.map(function(h){ return wikiAmbil(h.title); }));
    })
    .catch(function(){ return []; });
}

function wikiAmbil(title){
  var url = 'https://id.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1'
    + '&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(title);
  return fetchTimeout(url, 8000)
    .then(function(r){ return r.json(); })
    .then(function(j){
      var pages = (j && j.query && j.query.pages) || {};
      var keys = Object.keys(pages);
      if (!keys.length) return null;
      var txt = String(pages[keys[0]].extract || '').trim();
      if (!txt) return null;
      return { judul: pages[keys[0]].title || title, isi: txt.slice(0, 550) };
    })
    .catch(function(){ return null; });
}

// ===== Ilustrator: diagram SVG buat hero, tiap bagian modul, dan slide =====
function buatIlustrasi(data){
  var ill = { hero: '', modul: {}, slide: {} };
  // Render ulang tiap ada bagian yang kelar — slide/modul nampilin placeholder
  // (defaultSlideSvg) dulu, lalu ke-swap begitu SVG-nya datang.
  function renderPartial(){
    if (!session) return;
    session.data.ilustrasi = ill;
    renderModule(session.data);
    if (!$('pane-slide').classList.contains('hide')) drawSlide();
  }
  // Dulu: SATU panggilan LLM gede (hero + semua modul + semua slide) → lama,
  // karena waktu tunggu = jumlah token SEMUA gambar. Sekarang dipecah jadi
  // beberapa panggilan kecil PARALEL → selesai selambat-lambatnya satu chunk,
  // bukan jumlah semuanya; slide ke-swap progresif; satu chunk gagal nggak
  // bawa jatuh yang lain (yang gagal tetap pakai visual cadangan).
  var rules = 'Aturan tiap SVG: mulai <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280">, ringkas '
    + '(maksimal sekitar 25 elemen), tanpa tag script, tanpa atribut event (onclick dll), tanpa '
    + 'foreignObject, tanpa resource eksternal, teks pendek font-family sans-serif minimal ukuran 12. '
    + 'Palet: latar #ffffff atau #f8fafc, bentuk utama #1f54c9, aksen #dfae3d, garis #d8dde7, teks '
    + '#223047. Pilih jenis diagram yang paling ngebantu paham isi bagian itu: alur, siklus, '
    + 'perbandingan, hierarki, atau peta konsep.';
  function minta(sys, payload, tag){
    return chatComplete(
      [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(payload) }],
      { temperature: 0.3, maxTokens: 12288, model: cfg.chatModel }
    ).then(function(raw){
      var d = parseLesson(raw);
      if (!d) throw new Error('ilustrasi ' + tag + ' nggak ke-parse');
      return d;
    });
  }
  var outline = {
    judul: data.judul || '',
    modul: (data.modul || []).map(function(m, i){
      return { i: i, judul: m.judul || '', isi: String(m.isi || '').slice(0, 240) };
    }),
    slide: (data.slide || []).map(function(s, i){
      return { i: i, judul: s.judul || '', isi: (s.isi || []).join(' ').slice(0, 150) };
    })
  };
  var jobs = [];
  // Chunk 1: hero + diagram modul.
  jobs.push(minta(
    'Kamu ilustrator edukasi yang bikin diagram SVG sederhana. Balas HANYA JSON valid tanpa '
    + 'penjelasan lain, tanpa markdown, bentuknya: {"hero":string,"modul":[string]} '
    + '"hero" satu SVG peta konsep keseluruhan materi. "modul" array SVG yang panjangnya HARUS sama '
    + 'dengan jumlah bagian modul di bawah, urut sesuai index. ' + rules,
    { judul: outline.judul, modul: outline.modul }, 'modul'
  ).then(function(d){
    ill.hero = safeSvg(d.hero);
    (Array.isArray(d.modul) ? d.modul : []).forEach(function(s, i){
      var v = safeSvg(s); if (v) ill.modul[i] = v;
    });
    renderPartial();
  }).catch(function(){}));
  // Chunk 2 & 3: diagram slide, dibagi dua biar jalan paralel.
  var sl = outline.slide;
  if (sl.length){
    var mid = Math.ceil(sl.length / 2);
    [sl.slice(0, mid), sl.slice(mid)].forEach(function(part, pi){
      if (!part.length) return;
      jobs.push(minta(
        'Kamu ilustrator edukasi yang bikin diagram SVG sederhana. Balas HANYA JSON valid tanpa '
        + 'penjelasan lain, tanpa markdown, bentuknya: {"slide":[string]} \u2014 array SVG panjangnya '
        + 'HARUS sama dengan jumlah slide di bawah, urut sesuai index; kalau slide nggak butuh '
        + 'diagram, isi string kosong "". ' + rules,
        part, 'slide' + (pi + 1)
      ).then(function(d){
        (Array.isArray(d.slide) ? d.slide : []).forEach(function(s, k){
          var v = safeSvg(s);
          if (v && part[k]) ill.slide[part[k].i] = v;
        });
        renderPartial();
      }).catch(function(){}));
    });
  }
  if (!jobs.length) return Promise.resolve(ill);
  return Promise.all(jobs).then(function(){ return ill; });
}

function safeSvg(s){
  if (!s || typeof s !== 'string') return '';
  s = s.trim();
  if (!/^<svg[\s>]/i.test(s)) return '';
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(xlink:href|href)\s*=\s*("|')\s*(javascript|data)[^"']*\2/gi, '');
  return /<\/svg>/i.test(s) ? s : s + '</svg>';
}

function defaultSlideSvg(idx){
  var cols = ['#1f54c9', '#dfae3d', '#173f9d', '#12805c'];
  var c = cols[idx % cols.length];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160" role="img" aria-hidden="true">'
    + '<rect width="480" height="160" rx="12" fill="#f8fafc"/>'
    + '<circle cx="70" cy="80" r="34" fill="' + c + '" opacity="0.9"/>'
    + '<rect x="130" y="46" width="150" height="12" rx="6" fill="' + c + '" opacity="0.35"/>'
    + '<rect x="130" y="74" width="210" height="12" rx="6" fill="' + c + '" opacity="0.55"/>'
    + '<rect x="130" y="102" width="120" height="12" rx="6" fill="' + c + '" opacity="0.35"/>'
    + '<circle cx="418" cy="80" r="26" fill="none" stroke="' + c + '" stroke-width="5"/>'
    + '</svg>';
}

