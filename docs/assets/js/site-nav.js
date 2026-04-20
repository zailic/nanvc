(function () {
  const nav = document.querySelector('.site-nav');

  if (!nav) {
    return;
  }

  const list = nav.querySelector('.site-nav__list');
  const more = nav.querySelector('.site-nav__more');
  const button = nav.querySelector('.site-nav__more-button');
  const menu = nav.querySelector('.site-nav__more-menu');

  if (!list || !more || !button || !menu) {
    return;
  }

  const closeMenu = () => {
    button.setAttribute('aria-expanded', 'false');
  };

  const setCurrentState = () => {
    more.classList.toggle('site-nav__more--current', Boolean(menu.querySelector('[aria-current="page"]')));
  };

  const restoreItems = () => {
    Array.from(menu.querySelectorAll('.site-nav__item')).forEach((item) => {
      list.insertBefore(item, more);
    });
  };

  const isOverflowing = () => list.scrollWidth > list.clientWidth + 1;

  const rebalance = () => {
    closeMenu();
    restoreItems();
    more.hidden = true;
    more.classList.remove('site-nav__more--current');

    if (!isOverflowing()) {
      return;
    }

    more.hidden = false;

    while (isOverflowing()) {
      const items = Array.from(list.querySelectorAll(':scope > .site-nav__item'));
      const item = items[items.length - 1];

      if (!item) {
        break;
      }

      menu.insertBefore(item, menu.firstElementChild);
    }

    setCurrentState();
  };

  button.addEventListener('click', () => {
    button.setAttribute('aria-expanded', button.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      button.focus();
    }
  });

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(rebalance);
  });

  window.requestAnimationFrame(rebalance);
})();
