// Initialize header partial after it's injected
function initSiteHeader(container) {
  try {
    const back = container.querySelector('.header-back');
    const toggle = container.querySelector('.header-toggle');
    const nav = container.querySelector('.header-nav');

    // show back button only if there is history
    if (back) {
      try { back.style.display = (history.length > 1) ? 'inline-block' : 'none'; } catch (e) { back.style.display = 'none'; }
      back.addEventListener('click', () => { history.back(); });
    }

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        nav.setAttribute('aria-hidden', String(!open));
      });

      // close nav when a link is clicked
      nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); nav.setAttribute('aria-hidden','true'); }));

      // close on Escape
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { nav.classList.remove('open'); nav.setAttribute('aria-hidden','true'); } });
    }

    // set dynamic title: prefer <body data-title="...">, fallback to filename-based labels
    try {
      const titleEl = container.querySelector('.site-title');
      if (titleEl) {
        const bodyTitle = document.body && document.body.dataset && document.body.dataset.title;
        if (bodyTitle) {
          titleEl.textContent = bodyTitle;
        } else {
          const p = (window.location.pathname || '').split('/').pop() || 'index.html';
          let label = 'MABDA';
          if (p === '' || p === 'index.html') label = 'Home';
          else if (p.toLowerCase().includes('tiket-bas') || p.toLowerCase().includes('tiket-mabda')) label = 'Mabda Liner';
          else if (p.toLowerCase().includes('tiket')) label = 'Tiket';
          titleEl.textContent = label;
        }
      }
    } catch (e) { /* ignore */ }
    // notify other scripts that header has been initialized and injected
    try { document.dispatchEvent(new Event('mabda_header_injected')); } catch (e) {}
  } catch (err) {
    console.warn('initSiteHeader error', err);
  }
}
