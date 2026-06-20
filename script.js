// ── MAIN ENTRY POINT ────────────────────────────────
// Imports all modules and wires them together.
// Modules live in the js/ folder.

import './js/lobby.js';
import { init, loadAllStickers, loadLeaderboard, submission } from './js/submission.js';

// ── MAP SETUP ────────────────────────────────────────
let map = null;

function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO'
  }).addTo(map);

  // Read current lobby from session
  const lobby = JSON.parse(sessionStorage.getItem('geostickrs_lobby'));

  // Pass map and lobby into submission module
  init(map, lobby);

  // Map click for location picking — dispatched to submission module
  map.on('click', (e) => {

    // Treasure Hunt Creator active?
    if (treasureHuntDraft) {
      handleTreasureHuntClick(e.latlng.lat, e.latlng.lng);
      return;
    }

    submission.lat = e.latlng.lat;
    submission.lng = e.latlng.lng;
    const el = document.getElementById('location-instruction');
    if (el) {
      el.textContent = `📍 ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)} — press Continue.`;
      el.style.color  = '#16a34a';
    }
    document.getElementById('btn-location-next').disabled = false;

    // Place preview marker via submission module
    import('./js/submission.js').then(m => m.placePreviewMarker(e.latlng.lat, e.latlng.lng));
  });

  loadAllStickers();
  loadLeaderboard();
  loadSavedTreasureHunt();
}

// ── ENTER APP ────────────────────────────────────────
function enterApp() {
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'block';

  const lobby = JSON.parse(sessionStorage.getItem('geostickrs_lobby'));
  document.getElementById('lobby-badge-name').textContent = `🏠 ${lobby?.name ?? ''}`;

  const adminButton = document.getElementById('btn-admin-panel');
  const adminToken = lobby?.name
    ? localStorage.getItem(`geostickrs_admin_${lobby.name}`)
    : null;

  if (adminButton && adminToken) {
    adminButton.style.display = 'inline-block';
  }

  initMap();
}

// Expose globally so lobby.js can call window._enterApp()
window._enterApp = enterApp;

// Auto-enter if session already has a lobby (page refresh)
if (sessionStorage.getItem('geostickrs_lobby')) {
  window.addEventListener('load', enterApp);
}


// ── FIRST VISIT INTRO ────────────────────────────────

function initIntro() {
  const introScreen = document.getElementById('intro-screen');
  const skipButton = document.getElementById('btn-intro-skip');

  if (!introScreen || !skipButton) return;

  const introSeen = localStorage.getItem('geostickrs_intro_seen');

  if (!introSeen) {
    introScreen.style.display = 'flex';
  }

  skipButton.addEventListener('click', () => {
    localStorage.setItem('geostickrs_intro_seen', 'true');
    introScreen.style.display = 'none';
  });
}

window.addEventListener('load', initIntro);



// ── ADMIN PANEL ──────────────────────────────────────

function initAdminPanel() {
  const adminButton = document.getElementById('btn-admin-panel');
  const adminPanel = document.getElementById('admin-panel');
  const closeButton = document.getElementById('btn-admin-close');

  const treasureButton = document.getElementById('btn-admin-treasure');
  console.log('Treasure button found:', treasureButton);

  if (!adminButton || !adminPanel || !closeButton) return;

  adminButton.addEventListener('click', () => {
    adminPanel.style.display = 'flex';
  });

  closeButton.addEventListener('click', () => {
    adminPanel.style.display = 'none';
  });

  adminPanel.addEventListener('click', (e) => {
    if (e.target === adminPanel) {
      adminPanel.style.display = 'none';
    }
  });

  treasureButton?.addEventListener('click', () => {console.log('Treasure button clicked');
  startTreasureHuntCreator();
  });

  document.getElementById('btn-admin-manhunt')?.addEventListener('click', () => {
    alert('Manhunt mode coming soon.');
  });

  document.getElementById('btn-admin-capture')?.addEventListener('click', () => {
    alert('Capture The Sticker coming soon.');
  });

  document.getElementById('btn-admin-review')?.addEventListener('click', () => {
    alert('Sticker review coming soon.');
  });

  document.getElementById('btn-admin-rules')?.addEventListener('click', () => {
    alert('Rules & Legal coming soon.');
  });

  document.getElementById('btn-admin-settings')?.addEventListener('click', () => {
    alert('Lobby settings coming soon.');
  });
}

window.addEventListener('load', initAdminPanel);




// ── TREASURE HUNT CREATOR ────────────────────────────

let treasureHuntDraft = null;
let treasureHuntStep = 0;
let treasureHuntMarkers = [];

function startTreasureHuntCreator() {
  console.log('Treasure Hunt Creator started');
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) adminPanel.style.display = 'none';

  const durationMinutes = 60; // default: 1 hour

  //const durationMinutes = Number(duration);

    const expiresAt = durationMinutes > 0
  ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
  : null;

  treasureHuntDraft = {
    name: 'Treasure Hunt',
    checkpoints: [],
    treasure: null,
    createdAt: new Date().toISOString(),
    expiresAt,
    active: true
  };

  treasureHuntStep = 0;

  alert('Treasure Hunt Creator started. Click on the map to set Checkpoint 1.');
}

function handleTreasureHuntClick(lat, lng) {
  console.log('Treasure Hunt click received:', lat, lng, treasureHuntStep);
  if (!map || !treasureHuntDraft) return;

  // First 3 clicks = checkpoints
  if (treasureHuntStep < 3) {
    treasureHuntDraft.checkpoints.push({ lat, lng });

    const marker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`Checkpoint ${treasureHuntStep + 1}`)
      .openPopup();

    treasureHuntMarkers.push(marker);

    treasureHuntStep++;

    if (treasureHuntStep < 3) {
      alert(`Checkpoint ${treasureHuntStep} saved. Set Checkpoint ${treasureHuntStep + 1}.`);
    } else {
      alert('Checkpoint 3 saved. Now place the Treasure.');
    }

    return;
  }

  // Fourth click = treasure
  treasureHuntDraft.treasure = { lat, lng };

  const treasureMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup('🏆 Treasure')
    .openPopup();

  treasureHuntMarkers.push(treasureMarker);

  localStorage.setItem('geostickrs_treasure_hunt', JSON.stringify(treasureHuntDraft));

  console.log('Treasure Hunt created:', treasureHuntDraft);

  alert('🏴‍☠️ Treasure Hunt created and saved locally!');

  treasureHuntDraft = null;
  treasureHuntStep = 0;
}


function loadSavedTreasureHunt() {
  const saved = localStorage.getItem('geostickrs_treasure_hunt');
  if (!saved || !map) return;

  const hunt = JSON.parse(saved);

  if (hunt.expiresAt && new Date(hunt.expiresAt) < new Date()) {
    localStorage.removeItem('geostickrs_treasure_hunt');
    return;
  }

  hunt.checkpoints.forEach((checkpoint, index) => {
    L.marker([checkpoint.lat, checkpoint.lng])
      .addTo(map)
      .bindPopup(`Checkpoint ${index + 1}`);
  });

  if (hunt.treasure) {
  L.marker([hunt.treasure.lat, hunt.treasure.lng])
    .addTo(map)
    .bindPopup('🏆 Treasure');
}

showHuntBadge(hunt);
}

let huntTimerInterval = null;

function showHuntBadge(hunt) {
  const badge = document.getElementById('hunt-badge');
  const timer = document.getElementById('hunt-timer');

  if (!badge || !timer || !hunt) return;

  badge.style.display = 'block';

  function updateTimer() {
    if (!hunt.expiresAt) {
      timer.textContent = 'No time limit';
      return;
    }

    const remainingMs = new Date(hunt.expiresAt) - new Date();

    if (remainingMs <= 0) {
      timer.textContent = 'Expired';
      badge.style.display = 'none';
      localStorage.removeItem('geostickrs_treasure_hunt');
      clearInterval(huntTimerInterval);
      return;
    }

    const minutes = Math.floor(remainingMs / 60000);
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;

    timer.textContent = hours > 0
      ? `${hours}h ${restMinutes}min remaining`
      : `${minutes}min remaining`;
  }

  updateTimer();
  clearInterval(huntTimerInterval);
  huntTimerInterval = setInterval(updateTimer, 1000);
}
