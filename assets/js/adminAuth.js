// Simple admin auth integration using provided Apps Script web app
// WARNING: This is a convenience layer for small/private usage. Do not treat as a production-grade auth.
(function(){
  const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbziJBrE4FKoyol7JqF---uEoq7tPzd292BGHVIIFR5DlO20z6UaB9qCVqW62uN8K_8k/exec';
  const STORAGE_KEY = 'mabda_admin_user';

  function isAdmin() { return !!localStorage.getItem(STORAGE_KEY); }

  function setAdmin(user) {
    if(user) localStorage.setItem(STORAGE_KEY, user); else localStorage.removeItem(STORAGE_KEY);
    try{
      if(user){ document.body && (document.body.dataset.admin = '1'); }
      else { document.body && delete document.body.dataset.admin; }
    }catch(e){}
    try{ document.dispatchEvent(new Event('mabda_auth_changed')); }catch(e){}
  }

  function updateUi() {
    const adminLink = document.getElementById('admin-link');
    const adminLogin = document.getElementById('admin-login');
    if(!adminLink || !adminLogin) return;
    if(isAdmin()){
      adminLink.style.display = 'block';
      adminLogin.textContent = 'Logout';
      try{ document.body && (document.body.dataset.admin = '1'); }catch(e){}
    } else {
      adminLink.style.display = 'none';
      adminLogin.textContent = 'Admin Login';
      try{ document.body && delete document.body.dataset.admin; }catch(e){}
    }
    try{ document.dispatchEvent(new Event('mabda_auth_changed')); }catch(e){}
  }

  function showPromptLogin(){
    const user = prompt('Admin username:');
    if(!user) return;
    const pass = prompt('Password:');
    if(pass === null) return; // cancelled
    doLogin(user, pass).then(res => {
      if(res && res.ok) alert('Login successful'); else alert('Login failed');
    }).catch(() => { alert('Connection error'); });
  }

  function doLogin(user, pass){
    // Direct fetch to Google Apps Script (no proxy)
    const params = new URLSearchParams();
    params.append('action', 'login');
    params.append('user', user);
    params.append('pass', pass);
    
    return fetch(APP_SCRIPT_URL + '?' + params.toString(), {
      method: 'GET',
      timeout: 10000
    })
    .then(async r => {
      const text = await r.text();
      if(!r.ok){
        return { ok: false, error: 'HTTP ' + r.status + ': ' + (text || r.statusText) };
      }
      try{
        // Try to parse as JSON
        const data = text ? JSON.parse(text) : {};
        if(data && data.ok){
          setAdmin(user);
          updateUi();
          return { ok: true, data };
        }
        return { ok: false, data };
      }catch(e){
        // Failed to parse - treat as error
        return { ok: false, error: 'Invalid response from server' };
      }
    })
    .catch(err => {
      console.error('Login error:', err);
      return { ok: false, error: 'Network error: ' + err.message };
    });
  }

  function init() {
    // update UI immediately (in case header already injected)
    try { updateUi(); } catch (e) {}

    // delegated click handler: redirect to dedicated login page when not logged in
    document.addEventListener('click', function(e){
      const target = e.target;
      if(!target) return;
      if(target.id === 'admin-login' || target.closest && target.closest('#admin-login')){
        e.preventDefault();
        if(isAdmin()){
          if(confirm('Logout admin?')){ setAdmin(null); updateUi(); }
        } else {
          // redirect to login page with return path
          var next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash || '');
          window.location.href = 'admin-login.html?next=' + next;
        }
      }
    });

    // also update UI once DOM is ready
    document.addEventListener('DOMContentLoaded', () => { updateUi();
      // protect admin.html if accessed directly
      try{
        if(window.location.pathname && window.location.pathname.split('/').pop().toLowerCase() === 'admin.html'){
          if(!isAdmin()){
            alert('You must be logged in as an admin to view this page.');
            window.location.href = 'index.html';
          }
        }
      }catch(e){}
    });

    // ensure UI updates when header is injected after page load
    document.addEventListener('mabda_header_injected', () => { try{ updateUi(); }catch(e){} });
  }

  init();
  // expose API for dedicated login page (include endpoint for debugging)
  try{ window.mabdaAdmin = { doLogin: doLogin, isAdmin: isAdmin, setAdmin: setAdmin, endpointRaw: APP_SCRIPT_URL }; }catch(e){}
})();
