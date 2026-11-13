// js/ui.js — polesan interaksi antar fitur (dropzone, popover, stepper, dialog).
// Dipecah dari index.html (modularisasi per fitur).
'use strict';
// ===== redesign additive interactions (item 13,15,22,26,28,33) =====
// dipasang setelah JS owner; wrap show() & pipeSet() untuk sinkronisasi visual.
(function(){
  function $i(id){ return document.getElementById(id); }
  // profile popover (item 33)
  var bp = $i('btn-profile');
  if (bp){
    bp.addEventListener('click', function(e){
      e.stopPropagation();
      var pop = $i('profile-pop');
      var open = pop.classList.toggle('open');
      bp.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function(e){
      if (!e.target.closest || !e.target.closest('.profile-wrap')){
        var pop = $i('profile-pop'); if (pop) pop.classList.remove('open');
      }
    });
  }
  // focus body collapsible (item 22)
  var fsum = $i('focus-summary');
  if (fsum){
    fsum.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('#btn-cam')) return;
      var fb = $i('focus-body'); if (fb) fb.classList.toggle('open');
    });
  }
  // dropzone drag-drop (item 13)
  var dz = $i('dropzone');
  if (dz){
    ['dragenter','dragover'].forEach(function(ev){
      dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave','drop'].forEach(function(ev){
      dz.addEventListener(ev, function(e){ e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function(e){
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (!/^audio\//.test(f.type) && !/\.(mp3|wav|m4a|webm|ogg)$/i.test(f.name)){
        setStatus($('asr-status'), 'File itu bukan audio. Tarik wav/mp3/m4a/webm/ogg.', 'err');
        return;
      }
      try {
        var dt = new DataTransfer(); dt.items.add(f);
        $('in-audio').files = dt.files;
        $('in-audio').dispatchEvent(new Event('change'));
      } catch(err){
        setStatus($('asr-status'), 'Gagal nangkap file drop. Coba klik Upload aja.', 'err');
      }
    });
  }
  // confirm dialog wiring (item 28)
  var cy = $i('confirm-yes'), cn = $i('confirm-no');
  if (cy) cy.addEventListener('click', function(){
    $i('confirm-overlay').classList.add('hide');
    if (typeof finishSession === 'function') finishSession();
  });
  if (cn) cn.addEventListener('click', function(){
    $i('confirm-overlay').classList.add('hide');
  });
  // stepper sync via wrapping show() (item 15)
  if (typeof show === 'function'){
    var _show = show;
    show = function(id){
      _show(id);
      var st = document.querySelector('#stepper');
      if (!st) return;
      var stage = id === 'screen-home' ? 'sumber'
                : id === 'screen-study' ? 'belajar' : null;
      if (!stage) return;
      var order = ['sumber','proses','belajar'];
      var idx = order.indexOf(stage);
      Array.prototype.forEach.call(st.querySelectorAll('.step'), function(s){
        var i = order.indexOf(s.getAttribute('data-s'));
        s.classList.toggle('on', i === idx);
        s.classList.toggle('done', i < idx);
      });
      if (id === 'screen-study'){ var _fb = document.getElementById('focus-body'); if (_fb) _fb.classList.add('open'); }
    };
  }
  // tab-status mirror via wrapping pipeSet() (item 26)
  if (typeof pipeSet === 'function'){
    var _pipeSet = pipeSet;
    pipeSet = function(k, state){
      _pipeSet(k, state);
      var el = document.querySelector('.tab-status[data-k="' + k + '"]');
      if (el){
        el.classList.remove('run','done');
        if (state === 'run' || state === 'done') el.classList.add(state);
      }
    };
  }
})();

