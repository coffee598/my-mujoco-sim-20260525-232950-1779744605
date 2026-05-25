import * as THREE from 'three';
import { Reflector  } from './utils/Reflector.js';
import { MuJoCoDemo } from './main.js';

export async function reloadFunc() {
  // Delete the old scene and load the new scene
  this.scene.remove(this.scene.getObjectByName("MuJoCo Root"));
  [this.model, this.data, this.bodies, this.lights] =
    await loadSceneFromURL(this.mujoco, this.params.scene, this);
  this.mujoco.mj_forward(this.model, this.data);
  for (let i = 0; i < this.updateGUICallbacks.length; i++) {
    this.updateGUICallbacks[i](this.model, this.data, this.params);
  }
}

/** @param {MuJoCoDemo} parentContext*/
export function setupGUI(parentContext) {

  // Reset callbacks & camera
  parentContext.updateGUICallbacks.length = 0;
  parentContext.updateGUICallbacks.push((model, data, params) => {
    parentContext.camera.position.set(2.0, 1.7, 1.7);
    parentContext.controls.target.set(0, 0.7, 0);
    parentContext.controls.update();
  });

  // Hide default lil-gui
  if (parentContext.gui && parentContext.gui.domElement) {
    parentContext.gui.domElement.style.display = 'none';
  }

  let reload = reloadFunc.bind(parentContext);

  // Build scene options
  let sceneOptions = {};
  if (parentContext.sceneFiles && parentContext.sceneFiles.length > 0) {
    for (let f of parentContext.sceneFiles) {
      let label = f.replace('.xml','').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
      sceneOptions[label] = f;
    }
  } else {
    let f = parentContext.params.scene;
    let label = f.replace('.xml','').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
    sceneOptions[label] = f;
  }

  // ── Inject demo5-style CSS ───────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    *,*::before,*::after{box-sizing:border-box}
    .lil-gui,.lil-gui.root,.gui-custom-header{display:none!important}
    #roba-ctrl-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 272px; z-index: 9999;
      display: flex; flex-direction: column;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 12px; color: #e2e8f0;
      background: #14161e;
      border-left: 1px solid #1e2230;
      transition: width 0.35s ease;
    }
    #roba-ctrl-panel.d5-collapsed { width: 40px; overflow: hidden; }
    /* body wrap — scaleY collapse (bottom-to-top) */
    #rcp-body-wrap {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
      transform-origin: top center;
      transition: transform 0.35s ease, opacity 0.28s ease;
    }
    #roba-ctrl-panel.rcp-body-collapsing #rcp-body-wrap {
      transform: scaleY(0); opacity: 0;
    }

    /* ── Panel header (title bar + collapse btn) ── */
    #rcp-panel-head {
      flex-shrink: 0; height: 48px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 12px; border-bottom: 1px solid #1e2230;
      background: #0c0e12;
    }
    #rcp-panel-head .rcp-head-left { display: flex; align-items: center; gap: 8px; overflow: hidden; }
    .rcp-logo {
      width: 28px; height: 28px; flex-shrink: 0;
      border-radius: 7px; display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .rcp-panel-title { font-size: 12px; font-weight: 700; color: #e2e8f0; white-space: nowrap; }
    .rcp-panel-sub   { font-size: 10px; color: #4a5568; white-space: nowrap; }
    #rcp-sidebar-toggle {
      width: 26px; height: 26px; flex-shrink: 0;
      background: #1e2230; border: 1px solid #2a2f3d;
      border-radius: 6px; color: #a0aec0; font-size: 13px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all .15s;
    }
    #rcp-sidebar-toggle:hover { background: #252938; color: #e2e8f0; }

    /* ── Status bar ── */
    #rcp-status-bar {
      flex-shrink: 0; display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid #1e2230;
      background: #0c0e12;
    }
    .rcp-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .rcp-dot.green { background: #34d399; box-shadow: 0 0 7px rgba(52,211,153,.6); animation: rcpPulse 2s infinite; }
    .rcp-dot.amber { background: #fbbf24; box-shadow: 0 0 7px rgba(251,191,36,.6); }
    .rcp-dot.red   { background: #f87171; box-shadow: 0 0 7px rgba(248,113,113,.6); }
    @keyframes rcpPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
    #rcp-status { font-size: 11px; font-weight: 600; color: #e2e8f0; }
    #rcp-model-badge {
      margin-left: auto; font-size: 10px; padding: 2px 8px;
      background: rgba(96,165,250,.1); color: #60a5fa;
      border: 1px solid rgba(96,165,250,.2); border-radius: 20px;
      font-weight: 600; max-width: 110px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* ── Scrollable body ── */
    #rcp-scroll {
      flex: 1; overflow-y: auto; padding: 10px 10px;
    }
    #rcp-scroll::-webkit-scrollbar { width: 4px; }
    #rcp-scroll::-webkit-scrollbar-thumb { background: #2a2f3d; border-radius: 2px; }

    /* ── Cards ── */
    .rcp-card {
      background: #1a1d27;
      border: 1px solid #2a2f3d;
      border-radius: 10px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .rcp-card-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 11px; cursor: pointer;
      border-bottom: 1px solid #2a2f3d;
      user-select: none;
    }
    .rcp-card-head:hover { background: #1e2230; }
    .rcp-card-head-left { display: flex; align-items: center; gap: 7px; }
    .rcp-cs-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1.2px; color: #4a5568;
    }
    .rcp-badge {
      font-size: 10px; padding: 1px 7px; border-radius: 20px;
      font-weight: 600;
    }
    .rcp-badge-green { background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.2); }
    .rcp-badge-blue  { background: rgba(96,165,250,.1);  color: #60a5fa; border: 1px solid rgba(96,165,250,.2); }
    .rcp-badge-purple{ background: rgba(167,139,250,.1); color: #a78bfa; border: 1px solid rgba(167,139,250,.2); }
    .rcp-chevron {
      font-size: 11px; color: #4a5568; transition: transform .2s;
    }
    .rcp-chevron.open { transform: rotate(0deg); }
    .rcp-chevron.closed { transform: rotate(-90deg); }
    .rcp-card-body { padding: 10px 11px; }
    .rcp-card-body.hidden { display: none; }

    /* ── Section label ── */
    .rcp-label { font-size: 10px; color: #718096; margin-bottom: 5px; }

    /* ── Select ── */
    .rcp-select {
      width: 100%; background: #1e2230; border: 1px solid #2a2f3d;
      color: #e2e8f0; border-radius: 8px; padding: 7px 10px;
      font-size: 12px; font-family: inherit;
      cursor: pointer; outline: none; appearance: none; margin-bottom: 10px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236366f1'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 9px center;
      transition: border-color .15s;
    }
    .rcp-select option { background: #14161e; }
    .rcp-select:hover { border-color: #3a3f52; }

    /* ── Buttons ── */
    .rcp-btn-row { display: flex; gap: 6px; margin-bottom: 8px; }
    .rcp-btn {
      flex: 1; padding: 7px 5px; border-radius: 8px;
      border: 1px solid #2a2f3d; background: #1e2230;
      color: #a0aec0; font-size: 11px; font-weight: 500; font-family: inherit;
      cursor: pointer; transition: all .15s;
      display: flex; align-items: center; justify-content: center; gap: 4px;
    }
    .rcp-btn:hover { background: #252938; border-color: #3a3f52; color: #e2e8f0; }
    .rcp-btn.success { background: rgba(52,211,153,.1); border-color: rgba(52,211,153,.3); color: #34d399; }
    .rcp-btn.success:hover { background: rgba(52,211,153,.18); }
    .rcp-btn.primary { background: rgba(99,102,241,.2); border-color: rgba(99,102,241,.4); color: #818cf8; }
    .rcp-btn.primary:hover { background: rgba(99,102,241,.3); border-color: #6366f1; color: #a5b4fc; }
    .rcp-btn.danger  { background: rgba(248,113,113,.1); border-color: rgba(248,113,113,.25); color: #f87171; }
    .rcp-btn.danger:hover  { background: rgba(248,113,113,.18); }
    .rcp-btn-full { width: 100%; margin-bottom: 6px; }

    /* ── Sliders ── */
    .rcp-field { margin-bottom: 10px; }
    .rcp-field:last-child { margin-bottom: 0; }
    .rcp-field-label {
      display: flex; justify-content: space-between;
      font-size: 10px; color: #718096; margin-bottom: 5px;
    }
    .rcp-field-label b { color: #a5b4fc; font-weight: 600; }
    input[type=range].rcp-range {
      width: 100%; height: 3px; -webkit-appearance: none;
      background: #2a2f3d; border-radius: 2px; outline: none; cursor: pointer;
    }
    input[type=range].rcp-range::-webkit-slider-thumb {
      -webkit-appearance: none; width: 13px; height: 13px;
      background: #6366f1; border-radius: 50%;
      cursor: grab; box-shadow: 0 0 0 2px rgba(99,102,241,.25);
    }

    /* ── Actuator rows ── */
    .rcp-act-row { display: flex; align-items: center; gap: 7px; padding: 5px 0; border-bottom: 1px solid #1e2230; }
    .rcp-act-row:last-child { border-bottom: none; }
    .rcp-act-name { font-size: 10px; color: #718096; width: 68px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rcp-act-val  { font-size: 10px; color: #6366f1; width: 32px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  `;
  document.head.appendChild(styleEl);

  // ── Helper: make collapsible card ───────────────────────────────────
  const makeCard = (labelText, badgeText, badgeClass, startOpen = true) => {
    const card = document.createElement('div');
    card.className = 'rcp-card';

    const head = document.createElement('div');
    head.className = 'rcp-card-head';

    const headLeft = document.createElement('div');
    headLeft.className = 'rcp-card-head-left';

    const lbl = document.createElement('span');
    lbl.className = 'rcp-cs-label';
    lbl.textContent = labelText;
    headLeft.appendChild(lbl);

    if (badgeText) {
      const badge = document.createElement('span');
      badge.className = 'rcp-badge ' + (badgeClass || 'rcp-badge-blue');
      badge.textContent = badgeText;
      headLeft.appendChild(badge);
    }
    head.appendChild(headLeft);

    const chev = document.createElement('span');
    chev.className = 'rcp-chevron ' + (startOpen ? 'open' : 'closed');
    chev.textContent = '▾';
    head.appendChild(chev);

    const body = document.createElement('div');
    body.className = 'rcp-card-body' + (startOpen ? '' : ' hidden');

    head.addEventListener('click', () => {
      const open = !body.classList.contains('hidden');
      body.classList.toggle('hidden', open);
      chev.className = 'rcp-chevron ' + (open ? 'closed' : 'open');
    });

    card.appendChild(head);
    card.appendChild(body);
    return { card, body, head, headLeft };
  };

  // ── Build panel ──────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'roba-ctrl-panel';

  // ── Panel header ─────────────────────────────────────────────────────
  const panelHead = document.createElement('div');
  panelHead.id = 'rcp-panel-head';
  panelHead.innerHTML = `
    <div class="rcp-head-left">
      <div class="rcp-logo"><img src="./assets/favicon.png" alt="logo" style="width:24px;height:24px;object-fit:contain"></div>
      <div>
        <div class="rcp-panel-title">RobaCtrl</div>
        <div class="rcp-panel-sub">MuJoCo Physics</div>
      </div>
    </div>`;
  const sidebarToggleBtn = document.createElement('button');
  sidebarToggleBtn.id = 'rcp-sidebar-toggle';
  sidebarToggleBtn.title = 'Collapse panel';
  sidebarToggleBtn.textContent = '◀';
  let panelCollapsed = false;
  sidebarToggleBtn.addEventListener('click', () => {
    panelCollapsed = !panelCollapsed;
    sidebarToggleBtn.disabled = true;
    if (panelCollapsed) {
      // Step 1: collapse body bottom-to-top (scaleY on top-origin)
      panel.classList.add('rcp-body-collapsing');
      setTimeout(() => {
        // Step 2: collapse width side-to-side
        panel.classList.add('d5-collapsed');
        sidebarToggleBtn.textContent = '▶';
        sidebarToggleBtn.title = 'Expand panel';
        setTimeout(() => { sidebarToggleBtn.disabled = false; }, 380);
      }, 380);
    } else {
      // Step 1: expand width side-to-side
      panel.classList.remove('d5-collapsed');
      setTimeout(() => {
        // Step 2: expand body top-to-bottom (scaleY restore)
        panel.classList.remove('rcp-body-collapsing');
        sidebarToggleBtn.textContent = '◀';
        sidebarToggleBtn.title = 'Collapse panel';
        setTimeout(() => { sidebarToggleBtn.disabled = false; }, 380);
      }, 380);
    }
  });
  panelHead.appendChild(sidebarToggleBtn);
  panel.appendChild(panelHead);

  // ── Status bar ───────────────────────────────────────────────────────
  const statusBar = document.createElement('div');
  statusBar.id = 'rcp-status-bar';
  statusBar.innerHTML = `
    <div class="rcp-dot green" id="rcp-dot"></div>
    <span id="rcp-status">Running</span>
    <span id="rcp-model-badge">—</span>`;
  const bodyWrap = document.createElement('div');
  bodyWrap.id = 'rcp-body-wrap';
  bodyWrap.appendChild(statusBar);

  // ── Scrollable body ──────────────────────────────────────────────────
  const scroll = document.createElement('div');
  scroll.id = 'rcp-scroll';
  bodyWrap.appendChild(scroll);
  panel.appendChild(bodyWrap);

  // ── Scene & Playback card ────────────────────────────────────────────
  const { card: cardCtrl, body: bodyCtrl } = makeCard('Scene & Playback', null, null, true);

  const sceneLabel = document.createElement('div');
  sceneLabel.className = 'rcp-label';
  sceneLabel.textContent = 'Scene';
  bodyCtrl.appendChild(sceneLabel);

  const sceneSelect = document.createElement('select');
  sceneSelect.className = 'rcp-select';
  for (const [label, val] of Object.entries(sceneOptions)) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (val === parentContext.params.scene) opt.selected = true;
    sceneSelect.appendChild(opt);
  }
  sceneSelect.addEventListener('change', () => {
    parentContext.params.scene = sceneSelect.value;
    reload();
  });
  bodyCtrl.appendChild(sceneSelect);

  const btnRow1 = document.createElement('div');
  btnRow1.className = 'rcp-btn-row';

  const playBtn = document.createElement('button');
  playBtn.className = 'rcp-btn success';
  playBtn.innerHTML = '⏸ Pause';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'rcp-btn';
  resetBtn.innerHTML = '↺ Reset';
  resetBtn.addEventListener('click', () => {
    parentContext.mujoco.mj_resetData(parentContext.model, parentContext.data);
    parentContext.mujoco.mj_forward(parentContext.model, parentContext.data);
  });

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'rcp-btn primary';
  reloadBtn.innerHTML = '⟳ Reload';
  reloadBtn.addEventListener('click', () => reload());

  btnRow1.appendChild(playBtn); btnRow1.appendChild(resetBtn); btnRow1.appendChild(reloadBtn);
  bodyCtrl.appendChild(btnRow1);

  const _updatePlayState = () => {
    const p = parentContext.params.paused;
    playBtn.innerHTML   = p ? '▶ Play'  : '⏸ Pause';
    playBtn.className   = p ? 'rcp-btn primary' : 'rcp-btn success';
    document.getElementById('rcp-dot').className    = 'rcp-dot ' + (p ? 'amber' : 'green');
    document.getElementById('rcp-status').textContent = p ? 'Paused' : 'Running';
  };
  playBtn.addEventListener('click', () => {
    parentContext.params.paused = !parentContext.params.paused;
    _updatePlayState();
  });

  // Keyframe slider
  const kfWrap = document.createElement('div');
  kfWrap.className = 'rcp-field';
  kfWrap.innerHTML = `<div class="rcp-field-label"><span>Keyframe</span><b id="rcp-kf-val">0</b></div>`;
  const kfSlider = document.createElement('input');
  kfSlider.type = 'range'; kfSlider.className = 'rcp-range';
  kfSlider.min = 0; kfSlider.max = Math.max(0, parentContext.model.nkey - 1);
  kfSlider.step = 1; kfSlider.value = 0;
  if (parentContext.model.nkey === 0) kfSlider.style.opacity = '0.35';
  kfSlider.addEventListener('input', () => {
    const v = parseInt(kfSlider.value);
    parentContext.params.keyframeNumber = v;
    document.getElementById('rcp-kf-val').textContent = v;
    if (v < parentContext.model.nkey) {
      parentContext.data.qpos.set(parentContext.model.key_qpos.slice(
        v * parentContext.model.nq, (v + 1) * parentContext.model.nq));
    }
  });
  kfWrap.appendChild(kfSlider);
  bodyCtrl.appendChild(kfWrap);
  scroll.appendChild(cardCtrl);

  parentContext.updateGUICallbacks.push((model) => {
    const nk = model.nkey;
    kfSlider.max = Math.max(0, nk - 1);
    kfSlider.value = 0;
    kfSlider.style.opacity = nk > 0 ? '1' : '0.35';
    document.getElementById('rcp-kf-val').textContent = '0';
  });

  // ── Simulation card ──────────────────────────────────────────────────
  const { card: cardSim, body: bodySim } = makeCard('Simulation', null, null, true);

  const nrWrap = document.createElement('div');
  nrWrap.className = 'rcp-field';
  nrWrap.innerHTML = `<div class="rcp-field-label"><span>Noise Rate</span><b id="rcp-nr-val">0.00</b></div>`;
  const nrSlider = document.createElement('input');
  nrSlider.type = 'range'; nrSlider.className = 'rcp-range';
  nrSlider.min = 0; nrSlider.max = 2; nrSlider.step = 0.01; nrSlider.value = 0;
  nrSlider.addEventListener('input', () => {
    parentContext.params.ctrlnoiserate = parseFloat(nrSlider.value);
    document.getElementById('rcp-nr-val').textContent = parseFloat(nrSlider.value).toFixed(2);
  });
  nrWrap.appendChild(nrSlider);
  bodySim.appendChild(nrWrap);

  const nsWrap = document.createElement('div');
  nsWrap.className = 'rcp-field';
  nsWrap.innerHTML = `<div class="rcp-field-label"><span>Noise Scale</span><b id="rcp-ns-val">0.00</b></div>`;
  const nsSlider = document.createElement('input');
  nsSlider.type = 'range'; nsSlider.className = 'rcp-range';
  nsSlider.min = 0; nsSlider.max = 2; nsSlider.step = 0.01; nsSlider.value = 0;
  nsSlider.addEventListener('input', () => {
    parentContext.params.ctrlnoisestd = parseFloat(nsSlider.value);
    document.getElementById('rcp-ns-val').textContent = parseFloat(nsSlider.value).toFixed(2);
  });
  nsWrap.appendChild(nsSlider);
  bodySim.appendChild(nsWrap);
  scroll.appendChild(cardSim);

  // ── Actuators card ───────────────────────────────────────────────────
  const { card: cardAct, body: bodyAct, headLeft: actHeadLeft } = makeCard('Actuators', '— act', 'rcp-badge-blue', true);
  const actCountBadge = actHeadLeft.querySelector('.rcp-badge');
  actCountBadge.id = 'rcp-act-count';
  const actList = document.createElement('div');
  actList.id = 'rcp-act-list';
  bodyAct.appendChild(actList);
  scroll.appendChild(cardAct);

  // ── Mount panel before buildActuators ───────────────────────────────
  document.body.appendChild(panel);

  // ── Build actuator rows ──────────────────────────────────────────────
  let textDecoder = new TextDecoder('utf-8');
  let nullChar    = textDecoder.decode(new ArrayBuffer(1));

  const buildActuators = (model, data) => {
    actList.innerHTML = '';
    const act_range = model.actuator_ctrlrange;
    let count = 0;
    for (let i = 0; i < model.nu; i++) {
      if (!model.actuator_ctrllimited[i]) continue;
      let name = textDecoder.decode(
        parentContext.model.names.subarray(
          parentContext.model.name_actuatoradr[i])).split(nullChar)[0];
      parentContext.params[name] = 0.0;
      count++;
      const row    = document.createElement('div');  row.className = 'rcp-act-row';
      const nameEl = document.createElement('div');  nameEl.className = 'rcp-act-name'; nameEl.title = name; nameEl.textContent = name;
      const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'rcp-range'; slider.style.flex = '1';
      slider.min = act_range[2*i]; slider.max = act_range[2*i+1]; slider.step = 0.01; slider.value = 0;
      const valEl  = document.createElement('div');  valEl.className = 'rcp-act-val'; valEl.textContent = '0.00';
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        data.ctrl[i] = v; parentContext.params[name] = v;
        valEl.textContent = v.toFixed(2);
      });
      row.appendChild(nameEl); row.appendChild(slider); row.appendChild(valEl);
      actList.appendChild(row);
    }
    document.getElementById('rcp-act-count').textContent = count + ' act';
    document.getElementById('rcp-model-badge').textContent = parentContext.params.scene.replace('.xml','');
  };

  buildActuators(parentContext.model, parentContext.data);

  parentContext.updateGUICallbacks.push((model, data, params) => {
    buildActuators(model, data);
    sceneSelect.value = params.scene;
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { parentContext.params.paused = !parentContext.params.paused; _updatePlayState(); e.preventDefault(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Backspace') {
      parentContext.mujoco.mj_resetData(parentContext.model, parentContext.data);
      parentContext.mujoco.mj_forward(parentContext.model, parentContext.data);
      e.preventDefault();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'KeyA') {
      parentContext.camera.position.set(2.0, 1.7, 1.7);
      parentContext.controls.target.set(0, 0.7, 0);
      parentContext.controls.update();
      e.preventDefault();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'KeyL') { reload(); e.preventDefault(); }
  });
}


/** Loads a scene for MuJoCo
 * @param {mujoco} mujoco This is a reference to the mujoco namespace object
 * @param {string} filename This is the name of the .xml file in the /working/ directory of the MuJoCo/Emscripten Virtual File System
 * @param {MuJoCoDemo} parent The three.js Scene Object to add the MuJoCo model elements to
 */
export async function loadSceneFromURL(mujoco, filename, parent) {
    // Free the old data.
    if (parent.data != null) {
      parent.data.delete();
      parent.model = null;
      parent.data  = null;
    }

    // Load in the state from XML.
    parent.model = mujoco.MjModel.loadFromXML("/working/"+filename);
    parent.data  = new mujoco.MjData(parent.model);

    let model = parent.model;
    let data = parent.data;

    // Decode the null-terminated string names.
    let textDecoder = new TextDecoder("utf-8");
    let names_array = new Uint8Array(model.names);
    let fullString = textDecoder.decode(model.names);
    let names = fullString.split(textDecoder.decode(new ArrayBuffer(1)));

    // Create the root object.
    let mujocoRoot = new THREE.Group();
    mujocoRoot.name = "MuJoCo Root";
    parent.scene.add(mujocoRoot);

    /** @type {Object.<number, THREE.Group>} */
    let bodies = {};
    /** @type {Object.<number, THREE.BufferGeometry>} */
    let meshes = {};
    /** @type {THREE.Light[]} */
    let lights = [];

    // Default material definition.
    let material = new THREE.MeshPhysicalMaterial();
    material.color = new THREE.Color(1, 1, 1);
    
    // Loop through the MuJoCo geoms and recreate them in three.js.
    for (let g = 0; g < model.ngeom; g++) {
      // Only visualize geom groups up to 2 (same default behavior as simulate).
      if (!(model.geom_group[g] < 3)) { continue; }

      // Get the body ID and type of the geom.
      let b    = model.geom_bodyid[g];
      let type = model.geom_type  [g];
      let size = [
        model.geom_size[(g*3) + 0],
        model.geom_size[(g*3) + 1],
        model.geom_size[(g*3) + 2]
      ];

      // Create the body if it doesn't exist.
      if (!(b in bodies)) {
        bodies[b] = new THREE.Group();
        
        let start_idx = model.name_bodyadr[b];
        let end_idx = start_idx;
        while (end_idx < names_array.length && names_array[end_idx] !== 0) {
          end_idx++;
        }
        let name_buffer = names_array.subarray(start_idx, end_idx);
        bodies[b].name = textDecoder.decode(name_buffer);
        
        bodies[b].bodyID = b;
        bodies[b].has_custom_mesh = false;
      }

      // Set the default geometry. In MuJoCo, this is a sphere.
      let geometry = new THREE.SphereGeometry(size[0] * 0.5);
      if (type == mujoco.mjtGeom.mjGEOM_PLANE.value) {
        // Special handling for plane later.
      } else if (type == mujoco.mjtGeom.mjGEOM_HFIELD.value) {
        // TODO: Implement this.
      } else if (type == mujoco.mjtGeom.mjGEOM_SPHERE.value) {
        geometry = new THREE.SphereGeometry(size[0]);
      } else if (type == mujoco.mjtGeom.mjGEOM_CAPSULE.value) {
        geometry = new THREE.CapsuleGeometry(size[0], size[1] * 2.0, 20, 20);
      } else if (type == mujoco.mjtGeom.mjGEOM_ELLIPSOID.value) {
        geometry = new THREE.SphereGeometry(1); // Stretch this below
      } else if (type == mujoco.mjtGeom.mjGEOM_CYLINDER.value) {
        geometry = new THREE.CylinderGeometry(size[0], size[0], size[1] * 2.0);
      } else if (type == mujoco.mjtGeom.mjGEOM_BOX.value) {
        geometry = new THREE.BoxGeometry(size[0] * 2.0, size[2] * 2.0, size[1] * 2.0);
      } else if (type == mujoco.mjtGeom.mjGEOM_MESH.value) {
        let meshID = model.geom_dataid[g];

        if (!(meshID in meshes)) {
          geometry = new THREE.BufferGeometry();

          let vertex_buffer = model.mesh_vert.subarray(
             model.mesh_vertadr[meshID] * 3,
            (model.mesh_vertadr[meshID]  + model.mesh_vertnum[meshID]) * 3);
          for (let v = 0; v < vertex_buffer.length; v+=3){
            //vertex_buffer[v + 0] =  vertex_buffer[v + 0];
            let temp             =  vertex_buffer[v + 1];
            vertex_buffer[v + 1] =  vertex_buffer[v + 2];
            vertex_buffer[v + 2] = -temp;
          }

          let normal_buffer = model.mesh_normal.subarray(
             model.mesh_normaladr[meshID] * 3,
            (model.mesh_normaladr[meshID]  + model.mesh_normalnum[meshID]) * 3);
          for (let v = 0; v < normal_buffer.length; v+=3){
            //normal_buffer[v + 0] =  normal_buffer[v + 0];
            let temp             =  normal_buffer[v + 1];
            normal_buffer[v + 1] =  normal_buffer[v + 2];
            normal_buffer[v + 2] = -temp;
          }

          let uv_buffer = model.mesh_texcoord.subarray(
             model.mesh_texcoordadr[meshID] * 2,
            (model.mesh_texcoordadr[meshID]  + model.mesh_texcoordnum[meshID]) * 2);

          let face_to_vertex_buffer = model.mesh_face.subarray(
             model.mesh_faceadr[meshID] * 3,
            (model.mesh_faceadr[meshID]  + model.mesh_facenum[meshID]) * 3);
          let face_to_uv_buffer = model.mesh_facetexcoord.subarray(
             model.mesh_faceadr[meshID] * 3,
            (model.mesh_faceadr[meshID]  + model.mesh_facenum[meshID]) * 3);
          let face_to_normal_buffer = model.mesh_facenormal.subarray(
             model.mesh_faceadr[meshID] * 3,
            (model.mesh_faceadr[meshID]  + model.mesh_facenum[meshID]) * 3);

          // The UV and Normal Buffers are actually indexed by the triangle indices through the face_to_uv_buffer and face_to_normal_buffer.
          // We need to swizzle them into a per-vertex format for three.js
          let swizzled_uv_buffer      = new Float32Array((vertex_buffer.length / 3) * 2);
          let swizzled_normal_buffer  = new Float32Array(vertex_buffer.length);
          for (let t = 0; t < face_to_vertex_buffer.length / 3; t++) {
            let vi0 = face_to_vertex_buffer[(t * 3) + 0];
            let vi1 = face_to_vertex_buffer[(t * 3) + 1];
            let vi2 = face_to_vertex_buffer[(t * 3) + 2];
            let uvi0 = face_to_uv_buffer[(t * 3) + 0];
            let uvi1 = face_to_uv_buffer[(t * 3) + 1];
            let uvi2 = face_to_uv_buffer[(t * 3) + 2];
            let nvi0 = face_to_normal_buffer[(t * 3) + 0];
            let nvi1 = face_to_normal_buffer[(t * 3) + 1];
            let nvi2 = face_to_normal_buffer[(t * 3) + 2];
            swizzled_uv_buffer[(vi0 * 2) + 0] = uv_buffer[(uvi0 * 2) + 0];
            swizzled_uv_buffer[(vi0 * 2) + 1] = uv_buffer[(uvi0 * 2) + 1];
            swizzled_uv_buffer[(vi1 * 2) + 0] = uv_buffer[(uvi1 * 2) + 0];
            swizzled_uv_buffer[(vi1 * 2) + 1] = uv_buffer[(uvi1 * 2) + 1];
            swizzled_uv_buffer[(vi2 * 2) + 0] = uv_buffer[(uvi2 * 2) + 0];
            swizzled_uv_buffer[(vi2 * 2) + 1] = uv_buffer[(uvi2 * 2) + 1];
            swizzled_normal_buffer[(vi0 * 3) + 0] = normal_buffer[(nvi0 * 3) + 0];
            swizzled_normal_buffer[(vi0 * 3) + 1] = normal_buffer[(nvi0 * 3) + 1];
            swizzled_normal_buffer[(vi0 * 3) + 2] = normal_buffer[(nvi0 * 3) + 2];
            swizzled_normal_buffer[(vi1 * 3) + 0] = normal_buffer[(nvi1 * 3) + 0];
            swizzled_normal_buffer[(vi1 * 3) + 1] = normal_buffer[(nvi1 * 3) + 1];
            swizzled_normal_buffer[(vi1 * 3) + 2] = normal_buffer[(nvi1 * 3) + 2];
            swizzled_normal_buffer[(vi2 * 3) + 0] = normal_buffer[(nvi2 * 3) + 0];
            swizzled_normal_buffer[(vi2 * 3) + 1] = normal_buffer[(nvi2 * 3) + 1];
            swizzled_normal_buffer[(vi2 * 3) + 2] = normal_buffer[(nvi2 * 3) + 2];
          }
          geometry.setAttribute("position", new THREE.BufferAttribute(vertex_buffer, 3));
          geometry.setAttribute("normal"  , new THREE.BufferAttribute(swizzled_normal_buffer, 3));
          geometry.setAttribute("uv"      , new THREE.BufferAttribute(swizzled_uv_buffer, 2));
          geometry.setIndex    (Array.from(face_to_vertex_buffer));
          geometry.computeVertexNormals(); // MuJoCo Normals acting strangely... just recompute them
          meshes[meshID] = geometry;
        } else {
          geometry = meshes[meshID];
        }

        bodies[b].has_custom_mesh = true;
      }
      // Done with geometry creation.

      // Set the Material Properties of incoming bodies
      let texture = undefined;
      let color = [
        model.geom_rgba[(g * 4) + 0],
        model.geom_rgba[(g * 4) + 1],
        model.geom_rgba[(g * 4) + 2],
        model.geom_rgba[(g * 4) + 3]];
      if (model.geom_matid[g] != -1) {
        let matId = model.geom_matid[g];
        color = [
          model.mat_rgba[(matId * 4) + 0],
          model.mat_rgba[(matId * 4) + 1],
          model.mat_rgba[(matId * 4) + 2],
          model.mat_rgba[(matId * 4) + 3]];

        // Construct Texture from model.tex_data
        texture = undefined;
        // mat_texid is now a matrix (nmat x mjNTEXROLE)
        // We use mjTEXROLE_RGB (value 1) for standard diffuse/color textures
        const mjNTEXROLE = 10; // Total number of texture roles
        const mjTEXROLE_RGB = 1; // RGB texture role
        let texId = model.mat_texid[(matId * mjNTEXROLE) + mjTEXROLE_RGB];
        
        if (texId != -1) {
          let width    = model.tex_width [texId];
          let height   = model.tex_height[texId];
          let offset   = model.tex_adr   [texId];
          let channels = model.tex_nchannel[texId];
          let texData  = model.tex_data;
          let rgbaArray = new Uint8Array(width * height * 4);
          for (let p = 0; p < width * height; p++){
            rgbaArray[(p * 4) + 0] = texData[offset + ((p * channels) + 0)];
            rgbaArray[(p * 4) + 1] = channels > 1 ? texData[offset + ((p * channels) + 1)] : rgbaArray[(p * 4) + 0];
            rgbaArray[(p * 4) + 2] = channels > 2 ? texData[offset + ((p * channels) + 2)] : rgbaArray[(p * 4) + 0];
            rgbaArray[(p * 4) + 3] = channels > 3 ? texData[offset + ((p * channels) + 3)] : 255;
          }
          texture = new THREE.DataTexture(rgbaArray, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
          if (texId == 2) {
            texture.repeat = new THREE.Vector2(50, 50);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
          } else {
            texture.repeat = new THREE.Vector2(model.mat_texrepeat[(model.geom_matid[g] * 2) + 0],
                                               model.mat_texrepeat[(model.geom_matid[g] * 2) + 1]);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
          }

          texture.needsUpdate = true;
        }
      }

      // Create a new material for each geom to avoid cross-contamination
      let currentMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        transparent: color[3] < 1.0,
        opacity: color[3]/255.,
        specularIntensity: model.geom_matid[g] != -1 ?       model.mat_specular   [model.geom_matid[g]] : undefined,
        reflectivity     : model.geom_matid[g] != -1 ?       model.mat_reflectance[model.geom_matid[g]] : undefined,
        roughness        : model.geom_matid[g] != -1 ? 1.0 - model.mat_shininess  [model.geom_matid[g]] : undefined,
        metalness        : model.geom_matid[g] != -1 ?       0.1 : undefined, //model.mat_metallic   [model.geom_matid[g]]
        map              : texture
      });

      let mesh;// = new THREE.Mesh();
      if (type == 0) {
        mesh = new Reflector( new THREE.PlaneGeometry( 100, 100 ), { clipBias: 0.003, texture: texture } );
        mesh.rotateX( - Math.PI / 2 );
      } else {
        mesh = new THREE.Mesh(geometry, currentMaterial);
      }

      mesh.castShadow = g == 0 ? false : true;
      mesh.receiveShadow = type != 7;
      mesh.bodyID = b;
      bodies[b].add(mesh);
      getPosition  (model.geom_pos, g, mesh.position  );
      if (type != 0) { getQuaternion(model.geom_quat, g, mesh.quaternion); }
      if (type == 4) { mesh.scale.set(size[0], size[2], size[1]); } // Stretch the Ellipsoid
    }

    // Parse tendons.
    let tendonMat = new THREE.MeshPhongMaterial();
    tendonMat.color = new THREE.Color(0.8, 0.3, 0.3);
    mujocoRoot.cylinders = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1, 1, 1),
        tendonMat, 1023);
    mujocoRoot.cylinders.receiveShadow = true;
    mujocoRoot.cylinders.castShadow    = true;
    mujocoRoot.add(mujocoRoot.cylinders);
    mujocoRoot.spheres = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1, 10, 10),
        tendonMat, 1023);
    mujocoRoot.spheres.receiveShadow = true;
    mujocoRoot.spheres.castShadow    = true;
    mujocoRoot.add(mujocoRoot.spheres);

    // Parse lights.
    for (let l = 0; l < model.nlight; l++) {
      let light = new THREE.DirectionalLight();
      if (model.light_type[l] == 0) {
        light = new THREE.SpotLight();
        light.angle = 1.51;//model.light_cutoffangle[l];
      } else if (model.light_type[l] == 1) {
        light = new THREE.DirectionalLight();
      } else if (model.light_type[l] == 2) {
        light = new THREE.PointLight();
      }else if (model.light_type[l] == 3) {
        light = new THREE.HemisphereLight();
      }

      light.angle = 1.11;

      light.decay = model.light_attenuation[l] * 100;
      light.penumbra = 0.5;
      light.castShadow = true; // default false
      light.intensity = light.intensity * 3.14 * 1.0;

      light.shadow.mapSize.width = 1024; // default
      light.shadow.mapSize.height = 1024; // default
      light.shadow.camera.near = 0.1; // default
      light.shadow.camera.far = 10; // default
      //bodies[model.light_bodyid()].add(light);
      if (bodies[0]) {
        bodies[0].add(light);
      } else {
        mujocoRoot.add(light);
      }
      lights.push(light);
    }
    if (model.nlight == 0) {
      let light = new THREE.DirectionalLight();
      mujocoRoot.add(light);
    }

    for (let b = 0; b < model.nbody; b++) {
      //let parent_body = model.body_parentid()[b];
      if (b == 0 || !bodies[0]) {
        mujocoRoot.add(bodies[b]);
      } else if(bodies[b]){
        bodies[0].add(bodies[b]);
      } else {
        console.log("Body without Geometry detected; adding to bodies", b, bodies[b]);
        bodies[b] = new THREE.Group(); bodies[b].name = names[b + 1]; bodies[b].bodyID = b; bodies[b].has_custom_mesh = false;
        bodies[0].add(bodies[b]);
      }
    }
  
    parent.mujocoRoot = mujocoRoot;

    return [model, data, bodies, lights];
}

export function drawTendonsAndFlex(mujocoRoot, model, data) {
  // Update tendon transforms.
  let identityQuat = new THREE.Quaternion();
  let numWraps = 0;
  if (mujocoRoot && mujocoRoot.cylinders) {
    let mat = new THREE.Matrix4();
    for (let t = 0; t < model.ntendon; t++) {
      let startW = data.ten_wrapadr[t];
      let r = model.tendon_width[t];
      for (let w = startW; w < startW + data.ten_wrapnum[t] -1 ; w++) {
        let tendonStart = getPosition(data.wrap_xpos, w    , new THREE.Vector3());
        let tendonEnd   = getPosition(data.wrap_xpos, w + 1, new THREE.Vector3());
        let tendonAvg   = new THREE.Vector3().addVectors(tendonStart, tendonEnd).multiplyScalar(0.5);

        let validStart = tendonStart.length() > 0.01;
        let validEnd   = tendonEnd  .length() > 0.01;

        if (validStart) { mujocoRoot.spheres.setMatrixAt(numWraps    , mat.compose(tendonStart, identityQuat, new THREE.Vector3(r, r, r))); }
        if (validEnd  ) { mujocoRoot.spheres.setMatrixAt(numWraps + 1, mat.compose(tendonEnd  , identityQuat, new THREE.Vector3(r, r, r))); }
        if (validStart && validEnd) {
          mat.compose(tendonAvg, identityQuat.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), tendonEnd.clone().sub(tendonStart).normalize()),
            new THREE.Vector3(r, tendonStart.distanceTo(tendonEnd), r));
          mujocoRoot.cylinders.setMatrixAt(numWraps, mat);
          numWraps++;
        }
      }
    }

    let curFlexSphereInd = numWraps;
    let tempvertPos = new THREE.Vector3();
    let tempvertRad = new THREE.Vector3();
    for (let i = 0; i < model.nflex; i++) {
      for(let j = 0; j < model.flex_vertnum[i]; j++) {
        let vertIndex = model.flex_vertadr[i] + j;
        getPosition(data.flexvert_xpos, vertIndex, tempvertPos);
        let r   = 0.01;
        mat.compose(tempvertPos, identityQuat, tempvertRad.set(r, r, r));

        mujocoRoot.spheres.setMatrixAt(curFlexSphereInd, mat);
        curFlexSphereInd++;
      }
    }
    mujocoRoot.cylinders.count = numWraps;
    mujocoRoot.spheres  .count = curFlexSphereInd;
    mujocoRoot.cylinders.instanceMatrix.needsUpdate = true;
    mujocoRoot.spheres  .instanceMatrix.needsUpdate = true;
  }
}

/** Downloads the scenes/assets folder to MuJoCo's virtual filesystem.
 * Reads index.json to determine which files to load.
 * @param {mujoco} mujoco
 * @returns {Promise<string[]>} list of XML scene files found */
export async function downloadExampleScenesFolder(mujoco) {
  // Load file list from index.json
  let allFiles = [];
  try {
    const indexResp = await fetch('./assets/scenes/index.json');
    if (indexResp.ok) {
      allFiles = await indexResp.json();
    }
  } catch (e) {
    console.warn("Could not load index.json, no scene assets will be loaded");
  }

  // Try to load mesh bundle (single compressed file instead of 65+ individual requests)
  let bundleLoaded = false;
  try {
    const bundleResp = await fetch('./assets/scenes/meshes_bundle.gz');
    if (bundleResp.ok) {
      console.log("Loading mesh bundle...");
      const ds = new DecompressionStream('gzip');
      const decompressed = bundleResp.body.pipeThrough(ds);
      const buffer = await new Response(decompressed).arrayBuffer();
      const view = new DataView(buffer);

      // Read header: [4 bytes LE: header length][JSON manifest][binary data]
      const headerLen = view.getUint32(0, true);
      const headerBytes = new Uint8Array(buffer, 4, headerLen);
      const manifest = JSON.parse(new TextDecoder().decode(headerBytes));
      const dataStart = 4 + headerLen;

      const entries = Object.entries(manifest);
      for (const [filename, info] of entries) {
        // Create subdirectories in VFS
        const parts = filename.split('/');
        let dir = '/working/';
        for (let i = 0; i < parts.length - 1; i++) {
          dir += parts[i];
          if (!mujoco.FS.analyzePath(dir).exists) { mujoco.FS.mkdir(dir); }
          dir += '/';
        }
        const fileData = new Uint8Array(buffer, dataStart + info.offset, info.size);
        mujoco.FS.writeFile('/working/' + filename, fileData);
      }
      console.log(`Mesh bundle loaded: ${entries.length} files`);
      bundleLoaded = true;
    }
  } catch (e) {
    console.warn("Mesh bundle not available, falling back to individual files:", e.message);
  }

  if (allFiles.length === 0 && !bundleLoaded) { return []; }

  // Load remaining non-mesh files (XML, textures, etc.) from index.json
  if (allFiles.length > 0) {
    console.log("Loading scene assets:", allFiles.length, "files");

    let requests = allFiles.map((url) => fetch(`./assets/scenes/${url}`));
    let responses = await Promise.all(requests);

    for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          console.warn(`Skipping ${allFiles[i]}: ${responses[i].status}`);
          continue;
        }

        let split = allFiles[i].split("/");
        let working = '/working/';
        for (let f = 0; f < split.length - 1; f++) {
            working += split[f];
            if (!mujoco.FS.analyzePath(working).exists) { mujoco.FS.mkdir(working); }
            working += "/";
        }

        let lowerFile = allFiles[i].toLowerCase();
        if (lowerFile.endsWith(".png") || lowerFile.endsWith(".stl") || lowerFile.endsWith(".skn") || lowerFile.endsWith(".obj")) {
            const buffer = await responses[i].arrayBuffer();
            mujoco.FS.writeFile("/working/" + allFiles[i], new Uint8Array(buffer));
        } else {
            const text = await responses[i].text();
            mujoco.FS.writeFile("/working/" + allFiles[i], text);
        }
    }
  }

  // Collect XML scene files from both bundle and index
  let sceneXmlFiles = allFiles.filter(f => f.endsWith('.xml'));

  console.log("All assets loaded to VFS");
  return sceneXmlFiles;
}

/** Access the vector at index, swizzle for three.js, and apply to the target THREE.Vector3
 * @param {Float32Array|Float64Array} buffer
 * @param {number} index
 * @param {THREE.Vector3} target */
export function getPosition(buffer, index, target, swizzle = true) {
  if (swizzle) {
    return target.set(
       buffer[(index * 3) + 0],
       buffer[(index * 3) + 2],
      -buffer[(index * 3) + 1]);
  } else {
    return target.set(
       buffer[(index * 3) + 0],
       buffer[(index * 3) + 1],
       buffer[(index * 3) + 2]);
  }
}

/** Access the quaternion at index, swizzle for three.js, and apply to the target THREE.Quaternion
 * @param {Float32Array|Float64Array} buffer
 * @param {number} index
 * @param {THREE.Quaternion} target */
export function getQuaternion(buffer, index, target, swizzle = true) {
  if (swizzle) {
    return target.set(
      -buffer[(index * 4) + 1],
      -buffer[(index * 4) + 3],
       buffer[(index * 4) + 2],
      -buffer[(index * 4) + 0]);
  } else {
    return target.set(
       buffer[(index * 4) + 0],
       buffer[(index * 4) + 1],
       buffer[(index * 4) + 2],
       buffer[(index * 4) + 3]);
  }
}

/** Converts this Vector3's Handedness to MuJoCo's Coordinate Handedness
 * @param {THREE.Vector3} target */
export function toMujocoPos(target) { return target.set(target.x, -target.z, target.y); }

/** Standard normal random number generator using Box-Muller transform */
export function standardNormal() {
  return Math.sqrt(-2.0 * Math.log( Math.random())) *
         Math.cos ( 2.0 * Math.PI * Math.random()); }

