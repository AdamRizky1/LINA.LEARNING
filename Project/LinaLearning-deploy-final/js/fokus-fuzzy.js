// js/fokus-fuzzy.js — logika fuzzy takaran fokus (Sugeno ringan).
// Masalah yang dibereskan: takaran wajah lama BINER (ada wajah = 60, nggak ada =
// 0 + poin ketenangan) — jadi wajah hilang di ruangan tenang nyangkut ~40% dan
// nunduk/mata melirik ke bawah tetap dianggap fokus penuh. Rancu.
//
// Sekarang poin wajah (slot 0-60) dihitung fuzzy dari tiga sinyal kamera:
//   ada      — wajah terdeteksi atau tidak, plus sudah berapa detik hilang
//              (hilang → takaran turun bertahap sampai 0, bukan nyangkut)
//   memendek — rasio geometri box wajah vs kalibrasi dasar. Nunduk memendekkan
//              tinggi wajah (foreshortening), menyamping memendekkan lebar,
//              melirik ke bawah meski kepala tegap memendekkan tinggi sedikit
//              tapi PERSISTEN — semuanya kebaca lewat rasio ini
//   geser    — pusat box bergeser turun (kepala ikut merosot ke bawah)
//
// Poin ketenangan (mic) tetap ada tapi diskalakan ke hadiran wajah — orang
// tidak ada di depan kamera, ruangan sepi pun bukan fokus.
//
// Modul ini MURNI (tanpa DOM/kamera) — bisa diuji langsung di Node.
(function (g) {
  'use strict';

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // Keanggotaan trapesium: 0 sampai a, naik ke 1 di b, penuh b..c, turun ke 0 di d.
  function trapz(x, a, b, c, d) {
    if (x <= a || x >= d) return 0;
    if (x >= b && x <= c) return 1;
    return x < b ? (x - a) / (b - a) : (d - x) / (d - c);
  }
  function tri(x, a, b, c) { return trapz(x, a, b, b, c); }

  // ── Kalibrasi dasar box wajah ──
  // Median 8 sampel pertama yang wajar → dasar nggak tersedot kalau pengguna
  // sempat nunduk pas fase kalibrasi. Setelah siap, adaptasi pelan (EMA 10%)
  // cuma dari sampel nyaris tegak, biar ngikut kalau posisi/kamera bergeser.
  function makeBase() {
    return { h: [], w: [], cy: [], ready: false, H: 0, W: 0, CY: 0 };
  }
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function updateBase(b, box) {
    var ratioH = b.H > 0 ? box.height / b.H : 1;
    var ratioW = b.W > 0 ? box.width / b.W : 1;
    var wajar = !b.ready ||
      (ratioH >= 0.88 && ratioH <= 1.15 && ratioW >= 0.88 && ratioW <= 1.15);
    if (!wajar) return b.ready; // sampel nunduk/menyamping jelas → buang, jangan ikutkan
    if (b.ready) {
      if (ratioH > 0.95) b.H = 0.9 * b.H + 0.1 * box.height;
      if (ratioW > 0.95) b.W = 0.9 * b.W + 0.1 * box.width;
      return true;
    }
    b.h.push(box.height); b.w.push(box.width); b.cy.push(box.y + box.height / 2);
    if (b.h.length >= 8) {
      b.H = median(b.h); b.W = median(b.w); b.CY = median(b.cy);
      b.ready = true;
    }
    return b.ready;
  }

  // ── Sinyal dari box wajah ──
  // memendek: MINIMUM rasio tinggi/lebar vs dasar (1 = wajar). Nunduk → tinggi
  // menyusut, menyamping → lebar menyusut, keluar frame → box kepotong. Satu
  // sumbu untuk semua bentuk "muka nggak nengok layar".
  // geserY: pergeseran pusat box vertikal sebagai fraksi tinggi frame (+ = turun).
  function boxSignals(box, base, frameH) {
    var rH = base.H > 0 ? box.height / base.H : 1;
    var rW = base.W > 0 ? box.width / base.W : 1;
    return {
      memendek: Math.min(rH, rW),
      geserY: base.ready ? ((box.y + box.height / 2) - base.CY) / Math.max(1, frameH) : 0
    };
  }

  // ── Himpunan fuzzy ──
  // memendek (rasio):  tegak penuh ~1.0-1.2 (nunduk dikit masih di agak)
  var SETS = {
    tegakTolak: [0.95, 0.99, 1.20, 1.30],  // trapz
    agakTolak: [0.84, 0.93, 0.99],         // tri  — memendek ~7% (mata turun/kepala dikit)
    banyakTolak: [0.62, 0.74, 0.86, 0.95], // trapz — nunduk/menyamping jelas
    // geserY (fraksi tinggi frame):
    diamTolak: [-0.03, 0.0, 0.06, 0.12],
    rosotTolak: [0.04, 0.10, 0.40, 0.60],
    // detik tanpa wajah:
    hilangTolak: [0.05, 0.80, 6, 10]
  };
  function muTegak(x) { return trapz(x, SETS.tegakTolak[0], SETS.tegakTolak[1], SETS.tegakTolak[2], SETS.tegakTolak[3]); }
  function muAgak(x) { return tri(x, SETS.agakTolak[0], SETS.agakTolak[1], SETS.agakTolak[2]); }
  function muBanyak(x) { return trapz(x, SETS.banyakTolak[0], SETS.banyakTolak[1], SETS.banyakTolak[2], SETS.banyakTolak[3]); }
  function muDiam(g) { return trapz(g, SETS.diamTolak[0], SETS.diamTolak[1], SETS.diamTolak[2], SETS.diamTolak[3]); }
  function muRosot(g) { return trapz(g, SETS.rosotTolak[0], SETS.rosotTolak[1], SETS.rosotTolak[2], SETS.rosotTolak[3]); }

  // ── Konsekuensi (poin wajah 0-60, slot yang dulu diisi biner 60/0) ──
  var S_TEGAK = 60, S_AGAK = 42, S_BANYAK = 22;
  var MISS_AWAL = 22;       // wajah baru saja hilang (kedipan/kejut detektor) → penalti ringan
  var MISS_TURUN = 7;       // penurunan poin per detik setelah 1,5 dtk
  var MISS_MULES = 1.5;     // di bawah segini dianggap kejilatan, di atasnya turun bertahap

  // Kurva wajah hilang: 22 poin sampai 1,5 dtk, lalu turun 7 poin/dtk → 0 di ~4,6 dtk.
  // Inilah yang bikin "muka ga keliatan → takaran jelas berkurang", bukan nyangkut 40.
  function missScore(missSec) {
    if (missSec <= MISS_MULES) return MISS_AWAL;
    return Math.max(0, MISS_AWAL - MISS_TURUN * (missSec - MISS_MULES));
  }

  // ── Inferensi ──
  // input: { ada, calibrated, memendek, geserY, missSec }
  // keluaran: { score: 0-60, label: teks status untuk UI }
  function infer(inp) {
    if (!inp.ada) {
      return { score: missScore(inp.missSec || 0), label: 'wajah tidak terlihat — takaran turun bertahap' };
    }
    if (!inp.calibrated) {
      // Belum ada pembanding dasar → jangan menghukum dulu, kasih poin penuh
      // sampai kalibrasi jalan (maks ~12 dtk cek pertama). Aman dari penalti salah.
      return { score: S_TEGAK, label: 'wajah terlihat (kalibrasi posisi awal)' };
    }
    var mTegak = muTegak(inp.memendek), mAgak = muAgak(inp.memendek), mBanyak = muBanyak(inp.memendek);
    var mDiam = muDiam(inp.geserY), mRosot = muRosot(inp.geserY);
    // Aturan (Sugeno): bobot = kekuatan aktivasi, konsekuensi = poin wajah.
    var rules = [
      { w: mTegak * mDiam, s: S_TEGAK },              // tegak & kepala di tempat → fokus penuh
      { w: mTegak * mRosot, s: 40 },                  // wajah utuh tapi merosot ke bawah
      { w: mAgak * mDiam, s: S_AGAK },                // mata turun/kepala dikit, posisi tetap
      { w: mAgak * mRosot, s: 32 },                   // turun dikit + ikut merosot
      { w: mBanyak, s: S_BANYAK }                     // nunduk/menyamping jelas → poin wajah rendah
    ];
    var tot = 0, acc = 0, i;
    for (i = 0; i < rules.length; i++) { tot += rules[i].w; acc += rules[i].w * rules[i].s; }
    var score = tot > 0 ? acc / tot : S_TEGAK; // di luar semua himpunan (mis. makin dekat kamera) → penuh
    var label;
    if (mBanyak >= 0.5) label = 'nunduk/menyamping dari layar — takaran turun';
    else if (mAgak >= 0.5) label = 'posisi mata/kepala turun dikit — takaran ikut turun';
    else label = 'wajah terlihat, posisi tegak';
    return { score: Math.round(score * 100) / 100, label: label };
  }

  g.FokusFuzzy = {
    trapz: trapz, tri: tri,
    makeBase: makeBase, updateBase: updateBase, boxSignals: boxSignals,
    infer: infer, missScore: missScore,
    // diekspos buat tes & kalibrasi manual
    SETS: SETS, S_TEGAK: S_TEGAK, S_AGAK: S_AGAK, S_BANYAK: S_BANYAK,
    MISS_AWAL: MISS_AWAL, MISS_TURUN: MISS_TURUN, MISS_MULES: MISS_MULES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.FokusFuzzy;
})(typeof window !== 'undefined' ? window : globalThis);
