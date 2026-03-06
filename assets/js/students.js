// Students UI: PitStop selector + search + filtered list (JSONP read, single-checkbox updates)
(function(){
  const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziJBrE4FKoyol7JqF---uEoq7tPzd292BGHVIIFR5DlO20z6UaB9qCVqW62uN8K_8k/exec';
  const PROXY_URL = 'https://mabda-proxy.muafakatmabda2026.workers.dev/';
  const PROXY_TOKEN = 'mynameisvontdeuxthegreat123$';

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }

  // In-memory data structures
  let headers = [];
  let rowsData = []; // { sheetRow: number, row: array, map: {header: value} }
  let pitstopCounts = {};
  let currentPitstop = 'All';
  let searchTerm = '';
  function isAdmin(){ return !!localStorage.getItem('mabda_admin_user'); }

  function buildRows(rows){
    headers = rows[0].map(h => String(h || '').trim());
    rowsData = rows.slice(1).map((r, i) => {
      const map = {};
      headers.forEach((h, idx) => map[h] = r[idx]);
      return { sheetRow: i + 2, row: r, map };
    });
    // build pitstop counts
    pitstopCounts = { 'All': rowsData.length };
    rowsData.forEach(r => {
      const p = String(r.map['PitStop PB'] || r.map['PitStop'] || '').trim();
      if(!p) return;
      pitstopCounts[p] = (pitstopCounts[p] || 0) + 1;
    });
  }

  function renderControls(){
    const container = qs('#students-container');
    if(!container) return;
    // build selector options
    const pitstops = Object.keys(pitstopCounts).sort((a,b) => (a==='All'? -1 : (pitstopCounts[b]-pitstopCounts[a])) );
    let html = '<div class="controls">';
    html += '<select id="pitstop-select">';
    pitstops.forEach(p => html += '<option value="'+escapeHtml(p)+'">'+escapeHtml(p+' ('+pitstopCounts[p]+')')+'</option>');
    html += '</select>';
    html += '<input id="students-search" placeholder="Cari nama, no maktab atau telefon" />';
    html += '</div>';
    html += '<div id="students-list">Loading…</div>';
    container.innerHTML = html;

    // set event handlers
    qs('#pitstop-select').value = currentPitstop;
    qs('#pitstop-select').addEventListener('change', function(){ currentPitstop = this.value; renderList(); });
    let debounceTimer = 0;
    qs('#students-search').addEventListener('input', function(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(()=>{ searchTerm = this.value.trim().toLowerCase(); renderList(); }, 220); });
  }

  function matchesFilter(item){
    if(currentPitstop && currentPitstop !== 'All'){
      const p = String(item.map['PitStop PB'] || item.map['PitStop'] || '').trim();
      if(p !== currentPitstop) return false;
    }
    if(!searchTerm) return true;
    const s = searchTerm;
    return (String(item.map['Nama Student']||'').toLowerCase().includes(s) || String(item.map['No Maktab']||'').toLowerCase().includes(s) || String(item.map['Phone Parent']||'').toLowerCase().includes(s));
  }

  function renderList(){
    const listEl = qs('#students-list');
    if(!listEl) return;
    const filtered = rowsData.filter(matchesFilter);
    if(filtered.length === 0){ listEl.innerHTML = '<p>Tidak ada rekod untuk pilihan ini.</p>'; return; }

    const parts = filtered.map(item => {
      const name = escapeHtml(item.map['Nama Student'] || '');
      const no = escapeHtml(item.map['No Maktab'] || '');
      const ting = escapeHtml(item.map['Tingkatan'] || '');
      const phone = escapeHtml(item.map['Phone Parent'] || '');
      const pit = escapeHtml(item.map['PitStop PB'] || item.map['PitStop'] || '');
      const checkedVal = String(item.map['Checked'] || '').toLowerCase();
      const checked = checkedVal !== '' && checkedVal !== 'false' && checkedVal !== '0';
      const colIdx = headers.indexOf('Checked');
      const colNumber = colIdx >= 0 ? (colIdx + 1) : '';
      // include checkbox only when admin is logged in
      const checkboxHtml = isAdmin() ? ('<div class="student-actions">'
            + '<input type="checkbox" class="finalist-checked" data-row="'+item.sheetRow+'" data-col="'+colNumber+'"'+(checked? ' checked':'')+'> '
            +'</div>') : '';

      return '<div class="student-row">'
        + '<div class="student-main">'
          + '<div class="student-name">'+name+'</div>'
          + '<div class="student-meta">'+no + ' • ' + ting + (phone? ' • ' + phone : '') + (pit? ' • ' + pit : '') +'</div>'
        + '</div>'
        + checkboxHtml
        + '</div>';
    });

    listEl.innerHTML = parts.join('');
  }

  function jsonpFetchFinalist(timeout = 10000){
    return new Promise((resolve, reject) => {
      const cb = '__mabda_students_cb_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const cleanup = () => { try{ delete window[cb]; }catch(e){} const s = document.getElementById(cb+'_script'); if(s && s.parentNode) s.parentNode.removeChild(s); };
      window[cb] = function(data){ cleanup(); resolve(data); };
      const s = document.createElement('script');
      s.id = cb + '_script';
      // request JSONP via proxy (proxy will fetch the target and return the callback-wrapped JS)
      const tgt = APP_SCRIPT_URL + '?action=finalistpb&callback=' + cb;
      s.src = PROXY_URL + '?url=' + encodeURIComponent(tgt) + '&token=' + encodeURIComponent(PROXY_TOKEN);
      s.onerror = function(){ cleanup(); reject(new Error('JSONP load error')); };
      document.head.appendChild(s);
      setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout')); }, timeout);
    });
  }

  function jsonpUpdateCell(row, col, value, timeout = 10000){
    return new Promise((resolve, reject) => {
      const cb = '__mabda_students_up_cb_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const cleanup = () => { try{ delete window[cb]; }catch(e){} const s = document.getElementById(cb+'_script'); if(s && s.parentNode) s.parentNode.removeChild(s); };
      window[cb] = function(data){ cleanup(); resolve(data); };
      const params = '&row=' + encodeURIComponent(row) + '&col=' + encodeURIComponent(col) + '&value=' + encodeURIComponent(value);
      const s = document.createElement('script');
      s.id = cb + '_script';
      const tgt = APP_SCRIPT_URL + '?action=update_finalistpb' + params + '&callback=' + cb;
      s.src = PROXY_URL + '?url=' + encodeURIComponent(tgt) + '&token=' + encodeURIComponent(PROXY_TOKEN);
      s.onerror = function(){ cleanup(); reject(new Error('JSONP load error')); };
      document.head.appendChild(s);
      setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout')); }, timeout);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    const container = document.getElementById('students-container');
    if(container) container.innerHTML = '<p>Memuatkan data…</p>';
    jsonpFetchFinalist().then(result => {
      const rows = Array.isArray(result) ? result : (result && result.rows) || [];
      if(!rows || rows.length === 0) return renderControls();
      buildRows(rows);
      renderControls();
      renderList();

      // Re-render list when login state changes so checkboxes appear only after login
      function refreshIfAuthChanged(){ renderList(); }
      document.addEventListener('click', function(e){
        const t = e.target;
        if(t && (t.id === 'admin-login' || (t.closest && t.closest('#admin-login')))){
          // allow login handler to complete then re-render
          setTimeout(refreshIfAuthChanged, 600);
        }
      });
      window.addEventListener('storage', function(e){ if(e.key === 'mabda_admin_user') refreshIfAuthChanged(); });
      // listen for explicit auth-change event dispatched by adminAuth
      document.addEventListener('mabda_auth_changed', refreshIfAuthChanged);

      // checkbox handler (delegated)
      container.addEventListener('change', function(e){
        const t = e.target;
        if(t && t.classList && t.classList.contains('finalist-checked')){
          const row = t.getAttribute('data-row');
          const col = t.getAttribute('data-col');
          const checked = t.checked ? 'TRUE' : '';
          t.disabled = true;
          jsonpUpdateCell(row, col, checked).then(res => { t.disabled = false; }).catch(err => { t.disabled = false; console.error('Update failed', err); alert('Gagal mengemas kini. Sila semak konsol.'); });
        }
      });

    }).catch(err => {
      console.error('students load error', err);
      if(container) container.innerHTML = '<p>Gagal memuat data. Lihat konsol.</p>';
    });
  });

})();
