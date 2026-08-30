'use strict';

const state = {
  selfie: null, // data URL
  selfieImg: null, // HTMLImageElement, loaded
  dresses: [], // { id, dataUrl, img }
  activeDressId: null,
  transforms: {}, // dressId -> { x, y, w, h, rot } in stage px
  looks: [], // { id, dataUrl, label }
  aiEnabled: false,
  cameraStream: null,
};

const els = {
  statusBanner: document.getElementById('status-banner'),

  selfieEmpty: document.getElementById('selfie-empty'),
  startCamera: document.getElementById('start-camera'),
  selfieFile: document.getElementById('selfie-file'),
  cameraBox: document.getElementById('camera-box'),
  cameraVideo: document.getElementById('camera-video'),
  capturePhoto: document.getElementById('capture-photo'),
  cancelCamera: document.getElementById('cancel-camera'),
  selfiePreviewWrap: document.getElementById('selfie-preview-wrap'),
  selfieThumb: document.getElementById('selfie-thumb'),
  retakeSelfie: document.getElementById('retake-selfie'),

  dressFile: document.getElementById('dress-file'),
  dressGallery: document.getElementById('dress-gallery'),

  tryonPanel: document.getElementById('tryon-panel'),
  autoFit: document.getElementById('auto-fit'),
  opacitySlider: document.getElementById('opacity-slider'),
  resetFit: document.getElementById('reset-fit'),
  addToGallery: document.getElementById('add-to-gallery'),
  stage: document.getElementById('stage'),
  stageSelfie: document.getElementById('stage-selfie'),
  overlay: document.getElementById('overlay'),
  overlayImg: document.getElementById('overlay-img'),

  aiHint: document.getElementById('ai-hint'),
  styleNote: document.getElementById('style-note'),
  runAiBlend: document.getElementById('run-ai-blend'),
  aiStatus: document.getElementById('ai-status'),

  looksPanel: document.getElementById('looks-panel'),
  looksGallery: document.getElementById('looks-gallery'),

  workCanvas: document.getElementById('work-canvas'),
};

function showStatus(el, message, kind) {
  el.textContent = message;
  el.hidden = !message;
  el.className = kind ? `status ${kind}` : 'status';
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load that image.'));
    img.src = dataUrl;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

// ---------- Selfie ----------

async function setSelfie(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    state.selfie = dataUrl;
    state.selfieImg = img;
    els.selfieThumb.src = dataUrl;
    els.stageSelfie.src = dataUrl;
    els.selfieEmpty.hidden = true;
    els.cameraBox.hidden = true;
    els.selfiePreviewWrap.hidden = false;
    updateWorkspaceVisibility();
  } catch (err) {
    showStatus(els.statusBanner, err.message, 'error');
  }
}

els.selfieFile.addEventListener('change', async () => {
  const file = els.selfieFile.files[0];
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  setSelfie(dataUrl);
});

els.startCamera.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    state.cameraStream = stream;
    els.cameraVideo.srcObject = stream;
    els.selfieEmpty.hidden = true;
    els.cameraBox.hidden = false;
  } catch (err) {
    showStatus(els.statusBanner, 'Could not access the camera — try uploading a photo instead.', 'error');
  }
});

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((t) => t.stop());
    state.cameraStream = null;
  }
}

els.cancelCamera.addEventListener('click', () => {
  stopCamera();
  els.cameraBox.hidden = true;
  els.selfieEmpty.hidden = false;
});

els.capturePhoto.addEventListener('click', () => {
  const video = els.cameraVideo;
  const canvas = els.workCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  stopCamera();
  els.cameraBox.hidden = true;
  setSelfie(dataUrl);
});

els.retakeSelfie.addEventListener('click', () => {
  state.selfie = null;
  state.selfieImg = null;
  els.selfiePreviewWrap.hidden = true;
  els.selfieEmpty.hidden = false;
  els.selfieFile.value = '';
  updateWorkspaceVisibility();
});

// ---------- Dresses ----------

els.dressFile.addEventListener('change', async () => {
  const files = Array.from(els.dressFile.files || []);
  for (const file of files) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const img = await loadImage(dataUrl);
      const id = `dress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      state.dresses.push({ id, dataUrl, img });
      renderDressGallery();
      if (!state.activeDressId) selectDress(id);
    } catch (err) {
      showStatus(els.statusBanner, err.message, 'error');
    }
  }
  els.dressFile.value = '';
});

function renderDressGallery() {
  els.dressGallery.innerHTML = '';
  for (const dress of state.dresses) {
    const card = document.createElement('div');
    card.className = 'dress-thumb' + (dress.id === state.activeDressId ? ' active' : '');
    card.innerHTML = `
      <img src="${dress.dataUrl}" alt="Dress option" />
      <button class="remove-dress" title="Remove" type="button">✕</button>
    `;
    card.querySelector('img').addEventListener('click', () => selectDress(dress.id));
    card.querySelector('.remove-dress').addEventListener('click', (e) => {
      e.stopPropagation();
      removeDress(dress.id);
    });
    els.dressGallery.appendChild(card);
  }
}

function removeDress(id) {
  state.dresses = state.dresses.filter((d) => d.id !== id);
  delete state.transforms[id];
  if (state.activeDressId === id) {
    state.activeDressId = state.dresses.length ? state.dresses[0].id : null;
    if (state.activeDressId) applyDressToStage(state.activeDressId);
  }
  renderDressGallery();
  updateWorkspaceVisibility();
}

function selectDress(id) {
  state.activeDressId = id;
  renderDressGallery();
  applyDressToStage(id);
  updateWorkspaceVisibility();
}

function applyDressToStage(id) {
  const dress = state.dresses.find((d) => d.id === id);
  if (!dress) return;
  els.overlayImg.src = dress.dataUrl;
  if (!state.transforms[id]) {
    state.transforms[id] = computeDefaultTransform(dress.img);
  }
  renderTransform();
}

function updateWorkspaceVisibility() {
  const ready = Boolean(state.selfie && state.activeDressId);
  els.tryonPanel.hidden = !ready;
  els.looksPanel.hidden = state.looks.length === 0;
}

// ---------- Fit workspace (drag / resize / rotate) ----------

function stageRect() {
  return els.stage.getBoundingClientRect();
}

function computeDefaultTransform(dressImg) {
  const rect = stageRect();
  const stageW = rect.width || els.stageSelfie.clientWidth || 400;
  const stageH = rect.height || els.stageSelfie.clientHeight || 500;
  const aspect = dressImg.naturalHeight / dressImg.naturalWidth;

  const cx = stageW / 2;
  const topY = stageH * 0.32;

  const w = stageW * 0.46;
  const h = w * aspect;
  return { x: cx - w / 2, y: topY, w, h, rot: 0 };
}

async function autoFit() {
  const dress = state.dresses.find((d) => d.id === state.activeDressId);
  if (!dress || !state.selfieImg) return;

  const rect = stageRect();
  const stageW = rect.width;
  const stageH = rect.height;
  const aspect = dress.img.naturalHeight / dress.img.naturalWidth;

  let placed = false;

  if ('FaceDetector' in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: true });
      const faces = await detector.detect(state.selfieImg);
      if (faces && faces.length > 0) {
        const box = faces[0].boundingBox;
        const scale = stageW / state.selfieImg.naturalWidth;
        const faceW = box.width * scale;
        const faceCX = (box.x + box.width / 2) * scale;
        const chinY = (box.y + box.height) * scale;

        const w = faceW * 3.2;
        const h = w * aspect;
        const x = faceCX - w / 2;
        const y = chinY + faceW * 0.15;

        state.transforms[dress.id] = { x, y, w, h, rot: 0 };
        placed = true;
      }
    } catch (err) {
      // Shape Detection API not supported on this platform — fall through to default.
    }
  }

  if (!placed) {
    const w = stageW * 0.46;
    const h = w * aspect;
    state.transforms[dress.id] = { x: stageW / 2 - w / 2, y: stageH * 0.32, w, h, rot: 0 };
  }

  renderTransform();
}

function renderTransform() {
  const t = state.transforms[state.activeDressId];
  if (!t) return;
  els.overlay.style.left = `${t.x}px`;
  els.overlay.style.top = `${t.y}px`;
  els.overlay.style.width = `${t.w}px`;
  els.overlay.style.height = `${t.h}px`;
  els.overlay.style.transform = `rotate(${t.rot}deg)`;
}

let drag = null; // { mode, startX, startY, start: {...t} }

function pointerPos(e) {
  return { x: e.clientX, y: e.clientY };
}

function onHandlePointerDown(mode) {
  return (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = state.transforms[state.activeDressId];
    if (!t) return;
    drag = { mode, start: { ...t }, pointerStart: pointerPos(e) };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
}

function onPointerMove(e) {
  if (!drag) return;
  const t = state.transforms[state.activeDressId];
  const rect = stageRect();
  const pos = pointerPos(e);
  const dx = pos.x - drag.pointerStart.x;
  const dy = pos.y - drag.pointerStart.y;

  if (drag.mode === 'move') {
    t.x = drag.start.x + dx;
    t.y = drag.start.y + dy;
  } else if (drag.mode === 'resize') {
    const cx = drag.start.x + drag.start.w / 2;
    const cy = drag.start.y + drag.start.h / 2;
    const startDist = Math.hypot(drag.pointerStart.x - (rect.left + cx), drag.pointerStart.y - (rect.top + cy));
    const curDist = Math.hypot(pos.x - (rect.left + cx), pos.y - (rect.top + cy));
    const scale = Math.max(0.2, curDist / (startDist || 1));
    t.w = drag.start.w * scale;
    t.h = drag.start.h * scale;
    t.x = cx - t.w / 2;
    t.y = cy - t.h / 2;
  } else if (drag.mode === 'rotate') {
    const cx = rect.left + drag.start.x + drag.start.w / 2;
    const cy = rect.top + drag.start.y + drag.start.h / 2;
    const angle = Math.atan2(pos.x - cx, -(pos.y - cy)) * (180 / Math.PI);
    t.rot = angle;
  }

  renderTransform();
}

function onPointerUp() {
  drag = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
}

els.overlayImg.addEventListener('pointerdown', onHandlePointerDown('move'));
document.querySelector('.resize-handle').addEventListener('pointerdown', onHandlePointerDown('resize'));
document.querySelector('.rotate-handle').addEventListener('pointerdown', onHandlePointerDown('rotate'));

els.autoFit.addEventListener('click', autoFit);

els.resetFit.addEventListener('click', () => {
  const dress = state.dresses.find((d) => d.id === state.activeDressId);
  if (!dress) return;
  state.transforms[dress.id] = computeDefaultTransform(dress.img);
  renderTransform();
});

els.opacitySlider.addEventListener('input', () => {
  els.overlayImg.style.opacity = Number(els.opacitySlider.value) / 100;
});

// ---------- Save look ----------

function flattenLook() {
  const t = state.transforms[state.activeDressId];
  const dress = state.dresses.find((d) => d.id === state.activeDressId);
  if (!t || !dress || !state.selfieImg) return null;

  const rect = stageRect();
  const scale = state.selfieImg.naturalWidth / rect.width;

  const canvas = els.workCanvas;
  canvas.width = state.selfieImg.naturalWidth;
  canvas.height = state.selfieImg.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.selfieImg, 0, 0, canvas.width, canvas.height);

  const cx = (t.x + t.w / 2) * scale;
  const cy = (t.y + t.h / 2) * scale;
  const w = t.w * scale;
  const h = t.h * scale;

  ctx.save();
  ctx.globalAlpha = Number(els.opacitySlider.value) / 100;
  ctx.translate(cx, cy);
  ctx.rotate((t.rot * Math.PI) / 180);
  ctx.drawImage(dress.img, -w / 2, -h / 2, w, h);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function addLook(dataUrl, label) {
  const id = `look-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  state.looks.unshift({ id, dataUrl, label });
  renderLooks();
  updateWorkspaceVisibility();
}

function renderLooks() {
  els.looksGallery.innerHTML = '';
  for (const look of state.looks) {
    const card = document.createElement('div');
    card.className = 'look-card';
    card.innerHTML = `
      <img src="${look.dataUrl}" alt="${look.label}" />
      <div class="look-actions">
        <span class="look-label">${look.label}</span>
        <a download="style-myself-look.png" href="${look.dataUrl}">Download</a>
        <button type="button" class="remove-look">Remove</button>
      </div>
    `;
    card.querySelector('.remove-look').addEventListener('click', () => {
      state.looks = state.looks.filter((l) => l.id !== look.id);
      renderLooks();
      updateWorkspaceVisibility();
    });
    els.looksGallery.appendChild(card);
  }
}

els.addToGallery.addEventListener('click', () => {
  const dataUrl = flattenLook();
  if (dataUrl) addLook(dataUrl, 'Quick Try-On');
});

// ---------- AI Blend ----------

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.aiEnabled = Boolean(data.aiEnabled);
  } catch (err) {
    state.aiEnabled = false;
  }
  els.aiHint.textContent = state.aiEnabled
    ? 'Sends your selfie and the selected dress photo to OpenAI to render a realistic composite.'
    : 'Not configured on this server (needs OPENAI_API_KEY) — Quick Try-On above still works fully offline.';
  els.runAiBlend.disabled = !state.aiEnabled;
}

els.runAiBlend.addEventListener('click', async () => {
  const dress = state.dresses.find((d) => d.id === state.activeDressId);
  if (!state.selfie || !dress) return;

  els.runAiBlend.disabled = true;
  showStatus(els.aiStatus, 'Generating — this can take up to a minute…');

  try {
    const res = await fetch('/api/tryon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selfie: state.selfie, dress: dress.dataUrl, styleNote: els.styleNote.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI Blend failed.');
    addLook(data.image, 'AI Blend');
    showStatus(els.aiStatus, 'Done — see it in Your looks below.', 'success');
  } catch (err) {
    showStatus(els.aiStatus, err.message, 'error');
  } finally {
    els.runAiBlend.disabled = !state.aiEnabled;
  }
});

loadStatus();
