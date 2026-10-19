// Minimalist, XSS-safe Glassmorphic DOM UI for GPU Fur Simulation
// Features:
// 1. Primary Scene Selection Menu as a top-floating glass pill bar
// 2. Collapsible Materials & Lighting Settings panel on the side
// 3. Native Google Sans font typography with full fallbacks
// 4. Strict pure safe DOM construction with input sanitization

import { ENVIRONMENT_PRESETS, sanitizeEnvId } from './environments.js';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeHexColor(val, fallback) {
  if (typeof val === 'string' && HEX_COLOR_REGEX.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

export const FUR_PRESETS = [
  {
    name: 'Sakura Mochi',
    baseColor: '#5e2bff',
    tipColor: '#ff9ec7',
    furLength: 0.31,
    furDensity: 0.75,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.35,
    curliness: 0.23
  },
  {
    name: 'Golden Fluff',
    baseColor: '#7c3f14',
    tipColor: '#fde68a',
    furLength: 0.38,
    furDensity: 0.92,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.64,
    curliness: 0.58
  },
  {
    name: 'Midnight Velvet',
    baseColor: '#131638',
    tipColor: '#67e8f9',
    furLength: 0.29,
    furDensity: 0.95,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.44,
    curliness: 0.15
  },
  {
    name: 'Matcha Puff',
    baseColor: '#1e4631',
    tipColor: '#bbf7d0',
    furLength: 0.36,
    furDensity: 0.86,
    roughness: 0.77,
    specular: 0.24,
    clumping: 0.62,
    curliness: 0.72
  }
];

export function createMinimalUI(container, state, onChange) {
  // =========================================================================
  // 1. PRIMARY SCENE SELECTION MENU (TOP GLASS PILL BAR)
  // =========================================================================
  let sceneNav = document.getElementById('scene-nav');
  if (!sceneNav) {
    sceneNav = document.createElement('nav');
    sceneNav.id = 'scene-nav';
    sceneNav.className = 'scene-nav-bar';
    sceneNav.setAttribute('aria-label', 'Scene Selection');
    document.body.appendChild(sceneNav);
  }
  sceneNav.replaceChildren();

  const sceneButtons = {};

  for (const env of ENVIRONMENT_PRESETS) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'scene-pill';
    pill.setAttribute('data-env', env.id);
    pill.setAttribute('aria-label', `${env.name} · ${env.subtitle}`);
    const isCurrent = (state.environment || 'studio') === env.id;
    if (isCurrent) {
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
    } else {
      pill.setAttribute('aria-selected', 'false');
    }

    const dot = document.createElement('span');
    dot.className = 'scene-pill-dot';

    const label = document.createElement('span');
    label.className = 'scene-pill-label';
    label.textContent = env.name;

    pill.appendChild(dot);
    pill.appendChild(label);

    pill.addEventListener('click', () => {
      const safeEnv = sanitizeEnvId(env.id, 'studio');
      state.environment = safeEnv;
      updateEnvSelectionUI(safeEnv);
      onChange('environment', safeEnv);
    });

    sceneButtons[env.id] = pill;
    sceneNav.appendChild(pill);
  }

  // Divider + 1-Click WebGL / GPU Fur Toggle Pill in Top Floating Bar
  const navDivider = document.createElement('span');
  navDivider.className = 'scene-nav-divider';
  navDivider.setAttribute('aria-hidden', 'true');
  sceneNav.appendChild(navDivider);

  const topGpuFurPill = document.createElement('button');
  topGpuFurPill.type = 'button';
  topGpuFurPill.className = 'scene-pill gpu-fur-pill';
  topGpuFurPill.setAttribute('aria-label', 'Toggle between default WebGL Fur and full GPU Fur');

  const topGpuDot = document.createElement('span');
  topGpuDot.className = 'scene-pill-dot';

  const topGpuLabel = document.createElement('span');
  topGpuLabel.className = 'scene-pill-label';

  topGpuFurPill.appendChild(topGpuDot);
  topGpuFurPill.appendChild(topGpuLabel);
  sceneNav.appendChild(topGpuFurPill);

  // =========================================================================
  // 2. COLLAPSIBLE MATERIALS & LIGHTING SETTINGS PANEL (SIDE GLASS CARD ON DESKTOP, BOTTOM SHEET ON MOBILE)
  // =========================================================================
  container.replaceChildren();

  // Mobile Bottom Sheet Backdrop & Bottom Controls Trigger Button (hidden on desktop via CSS)
  let mobileBackdrop = document.getElementById('mobile-sheet-backdrop');
  if (!mobileBackdrop) {
    mobileBackdrop = document.createElement('div');
    mobileBackdrop.id = 'mobile-sheet-backdrop';
    mobileBackdrop.className = 'mobile-sheet-backdrop';
    mobileBackdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mobileBackdrop);
  }

  let mobileControlsBtn = document.getElementById('mobile-controls-btn');
  if (!mobileControlsBtn) {
    mobileControlsBtn = document.createElement('button');
    mobileControlsBtn.id = 'mobile-controls-btn';
    mobileControlsBtn.type = 'button';
    mobileControlsBtn.className = 'mobile-controls-btn';
    mobileControlsBtn.setAttribute('aria-label', 'Open simulation controls');
    mobileControlsBtn.setAttribute('aria-expanded', 'false');
    document.body.appendChild(mobileControlsBtn);
  }
  mobileControlsBtn.replaceChildren();

  const mobileBtnDot = document.createElement('span');
  mobileBtnDot.className = 'mobile-controls-btn-dot';

  const mobileBtnLabel = document.createElement('span');
  mobileBtnLabel.className = 'mobile-controls-btn-label';
  mobileBtnLabel.textContent = 'Controls';

  const mobileBtnSep = document.createElement('span');
  mobileBtnSep.className = 'mobile-controls-btn-sep';
  mobileBtnSep.setAttribute('aria-hidden', 'true');
  mobileBtnSep.textContent = '·';

  const mobileBtnScene = document.createElement('span');
  mobileBtnScene.className = 'mobile-controls-btn-scene';
  const currentPresetInit =
    ENVIRONMENT_PRESETS.find((e) => e.id === (state.environment || 'studio')) ||
    ENVIRONMENT_PRESETS[0];
  mobileBtnScene.textContent = currentPresetInit.name;

  mobileControlsBtn.appendChild(mobileBtnDot);
  mobileControlsBtn.appendChild(mobileBtnLabel);
  mobileControlsBtn.appendChild(mobileBtnSep);
  mobileControlsBtn.appendChild(mobileBtnScene);

  // Mobile sheet drag handle bar (hidden on desktop via CSS)
  const handleWrap = document.createElement('div');
  handleWrap.className = 'mobile-sheet-handle-wrap';
  handleWrap.setAttribute('aria-hidden', 'true');
  const handleBar = document.createElement('div');
  handleBar.className = 'mobile-sheet-handle';
  handleWrap.appendChild(handleBar);
  container.appendChild(handleWrap);

  // Glass Header Bar with Title and Collapse / Expand / Close toggle
  const header = document.createElement('div');
  header.className = 'ui-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'ui-title-wrap';

  const dot = document.createElement('span');
  dot.className = 'ui-dot';

  const title = document.createElement('span');
  title.className = 'ui-title';
  title.textContent = 'Materials & Lighting';

  titleWrap.appendChild(dot);
  titleWrap.appendChild(title);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'ui-toggle-btn';

  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function syncToggleBtnLabel() {
    if (isMobileViewport()) {
      const isOpen = container.classList.contains('mobile-sheet-open');
      toggleBtn.textContent = isOpen ? 'Done' : 'Controls';
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
      mobileControlsBtn.setAttribute('aria-expanded', String(isOpen));
    } else {
      const isCollapsed = container.classList.contains('collapsed');
      toggleBtn.textContent = isCollapsed ? 'Expand' : 'Collapse';
      toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
    }
  }

  function setMobileSheetOpen(open) {
    const isOpen = Boolean(open);
    container.classList.toggle('mobile-sheet-open', isOpen);
    mobileBackdrop.classList.toggle('active', isOpen);
    document.body.classList.toggle('mobile-sheet-active', isOpen);
    syncToggleBtnLabel();
  }

  toggleBtn.setAttribute('aria-label', 'Toggle settings panel');
  syncToggleBtnLabel();

  mobileControlsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMobileSheetOpen(true);
  });

  mobileBackdrop.addEventListener('click', (e) => {
    e.stopPropagation();
    setMobileSheetOpen(false);
  });

  handleWrap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMobileViewport()) {
      setMobileSheetOpen(false);
    }
  });

  // Support downward swipe gesture on the drag handle / header to dismiss the bottom sheet on mobile
  let touchStartY = null;
  function onSheetTouchStart(e) {
    if (!isMobileViewport()) return;
    if (e.touches && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  }
  function onSheetTouchEnd(e) {
    if (touchStartY === null || !isMobileViewport()) return;
    if (e.changedTouches && e.changedTouches.length === 1) {
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (deltaY > 36) {
        setMobileSheetOpen(false);
      }
    }
    touchStartY = null;
  }
  handleWrap.addEventListener('touchstart', onSheetTouchStart, { passive: true });
  handleWrap.addEventListener('touchend', onSheetTouchEnd, { passive: true });
  header.addEventListener('touchstart', onSheetTouchStart, { passive: true });
  header.addEventListener('touchend', onSheetTouchEnd, { passive: true });

  window.addEventListener('resize', () => {
    if (!isMobileViewport() && container.classList.contains('mobile-sheet-open')) {
      setMobileSheetOpen(false);
    } else {
      syncToggleBtnLabel();
    }
  });

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMobileViewport()) {
      const nextOpen = !container.classList.contains('mobile-sheet-open');
      setMobileSheetOpen(nextOpen);
      return;
    }
    const isCollapsed = container.classList.toggle('collapsed');
    toggleBtn.textContent = isCollapsed ? 'Expand' : 'Collapse';
    toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
  });

  header.addEventListener('click', () => {
    if (isMobileViewport()) {
      return;
    }
    if (container.classList.contains('collapsed')) {
      container.classList.remove('collapsed');
      toggleBtn.textContent = 'Collapse';
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
  });

  header.appendChild(titleWrap);
  header.appendChild(toggleBtn);
  container.appendChild(header);

  // Body container that collapses smoothly
  const body = document.createElement('div');
  body.className = 'ui-body';
  container.appendChild(body);

  const sliderRefs = {};
  const colorRefs = {};
  const mobileSceneButtons = {};

  function addSection(titleText) {
    const sec = document.createElement('section');
    sec.className = 'ui-section';
    const h = document.createElement('div');
    h.className = 'ui-section-title';
    h.textContent = titleText;
    sec.appendChild(h);
    body.appendChild(sec);
    return sec;
  }

  // --- Mobile-Only Section: Scene Selection inside the Bottom Sheet ---
  const mobileSceneSection = addSection('Scene Selection');
  mobileSceneSection.classList.add('mobile-scene-section');

  const mobileSceneGrid = document.createElement('div');
  mobileSceneGrid.className = 'preset-grid mobile-scene-grid';

  for (const env of ENVIRONMENT_PRESETS) {
    const mBtn = document.createElement('button');
    mBtn.type = 'button';
    mBtn.className = 'preset-btn mobile-scene-btn';
    mBtn.setAttribute('data-env', env.id);
    mBtn.setAttribute('aria-label', `${env.name} · ${env.subtitle}`);
    const isCur = (state.environment || 'studio') === env.id;
    if (isCur) {
      mBtn.classList.add('active');
      mBtn.setAttribute('aria-selected', 'true');
    } else {
      mBtn.setAttribute('aria-selected', 'false');
    }

    const mDot = document.createElement('span');
    mDot.className = 'scene-pill-dot';

    const mLabel = document.createElement('span');
    mLabel.className = 'preset-label';
    mLabel.textContent = env.name;

    mBtn.appendChild(mDot);
    mBtn.appendChild(mLabel);

    mBtn.addEventListener('click', () => {
      const safeEnv = sanitizeEnvId(env.id, 'studio');
      state.environment = safeEnv;
      updateEnvSelectionUI(safeEnv);
      onChange('environment', safeEnv);
    });

    mobileSceneButtons[env.id] = mBtn;
    mobileSceneGrid.appendChild(mBtn);
  }
  mobileSceneSection.appendChild(mobileSceneGrid);

  function addSlider(parent, key, labelText, min, max, step, formatFn) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'control-label-row';

    const lbl = document.createElement('span');
    lbl.className = 'control-label';
    lbl.textContent = labelText;

    const valSpan = document.createElement('span');
    valSpan.className = 'control-val';
    valSpan.textContent = formatFn(state[key]);

    labelRow.appendChild(lbl);
    labelRow.appendChild(valSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(state[key]);
    input.setAttribute('aria-label', labelText);

    input.addEventListener('input', () => {
      const sanitized = clampNumber(input.value, min, max, state[key]);
      state[key] = sanitized;
      valSpan.textContent = formatFn(sanitized);
      onChange(key, sanitized);
    });

    row.appendChild(labelRow);
    row.appendChild(input);
    parent.appendChild(row);

    sliderRefs[key] = { input, valSpan, formatFn };
  }

  // --- Section 1: Quick Presets ---
  const presetSection = addSection('Quick Presets');
  const presetGrid = document.createElement('div');
  presetGrid.className = 'preset-grid';

  for (const preset of FUR_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';

    const pDot = document.createElement('span');
    pDot.className = 'preset-dot';
    pDot.style.background = `linear-gradient(135deg, ${preset.tipColor} 0%, ${preset.baseColor} 100%)`;

    const pLabel = document.createElement('span');
    pLabel.className = 'preset-label';
    pLabel.textContent = preset.name;

    btn.appendChild(pDot);
    btn.appendChild(pLabel);

    btn.addEventListener('click', () => {
      Object.keys(preset).forEach((k) => {
        if (k === 'name') return;
        state[k] = preset[k];
        if (sliderRefs[k]) {
          sliderRefs[k].input.value = String(preset[k]);
          sliderRefs[k].valSpan.textContent = sliderRefs[k].formatFn(preset[k]);
        }
        if (colorRefs[k]) {
          colorRefs[k].value = preset[k];
        }
        onChange(k, preset[k]);
      });
    });
    presetGrid.appendChild(btn);
  }
  presetSection.appendChild(presetGrid);

  // --- Section 2: Coat Materials (Geometry & Clumping) ---
  const geoSection = addSection('Coat Materials');

  const engineModeRow = document.createElement('div');
  engineModeRow.className = 'dpr-selector-row engine-mode-row';

  const gpuFurModeBtn = document.createElement('button');
  gpuFurModeBtn.type = 'button';
  gpuFurModeBtn.className = 'dpr-pill-btn engine-mode-btn';
  gpuFurModeBtn.textContent = 'WebGPU (Default)';
  gpuFurModeBtn.setAttribute('aria-label', 'Switch to default 60k WebGPU Fur and GPGPU physics');

  const webglModeBtn = document.createElement('button');
  webglModeBtn.type = 'button';
  webglModeBtn.className = 'dpr-pill-btn engine-mode-btn';
  webglModeBtn.textContent = 'WebGL';
  webglModeBtn.setAttribute('aria-label', 'Switch to lightweight WebGL Fur fallback mode');

  engineModeRow.appendChild(gpuFurModeBtn);
  engineModeRow.appendChild(webglModeBtn);
  geoSection.appendChild(engineModeRow);

  addSlider(
    geoSection,
    'furLength',
    'Fur Length',
    0.06,
    0.62,
    0.01,
    (v) => `${(v * 2.0).toFixed(2)}" (${Math.round(v * 50.8)} mm)`
  );
  addSlider(
    geoSection,
    'furDensity',
    'Fur Density',
    0.12,
    1.0,
    0.01,
    (v) =>
      state.gpuFurEnabled
        ? `${Math.round(v * 100)}% (${Math.round(v * 60)}k)`
        : `${Math.round(v * 100)}% (WebGL)`
  );
  addSlider(
    geoSection,
    'curliness',
    'Curl / Waviness',
    0.0,
    1.0,
    0.01,
    (v) => `${Math.round(v * 100)}%`
  );
  addSlider(
    geoSection,
    'clumping',
    'Tuft Clumping',
    0.0,
    1.0,
    0.01,
    (v) => `${Math.round(v * 100)}%`
  );

  // --- Section 3: Physical Hair Shading ---
  const shadingSection = addSection('Physical Hair Shading');

  const colorGrid = document.createElement('div');
  colorGrid.className = 'color-grid';

  function addColorPicker(key, labelText) {
    const cell = document.createElement('label');
    cell.className = 'color-cell';

    const span = document.createElement('span');
    span.textContent = labelText;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = sanitizeHexColor(state[key], '#ff9ec7');
    picker.setAttribute('aria-label', labelText);

    picker.addEventListener('input', () => {
      const safeColor = sanitizeHexColor(picker.value, state[key]);
      state[key] = safeColor;
      onChange(key, safeColor);
    });

    cell.appendChild(span);
    cell.appendChild(picker);
    colorGrid.appendChild(cell);
    colorRefs[key] = picker;
  }

  addColorPicker('baseColor', 'Root Color');
  addColorPicker('tipColor', 'Tip Color');
  shadingSection.appendChild(colorGrid);

  addSlider(
    shadingSection,
    'roughness',
    'Roughness',
    0.06,
    0.95,
    0.01,
    (v) => v.toFixed(2)
  );
  addSlider(
    shadingSection,
    'specular',
    'Specular',
    0.0,
    2.0,
    0.02,
    (v) => v.toFixed(2)
  );

  // --- Section 4: Studio Lighting & Wind ---
  const lightSection = addSection('Lighting & Wind');

  const keyColorCell = document.createElement('label');
  keyColorCell.className = 'color-cell';
  keyColorCell.style.marginBottom = '9px';

  const keyColorSpan = document.createElement('span');
  keyColorSpan.textContent = 'Key Light Color';

  const keyColorPicker = document.createElement('input');
  keyColorPicker.type = 'color';
  keyColorPicker.value = sanitizeHexColor(state.keyColor, '#fff7ed');
  keyColorPicker.setAttribute('aria-label', 'Key Light Color');

  keyColorPicker.addEventListener('input', () => {
    const safeColor = sanitizeHexColor(keyColorPicker.value, state.keyColor || '#fff7ed');
    state.keyColor = safeColor;
    onChange('keyColor', safeColor);
  });

  keyColorCell.appendChild(keyColorSpan);
  keyColorCell.appendChild(keyColorPicker);
  lightSection.appendChild(keyColorCell);
  colorRefs.keyColor = keyColorPicker;

  addSlider(
    lightSection,
    'lightAngle',
    'Key Light Angle',
    -180,
    180,
    1,
    (v) => `${Math.round(v)}°`
  );
  addSlider(
    lightSection,
    'lightIntensity',
    'Key Intensity',
    0.2,
    2.5,
    0.05,
    (v) => v.toFixed(2)
  );
  addSlider(
    lightSection,
    'rimIntensity',
    'Rim Scatter',
    0.0,
    2.5,
    0.05,
    (v) => v.toFixed(2)
  );
  addSlider(
    lightSection,
    'windStrength',
    'Wind Breeze',
    0.0,
    2.5,
    0.05,
    (v) => v.toFixed(2)
  );

  // --- Section 5: Recording & Performance (Hidden per user preference; Retina enabled by default) ---
  const perfSection = addSection('Recording & Performance');
  perfSection.style.display = 'none';
  perfSection.setAttribute('aria-hidden', 'true');

  let recordModeActive = false;
  const recordBtn = document.createElement('button');
  recordBtn.type = 'button';
  recordBtn.className = 'action-btn perf-toggle-btn';
  recordBtn.textContent = '⏺ Record Mode (60 FPS): OFF';
  recordBtn.setAttribute('aria-label', 'Toggle 60 FPS recording optimization');

  recordBtn.addEventListener('click', () => {
    recordModeActive = !recordModeActive;
    recordBtn.textContent = recordModeActive ? '⏺ Record Mode: 60 FPS ON' : '⏺ Record Mode (60 FPS): OFF';
    recordBtn.classList.toggle('active', recordModeActive);
    onChange('toggleRecordMode', recordModeActive);
  });
  perfSection.appendChild(recordBtn);

  const dprRow = document.createElement('div');
  dprRow.className = 'dpr-selector-row';

  const dprOptions = [
    { label: '1x (Fast/Record)', val: '1x' },
    { label: '1.5x', val: '1.5x' },
    { label: '2x (Retina)', val: '2x' }
  ];
  const dprButtons = {};

  dprOptions.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dpr-pill-btn';
    btn.textContent = opt.label;
    if (opt.val === '2x') btn.classList.add('active');
    btn.addEventListener('click', () => {
      Object.values(dprButtons).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange('setDPR', opt.val);
    });
    dprButtons[opt.val] = btn;
    dprRow.appendChild(btn);
  });
  perfSection.appendChild(dprRow);

  let autoGuardActive = true;
  const autoGuardBtn = document.createElement('button');
  autoGuardBtn.type = 'button';
  autoGuardBtn.className = 'action-btn active';
  autoGuardBtn.textContent = '🛡 Auto-Protect 60 FPS: ON';
  autoGuardBtn.addEventListener('click', () => {
    autoGuardActive = !autoGuardActive;
    autoGuardBtn.textContent = autoGuardActive ? '🛡 Auto-Protect 60 FPS: ON' : '🛡 Auto-Protect 60 FPS: OFF';
    autoGuardBtn.classList.toggle('active', autoGuardActive);
    onChange('toggleAutoFPSGuard', autoGuardActive);
  });
  perfSection.appendChild(autoGuardBtn);

  // --- Section 6: AR Camera Controls (Active only in AR Mode) ---
  const arSection = addSection('AR Camera Controls');
  arSection.className = 'ui-section ar-section';
  arSection.style.display = (state.environment === 'ar') ? 'block' : 'none';

  const arControlsWrap = document.createElement('div');
  arControlsWrap.className = 'ar-controls-wrap';

  const arStatusRow = document.createElement('div');
  arStatusRow.className = 'ar-status-row';

  const arStatusDot = document.createElement('span');
  arStatusDot.className = 'ar-status-dot';

  const arStatusText = document.createElement('span');
  arStatusText.className = 'ar-status-text';
  arStatusText.textContent = 'Ready for AR Camera';

  arStatusRow.appendChild(arStatusDot);
  arStatusRow.appendChild(arStatusText);
  arControlsWrap.appendChild(arStatusRow);

  const arPlaneRow = document.createElement('div');
  arPlaneRow.className = 'ar-plane-row';

  const arPlaneInfo = document.createElement('div');
  arPlaneInfo.className = 'ar-plane-info';

  const arPlaneDot = document.createElement('span');
  arPlaneDot.className = 'ar-plane-dot';

  const arPlaneText = document.createElement('span');
  arPlaneText.className = 'ar-plane-text';
  arPlaneText.textContent = 'Estimating plane from video...';

  arPlaneInfo.appendChild(arPlaneDot);
  arPlaneInfo.appendChild(arPlaneText);

  const arPlaneBadge = document.createElement('span');
  arPlaneBadge.className = 'ar-plane-badge';
  arPlaneBadge.textContent = '0 pts';

  arPlaneRow.appendChild(arPlaneInfo);
  arPlaneRow.appendChild(arPlaneBadge);
  arControlsWrap.appendChild(arPlaneRow);

  const arLightRow = document.createElement('div');
  arLightRow.className = 'ar-plane-row';

  const arLightInfo = document.createElement('div');
  arLightInfo.className = 'ar-plane-info';

  const arLightDot = document.createElement('span');
  arLightDot.className = 'ar-plane-dot';
  arLightDot.style.background = '#fffdf7';
  arLightDot.style.boxShadow = '0 0 6px rgba(253, 224, 71, 0.8)';

  const arLightText = document.createElement('span');
  arLightText.className = 'ar-plane-text';
  arLightText.textContent = 'Light Est: 5200K · 100% · -32°';

  arLightInfo.appendChild(arLightDot);
  arLightInfo.appendChild(arLightText);

  const arLightBadge = document.createElement('span');
  arLightBadge.className = 'ar-plane-badge';
  arLightBadge.textContent = '#fffdf7';

  arLightRow.appendChild(arLightInfo);
  arLightRow.appendChild(arLightBadge);
  arControlsWrap.appendChild(arLightRow);

  const arActionRow = document.createElement('div');
  arActionRow.className = 'action-row';

  let tapPlaceActive = true;
  const tapPlaceBtn = document.createElement('button');
  tapPlaceBtn.type = 'button';
  tapPlaceBtn.className = 'action-btn active';
  tapPlaceBtn.textContent = 'Tap to Place: ON';
  tapPlaceBtn.addEventListener('click', () => {
    tapPlaceActive = !tapPlaceActive;
    tapPlaceBtn.textContent = tapPlaceActive ? 'Tap to Place: ON' : 'Tap to Place: OFF';
    tapPlaceBtn.classList.toggle('active', tapPlaceActive);
    onChange('arToggleTapPlace', tapPlaceActive);
  });

  let lightEstActive = true;
  const lightEstBtn = document.createElement('button');
  lightEstBtn.type = 'button';
  lightEstBtn.className = 'action-btn active';
  lightEstBtn.textContent = 'Light Est: ON';
  lightEstBtn.addEventListener('click', () => {
    lightEstActive = !lightEstActive;
    lightEstBtn.textContent = lightEstActive ? 'Light Est: ON' : 'Light Est: OFF';
    lightEstBtn.classList.toggle('active', lightEstActive);
    onChange('arToggleLightEst', lightEstActive);
  });

  const resetPosBtn = document.createElement('button');
  resetPosBtn.type = 'button';
  resetPosBtn.className = 'action-btn';
  resetPosBtn.textContent = 'Reset';
  resetPosBtn.addEventListener('click', () => {
    onChange('arResetPosition', true);
  });

  arActionRow.appendChild(tapPlaceBtn);
  arActionRow.appendChild(lightEstBtn);
  arActionRow.appendChild(resetPosBtn);
  arControlsWrap.appendChild(arActionRow);

  const arBtnRow = document.createElement('div');
  arBtnRow.className = 'action-row';

  const mirrorBtn = document.createElement('button');
  mirrorBtn.type = 'button';
  mirrorBtn.className = 'action-btn';
  mirrorBtn.textContent = 'Mirror: ON';
  mirrorBtn.addEventListener('click', () => {
    onChange('arToggleMirror', true);
  });

  const flipBtn = document.createElement('button');
  flipBtn.type = 'button';
  flipBtn.className = 'action-btn';
  flipBtn.textContent = 'Flip / Retry Cam';
  flipBtn.addEventListener('click', () => {
    onChange('arFlipCamera', true);
  });

  arBtnRow.appendChild(mirrorBtn);
  arBtnRow.appendChild(flipBtn);
  arControlsWrap.appendChild(arBtnRow);
  arSection.appendChild(arControlsWrap);

  function updateGPUFurModeUI(isGpuFur) {
    const enabled = Boolean(isGpuFur);
    state.gpuFurEnabled = enabled;

    topGpuFurPill.classList.toggle('active', enabled);
    topGpuFurPill.setAttribute('aria-pressed', String(enabled));
    topGpuLabel.textContent = enabled ? 'WebGPU Fur: ON' : 'WebGL Mode: ON';

    webglModeBtn.classList.toggle('active', !enabled);
    webglModeBtn.setAttribute('aria-pressed', String(!enabled));
    gpuFurModeBtn.classList.toggle('active', enabled);
    gpuFurModeBtn.setAttribute('aria-pressed', String(enabled));

    if (sliderRefs.furDensity) {
      sliderRefs.furDensity.valSpan.textContent = sliderRefs.furDensity.formatFn(state.furDensity);
    }
  }

  topGpuFurPill.addEventListener('click', () => {
    const next = !state.gpuFurEnabled;
    updateGPUFurModeUI(next);
    onChange('toggleGPUFur', next);
  });

  webglModeBtn.addEventListener('click', () => {
    if (state.gpuFurEnabled) {
      updateGPUFurModeUI(false);
      onChange('toggleGPUFur', false);
    }
  });

  gpuFurModeBtn.addEventListener('click', () => {
    if (!state.gpuFurEnabled) {
      updateGPUFurModeUI(true);
      onChange('toggleGPUFur', true);
    }
  });

  updateGPUFurModeUI(Boolean(state.gpuFurEnabled));

  function updateEnvSelectionUI(activeId) {
    const safeId = sanitizeEnvId(activeId, 'studio');
    Object.keys(sceneButtons).forEach((id) => {
      const isSel = id === safeId;
      sceneButtons[id].classList.toggle('active', isSel);
      sceneButtons[id].setAttribute('aria-selected', String(isSel));
    });
    Object.keys(mobileSceneButtons).forEach((id) => {
      const isSel = id === safeId;
      mobileSceneButtons[id].classList.toggle('active', isSel);
      mobileSceneButtons[id].setAttribute('aria-selected', String(isSel));
    });
    const matchedPreset = ENVIRONMENT_PRESETS.find((e) => e.id === safeId);
    if (matchedPreset && mobileBtnScene) {
      mobileBtnScene.textContent = matchedPreset.name;
    }
    if (arSection) {
      arSection.style.display = safeId === 'ar' ? 'block' : 'none';
    }
  }

  return {
    syncUI() {
      Object.keys(sliderRefs).forEach((k) => {
        sliderRefs[k].input.value = String(state[k]);
        sliderRefs[k].valSpan.textContent = sliderRefs[k].formatFn(state[k]);
      });
      Object.keys(colorRefs).forEach((k) => {
        colorRefs[k].value = state[k];
      });
      updateEnvSelectionUI(state.environment || 'studio');
      updateGPUFurModeUI(Boolean(state.gpuFurEnabled));
    },
    setGPUFurEnabled(enabled) {
      updateGPUFurModeUI(Boolean(enabled));
    },
    setActiveEnvironment(envId) {
      const safeEnv = sanitizeEnvId(envId, 'studio');
      state.environment = safeEnv;
      updateEnvSelectionUI(safeEnv);
    },
    setARStatus(statusText, isLive) {
      arStatusText.textContent = String(statusText || '');
      arStatusDot.classList.toggle('live', Boolean(isLive));
    },
    setARPlaneStatus(surfaceType, planeY, confidence, featureCount) {
      const confPct = Math.round((confidence || 0.9) * 100);
      arPlaneText.textContent = `${surfaceType} (${confPct}% conf)`;
      arPlaneBadge.textContent = `${featureCount || 0} pts`;
    },
    setARLightStatus(lightInfo) {
      if (!lightInfo) return;
      const safeHex = sanitizeHexColor(lightInfo.keyColor, '#fffdf7');
      if (lightInfo.isManualReset) {
        arLightDot.style.background = '#94a3b8';
        arLightDot.style.boxShadow = 'none';
        arLightText.textContent = 'Light Est: OFF (Manual Studio Light)';
        arLightBadge.textContent = 'MANUAL';
      } else {
        arLightDot.style.background = safeHex;
        arLightDot.style.boxShadow = `0 0 8px ${safeHex}`;
        arLightText.textContent = `Webcam Light: ${lightInfo.kelvin || 5200}K · ${lightInfo.luminancePct || 100}% · ${Math.round(lightInfo.lightAngle || 0)}°`;
        arLightBadge.textContent = safeHex;
      }
      if (colorRefs.keyColor) {
        colorRefs.keyColor.value = safeHex;
      }
      ['lightAngle', 'lightIntensity', 'rimIntensity'].forEach((k) => {
        if (sliderRefs[k] && state[k] !== undefined) {
          sliderRefs[k].input.value = String(state[k]);
          sliderRefs[k].valSpan.textContent = sliderRefs[k].formatFn(state[k]);
        }
      });
    },
    setLightEstActive(isActive) {
      lightEstActive = Boolean(isActive);
      lightEstBtn.textContent = lightEstActive ? 'Light Est: ON' : 'Light Est: OFF';
      lightEstBtn.classList.toggle('active', lightEstActive);
    },
    setSurfaceTrackedStatus(isLocked, confidence) {
      if (isLocked) {
        arPlaneDot.style.background = '#4ade80';
        arPlaneDot.style.boxShadow = '0 0 6px rgba(74, 222, 128, 0.8)';
        arPlaneBadge.textContent = `${confidence}% lock`;
        arPlaneBadge.style.color = '#86efac';
        arPlaneBadge.style.borderColor = '#4ade80';
      } else {
        arPlaneDot.style.background = '#38bdf8';
        arPlaneDot.style.boxShadow = '0 0 6px rgba(56, 189, 248, 0.7)';
        arPlaneBadge.style.color = '#7dd3fc';
        arPlaneBadge.style.borderColor = 'rgba(56, 189, 248, 0.35)';
      }
    },
    setTapPlaceActive(isActive) {
      tapPlaceActive = Boolean(isActive);
      tapPlaceBtn.textContent = tapPlaceActive ? 'Tap to Place: ON' : 'Tap to Place: OFF';
      tapPlaceBtn.classList.toggle('active', tapPlaceActive);
    },
    setMirrorLabel(isMirrored) {
      mirrorBtn.textContent = isMirrored ? 'Mirror: ON' : 'Mirror: OFF';
    }
  };
}
