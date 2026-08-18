document.addEventListener('DOMContentLoaded', function(){
  var fab = document.querySelector('.chat-fab');
  var panel = document.querySelector('.chat-panel');
  if(!fab || !panel) return;
  fab.addEventListener('click', function(){
    panel.classList.toggle('open');
  });
});
