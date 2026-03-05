// Shared initialization for the status partial.
// Call: initSiteStatus(containerElement)
function initSiteStatus(container) {
  try {
    const panel = container.querySelector('.status-panel');
    const toggle = container.querySelector('.status-toggle');
    const pill = container.querySelector('.status-pill');
    if (pill) pill.title = pill.textContent.trim();
    const items = Array.from(container.querySelectorAll('.status-item'));
    const desc = container.querySelector('.status-desc');

    if (!panel) return;

    function setOpen(open) {
      panel.classList.toggle('open', open);
      panel.setAttribute('aria-hidden', String(!open));
    }

    toggle && toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'i' || e.key === 'I') {
        setOpen(!panel.classList.contains('open'));
      }
    });

    function selectItem(item) {
      items.forEach(i => i.classList.remove('active'));
      if (!item) return;
      item.classList.add('active');
      // Do NOT modify the status pill here — pill is admin-controlled and static.
      if (desc) {
        desc.textContent = item.dataset.desc || '';
        desc.style.display = desc.textContent ? 'block' : 'none';
      }
    }

    items.forEach(it => {
      it.addEventListener('click', () => selectItem(it));
    });

    // initialize: prefer item matching the pill's status class, then any pre-marked active, then first item
    let initial = items[0];
    try {
      const pillCls = pill ? Array.from(pill.classList).find(c => c.startsWith('status--')) : null;
      if (pillCls) {
        const match = items.find(i => i.classList.contains(pillCls));
        if (match) initial = match;
      }
    } catch (e) { /* ignore */ }
    // if none matched by pill class, prefer an item already marked active
    const preActive = items.find(i => i.classList.contains('active'));
    if (preActive) initial = preActive;
    selectItem(initial);
  } catch (err) {
    console.warn('initSiteStatus error', err);
  }
}
