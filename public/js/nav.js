(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var sections = links
    .map(function (link) {
      return document.querySelector(link.getAttribute('href'));
    })
    .filter(Boolean);
  if (!sections.length) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lastId = '';

  function setCurrent() {
    var marker = window.scrollY + 150;
    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= marker) current = sections[i];
    }
    links.forEach(function (link) {
      if (link.getAttribute('href') === '#' + current.id) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    if (current.id === lastId) return;
    lastId = current.id;
    var active = nav.querySelector('[aria-current="true"]');
    if (!active) return;
    nav.scrollTo({
      left: Math.max(0, active.offsetLeft - 12),
      behavior: reduce ? 'auto' : 'smooth',
    });
  }

  window.addEventListener('scroll', setCurrent, { passive: true });
  window.addEventListener('hashchange', setCurrent);
  setCurrent();
})();
