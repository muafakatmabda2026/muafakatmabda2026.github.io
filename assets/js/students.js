// Fetch 'Processed' sheet rows via JSONP and render a table
(function(){
  const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziJBrE4FKoyol7JqF---uEoq7tPzd292BGHVIIFR5DlO20z6UaB9qCVqW62uN8K_8k/exec';

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderTable(rows){
    const container = document.getElementById('students-container');
    if(!container) return;
    if(!rows || rows.length === 0){ container.innerHTML = '<p>Tidak ada data.</p>'; return; }

    const headers = rows[0].map(h => String(h || '').trim());
    const data = rows.slice(1);

    const cols = ['TimeStamp','Email','Nama Student','No Maktab','Tingkatan','Nama Parent','Phone Parent','Jenis ticket','Bas PB','Bas KM','Seat_PB','Seat_KM','Validity'];
    const idx = Object.create(null);
    headers.forEach((h,i)=> idx[h]=i);

    let html = '<table class="students-table"><thead><tr>';
    cols.forEach(c => html += '<th>'+escapeHtml(c)+'</th>');
    html += '</tr></thead><tbody>';

    data.forEach(row => {
      const validity = (row[idx['Validity']] || '').toString().toLowerCase();
      html += '<tr' + (validity === 'invalid' ? ' class="invalid-row"' : '') + '>';
      cols.forEach(c => {
        const v = row[idx[c]] || '';
        html += '<td>' + escapeHtml(v) + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function jsonpFetchProcessed(timeout = 10000){
    return new Promise((resolve, reject) => {
      const cb = '__mabda_students_cb_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const cleanup = () => { try{ delete window[cb]; }catch(e){} const s = document.getElementById(cb+'_script'); if(s && s.parentNode) s.parentNode.removeChild(s); };
      window[cb] = function(data){ cleanup(); resolve(data); };
      const s = document.createElement('script');
      s.id = cb + '_script';
      s.src = APP_SCRIPT_URL + '?action=processed&callback=' + cb;
      s.onerror = function(){ cleanup(); reject(new Error('JSONP load error')); };
      document.head.appendChild(s);
      setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout')); }, timeout);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    const container = document.getElementById('students-container');
    if(container) container.innerHTML = '<p>Memuatkan data…</p>';
    jsonpFetchProcessed().then(result => {
      // Apps Script will return the raw rows array; or an object { rows: [...] }
      const rows = Array.isArray(result) ? result : (result && result.rows) || [];
      renderTable(rows);
    }).catch(err => {
      console.error('students load error', err);
      if(container) container.innerHTML = '<p>Gagal memuat data. Lihat konsol.</p>';
    });
  });

})();
