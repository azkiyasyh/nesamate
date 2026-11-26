/**
 * NesaMate - Login & Daftar Akun (Gmail + Nama Panggilan + Password)
 * Semua proses auth melalui backend (/api/auth/login, /api/auth/register, /api/auth/check-email)
 * menggunakan SUPABASE_SERVICE_ROLE_KEY di server, sehingga tidak butuh SUPABASE_ANON_KEY di frontend.
 */

class NesaAuthManager {
  constructor() {
    this.user = null;
    this.visitorId = Number(localStorage.getItem('nesamate_visitor_id')) || null;
    this.apiBase = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
      ? 'http://127.0.0.1:8000/api'
      : '/api';
  }

  init() {
    this.bindUI();
    const saved = this.loadSavedSession();
    if (saved) {
      this.applySignedInUser(saved);
    } else {
      this.clearSignedInUI();
    }
  }

  loadSavedSession() {
    try {
      const raw = localStorage.getItem('nesamate_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  bindUI() {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const loginForm = document.getElementById('form-auth-login');
    const registerForm = document.getElementById('form-auth-register');
    const logoutBtn = document.getElementById('btn-auth-logout');

    if (tabLogin) tabLogin.addEventListener('click', () => this.switchMode('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => this.switchMode('register'));
    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.signOut());
  }

  switchMode(mode, statusMsg = '', statusType = 'info') {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabRegister = document.getElementById('tab-auth-register');
    const panelLogin = document.getElementById('form-auth-login');
    const panelRegister = document.getElementById('form-auth-register');

    const isRegister = mode === 'register';
    if (tabLogin) tabLogin.classList.toggle('is-active', !isRegister);
    if (tabRegister) tabRegister.classList.toggle('is-active', isRegister);
    if (panelLogin) panelLogin.classList.toggle('is-active', !isRegister);
    if (panelRegister) panelRegister.classList.toggle('is-active', isRegister);

    if (statusMsg) {
      this.setStatus(statusMsg, statusType);
    } else {
      this.clearStatus();
    }
  }

  setStatus(msg, type = 'info') {
    const el = document.getElementById('auth-status-msg');
    if (!el) return;
    el.textContent = msg;
    el.className = `auth-status-msg is-${type}`;
  }

  clearStatus() {
    const el = document.getElementById('auth-status-msg');
    if (!el) return;
    el.textContent = '';
    el.className = 'auth-status-msg';
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
    const password = document.getElementById('login-password')?.value || '';
    const btn = document.getElementById('btn-auth-login');

    if (!email || !password) {
      return this.setStatus('Masukkan email dan password terlebih dahulu.', 'error');
    }

    if (btn) btn.disabled = true;
    this.clearStatus();

    try {
      const res = await fetch(`${this.apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.status === 404) {
        // Akun belum terdaftar -> otomatis balik ke tab Daftar Akun dengan email & password terisi
        const regEmail = document.getElementById('reg-email');
        const regPass = document.getElementById('reg-password');
        if (regEmail) regEmail.value = email;
        if (regPass) regPass.value = password;
        this.switchMode(
          'register',
          'Akun belum terdaftar! Silakan lengkapi nama panggilan untuk daftar akun baru.',
          'info'
        );
        return;
      }

      if (!res.ok) {
        return this.setStatus(data.detail || 'Password salah atau gagal masuk.', 'error');
      }

      this.saveAndApplySession(data);
    } catch (err) {
      this.setStatus(`Gagal terhubung ke server: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const email = (document.getElementById('reg-email')?.value || '').trim().toLowerCase();
    const nickname = (document.getElementById('reg-nickname')?.value || '').trim();
    const password = document.getElementById('reg-password')?.value || '';
    const btn = document.getElementById('btn-auth-register');

    if (!email.endsWith('@gmail.com')) {
      return this.setStatus('Daftar akun wajib menggunakan alamat Gmail (@gmail.com).', 'error');
    }
    if (!nickname) {
      return this.setStatus('Masukkan nama panggilanmu.', 'error');
    }
    if (password.length < 6) {
      return this.setStatus('Password minimal 6 karakter.', 'error');
    }

    if (btn) btn.disabled = true;
    this.clearStatus();

    try {
      const regRes = await fetch(`${this.apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password })
      });
      const regData = await regRes.json();

      if (!regRes.ok) {
        if (regRes.status === 409) {
          const loginEmail = document.getElementById('login-email');
          if (loginEmail) loginEmail.value = email;
          this.switchMode('login', 'Email sudah terdaftar. Silakan masukkan password untuk login.', 'info');
          return;
        }
        return this.setStatus(regData.detail || 'Gagal mendaftar akun.', 'error');
      }

      this.saveAndApplySession(regData);
    } catch (err) {
      this.setStatus(`Gagal terhubung ke server: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  saveAndApplySession(data) {
    const userObj = {
      user_id: data.user_id,
      email: data.email,
      nickname: (data.nickname || 'Teman').slice(0, 25),
      visitor_id: data.visitor_id || this.visitorId
    };
    if (userObj.visitor_id) {
      this.visitorId = userObj.visitor_id;
      localStorage.setItem('nesamate_visitor_id', String(userObj.visitor_id));
    }
    localStorage.setItem('nesamate_auth_user', JSON.stringify(userObj));
    this.applySignedInUser(userObj);
  }

  signOut() {
    this.user = null;
    this.visitorId = null;
    localStorage.removeItem('nesamate_auth_user');
    localStorage.removeItem('nesamate_visitor_id');
    this.clearSignedInUI();
  }

  applySignedInUser(user) {
    this.user = user;
    const nickname = (user.nickname || 'Teman').slice(0, 25);

    const nameInput = document.getElementById('input-user-name');
    if (nameInput) nameInput.value = nickname;

    localStorage.setItem('nesamate_user_name', nickname);
    if (window.nesaApp) {
      window.nesaApp.userName = nickname;
    }

    const authCard = document.getElementById('auth-box-wrapper');
    const pill = document.getElementById('auth-user-pill');
    const nameEl = document.getElementById('auth-user-name');
    const emailEl = document.getElementById('auth-user-email');
    const startBtn = document.getElementById('btn-start');

    if (nameEl) nameEl.textContent = `Halo, ${nickname}!`;
    if (emailEl) emailEl.textContent = user.email || '';
    if (authCard) authCard.style.display = 'none';
    if (pill) pill.classList.add('is-visible');
    if (startBtn) startBtn.style.display = 'flex';
    this.clearStatus();
  }

  clearSignedInUI() {
    const authCard = document.getElementById('auth-box-wrapper');
    const pill = document.getElementById('auth-user-pill');
    const startBtn = document.getElementById('btn-start');

    if (authCard) authCard.style.display = 'block';
    if (pill) pill.classList.remove('is-visible');
    if (startBtn) startBtn.style.display = 'none';
  }

  async ensureVisitor(displayName) {
    if (this.visitorId) return this.visitorId;
    try {
      const res = await fetch(`${this.apiBase}/visitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: (displayName || 'Pengunjung').slice(0, 60) })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.visitor_id) {
        this.visitorId = data.visitor_id;
        localStorage.setItem('nesamate_visitor_id', String(data.visitor_id));
        return data.visitor_id;
      }
    } catch (err) {
      console.warn('[NesaAuth] Gagal registrasi visitor:', err);
    }
    return null;
  }
}

window.nesaAuth = new NesaAuthManager();
window.addEventListener('DOMContentLoaded', () => {
  window.nesaAuth.init();
});
