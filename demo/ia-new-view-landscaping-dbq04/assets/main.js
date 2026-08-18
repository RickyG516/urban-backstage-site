document.addEventListener('DOMContentLoaded', function(){
  var toggle = document.querySelector('.navtoggle');
  var links = document.querySelector('nav.links');
  if(toggle && links){
    toggle.addEventListener('click', function(){
      links.classList.toggle('open');
    });
  }
  // mobile: tap the Services/Service Areas label to expand its submenu instead of navigating
  var isTouch = window.matchMedia('(hover: none)').matches;
  document.querySelectorAll('nav.links .has-sub > a').forEach(function(a){
    a.addEventListener('click', function(e){
      if (window.innerWidth <= 860) {
        e.preventDefault();
        a.parentElement.classList.toggle('open');
      }
    });
  });
});
