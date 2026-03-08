// Students UI: PitStop selector + search + filtered list (direct fetch, single-checkbox updates)
(function(){
  const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziJBrE4FKoyol7JqF---uEoq7tPzd292BGHVIIFR5DlO20z6UaB9qCVqW62uN8K_8k/exec';
  const CACHE_TTL = 3600000; // 1 hour
  const PITSTOPS_CACHE_KEY = 'mabda_pitstops_cache';
  const FINALISTS_CACHE_KEY = 'mabda_finalists_cache';

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }

  // Cache utility functions
  function setCacheItem(key, data){
    try{
      const item = { data, expiry: Date.now() + CACHE_TTL };
      localStorage.setItem(key, JSON.stringify(item));
    } catch(e){}
  }

  function getCacheItem(key){
    try{
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      if(item.expiry && item.expiry > Date.now()) return item.data;
      localStorage.removeItem(key);
    } catch(e){}
    return null;
  }

  // Public cache clear function for admin
  window.clearMabdaStudentsCache = function(){
    try{
      localStorage.removeItem(PITSTOPS_CACHE_KEY);
      localStorage.removeItem(FINALISTS_CACHE_KEY);
      alert('Cache cleared. Refresh the page to load fresh data.');
    } catch(e){
      alert('Error clearing cache');
    }
  };

  // Cache version checking for global invalidation
  const CACHE_VERSION_KEY = 'mabda_cache_version';
  const CACHE_VERSION_URL = '/cache-version.txt';
  
  function checkAndValidateCache(){
    return fetch(CACHE_VERSION_URL)
      .then(r => r.text())
      .then(version => {
        const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
        const currentVersion = version.trim();
        if(storedVersion !== currentVersion){
          // Version changed - clear old cache
          try{
            localStorage.removeItem(PITSTOPS_CACHE_KEY);
            localStorage.removeItem(FINALISTS_CACHE_KEY);
            localStorage.setItem(CACHE_VERSION_KEY, currentVersion);
            console.log('Cache invalidated: version changed from ' + storedVersion + ' to ' + currentVersion);
          } catch(e){}
        } else {
          // Version matches - cache is valid
          localStorage.setItem(CACHE_VERSION_KEY, currentVersion);
        }
      })
      .catch(err => {
        // If fetch fails, just continue with existing cache
        console.warn('Could not check cache version', err);
      });
  }

  function formatPhoneHtml(phone){
    if(!phone) return '';
    const raw = String(phone || '').trim();
    // sanitize digits for wa.me (international number without +)
    const digits = raw.replace(/\D/g,'');
    if(!digits) return escapeHtml(raw);
    const href = 'https://wa.me/' + encodeURIComponent(digits);
    const icon = '/assets/images/whatsapp-icon.png';
    return '<a class="wa-link" href="'+href+'" target="_blank" rel="noopener">'
      + escapeHtml(raw)
      + ' <img src="'+icon+'" alt="WA" style="height:16px;vertical-align:middle;margin-left:6px">'
      + '</a>';
  }

  // In-memory data structures
  let headers = [];
  let rowsData = []; // { sheetRow: number, row: array, map: {header: value} }
  let pitstopCounts = {};
  let busCounts = {};
  let currentFilter = 'All'; // can be 'All', pitstop name, or "bus|busKey"
  let searchTerm = '';
  let pitstopMap = {}; // map pitstop name -> { VolunteerName, VolunteerPhone }
  let busMap = {}; // map "busNumber|plateNumber" -> { busNumber, plateNumber, displayName, pitstops: [] }
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
    
    // build bus counts and busMap
    busCounts = {};
    busMap = {};
    rowsData.forEach(r => {
      const busNum = String(r.map['Bus Number'] || '').trim();
      const platNum = String(r.map['Plate Number'] || '').trim();
      const pitstop = String(r.map['PitStop PB'] || r.map['PitStop'] || '').trim();
      
      if(!busNum || !platNum) return;
      
      const busKey = busNum + '|' + platNum;
      const busDisplay = 'Bus ' + busNum + ' - ' + platNum.toUpperCase();
      
      if(!busMap[busKey]){
        busMap[busKey] = {
          busNumber: busNum,
          plateNumber: platNum,
          displayName: busDisplay,
          pitstops: new Set()
        };
      }
      
      busCounts[busKey] = (busCounts[busKey] || 0) + 1;
      if(pitstop) busMap[busKey].pitstops.add(pitstop);
    });
    
    // convert pitstops Set to Array for display
    Object.keys(busMap).forEach(key => {
      busMap[key].pitstops = Array.from(busMap[key].pitstops);
    });
  }

  function renderControls(){
    const container = qs('#students-container');
    if(!container) return;
    
    // build single selector with both pitstops and buses
    const pitstops = Object.keys(pitstopCounts).sort((a,b) => (a==='All'? -1 : (pitstopCounts[b]-pitstopCounts[a])) );
    const buses = Object.keys(busMap).sort((a, b) => busCounts[b] - busCounts[a]);
    
    let html = '<div class="controls">';
    html += '<select id="pitstop-select">';
    
    // Add pitstops
    pitstops.forEach(p => html += '<option value="'+escapeHtml(p)+'">'+escapeHtml(p+' ('+pitstopCounts[p]+')')+'</option>');
    
    // Add buses
    if(buses.length > 0){
      html += '<optgroup label="Buses">';
      buses.forEach(busKey => {
        const bus = busMap[busKey];
        html += '<option value="bus|'+escapeHtml(busKey)+'">'+escapeHtml(bus.displayName+' ('+busCounts[busKey]+')')+'</option>';
      });
      html += '</optgroup>';
    }
    
    html += '</select>';
    html += '<input id="students-search" placeholder="Cari nama, no maktab atau telefon" />';
    html += '</div>';
    html += '<div id="volunteer-info" style="margin:8px 0;color:#154360;font-weight:600"></div>';
    html += '<div id="students-list">Loading…</div>';
    container.innerHTML = html;

    // set event handlers
    qs('#pitstop-select').value = currentFilter;
    qs('#pitstop-select').addEventListener('change', function(){ 
      currentFilter = this.value;
      renderList(); 
    });
    
    let debounceTimer = 0;
    qs('#students-search').addEventListener('input', function(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(()=>{ searchTerm = this.value.trim().toLowerCase(); renderList(); }, 220); });
  }

  function matchesFilter(item){
    // Parse current filter
    if(currentFilter && currentFilter.startsWith('bus|')){
      // Filter by bus
      const selectedBusKey = currentFilter.substring(4);
      const busNum = String(item.map['Bus Number'] || '').trim();
      const platNum = String(item.map['Plate Number'] || '').trim();
      const itemBusKey = busNum + '|' + platNum;
      if(itemBusKey !== selectedBusKey) return false;
    } else if(currentFilter && currentFilter !== 'All'){
      // Filter by pitstop
      const p = String(item.map['PitStop PB'] || item.map['PitStop'] || '').trim();
      if(p !== currentFilter) return false;
    }
    
    // Filter by search term
    if(!searchTerm) return true;
    const s = searchTerm;
    return (String(item.map['Nama Student']||'').toLowerCase().includes(s) || String(item.map['No Maktab']||'').toLowerCase().includes(s) || String(item.map['Phone Parent']||'').toLowerCase().includes(s));
  }

  function renderList(){
    const listEl = qs('#students-list');
    if(!listEl) return;
    
    // show volunteer info when a pitstop is selected, or bus info when a bus is selected
    const volEl = qs('#volunteer-info');
    if(volEl){
      if(currentFilter && currentFilter.startsWith('bus|')){
        // Show bus details
        const selectedBusKey = currentFilter.substring(4);
        if(busMap[selectedBusKey]){
          const bus = busMap[selectedBusKey];
          const pitstopList = bus.pitstops.length > 0 ? bus.pitstops.join('\n') : 'No pitstop info';
          volEl.innerHTML = escapeHtml(bus.displayName) + '\n' + escapeHtml(pitstopList);
        }
      } else if(currentFilter && currentFilter !== 'All' && pitstopMap[currentFilter]){
        // Show volunteer details
        const v = pitstopMap[currentFilter];
        const name = v.VolunteerName || v.Name || '';
        const phone = v.VolunteerPhone || v.Phone || '';
        if(name || phone){
          volEl.innerHTML = 'Volunteer: ' + escapeHtml(name) + (phone ? ' — ' + formatPhoneHtml(phone) : '');
        } else {
          volEl.innerHTML = '';
        }
      } else {
        volEl.innerHTML = '';
      }
    }
    
    const filtered = rowsData.filter(matchesFilter);
    if(filtered.length === 0){ listEl.innerHTML = '<p>Tidak ada rekod untuk pilihan ini.</p>'; return; }

    const parts = filtered.map(item => {
      const name = escapeHtml(item.map['Nama Student'] || '');
      const no = escapeHtml(item.map['No Maktab'] || '');
      const ting = escapeHtml(item.map['Tingkatan'] || '');
      const phone = item.map['Phone Parent'] || '';
      const pit = escapeHtml(item.map['PitStop PB'] || item.map['PitStop'] || '');
      const busNum = String(item.map['Bus Number'] || '').trim();
      const platNum = String(item.map['Plate Number'] || '').trim();
      const busDisplay = busNum && platNum ? escapeHtml('Bus ' + busNum + ' - ' + platNum.toUpperCase()) : '';
      
      const checkedVal = String(item.map['Checked'] || '').toLowerCase();
      const checked = checkedVal !== '' && checkedVal !== 'false' && checkedVal !== '0';
      const colIdx = headers.indexOf('Checked');
      const colNumber = colIdx >= 0 ? (colIdx + 1) : '';
      // include checkbox only when admin is logged in
      const phoneHtml = phone ? formatPhoneHtml(phone) : '';
      
      // Build meta line: no • ting • phone • pit
      const metaParts = [no, ting];
      if(phoneHtml) metaParts.push(phoneHtml);
      if(pit){
        metaParts.push(pit);
      }
      const metaHtml = metaParts.join(' • ');
      
      const checkboxHtml = isAdmin() ? ('<div class="student-actions">'
        + '<input type="checkbox" class="finalist-checked" data-row="'+item.sheetRow+'" data-col="'+colNumber+'"'+(checked? ' checked':'')+'> '
        +'</div>') : '';

      return '<div class="student-row">'
        + '<div class="student-main">'
          + '<div class="student-name">'+name+'</div>'
          + '<div class="student-meta">'+metaHtml+'</div>'
        + '</div>'
        + checkboxHtml
        + '</div>';
    });

    listEl.innerHTML = parts.join('');
  }

  function fetchFinalist(timeout = 10000){
    return fetch(APP_SCRIPT_URL + '?action=finalistpb', {
      method: 'GET',
      timeout: timeout
    })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function fetchPitstops(timeout = 10000){
    return fetch(APP_SCRIPT_URL + '?action=pitstops', {
      method: 'GET',
      timeout: timeout
    })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function updateCell(row, col, value, timeout = 10000){
    const params = new URLSearchParams();
    params.append('action', 'update_finalistpb');
    params.append('row', row);
    params.append('col', col);
    params.append('value', value);
    
    return fetch(APP_SCRIPT_URL + '?' + params.toString(), {
      method: 'GET',
      timeout: timeout
    })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    const container = document.getElementById('students-container');
    if(container) container.innerHTML = '<div class="loading-spinner"></div><p>Memuatkan data…</p>';
    
    // Check cache version first, then load data
    checkAndValidateCache().then(() => {
      // Try to load from cache first
      let pitstopsPromise = Promise.resolve(getCacheItem(PITSTOPS_CACHE_KEY)).then(cached => {
        if(cached) return cached;
        return fetchPitstops().then(data => { setCacheItem(PITSTOPS_CACHE_KEY, data); return data; });
      });
      
      let finalistsPromise = Promise.resolve(getCacheItem(FINALISTS_CACHE_KEY)).then(cached => {
        if(cached) return cached;
        return fetchFinalist().then(data => { setCacheItem(FINALISTS_CACHE_KEY, data); return data; });
      });
    
    // fetch pitstops first, then the finalists
    pitstopsPromise.then(pres => {
      const prot = Array.isArray(pres) ? pres : (pres && pres.rows) || [];
      if(prot && prot.length > 1){
        // build pitstopMap from rows: assume first column is PitStop, second VolunteerName, third VolunteerPhone
        const nameIdx = 0;
        const volNameIdx = 1;
        const volPhoneIdx = 2;
        prot.slice(1).forEach(r => {
          const key = String(r[nameIdx]||'').trim();
          if(!key) return;
          pitstopMap[key] = { VolunteerName: r[volNameIdx]||'', VolunteerPhone: r[volPhoneIdx]||'' };
        });
      }
      return finalistsPromise;
    }).then(result => {
      const rows = Array.isArray(result) ? result : (result && result.rows) || [];
      if(!rows || rows.length === 0) return renderControls();
      buildRows(rows);
      renderControls();
      
      // Force select first pitstop (not "All")
      const allPitstops = Object.keys(pitstopCounts).filter(p => p !== 'All').sort((a,b) => (pitstopCounts[b]-pitstopCounts[a]));
      if(allPitstops.length > 0){
        currentFilter = allPitstops[0];
        qs('#pitstop-select').value = currentFilter;
      }
      
      renderList();
      
      // Update body data-admin attribute based on login state
      function updateAdminAttribute(){
        if(isAdmin()){
          document.body.setAttribute('data-admin', '1');
        } else {
          document.body.removeAttribute('data-admin');
        }
      }
      updateAdminAttribute(); // Set initial state

      // Re-render list when login state changes so checkboxes appear only after login
      function refreshIfAuthChanged(){ updateAdminAttribute(); renderList(); }
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
          updateCell(row, col, checked).then(res => { t.disabled = false; }).catch(err => { t.disabled = false; console.error('Update failed', err); alert('Gagal mengemas kini. Sila semak konsol.'); });
        }
      });

    }).catch(err => {
      console.error('students load error', err);
      if(container) container.innerHTML = '<p>Gagal memuat data. Lihat konsol.</p>';
    });
    }).catch(err => {
      console.error('Cache version check failed, continuing with data load', err);
    });
  });

})();
