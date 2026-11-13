// js/landing.js — halaman guest: landing tamu (dashboard/about/get started), slideshow 3D, navbar.
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
// ===== Landing tamu: Dashboard / About / Get Started =====
$('gnav-dash').addEventListener('click', function(e){
  e.preventDefault();
  show('screen-landing');
});
$('gnav-about').addEventListener('click', function(e){
  e.preventDefault();
  show('screen-about'); // halaman about sendiri, bukan cuma scroll
});
$('gnav-getstarted').addEventListener('click', function(){
  show('screen-login');
});
$('land-cta').addEventListener('click', function(){
  show('screen-login');
});
$('land-cta-2').addEventListener('click', function(){
  show('screen-login');
});
$('land-cta-3').addEventListener('click', function(){
  show('screen-login');
});
$('lnk-back-landing').addEventListener('click', function(e){
  e.preventDefault();
  show('screen-landing');
});

// Slideshow 3D (korsel) buat screenshot landing: ring di-sumbu Y, kartu depan
// tegak lurus, kartu samping miring, yang di belakang tersembunyi (backface).
// Auto muter, berhenti pas kursor di atasnya, panah + titik buat pindah manual.
var s3dCards = document.querySelectorAll('.slide3d');
var s3dN = s3dCards.length;
if (s3dN){
  var s3dIdx = 0, s3dTimer = null, s3dDots = $('dots3d');
  for (var i = 0; i < s3dN; i++){
    var s3dD = document.createElement('button');
    s3dD.className = 'dot3d'; s3dD.type = 'button';
    s3dD.setAttribute('aria-label', 'Tampilan ke-' + (i + 1));
    (function(n){ s3dD.addEventListener('click', function(){ s3dSet(n); s3dAuto(); }); })(i);
    s3dDots.appendChild(s3dD);
  }
  function s3dSet(i){
    s3dIdx = ((i % s3dN) + s3dN) % s3dN;
    // Radius dihitung dari lebar kartu asli → tetap benar pas layout mengecil.
    var s3dR = Math.round((s3dCards[0].offsetWidth || 520) / 2 / Math.tan(Math.PI / s3dN));
    $('ring3d').style.transform = 'translateZ(' + (-s3dR) + 'px) rotateY(' + (-s3dIdx * 360 / s3dN) + 'deg)';
    for (var k = 0; k < s3dN; k++){
      s3dCards[k].style.transform = 'rotateY(' + (k * 360 / s3dN) + 'deg) translateZ(' + s3dR + 'px)';
      s3dDots.children[k].classList.toggle('on', k === s3dIdx);
    }
  }
  function s3dAuto(){
    if (s3dTimer) clearInterval(s3dTimer);
    s3dTimer = setInterval(function(){ s3dSet(s3dIdx + 1); }, 3400);
  }
  $('s3d-prev').addEventListener('click', function(){ s3dSet(s3dIdx - 1); s3dAuto(); });
  $('s3d-next').addEventListener('click', function(){ s3dSet(s3dIdx + 1); s3dAuto(); });
  $('stage3d').addEventListener('mouseenter', function(){ if (s3dTimer) clearInterval(s3dTimer); s3dTimer = null; });
  $('stage3d').addEventListener('mouseleave', s3dAuto);
  window.addEventListener('resize', function(){ s3dSet(s3dIdx); });
  s3dSet(0);
  s3dAuto();
}

// ===== Navbar: Beranda / Mode belajar =====
$('nav-beranda').addEventListener('click', function(e){
  e.preventDefault();
  if (!profile){ show('screen-landing'); return; }
  show('screen-home'); // sesi yang lagi jalan tetap lanjut, nggak di-stop
});
$('nav-study').addEventListener('click', function(e){
  e.preventDefault();
  gotoStudy();
});
function gotoStudy(){
  if (!profile){ show('screen-landing'); return; }
  if (session){ show('screen-study'); return; } // lanjutin sesi yang udah ada
  var trans = $('in-trans').value.trim(), materi = $('in-materi').value.trim();
  if (!trans && !materi){
    show('screen-home');
    setStatus($('gen-status'), 'Belum ada sumbernya. Isi materi (langkah 2) atau transkrip '
      + '(langkah 3) dulu di beranda, terus klik \u201cMulai belajar\u201d.', '');
    return;
  }
  autoGen(); // lompat ke mode belajar + auto-generate semua bahan yang dipilih
}

