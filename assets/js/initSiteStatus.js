// Shared status steps and global current step
const statusSteps = [
  { name: 'Survey Belum Bermula', color: '#cbd5e1' },
  { name: 'Survey Tamat', color: '#93c5fd' },
  { name: 'Penentuan Jumlah Bas', color: '#60a5fa' },
  { name: 'Tempahan Tiket Bermula', color: '#2dd4bf' },
  { name: 'Tempahan Tiket Tamat', color: '#4ade80' },
  { name: 'Senarai Nama Pelajar Dikeluarkan', color: '#16a34a' }
];

// GLOBAL: Change this value on any page to update the status across the site
let currentStep = 3; // Default: Penentuan Jumlah Bas

// Global function to update status panel based on currentStep
function updateStatusPanel(container) {
  try {
    const statusItems = container.querySelectorAll('.status-item');
    const statusPill = container.querySelector('.status-pill');
    const statusDesc = container.querySelector('.status-desc');
    
    if (!statusItems.length || !statusPill) return;
    
    const currentStatus = statusSteps[currentStep - 1];
    
    // Update pill text to current step
    statusPill.textContent = currentStatus.name;
    
    // Reset and update status items
    statusItems.forEach((item, idx) => {
      item.classList.remove('active');
      // Mark current step as active
      if (idx === currentStep - 1) {
        item.classList.add('active');
        // Update description
        if (statusDesc) {
          statusDesc.textContent = item.getAttribute('data-desc') || '';
          statusDesc.style.display = statusDesc.textContent ? 'block' : 'none';
        }
      }
    });
  } catch (err) {
    console.warn('updateStatusPanel error', err);
  }
}

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
    
    // Apply global currentStep (if defined)
    updateStatusPanel(container);
  } catch (err) {
    console.warn('initSiteStatus error', err);
  }
}
