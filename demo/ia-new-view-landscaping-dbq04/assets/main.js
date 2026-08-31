document.addEventListener('DOMContentLoaded', function(){
  var toggle = document.querySelector('.navtoggle');
  var links = document.querySelector('nav.links');
  if(toggle && links){
    toggle.addEventListener('click', function(){
      links.classList.toggle('open');
    });
  }
  var isTouch = window.matchMedia('(hover: none)').matches;

  // mobile: tap the Services/Service Areas label to expand its submenu instead of navigating
  document.querySelectorAll('nav.links .has-sub > a').forEach(function(a){
    a.addEventListener('click', function(e){
      if (window.innerWidth <= 860) {
        e.preventDefault();
        a.parentElement.classList.toggle('open');
      }
    });
  });

  // desktop: open dropdown on hover, but wait a beat before closing so crossing
  // the gap between the nav link and the menu (or reaching a lower item) doesn't
  // slam it shut mid-move
  if (!isTouch) {
    var CLOSE_DELAY = 400;
    document.querySelectorAll('nav.links .has-sub').forEach(function(container){
      var closeTimer = null;
      function open(){
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        container.classList.add('subnav-open');
      }
      function scheduleClose(){
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(function(){
          container.classList.remove('subnav-open');
          closeTimer = null;
        }, CLOSE_DELAY);
      }
      container.addEventListener('mouseenter', open);
      container.addEventListener('mouseleave', scheduleClose);
      container.addEventListener('focusin', open);
      container.addEventListener('focusout', function(e){
        if (!container.contains(e.relatedTarget)) scheduleClose();
      });
    });
  }

  /* ---------- portfolio category filter ---------- */
  var filterBtns = document.querySelectorAll('.filter-btn');
  if (filterBtns.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var cat = btn.getAttribute('data-filter');
        document.querySelectorAll('.shot').forEach(function (shot) {
          var matches = cat === 'all' || shot.getAttribute('data-cat') === cat;
          if (matches) {
            shot.classList.remove('filter-hidden');
            shot.classList.remove('filter-enter');
            void shot.offsetWidth;
            shot.classList.add('filter-enter');
          } else {
            shot.classList.add('filter-hidden');
          }
        });
      });
    });
  }

  /* ---------- before/after slider ---------- */
  document.querySelectorAll('.ba-slider').forEach(function (slider) {
    var afterImg = slider.querySelector('.ba-after');
    var handle = slider.querySelector('.ba-handle');
    var dragging = false;

    function setPosition(clientX) {
      var rect = slider.getBoundingClientRect();
      var pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      afterImg.style.clipPath = 'inset(0 0 0 ' + (pct * 100) + '%)';
      handle.style.left = (pct * 100) + '%';
    }
    slider.addEventListener('mousedown', function (e) { dragging = true; setPosition(e.clientX); });
    window.addEventListener('mousemove', function (e) { if (dragging) setPosition(e.clientX); });
    window.addEventListener('mouseup', function () { dragging = false; });
    slider.addEventListener('touchstart', function (e) { dragging = true; setPosition(e.touches[0].clientX); }, {passive: true});
    slider.addEventListener('touchmove', function (e) { if (dragging) setPosition(e.touches[0].clientX); }, {passive: true});
    slider.addEventListener('touchend', function () { dragging = false; });
  });
});
