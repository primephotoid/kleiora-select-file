// State management
let currentMode = 'photo'; // 'photo' | 'memories'
let currentGallery = {
  title: "Album Pernikahan: Budi & Anisa",
  clientName: "Anisa Putri",
  maxSelection: 10,
  photos: [
    { id: "f1", fileName: "WEDDING_AKAD_001.JPG", url: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop" },
    { id: "f2", fileName: "WEDDING_AKAD_008.JPG", url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop" },
    { id: "f3", fileName: "WEDDING_RESEPSI_014.JPG", url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=800&auto=format&fit=crop" },
    { id: "f4", fileName: "WEDDING_RESEPSI_025.JPG", url: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=800&auto=format&fit=crop" },
    { id: "f5", fileName: "PREWED_COUPLE_003.JPG", url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=800&auto=format&fit=crop" },
    { id: "f6", fileName: "PREWED_OUTDOOR_012.JPG", url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=800&auto=format&fit=crop" },
    { id: "f7", fileName: "PORTRAIT_STUDIO_005.JPG", url: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=800&auto=format&fit=crop" },
    { id: "f8", fileName: "EVENT_MOMENT_033.JPG", url: "https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=800&auto=format&fit=crop" },
    { id: "f9", fileName: "WEDDING_RING_002.JPG", url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=800&auto=format&fit=crop" },
    { id: "f10", fileName: "WEDDING_FAMILY_040.JPG", url: "https://images.unsplash.com/photo-1529636798458-92182e662485?q=80&w=800&auto=format&fit=crop" },
    { id: "f11", fileName: "CANDID_SMILE_019.JPG", url: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop" },
    { id: "f12", fileName: "BRIDE_PREPARATION_007.JPG", url: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=800&auto=format&fit=crop" }
  ]
};

let selectedPhotoIds = new Set(["f1", "f3", "f9"]);
let currentFilter = 'all';
let currentLightboxIndex = 0;

let photographerGalleries = [
  {
    id: 1,
    title: "Album Pernikahan: Budi & Anisa",
    clientName: "Anisa Putri",
    driveFolder: "1demo_wedding_album_2026",
    status: "submitted",
    selectedCount: 3,
    totalPhotos: 12,
    selectedFiles: ["WEDDING_AKAD_001.JPG", "WEDDING_RESEPSI_014.JPG", "WEDDING_RING_002.JPG"]
  },
  {
    id: 2,
    title: "Prewedding Outdoor: Dimas & Sarah",
    clientName: "Dimas Anggara",
    driveFolder: "1demo_prewed_dimas_2026",
    status: "active",
    selectedCount: 0,
    totalPhotos: 24,
    selectedFiles: []
  }
];

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
  renderDashboard();
});

// Section Navigation
function showSection(sectionId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const targetSec = document.getElementById(`sec-${sectionId}`);
  if (targetSec) targetSec.classList.add('active');

  // Highlight active nav
  const navLinks = document.querySelectorAll('.nav-item');
  if (sectionId === 'landing') navLinks[0]?.classList.add('active');
  if (sectionId === 'demo') navLinks[1]?.classList.add('active');
  if (sectionId === 'gallery') navLinks[2]?.classList.add('active');
  if (sectionId === 'dashboard') navLinks[3]?.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Theme Toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  showToast(`Tema diubah ke mode ${newTheme === 'dark' ? 'gelap' : 'terang'}`);
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Demo Mode Switch
function selectDemoMode(mode) {
  currentMode = mode;
  document.getElementById('modePhotoBtn').classList.toggle('active', mode === 'photo');
  document.getElementById('modeMemoriesBtn').classList.toggle('active', mode === 'memories');
}

function fillSampleDriveLink() {
  document.getElementById('driveUrlInput').value = "https://drive.google.com/drive/folders/1demo_wedding_album_2026";
  showToast("Link folder Google Drive sampel dimasukkan!");
}

function runDriveDemo() {
  const inputVal = document.getElementById('driveUrlInput').value.trim();
  if (!inputVal) {
    alert("Tempelkan dulu link folder Google Drive!");
    return;
  }

  showToast("Mengurai folder Google Drive...");
  setTimeout(() => {
    showSection('gallery');
    showToast("Berhasil memuat galeri!");
  }, 600);
}

// Render Gallery Photos
function renderGallery() {
  const grid = document.getElementById('photoGrid');
  grid.innerHTML = '';

  const photosToDisplay = currentGallery.photos.filter(p => {
    if (currentFilter === 'selected') return selectedPhotoIds.has(p.id);
    return true;
  });

  photosToDisplay.forEach((photo, index) => {
    const isSelected = selectedPhotoIds.has(photo.id);
    const card = document.createElement('div');
    card.className = `photo-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <img src="${photo.url}" alt="${photo.fileName}" loading="lazy">
      <div class="photo-card-overlay">
        <button class="photo-select-btn" onclick="event.stopPropagation(); toggleSelectPhoto('${photo.id}')">
          ${isSelected ? '❤️' : '🤍'}
        </button>
        <span class="photo-filename">${photo.fileName}</span>
      </div>
    `;

    card.addEventListener('click', () => openLightbox(index));
    grid.appendChild(card);
  });

  updateGalleryUI();
}

function updateGalleryUI() {
  const count = selectedPhotoIds.size;
  const max = currentGallery.maxSelection;

  document.getElementById('selectedCountBadge').textContent = `${count} / ${max > 0 ? max : '∞'} Foto`;
  document.getElementById('submitCount').textContent = count;
  document.getElementById('totalPhotosCount').textContent = currentGallery.photos.length;
  document.getElementById('filterSelectedCount').textContent = count;
}

function filterGallery(type, btnElement) {
  currentFilter = type;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderGallery();
}

function toggleSelectPhoto(photoId) {
  if (selectedPhotoIds.has(photoId)) {
    selectedPhotoIds.delete(photoId);
  } else {
    if (currentGallery.maxSelection > 0 && selectedPhotoIds.size >= currentGallery.maxSelection) {
      alert(`Maksimal kuota pilihan adalah ${currentGallery.maxSelection} foto.`);
      return;
    }
    selectedPhotoIds.add(photoId);
  }
  renderGallery();
}

// Lightbox Logic
function openLightbox(index) {
  currentLightboxIndex = index;
  const photo = currentGallery.photos[currentLightboxIndex];
  if (!photo) return;

  document.getElementById('lightboxImg').src = photo.url;
  document.getElementById('lightboxFileName').textContent = photo.fileName;
  
  const isSelected = selectedPhotoIds.has(photo.id);
  document.getElementById('lightboxSelectTxt').textContent = isSelected ? 'Batal Pilih' : 'Pilih Foto Ini';

  document.getElementById('lightboxModal').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightboxModal').classList.remove('open');
}

function prevLightbox() {
  if (currentLightboxIndex > 0) {
    openLightbox(currentLightboxIndex - 1);
  }
}

function nextLightbox() {
  if (currentLightboxIndex < currentGallery.photos.length - 1) {
    openLightbox(currentLightboxIndex + 1);
  }
}

function toggleLightboxSelect() {
  const photo = currentGallery.photos[currentLightboxIndex];
  if (photo) {
    toggleSelectPhoto(photo.id);
    openLightbox(currentLightboxIndex);
  }
}

// Submit Modal
function openSubmitModal() {
  if (selectedPhotoIds.size === 0) {
    alert("Pilih minimal 1 foto sebelum mengirim!");
    return;
  }
  document.getElementById('modalSelectedTotal').textContent = selectedPhotoIds.size;
  document.getElementById('submitModal').classList.add('open');
}

function closeSubmitModal() {
  document.getElementById('submitModal').classList.remove('open');
}

function confirmSubmitSelection() {
  const clientName = document.getElementById('clientNameInput').value.trim() || 'Klien';
  closeSubmitModal();
  showToast(`Terima kasih ${clientName}! Hasil seleksi foto telah dikirim ke studio.`);
  
  // Update dashboard gallery status
  if (photographerGalleries.length > 0) {
    photographerGalleries[0].status = 'submitted';
    photographerGalleries[0].selectedCount = selectedPhotoIds.size;
    photographerGalleries[0].selectedFiles = currentGallery.photos
      .filter(p => selectedPhotoIds.has(p.id))
      .map(p => p.fileName);
    renderDashboard();
  }
}

// Photographer Dashboard Render
function renderDashboard() {
  const grid = document.getElementById('dashboardGalleryList');
  if (!grid) return;

  grid.innerHTML = '';
  photographerGalleries.forEach(g => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.innerHTML = `
      <div class="gallery-card-top">
        <h3>${g.title}</h3>
        <span class="status-tag ${g.status}">${g.status === 'submitted' ? 'Seleksi Selesai' : 'Aktif'}</span>
      </div>
      <div class="gallery-card-info">
        <span>👤 Klien: <b>${g.clientName}</b></span>
        <span>📷 Total Foto: <b>${g.totalPhotos} foto</b></span>
        <span>❤️ Foto Dipilih: <b>${g.selectedCount} foto</b></span>
      </div>
      <div class="gallery-card-actions">
        <button class="btn-ghost btn-sm" onclick="showSection('gallery')">👁️ Lihat Galeri</button>
        ${g.status === 'submitted' ? `<button class="btn-cta btn-sm" onclick="openExportModal(${g.id})">📋 Ekspor Rekap</button>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Create Gallery Modal
function openCreateGalleryModal() {
  document.getElementById('createGalleryModal').classList.add('open');
}

function closeCreateGalleryModal() {
  document.getElementById('createGalleryModal').classList.remove('open');
}

function saveNewGallery() {
  const title = document.getElementById('newGalleryTitle').value.trim();
  const clientName = document.getElementById('newClientName').value.trim();
  const driveLink = document.getElementById('newDriveLink').value.trim();
  const maxSel = parseInt(document.getElementById('newMaxSelection').value) || 0;

  if (!title || !driveLink) {
    alert("Judul galeri dan Link Drive wajib diisi!");
    return;
  }

  const newGal = {
    id: Date.now(),
    title: title,
    clientName: clientName || "Klien",
    driveFolder: driveLink,
    status: "active",
    selectedCount: 0,
    totalPhotos: 18,
    selectedFiles: []
  };

  photographerGalleries.unshift(newGal);
  renderDashboard();
  closeCreateGalleryModal();
  showToast("Galeri baru berhasil dibuat!");
}

// Export Selection Modal
function openExportModal(galleryId) {
  const gal = photographerGalleries.find(g => g.id === galleryId);
  if (!gal || !gal.selectedFiles.length) {
    alert("Belum ada foto yang dipilih untuk galeri ini.");
    return;
  }

  const commaStr = gal.selectedFiles.join(', ');
  const lineStr = gal.selectedFiles.join('\n');

  document.getElementById('exportCommaText').value = commaStr;
  document.getElementById('exportLineText').value = lineStr;

  document.getElementById('exportModal').classList.add('open');
}

function closeExportModal() {
  document.getElementById('exportModal').classList.remove('open');
}

function copyExportText(elementId) {
  const txtArea = document.getElementById(elementId);
  txtArea.select();
  document.execCommand('copy');
  showToast("Daftar nama file berhasil disalin ke clipboard!");
}
