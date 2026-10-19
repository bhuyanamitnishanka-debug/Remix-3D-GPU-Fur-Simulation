// Minimalist, XSS-safe DOM UI for GPU Grass Painter (Brush Radius/Strength/Softness, Blade Properties, Lighting)
// Strictly uses document.createElement and textContent for safe DOM construction.

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeHexColor(val, fallback) {
  if (typeof val === 'string' && HEX_COLOR_REGEX.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

export const GRASS_PRESETS = [
  {
    name: 'Spring Meadow',
    baseColor: '#14532d',
    tipColor: '#86efac',
    bladeHeight: 0.58,
    bladeDensity: 0.9,
    bladeBend: 0.46,
    roughness: 0.32,
    specular: 1.15,
    sunAngle: 42,
    sunIntensity: 1.45,
    rimIntensity: 1.35,
    windStrength: 1.05
  },
  {
    name: 'Golden Steppe',
    baseColor: '#5c3a11',
    tipColor: '#fde047',
    bladeHeight: 0.74,
    bladeDensity: 0.88,
    bladeBend: 0.62,
    roughness: 0.28,
    specular: 1.35,
    sunAngle: -48,
    sunIntensity: 1.55,
    rimIntensity: 1.6,
    windStrength: 1.45
  },
  {
    name: 'Cyber Grove',
    baseColor: '#0f172a',
    tipColor: '#38bdf8',
    bladeHeight: 0.52,
    bladeDensity: 0.95,
    bladeBend: 0.38,
    roughness: 0.2,
    specular: 1.65,
    sunAngle: 25,
    sunIntensity: 1.3,
    rimIntensity: 1.85,
    windStrength: 0.85
  },
  {
    name: 'Sakura Lawn',
    baseColor: '#4c1d95',
    tipColor: '#f9a8d4',
    bladeHeight: 0.48,
    bladeDensity: 0.92,
    bladeBend: 0.5,
    roughness: 0.3,
    specular: 1.25,
    sunAngle: 55,
    sunIntensity: 1.4,
    rimIntensity: 1.45,
    windStrength: 0.95
  }
];

export function createGrassUI(container, state, callbacks) {
  container.replaceChildren();

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
    mobileControlsBtn.setAttribute('aria-label', 'Open grass brush controls');
    mobileControlsBtn.setAttribute('aria-expanded', 'false');
    document.body.appendChild(mobileControlsBtn);
  }
  mobileControlsBtn.replaceChildren();

  const mobileBtnDot = document.createElement('span');
  mobileBtnDot.className = 'mobile-controls-btn-dot';

  const mobileBtnLabel = document.createElement('span');
  mobileBtnLabel.className = 'mobile-controls-btn-label';
  mobileBtnLabel.textContent = 'Controls';

  mobileControlsBtn.appendChild(mobileBtnDot);
  mobileControlsBtn.appendChild(mobileBtnLabel);

  const handleWrap = document.createElement('div');
  handleWrap.className = 'mobile-sheet-handle-wrap';
  handleWrap.setAttribute('aria-hidden', 'true');
  const handleBar = document.createElement('div');
  handleBar.className = 'mobile-sheet-handle';
  handleWrap.appendChild(handleBar);
  container.appendChild(handleWrap);

  const header = document.createElement('div');
  header.className = 'ui-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'ui-title-wrap';

  const dot = document.createElement('span');
  dot.className = 'ui-dot';

  const title = document.createElement('span');
  title.className = 'ui-title';
  title.textContent = 'GPU Grass Brush';

  titleWrap.appendChild(dot);
  titleWrap.appendChild(title);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'ui-toggle-btn';

  function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function setMobileSheetOpen(open) {
    const isOpen = Boolean(open);
    container.classList.toggle('mobile-sheet-open', isOpen);
    mobileBackdrop.classList.toggle('active', isOpen);
    document.body.classList.toggle('mobile-sheet-active', isOpen);
    if (isMobileViewport()) {
      toggleBtn.textContent = isOpen ? 'Done' : 'Controls';
      mobileControlsBtn.setAttribute('aria-expanded', String(isOpen));
    } else {
      const isCollapsed = container.classList.contains('collapsed');
      toggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
    }
  }

  toggleBtn.textContent = isMobileViewport() ? 'Done' : 'Hide';

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

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMobileViewport()) {
      setMobileSheetOpen(!container.classList.contains('mobile-sheet-open'));
      return;
    }
    const isCollapsed = container.classList.toggle('collapsed');
    toggleBtn.textContent = isCollapsed ? 'Show' : 'Hide';
  });

  header.appendChild(titleWrap);
  header.appendChild(toggleBtn);
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'ui-body';
  container.appendChild(body);

  const sliderRefs = {};
  const colorRefs = {};
  const modeButtons = {};

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
      callbacks.onChange(key, sanitized);
    });

    row.appendChild(labelRow);
    row.appendChild(input);
    parent.appendChild(row);

    sliderRefs[key] = { input, valSpan, formatFn };
  }

  // 1. Brush Settings Section
  const brushSection = addSection('Paint Brush Settings');

  const modeRow = document.createElement('div');
  modeRow.className = 'mode-row';

  const modes = [
    { id: 'grow', label: 'Grow' },
    { id: 'erase', label: 'Mow / Cut' },
    { id: 'comb', label: 'Comb' }
  ];

  for (const m of modes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mode-btn${state.brushMode === m.id ? ' active' : ''}`;
    btn.textContent = m.label;
    btn.addEventListener('click', () => {
      state.brushMode = m.id;
      Object.keys(modeButtons).forEach((k) => {
        modeButtons[k].classList.toggle('active', k === m.id);
      });
      callbacks.onChange('brushMode', m.id);
    });
    modeRow.appendChild(btn);
    modeButtons[m.id] = btn;
  }
  brushSection.appendChild(modeRow);

  addSlider(
    brushSection,
    'brushRadius',
    'Brush Radius',
    0.25,
    3.2,
    0.05,
    (v) => `${v.toFixed(2)} m`
  );
  addSlider(
    brushSection,
    'brushStrength',
    'Growth Flow Rate',
    0.08,
    1.0,
    0.02,
    (v) => `${Math.round(v * 100)}%`
  );
  addSlider(
    brushSection,
    'brushSoftness',
    'Edge Softness',
    0.1,
    1.0,
    0.02,
    (v) => `${Math.round(v * 100)}%`
  );

  const actionRow = document.createElement('div');
  actionRow.className = 'action-row';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'action-btn';
  clearBtn.textContent = 'Clear Dirt';
  clearBtn.addEventListener('click', () => callbacks.onClearDirt());

  const fillBtn = document.createElement('button');
  fillBtn.type = 'button';
  fillBtn.className = 'action-btn';
  fillBtn.textContent = 'Fill Meadow';
  fillBtn.addEventListener('click', () => callbacks.onFillMeadow());

  actionRow.appendChild(clearBtn);
  actionRow.appendChild(fillBtn);
  brushSection.appendChild(actionRow);

  // 2. Grass Blade & Shading Section
  const bladeSection = addSection('Grass & Physical Shading');
  addSlider(
    bladeSection,
    'bladeHeight',
    'Blade Height',
    0.15,
    1.2,
    0.02,
    (v) => `${Math.round(v * 100)} cm`
  );
  addSlider(
    bladeSection,
    'bladeDensity',
    'Blade Density',
    0.15,
    1.0,
    0.01,
    (v) => `${Math.round(v * 100)}% (${Math.round(v * 100)}k)`
  );
  addSlider(
    bladeSection,
    'bladeBend',
    'Blade Arch / Droop',
    0.0,
    1.0,
    0.02,
    (v) => `${Math.round(v * 100)}%`
  );

  const colorGrid = document.createElement('div');
  colorGrid.className = 'color-grid';

  function addColorPicker(key, labelText) {
    const cell = document.createElement('label');
    cell.className = 'color-cell';

    const span = document.createElement('span');
    span.textContent = labelText;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = sanitizeHexColor(state[key], '#86efac');
    picker.setAttribute('aria-label', labelText);

    picker.addEventListener('input', () => {
      const safeColor = sanitizeHexColor(picker.value, state[key]);
      state[key] = safeColor;
      callbacks.onChange(key, safeColor);
    });

    cell.appendChild(span);
    cell.appendChild(picker);
    colorGrid.appendChild(cell);
    colorRefs[key] = picker;
  }

  addColorPicker('baseColor', 'Root Color');
  addColorPicker('tipColor', 'Tip Color');
  bladeSection.appendChild(colorGrid);

  addSlider(
    bladeSection,
    'roughness',
    'Roughness',
    0.06,
    0.95,
    0.01,
    (v) => v.toFixed(2)
  );
  addSlider(
    bladeSection,
    'specular',
    'Specular Sheen',
    0.0,
    2.0,
    0.02,
    (v) => v.toFixed(2)
  );

  // 3. Sun Lighting & Wind Section
  const lightSection = addSection('Sun Lighting & Wind');
  addSlider(
    lightSection,
    'sunAngle',
    'Sun Direction',
    -180,
    180,
    1,
    (v) => `${Math.round(v)}°`
  );
  addSlider(
    lightSection,
    'sunIntensity',
    'Sun Intensity',
    0.2,
    2.5,
    0.05,
    (v) => v.toFixed(2)
  );
  addSlider(
    lightSection,
    'rimIntensity',
    'Sun Translucency',
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

  // 4. Quick Meadow Presets
  const presetRow = document.createElement('div');
  presetRow.className = 'preset-row';
  for (const preset of GRASS_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.textContent = preset.name;
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
        callbacks.onChange(k, preset[k]);
      });
    });
    presetRow.appendChild(btn);
  }
  lightSection.appendChild(presetRow);
}
