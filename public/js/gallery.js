(function () {
  var root = document.getElementById('lightbox');
  if (!root) return;

  var dialog = root.querySelector('.lightbox-dialog');
  var stage = document.getElementById('lightbox-stage');
  var img = document.getElementById('lightbox-img');
  var caption = document.getElementById('lightbox-caption');
  var count = document.getElementById('lightbox-count');
  var closeBtn = document.getElementById('lightbox-close');
  var prevBtn = document.getElementById('lightbox-prev');
  var nextBtn = document.getElementById('lightbox-next');
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-item]'));
  if (!dialog || !stage || !img || !caption || !count || !closeBtn || !prevBtn || !nextBtn || !items.length) return;

  var index = 0;
  var lastFocus = null;
  var scrollY = 0;
  var touchX = 0;
  var touchY = 0;
  var touchOn = false;
  var ignoreClick = false;
  var pushed = false;
  var ignorePop = false;

  function read(el) {
    return {
      full: el.getAttribute('data-full'),
      alt: el.getAttribute('data-alt') || '',
      caption: el.getAttribute('data-caption') || '',
    };
  }

  function preload(src) {
    if (!src) return;
    var probe = new Image();
    probe.src = src;
  }

  function show(nextIndex) {
    var total = items.length;
    index = (nextIndex + total) % total;
    var data = read(items[index]);
    var label = 'Photo ' + (index + 1) + ' of ' + total + '. ' + data.alt;
    img.src = data.full;
    img.alt = label;
    caption.textContent = data.caption;
    count.textContent = (index + 1) + ' / ' + total;
    dialog.setAttribute('aria-label', label);
    preload(read(items[(index + 1) % total]).full);
    preload(read(items[(index + total - 1) % total]).full);
  }

  function lockScroll() {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = '-' + scrollY + 'px';
    document.body.classList.add('lightbox-open');
  }

  function unlockScroll() {
    document.body.classList.remove('lightbox-open');
    document.body.style.top = '';
    var doc = document.documentElement;
    var previous = doc.style.scrollBehavior;
    doc.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollY);
    doc.style.scrollBehavior = previous;
  }

  function openAt(nextIndex) {
    show(nextIndex);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (root.hidden) lockScroll();
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    lastFocus = document.activeElement;
    if (!pushed) {
      try {
        history.pushState({ thfLightbox: 1 }, '');
        pushed = true;
      } catch (err) {
        pushed = false;
      }
    }
    closeBtn.focus();
  }

  function close(fromPop) {
    if (root.hidden) return;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    unlockScroll();
    img.removeAttribute('src');
    img.alt = '';
    if (pushed && !fromPop) {
      pushed = false;
      ignorePop = true;
      history.back();
    } else {
      pushed = false;
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    }
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (err) {
        lastFocus.focus();
      }
    }
  }

  function step(delta) {
    show(index + delta);
  }

  function findIndex(id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].getAttribute('data-photo') === id) return i;
    }
    return -1;
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest ? event.target.closest('[data-photo]') : null;
    if (!opener) return;
    var at = findIndex(opener.getAttribute('data-photo'));
    if (at === -1) return;
    event.preventDefault();
    openAt(at);
  });

  closeBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    close();
  });
  prevBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    step(-1);
  });
  nextBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    step(1);
  });
  dialog.addEventListener('click', function (event) {
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    if (event.target === dialog || event.target === stage) close();
  });

  document.addEventListener('keydown', function (event) {
    if (root.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      show(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      show(items.length - 1);
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = [closeBtn, prevBtn, nextBtn];
    var at = focusable.indexOf(document.activeElement);
    if (at === -1) {
      event.preventDefault();
      closeBtn.focus();
      return;
    }
    event.preventDefault();
    var next = event.shiftKey ? (at + focusable.length - 1) % focusable.length : (at + 1) % focusable.length;
    focusable[next].focus();
  });

  window.addEventListener('popstate', function () {
    if (ignorePop) {
      ignorePop = false;
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
      return;
    }
    if (!root.hidden) close(true);
  });

  stage.addEventListener('touchmove', function (event) {
    if (!touchOn) return;
    event.preventDefault();
  }, { passive: false });

  stage.addEventListener('touchstart', function (event) {
    if (!event.changedTouches || !event.changedTouches.length) return;
    touchOn = true;
    touchX = event.changedTouches[0].clientX;
    touchY = event.changedTouches[0].clientY;
  }, { passive: true });

  stage.addEventListener('touchend', function (event) {
    if (!touchOn || !event.changedTouches || !event.changedTouches.length) return;
    touchOn = false;
    var dx = event.changedTouches[0].clientX - touchX;
    var dy = event.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    ignoreClick = true;
    step(dx < 0 ? 1 : -1);
  }, { passive: true });

  stage.addEventListener('touchcancel', function () {
    touchOn = false;
  }, { passive: true });
})();
