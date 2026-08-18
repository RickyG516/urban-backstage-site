document.addEventListener('DOMContentLoaded', function(){
  var toggle = document.querySelector('.navtoggle');
  var links = document.querySelector('nav.links');
  if(toggle && links){
    toggle.addEventListener('click', function(){
      links.classList.toggle('open');
    });
  }
});
