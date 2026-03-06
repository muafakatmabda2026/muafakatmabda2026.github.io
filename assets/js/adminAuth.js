// Simple admin auth integration using provided Apps Script web app
// WARNING: This is a convenience layer for small/private usage. Do not treat as a production-grade auth.
(function(){
  const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRTfiD53v2MFWaUCg_zTUenOkqDpHFfZ4Di4YY2K71D5HZj4TxfZYAnW33rmplXf58Sg/exec';
  const STORAGE_KEY = 'mabda_admin_user';

  function isAdmin() { return !!localStorage.getItem(STORAGE_KEY); }

  function setAdmin(user) { if(user) localStorage.setItem(STORAGE_KEY, user); else localStorage.removeItem(STORAGE_KEY); }

  function updateUi() {
    const adminLink = document.getElementById('admin-link');
    const adminLogin = document.getElementById('admin-login');
    if(!adminLink || !adminLogin) return;
    if(isAdmin()){
      adminLink.style.display = 'block';
      adminLogin.textContent = 'Logout';
    } else {
      adminLink.style.display = 'none';
      adminLogin.textContent = 'Admin Login';
    }
  }

  function showPromptLogin(){
    const user = prompt('Admin username:');
    if(!user) return;
    const pass = prompt('Password:');
    if(pass === null) return; // cancelled
    doLogin(user, pass);
  }

  function doLogin(user, pass){
    fetch(APP_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user, pass: pass })
    }).then(r => r.json()).then(data => {
      if(data && data.ok){
        setAdmin(user);
        updateUi();
        alert('Login berjaya');
      } else {
        alert('Login gagal');
      }
    }).catch(err => { console.error(err); alert('Ralat sambungan'); });
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
            alert('Anda mesti login sebagai admin untuk melihat halaman ini.');
            window.location.href = 'index.html';
          }
        }
      }catch(e){}
    });
  }

  init();
})();
