import { supabase } from './supabase.js';

// ── NEU: LOBBIES LADEN BEIM START ────────────────────
window.addEventListener('load', async () => {
  const select = document.getElementById('lobby-select');
  
  const { data, error } = await supabase
    .from('lobbies')
    .select('name')
    .order('name', { ascending: true });
 
  if (error || !data) {
    select.innerHTML = '<option value="" disabled>Error loading lobbies</option>';
    return;
  }

  select.innerHTML = '<option value="" disabled selected>Select a lobby…</option>';
  data.forEach(lobby => {
    const option = document.createElement('option');
    option.value = lobby.name;
    option.textContent = lobby.name;
    select.appendChild(option);
  });
});

// ── LOBBY STATE ──────────────────────────────────────
export let currentLobby = null;
export let currentAdminToken = null;

// ── RESTORE FROM SESSION ─────────────────────────────
const savedLobby = sessionStorage.getItem('geostickrs_lobby');
if (savedLobby) {
  currentLobby = JSON.parse(savedLobby);
  window.addEventListener('load', () => {
    window._enterApp?.();
  });
}

// ── JOIN LOBBY ───────────────────────────────────────
document.getElementById('btn-lobby-join').addEventListener('click', joinLobby);
document.getElementById('lobby-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinLobby();
});

export async function joinLobby() {
  const input   = document.getElementById('lobby-password').value.trim();
  const errorEl = document.getElementById('lobby-error');
  errorEl.style.display = 'none';

  if (!input) { showLobbyError('Please enter a password.'); return; }

  const btn = document.getElementById('btn-lobby-join');
  btn.disabled = true;
  btn.textContent = 'Checking…';

  const { data, error } = await supabase
    .from('lobbies')
    .select('id, name, password, home_lat, home_lng, admin_token')
    .eq('password', input)
    .single();

  btn.disabled = false;
  btn.textContent = 'Join lobby →';

  if (error || !data) { showLobbyError('Wrong password. Try again.'); return; }

  currentLobby = {
    id:       data.id,
    name:     data.name,
    password: data.password,
    home_lat: data.home_lat,
    home_lng: data.home_lng,
    admin_token: data.admin_token,
  };
  sessionStorage.setItem('geostickrs_lobby', JSON.stringify(currentLobby));
  window._enterApp?.();
}

// ── CREATE LOBBY ─────────────────────────────────────
let homePickerMap    = null;
let selectedHomeLat  = null;
let selectedHomeLng  = null;
let homeMarker       = null;

document.getElementById('btn-lobby-create').addEventListener('click', () => {
  const creator = document.getElementById('lobby-creator');
  const isOpen  = creator.style.display === 'flex';
  creator.style.display = isOpen ? 'none' : 'flex';
  document.getElementById('btn-lobby-create').textContent = isOpen
    ? 'Create lobby →'
    : 'Close lobbycreator ↓';
});

document.getElementById('btn-lobby-home').addEventListener('click', () => {
  const name     = document.getElementById('lobby-new-name').value.trim();
  const password = document.getElementById('lobby-new-password').value.trim();
  const errorEl  = document.getElementById('step-lobby-create-error');

  if (!name)     { errorEl.textContent = 'Please enter a lobby name.';     errorEl.style.display = 'block'; return; }
  if (!password) { errorEl.textContent = 'Please enter a lobby password.'; errorEl.style.display = 'block'; return; }
  errorEl.style.display = 'none';

  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('lobby-home-picker').style.display = 'flex';
  document.getElementById('lobby-home-hint').style.display   = 'flex';

  if (!homePickerMap) {
    homePickerMap = L.map('lobby-home-map').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO'
    }).addTo(homePickerMap);

    homePickerMap.on('click', (e) => {
      selectedHomeLat = e.latlng.lat;
      selectedHomeLng = e.latlng.lng;
      if (homeMarker) homePickerMap.removeLayer(homeMarker);
      homeMarker = L.circleMarker([selectedHomeLat, selectedHomeLng], {
        radius: 10, color: '#18181b', fillColor: '#facc15', fillOpacity: 1, weight: 2
      }).addTo(homePickerMap);
      document.getElementById('lobby-home-instruction').textContent =
        `🏠 ${selectedHomeLat.toFixed(4)}, ${selectedHomeLng.toFixed(4)} — confirm or adjust`;
      document.getElementById('btn-home-confirm').disabled = false;
    });
  } else {
    selectedHomeLat = null;
    selectedHomeLng = null;
    if (homeMarker) { homePickerMap.removeLayer(homeMarker); homeMarker = null; }
    document.getElementById('btn-home-confirm').disabled = true;
    document.getElementById('lobby-home-instruction').textContent =
      "Click on the map to set your lobby's home point";
    setTimeout(() => homePickerMap.invalidateSize(), 100);
  }
});

document.getElementById('btn-home-back').addEventListener('click', () => {
  document.getElementById('lobby-home-picker').style.display = 'none';
  document.getElementById('lobby-home-hint').style.display   = 'none';
  document.getElementById('lobby-screen').style.display      = 'flex';
});

document.getElementById('btn-home-confirm').addEventListener('click', async () => {
  const name     = document.getElementById('lobby-new-name').value.trim();
  const password = document.getElementById('lobby-new-password').value.trim();
  const btn      = document.getElementById('btn-home-confirm');

  btn.disabled    = true;
  btn.textContent = 'Creating…';

  const { data: existing } = await supabase
    .from('lobbies').select('id').eq('password', password).maybeSingle();

  if (existing) {
    btn.disabled    = false;
    btn.textContent = 'Confirm home →';
    document.getElementById('lobby-home-picker').style.display = 'none';
    document.getElementById('lobby-home-hint').style.display   = 'none';
    document.getElementById('lobby-screen').style.display      = 'flex';
    const errorEl = document.getElementById('step-lobby-create-error');
    errorEl.textContent    = 'That password is already taken. Choose another.';
    errorEl.style.display  = 'block';
    return;
  }

  const adminToken = crypto.randomUUID();

  const { data: createdLobby, error } = await supabase
    .from('lobbies')
    .insert([{
      name,
      password,
      home_lat: selectedHomeLat,
      home_lng: selectedHomeLng,
      admin_token: adminToken,
    }])
    .select('id, name, password, home_lat, home_lng, admin_token')
    .single();

  btn.disabled    = false;
  btn.textContent = 'Confirm home →';

  if (error) { alert('Error creating lobby: ' + error.message); return; }

  document.getElementById('lobby-home-picker').style.display = 'none';
  document.getElementById('lobby-home-hint').style.display   = 'none';

  currentLobby = {
    id:          createdLobby.id,
    name:        createdLobby.name,
    password:    createdLobby.password,
    home_lat:    createdLobby.home_lat,
    home_lng:    createdLobby.home_lng,
    admin_token: createdLobby.admin_token,
  };

  sessionStorage.setItem('geostickrs_lobby', JSON.stringify(currentLobby));
  localStorage.setItem(`geostickrs_admin_${currentLobby.name}`, adminToken);

  alert('Lobby created! You are now the admin of this lobby.');

  window._enterApp?.();
});

// ── LEAVE LOBBY ──────────────────────────────────────
document.getElementById('btn-leave-lobby').addEventListener('click', leaveLobby);

export function leaveLobby() {
  sessionStorage.removeItem('geostickrs_lobby');
  window.location.reload();
}

// ── HELPERS ──────────────────────────────────────────
function showLobbyError(msg) {
  const el = document.getElementById('lobby-error');
  el.textContent    = msg;
  el.style.display  = 'block';
}

// ── MOBILE MENU ───────────────────────────────────────
// Wird von script.js aus enterApp() aufgerufen, nachdem die App sichtbar ist.
export function initMobileMenu() {
  // Nur auf kleinen Bildschirmen aktiv
  if (window.innerWidth > 768) return;

  // Verhindert doppeltes Einbinden (z.B. bei Hot-Reload)
  if (document.getElementById('mobile-menu-btn')) return;

  const lobby = JSON.parse(sessionStorage.getItem('geostickrs_lobby'));

  // ── Overlay (dunkelt Karte ab, Klick schließt Drawer) ──
  const overlay = document.createElement('div');
  overlay.id = 'mobile-menu-overlay';
  document.body.appendChild(overlay);

  // ── Drawer ──────────────────────────────────────────
  const drawer = document.createElement('div');
  drawer.id = 'mobile-menu-drawer';
  drawer.innerHTML = `
    <div id="mobile-drawer-header">
      <div id="mobile-drawer-lobby-name">🏠 ${lobby?.name ?? 'Lobby'}</div>
      <div id="mobile-drawer-lobby-actions">
        <button id="btn-admin-panel">⭐ Admin</button>
        <button id="mobile-drawer-leave-btn">Leave</button>
      </div>
    </div>
    <div id="mobile-drawer-leaderboard">
      <h2>Leaderboard</h2>
      <ul id="leaderboard-list"></ul>
    </div>
  `;
  document.body.appendChild(drawer);

  // ── Menü-Button (Hamburger, oben rechts) ────────────
  const menuBtn = document.createElement('button');
  menuBtn.id = 'mobile-menu-btn';
  menuBtn.setAttribute('aria-label', 'Open menu');
  menuBtn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>`;
  document.body.appendChild(menuBtn);

  // ── Öffnen / Schließen ───────────────────────────────
  const open  = () => { drawer.classList.add('open');    overlay.classList.add('open');    };
  const close = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); };

  menuBtn.addEventListener('click', open);
  overlay.addEventListener('click', close);

  // Leave-Button im Drawer
  drawer.querySelector('#mobile-drawer-leave-btn')
    .addEventListener('click', () => { close(); leaveLobby(); });

  // Admin-Button im Drawer: der bestehende initAdminPanel()-Listener
  // in script.js hört auf '#btn-admin-panel' — da der Button jetzt im Drawer
  // liegt, schließen wir den Drawer zusätzlich beim Öffnen des Admin-Panels.
  drawer.querySelector('#btn-admin-panel')
    .addEventListener('click', close);
}