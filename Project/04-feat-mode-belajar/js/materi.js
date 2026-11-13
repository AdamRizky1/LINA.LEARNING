// js/materi.js — fitur upload materi opsional & ekstraktor file (txt/pdf/docx/rtf).
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
function appendMateri(t){
  if (!t || !t.trim()) return false;
  var cur = $('in-materi').value;
  $('in-materi').value = cur ? cur + '\n\n' + t.trim() : t.trim();
  updateGenReady();
  return true;
}
// Nyamber file biner yang kebaca jadi karakter aneh (misal .doc/.pptx diubah jadi .txt)
function looksBinary(t){
  if (!t) return true;
  var head = t.slice(0, 1000), ctl = 0, i;
  for (i = 0; i < head.length; i++){
    var c = head.charCodeAt(i);
    if (c === 0) return true;
    if (c < 9 || (c > 13 && c < 32)) ctl++;
  }
  return ctl / head.length > 0.05;
}
// Tombol generate aktif kalau salah satu sumber udah ada: transkrip ATAU materi.
function updateGenReady(){
  var trans = $('in-trans').value.trim(), materi = $('in-materi').value.trim();
  $('btn-gen').disabled = pipeBusy || !(trans || materi);
  var chips = [];
  if (audioBlob) chips.push('<span class="chip"><span class="chip-dot"></span>Audio <small>'
    + esc(audioName || 'rekaman') + '</small></span>');
  if (trans) chips.push('<span class="chip"><span class="chip-dot"></span>Transkrip <small>'
    + fmtWords(trans) + '</small></span>');
  if (materi) chips.push('<span class="chip"><span class="chip-dot"></span>Materi tempel <small>'
    + fmtWords(materi) + '</small></span>');
  if (docName) chips.push('<span class="chip"><span class="chip-dot"></span>File materi <small>'
    + esc(docName) + '</small></span>');
  $('src-chips').innerHTML = chips.join('');
}
function fmtWords(s){
  var n = s.split(/\s+/).filter(Boolean).length;
  return n.toLocaleString('id-ID') + ' kata';
}
$('in-trans').addEventListener('input', updateGenReady);
$('in-materi').addEventListener('input', updateGenReady);
var OCR_MAX_PAGES = 6;
function extractPdf(f){
  $('doc-info').textContent = 'Membaca PDF\u2026';
  loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js').then(function(){
    var pdfjs = window.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    return f.arrayBuffer().then(function(buf){
      return pdfjs.getDocument({ data: buf }).promise;
    }).then(function(doc){
      var pages = [];
      var p = 1;
      function nxt(){
        if (p > doc.numPages){
          var t = pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
          if (t.length >= 200){
            if (appendMateri(t)){
              $('doc-info').textContent = f.name + ': ' + doc.numPages + ' halaman, '
                + t.length + ' karakter. Digabung ke kolom materi.';
            } else {
              $('doc-info').textContent = 'PDF-nya kosong isinya.';
            }
            return;
          }
          // Teks nyaris kosong = PDF-nya kemungkinan besar hasil scan (cuma gambar). Coba OCR.
          $('doc-info').textContent = 'Teks PDF-nya nggak kebaca (kayaknya hasil scan). Dicoba pakai OCR\u2026';
          return ocrPdf(doc).then(function(t2){
            if (t2 && t2.length > t.length && appendMateri(t2)){
              $('doc-info').textContent = f.name + ': ' + doc.numPages + ' halaman, kebaca pakai OCR ('
                + t2.length + ' karakter, maks ' + OCR_MAX_PAGES + ' halaman pertama). '
                + 'Udah digabung ke kolom materi, cek lagi deh hasilnya.';
            } else {
              $('doc-info').textContent = 'PDF-nya hasil scan tapi OCR-nya gagal/nemu dikit. '
                + 'Tempel teksnya manual di kolom materi, atau jepret bagian pentingnya buat direkam.';
            }
          });
        }
        $('doc-info').textContent = 'Membaca PDF halaman ' + p + '/' + doc.numPages + '\u2026';
        return doc.getPage(p++).then(function(pg){
          return pg.getTextContent();
        }).then(function(tc){
          pages.push(tc.items.map(function(it){ return it.str; }).join(' '));
          return nxt();
        });
      }
      return nxt();
    });
  }).catch(function(){
    $('doc-info').textContent = 'Gagal baca PDF (loader butuh internet). Tempel teksnya manual aja.';
  });
}
// OCR buat PDF scan: render tiap halaman ke canvas terus dibaca tesseract.js (indo+inggris).
function ocrPdf(doc){
  return loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')
    .then(function(){
      var T = window.Tesseract;
      if (!T || !T.createWorker) return '';
      return T.createWorker('ind+eng', 1, {
        logger: function(m){
          if (m && m.status === 'recognizing text' && m.progress != null)
            $('doc-info').textContent = 'OCR jalan\u2026 ' + Math.round(m.progress * 100) + '% (butuh internet, sabar ya)';
        }
      }).then(function(worker){
        var out = [], p = 1, maxP = Math.min(doc.numPages, OCR_MAX_PAGES);
        function nxt(){
          if (p > maxP){
            return worker.terminate().then(function(){
              return out.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
            });
          }
          $('doc-info').textContent = 'OCR halaman ' + p + '/' + maxP + '\u2026';
          return doc.getPage(p++).then(function(pg){
            var vp = pg.getViewport({ scale: 2 });
            var cv = document.createElement('canvas');
            cv.width = vp.width; cv.height = vp.height;
            return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise
              .then(function(){ return worker.recognize(cv); })
              .then(function(r){ out.push(((r && r.data && r.data.text) || '').trim()); return nxt(); });
          });
        }
        return nxt();
      });
    }).catch(function(){ return ''; });
}
// .docx = ZIP berisi XML. Browser modern punya DecompressionStream, jadi kita bongkar sendiri
// tanpa library tambahan: cari word/document.xml di tabel ZIP, inflate, terus bersihin XML-nya.
function extractDocx(f){
  $('doc-info').textContent = 'Membaca file Word\u2026';
  f.arrayBuffer().then(function(buf){
    return zipReadFile(buf, 'word/document.xml');
  }).then(function(xml){
    if (!xml) throw new Error('document.xml nggak ketemu');
    var t = xmlToText(xml);
    if (!appendMateri(t)){
      $('doc-info').textContent = 'File Word-nya kosong isinya.';
      return;
    }
    $('doc-info').textContent = f.name + ' dimuat (' + t.length + ' karakter). Digabung ke kolom materi.';
  }).catch(function(){
    $('doc-info').textContent = 'Gagal baca .docx-nya. Coba save-as .docx lagi dari Word, '
      + 'atau tempel teksnya manual.';
  });
}
function zipReadFile(buf, want){
  var u8 = new Uint8Array(buf), dv = new DataView(buf);
  var eocd = -1, i;
  for (i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--){
    if (u8[i] === 0x50 && u8[i+1] === 0x4b && u8[i+2] === 0x05 && u8[i+3] === 0x06){ eocd = i; break; }
  }
  if (eocd < 0) return Promise.reject(new Error('bukan file zip'));
  var n = dv.getUint16(eocd + 10, true);
  var p = dv.getUint32(eocd + 16, true);
  for (var k = 0; k < n; k++){
    if (dv.getUint32(p, true) !== 0x02014b50) return Promise.reject(new Error('tabel zip rusak'));
    var method = dv.getUint16(p + 10, true);
    var csize = dv.getUint32(p + 20, true);
    var nameLen = dv.getUint16(p + 28, true);
    var extraLen = dv.getUint16(p + 30, true);
    var commLen = dv.getUint16(p + 32, true);
    var lho = dv.getUint32(p + 42, true);
    var nm = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commLen;
    if (nm !== want) continue;
    var lNameLen = dv.getUint16(lho + 26, true);
    var lExtraLen = dv.getUint16(lho + 28, true);
    var dataStart = lho + 30 + lNameLen + lExtraLen;
    var data = u8.subarray(dataStart, dataStart + csize);
    if (method === 0) return Promise.resolve(new TextDecoder().decode(data));
    if (method !== 8) return Promise.reject(new Error('kompresi zip nggak didukung'));
    return inflateRaw(data).then(function(ab){ return new TextDecoder().decode(ab); });
  }
  return Promise.reject(new Error(want + ' nggak ketemu di zip'));
}
function inflateRaw(u8){
  if (typeof DecompressionStream === 'undefined')
    return Promise.reject(new Error('browser nggak support DecompressionStream'));
  var stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}
function xmlToText(x){
  return x
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
// .rtf: buang kode formatnya, sisain teks murni
function extractRtf(f){
  $('doc-info').textContent = 'Membaca file RTF\u2026';
  f.text().then(function(raw){
    var t = raw
      .replace(/\\fonttbl[\s\S]*?}/g, '').replace(/\\colortbl[\s\S]*?}/g, '')
      .replace(/\\stylesheet[\s\S]*?}/g, '').replace(/\\info[\s\S]*?}/g, '')
      .replace(/\\u(-?\d+)\s?\??/g, function(m, d){ var c = parseInt(d, 10); if (c < 0) c += 65536; return String.fromCharCode(c); })
      .replace(/\\'([0-9a-f]{2})/gi, function(m, h){ return String.fromCharCode(parseInt(h, 16)); })
      .replace(/\\par[d]?\b/g, '\n').replace(/\\line\b/g, '\n').replace(/\\tab\b/g, '\t')
      .replace(/\\[a-z]+-?\d* ?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!appendMateri(t)){
      $('doc-info').textContent = 'File RTF-nya kosong isinya.';
      return;
    }
    $('doc-info').textContent = f.name + ' dimuat (' + t.length + ' karakter). Digabung ke kolom materi.';
  }).catch(function(){
    $('doc-info').textContent = 'Gagal baca RTF-nya. Tempel teksnya manual aja.';
  });
}
function loadScript(src){
  return new Promise(function(res, rej){
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ res(); };
    s.onerror = function(){ rej(new Error('gagal load ' + src)); };
    document.head.appendChild(s);
  });
}

var sessionTimeLoop = null;

