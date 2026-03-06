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
    doLogin(user, pass);
  }

  function doLogin(user, pass){
    // Primary attempt: POST JSON (preferred). If this fails due to CORS
    // we fall back to a JSONP-style GET (requires the Apps Script to support it).
    fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', user: user, pass: pass })
    }).then(r => r.json()).then(data => {
      if(data && data.ok){
        setAdmin(user);
        updateUi();
        alert('Login successful');
      } else {
        alert('Login failed');
      }
    }).catch(err => {
      console.error('Primary login failed:', err);
      // Likely a CORS/preflight problem; try JSONP fallback
      tryJsonpLogin(user, pass).then(data => {
        if(data && data.ok){
          setAdmin(user);
          updateUi();
          alert('Login successful (via fallback)');
        } else {
          alert('Login failed');
        }
      }).catch(ferr => {
        console.error('Fallback login failed:', ferr);
        alert('Connection error. The authentication endpoint blocked the request (CORS).\n\nServer must allow cross-origin requests or support JSONP. See console for details.');
      });
    });
  }

  // JSONP fallback: adds a <script> tag to perform a GET with a callback param.
  // NOTE: JSONP requires the Apps Script endpoint to accept GET and wrap its
  // JSON response in the provided callback, e.g. callback({ ok: true }).
  function tryJsonpLogin(user, pass, timeout = 8000){
    return new Promise((resolve, reject) => {
      const cbName = '__mabda_admin_cb_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      const cleanup = () => {
        try{ delete window[cbName]; }catch(e){}
        const s = document.getElementById(cbName + '_script');
        if(s && s.parentNode) s.parentNode.removeChild(s);
      };

      window[cbName] = function(data){ cleanup(); resolve(data); };

      const src = APP_SCRIPT_URL + '?action=login&user=' + encodeURIComponent(user) + '&pass=' + encodeURIComponent(pass) + '&callback=' + cbName;
      const s = document.createElement('script');
      s.src = src;
      s.id = cbName + '_script';
      s.onerror = function(e){ cleanup(); reject(new Error('JSONP script load error')); };
      document.head.appendChild(s);

      setTimeout(() => { cleanup(); reject(new Error('JSONP timeout')); }, timeout);
    });
  }

  function init() {
    // update UI immediately (in case header already injected)
    try { updateUi(); } catch (e) {}

    // delegated click handler so it works regardless of when header is inserted
    document.addEventListener('click', function(e){
      const target = e.target;
      if(!target) return;
      if(target.id === 'admin-login' || target.closest && target.closest('#admin-login')){
        e.preventDefault();
        if(isAdmin()){
          if(confirm('Logout admin?')){ setAdmin(null); updateUi(); }
        } else {
          showPromptLogin();
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
  }

  init();
})();
