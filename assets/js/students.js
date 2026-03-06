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
    // Display columns and include the Checked column as a checkbox
    const cols = ['Nama Student','No Maktab','Tingkatan','Nama Parent','Phone Parent','Checked'];
    const idx = Object.create(null);
    headers.forEach((h,i)=> idx[h]=i);

    let html = '<table class="students-table"><thead><tr>';
    cols.forEach(c => html += '<th>'+escapeHtml(c)+'</th>');
    html += '</tr></thead><tbody>';

    data.forEach((row, i) => {
      // compute the sheet row number (headers at sheet row 1)
      const sheetRow = i + 2;
      html += '<tr>';
      cols.forEach(c => {
        if(c === 'Checked'){
          const checkedVal = (row[idx['Checked']] || '').toString();
          const checked = checkedVal !== '' && checkedVal.toLowerCase() !== 'false';
          // include data-row and data-col attributes for updates (col is 1-based)
          const colNumber = (idx['Checked'] !== undefined) ? (idx['Checked'] + 1) : '';
          html += '<td><input type="checkbox" class="finalist-checked" data-row="'+sheetRow+'" data-col="'+colNumber+'"' + (checked ? ' checked' : '') + '></td>';
        } else {
          const v = row[idx[c]] || '';
          html += '<td>' + escapeHtml(v) + '</td>';
        }
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
      s.src = APP_SCRIPT_URL + '?action=finalistpb&callback=' + cb;
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
      s.src = APP_SCRIPT_URL + '?action=update_finalistpb' + params + '&callback=' + cb;
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
      // delegate change handler for checkboxes
      container.addEventListener('change', function(e){
        const t = e.target;
        if(t && t.classList && t.classList.contains('finalist-checked')){
          const row = t.getAttribute('data-row');
          const col = t.getAttribute('data-col');
          const checked = t.checked ? 'TRUE' : '';
          t.disabled = true;
          jsonpUpdateCell(row, col, checked).then(res => {
            t.disabled = false;
            // optional: show brief highlight or toast; keep simple
          }).catch(err => {
            t.disabled = false;
            console.error('Update failed', err);
            alert('Gagal mengemas kini. Sila semak konsol.');
          });
        }
      });
    }).catch(err => {
      console.error('students load error', err);
      if(container) container.innerHTML = '<p>Gagal memuat data. Lihat konsol.</p>';
    });
  });

})();
