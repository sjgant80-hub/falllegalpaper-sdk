// falllegalpaper SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from falllegalpaper/index.html · 143103 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "falllegalpaper" }); }
    else go();
  })();
'use strict';
/* ============================== CONSTANTS ============================== */
const TOOLNAME='falllegalpaper';
const VERSION='1.0.0';
const PRIME=757;
const SCHEMA_VERSION='1.0';
const DB_NAME='falllegalpaper-db';
const DB_VER=1;
const RETENTION_YEARS=6;
const TABS=[
  {id:'dashboard', name:'Dashboard', ico:'◈'},
  {id:'clients',   name:'Clients',   ico:'◐'},
  {id:'matters',   name:'Matters',   ico:'◑'},
  {id:'documents', name:'Documents', ico:'▤'},
  {id:'templates', name:'Templates', ico:'▦'},
  {id:'audit',     name:'Audit',     ico:'◯'},
  {id:'t0',        name:'T0 rules',  ico:'◇'},
  {id:'chat',      name:'Chat',      ico:'◆'},
  {id:'firm',      name:'Firm',      ico:'⛯'},
  {id:'settings',  name:'Settings',  ico:'⚙'}
];
/* ============================== STATE ============================== */
const state={
  firm:null,
  advisers:[],
  clients:[],
  matters:[],
  documents:[],
  templates:[],
  audit:[],
  ui:{
    tab:'dashboard',
    selectedClientId:null,
    selectedMatterId:null,
    selectedTemplateId:null,
    selectedDocId:null,
    documentFilter:{client:'',matter:'',template:'',status:''},
    editorOverrides:{},
    chatLog:[]
  },
  settings:{
    auditChain:true,
    anthropicKey:'',
    customBrandName:'',
    customBrandColor:''
  },
  ready:false
};
/* ============================== UTILS ============================== */
const now=()=>Date.now();
const uuid=()=>(crypto&&crypto.randomUUID)?crypto.randomUUID():'x'+Math.random().toString(36).slice(2)+now();
const esc=s=>(s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,kind)=>{const t=document.createElement('div');t.className='toast';if(kind==='err'||kind===1)t.style.borderColor='var(--red)';t.textContent=m;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),3200);};
const fmtDT=ts=>!ts?'—':new Date(ts).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});
const today=()=>new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
async function sha256(s){
  const buf=new TextEncoder().encode(String(s));
  const h=await crypto.subtle.digest('SHA-256',buf);
  return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function get(obj,path){return path.split('.').reduce((o,k)=>(o==null?undefined:o[k]),obj);}
/* ============================== IDB ============================== */
const STORES=['firms','advisers','clients','matters','documents','templates','audit','state'];
function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded=e=>{
      const db=e.target.result;
      STORES.forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});});
    };
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
let _db=null;
async function db(){if(_db)return _db;_db=await openDB();return _db;}
function txDo(store,mode,fn){
  return new Promise(async(res,rej)=>{
    try{
      const d=await db();
      const tx=d.transaction(store,mode);
      const st=tx.objectStore(store);
      fn(st);
      tx.oncomplete=()=>res(true);
      tx.onerror=()=>rej(tx.error);
    }catch(e){rej(e);}
  });
}
const idbPut=(s,v)=>txDo(s,'readwrite',st=>st.put(v));
const idbDel=(s,k)=>txDo(s,'readwrite',st=>st.delete(k));
const idbGet=(s,k)=>new Promise(async(res,rej)=>{try{const d=await db();const tx=d.transaction(s,'readonly');const st=tx.objectStore(s);const r=st.get(k);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
const idbGetAll=s=>new Promise(async(res,rej)=>{try{const d=await db();const tx=d.transaction(s,'readonly');const st=tx.objectStore(s);const r=st.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
/* ============================== KONOMI shim ============================== */
const KONOMI={
  set:async(k,v)=>{try{await idbPut('state',{id:k,v,ts:now()});}catch(e){try{localStorage.setItem(TOOLNAME+':'+k,JSON.stringify(v));}catch(_){}}},
  get:async(k)=>{try{const r=await idbGet('state',k);if(r)return r.v;}catch(e){}try{const s=localStorage.getItem(TOOLNAME+':'+k);return s?JSON.parse(s):null;}catch(e){return null;}}
};
/* ============================== LOAD ============================== */
async function loadAll(){
  const [firms,advisers,clients,matters,documents,templates,auditRows,uiState]=await Promise.all([
    idbGetAll('firms'),idbGetAll('advisers'),idbGetAll('clients'),idbGetAll('matters'),
    idbGetAll('documents'),idbGetAll('templates'),idbGetAll('audit'),KONOMI.get('ui')
  ]);
  state.firm=firms[0]||null;
  state.advisers=advisers;
  state.clients=clients;
  state.matters=matters;
  state.documents=documents.sort((a,b)=>b.generatedAt-a.generatedAt);
  state.templates=templates;
  state.audit=auditRows.sort((a,b)=>a.i-b.i);
  if(uiState&&typeof uiState==='object')Object.assign(state.ui,uiState);
  const sx=await KONOMI.get('settings');if(sx)Object.assign(state.settings,sx);
  if(state.templates.length===0){await seedTemplates();}
  if(state.clients.length===0){await seedDemo();}
  state.ready=true;
}
async function persistUI(){await KONOMI.set('ui',state.ui);}
async function persistSettings(){await KONOMI.set('settings',state.settings);}
/* ============================== AUDIT ============================== */
async function auditLog(action,opts){
  opts=opts||{};
  if(!state.settings.auditChain)return;
  const i=state.audit.length+1;
  const prev=state.audit.length?state.audit[state.audit.length-1]:null;
  const prevHash=prev?prev.docHash:'GENESIS';
  const payload=opts.payload||{};
  const entry={
    id:'au_'+uuid(),i,ts:now(),
    tool:TOOLNAME,
    adviserId:opts.adviserId||'',
    clientId:opts.clientId||'',
    matterId:opts.matterId||'',
    action,
    reasoning:opts.reasoning||'',
    configVersion:TOOLNAME+'@'+VERSION,
    prevHash,payload
  };
  entry.docHash=await sha256(JSON.stringify({i,ts:entry.ts,action,prevHash,payload}));
  state.audit.push(entry);
  await idbPut('audit',entry);
}
/* ============================== MESH ============================== */
let bcSignal=null,bcLaw=null;
const meshSeen={};
function bcSend(channel,type,payload){
  if(!channel)return;
  try{channel.postMessage({v:1,type,ts:now(),source:TOOLNAME,payload});}catch(e){}
}
function initMesh(){
  try{
    bcSignal=new BroadcastChannel('fall-signal');
    bcSignal.postMessage({source:TOOLNAME,type:'hello',prime:PRIME,version:VERSION,ts:now()});
    bcSignal.onmessage=e=>{
      const m=e.data;if(!m||m.source===TOOLNAME)return;
      meshSeen[m.source]={prime:m.prime,ts:now()};
      if(m.type==='ping')bcSignal.postMessage({source:TOOLNAME,type:'pong',prime:PRIME,ts:now()});
    };
  }catch(e){}
  try{
    bcLaw=new BroadcastChannel('fall-law');
    bcLaw.onmessage=onLawMessage;
    bcLaw.postMessage({v:1,type:'sync.request',ts:now(),source:TOOLNAME,payload:{wants:['clients','advisers','matters','firm']}});
  }catch(e){}
}
async function onLawMessage(e){
  const m=e.data;if(!m||m.source===TOOLNAME)return;
  meshSeen[m.source]={prime:m.prime||0,ts:now()};
  if(m.type==='sync.request'){
    bcSend(bcLaw,'sync.snapshot',{
      clients:state.clients,advisers:state.advisers,matters:state.matters,firm:state.firm
    });
    return;
  }
  if(m.type==='sync.snapshot'&&m.payload){
    const p=m.payload;let touched=false;
    if(Array.isArray(p.clients)){for(const c of p.clients){const ex=state.clients.find(x=>x.id===c.id);if(!ex||(c.updatedAt||0)>(ex.updatedAt||0)){await idbPut('clients',c);if(ex)Object.assign(ex,c);else state.clients.push(c);touched=true;}}}
    if(Array.isArray(p.advisers)){for(const c of p.advisers){const ex=state.advisers.find(x=>x.id===c.id);if(!ex||(c.updatedAt||0)>(ex.updatedAt||0)){await idbPut('advisers',c);if(ex)Object.assign(ex,c);else state.advisers.push(c);touched=true;}}}
    if(Array.isArray(p.matters)){for(const c of p.matters){const ex=state.matters.find(x=>x.id===c.id);if(!ex||(c.updatedAt||0)>(ex.updatedAt||0)){await idbPut('matters',c);if(ex)Object.assign(ex,c);else state.matters.push(c);touched=true;}}}
    if(p.firm&&(!state.firm||(p.firm.updatedAt||0)>(state.firm.updatedAt||0))){await idbPut('firms',p.firm);state.firm=p.firm;touched=true;}
    if(touched)render();
    return;
  }
  const upsertList={'client.created':'clients','client.updated':'clients','adviser.created':'advisers','adviser.updated':'advisers','matter.created':'matters','matter.updated':'matters','matter.closed':'matters','matter.reopened':'matters'};
  if(upsertList[m.type]&&m.payload&&m.payload.id){
    const store=upsertList[m.type];const arr=state[store];const ex=arr.find(x=>x.id===m.payload.id);
    if(!ex||(m.payload.updatedAt||0)>(ex.updatedAt||0)){await idbPut(store,m.payload);if(ex)Object.assign(ex,m.payload);else arr.push(m.payload);render();}
    return;
  }
  if(m.type==='firm.updated'&&m.payload){await idbPut('firms',m.payload);state.firm=m.payload;render();}
}
/* ============================== TEMPLATES ============================== */
function tplDef(id,name,practiceArea,sections){
  return {id,name,version:'1.0.0',practiceArea,custom:false,sections,createdAt:now(),updatedAt:now()};
}
function sec(id,heading,body,req,locked){return {id,heading,body,requiredFields:req||[],locked:!!locked};}
const SEED_TEMPLATES=[
tplDef('engagement','Engagement Letter / Client Care','all',[
sec('header','',
'**{{firm.name}}**  ·  SRA No. {{firm.sraNo}}  ·  COLP: {{firm.colp}}  ·  COFA: {{firm.cofa}}\n{{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\nTel: {{firm.phone}}  ·  Email: {{firm.email}}\n\nFor the attention of: **{{client.title}} {{client.firstName}} {{client.lastName}}**\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\n**Our reference:** {{matter.ref}}\n**Date:** {{today}}',['firm.sraNo','client.firstName']),
sec('subject','',
'**RE: {{matter.title}}**\n\nDear {{client.title}} {{client.lastName}},\n\nThank you for instructing {{firm.name}} in the above matter. This letter sets out the terms on which we will act for you. It should be read together with our enclosed **Terms of Business**.',[]),
sec('regulatory','1. Who we are and how we are regulated',
'{{firm.name}} is authorised and regulated by the **Solicitors Regulation Authority** under SRA No. **{{firm.sraNo}}**. You can verify our authorisation on the SRA register at https://www.sra.org.uk. We are bound by the **SRA Code of Conduct for Solicitors, RELs and RFLs (2019)** and the **SRA Code of Conduct for Firms (2019)**.\n\nOur Compliance Officer for Legal Practice (**COLP**) is {{firm.colp}}. Our Compliance Officer for Finance and Administration (**COFA**) is {{firm.cofa}}.',[],true),
sec('scope','2. Scope of our retainer',
'We will act for you in connection with: **{{matter.retainerScope}}**.\n\nThis retainer **does not** include: {{matter.retainerLimits}}.\n\nWe will not undertake any work outside this scope without agreeing it with you in writing in advance. If the scope changes, we will issue a written variation.',['matter.retainerScope']),
sec('responsible','3. Who will handle your matter',
'The solicitor with day-to-day conduct of your matter is **{{adviser.name}}** ({{adviser.smcrRole}}, SRA roll no. {{adviser.practicingCertNo}}). The supervising partner is **{{supervisor.name}}**. Either may be contacted on {{firm.phone}} or {{firm.email}}.',[]),
sec('fees','4. Our fees',
'Our charges for this matter are on the following basis: **{{matter.feeArrangement}}**.\n\n- **Hourly rate** (where applicable): £{{matter.hourlyRate}} per hour, charged in units of six minutes.\n- **Fixed fee** (where applicable): £{{matter.fixedFee}} plus VAT and disbursements.\n- **CFA success fee** (where applicable): {{matter.cfaSuccessFeePct}}% of base costs, subject to the statutory cap.\n\nOur best current **estimate of total fees** for this matter is **£{{matter.estimatedFees}} plus VAT and disbursements**. This is an estimate not a quotation; we will update it if circumstances change.\n\nWe will bill periodically (typically monthly); invoices are payable within **30 days**. We reserve the right to charge interest on overdue invoices at 4% above the Bank of England base rate.',['matter.feeArrangement']),
sec('disbursements','5. Disbursements and VAT',
'Disbursements are payments we make on your behalf (court fees, search fees, counsel fees, expert reports, etc.). We will discuss material disbursements with you before incurring them. **VAT is charged at 20%** on our fees and on disbursements where VAT applies.',[]),
sec('payments-on-account','6. Payments on account',
'We may ask you for payments on account of costs and disbursements. These will be held in our **client account** (a separate ring-fenced account regulated by the SRA Accounts Rules 2019). Interest on client money will be accounted for in accordance with our Interest Policy (see Terms of Business).',[]),
sec('complaints','7. Complaints and the Legal Ombudsman',
'We are committed to providing high-quality legal services. If you are unhappy with any aspect of our service, please raise it first with **{{adviser.name}}**, and if not resolved, with our complaints partner **{{firm.complaintsPartner}}**. We will acknowledge your complaint within **5 working days** and provide a substantive response within **8 weeks**.\n\nIf you are not satisfied with our final response (or if 8 weeks have passed without one), you may refer the complaint to the **Legal Ombudsman**:\n\n- Address: PO Box 6167, Slough, SL1 0EH\n- Telephone: 0300 555 0333\n- Email: enquiries@legalombudsman.org.uk\n- Web: https://www.legalombudsman.org.uk\n\nNormally you must refer the complaint **within 6 months** of our final response, **and within 1 year of the act or omission complained of (or within 1 year of when you should reasonably have known of it)**. The Legal Ombudsman may extend these limits in exceptional circumstances.\n\nIf your complaint concerns our **professional conduct** (breach of the SRA Code), report it to the **Solicitors Regulation Authority** at https://www.sra.org.uk/consumers/problems/report-solicitor/.',[],true),
sec('pi','8. Professional Indemnity Insurance',
'We hold professional indemnity insurance with **{{firm.piInsurer}}** (policy no. {{firm.piPolicyNo}}), expiring {{firm.piExpiryDateText}}. Our minimum level of cover meets the SRA Minimum Terms and Conditions (£2,000,000 per claim, or £3,000,000 for incorporated practices). The territorial scope is England & Wales.',[],true),
sec('liability','9. Limitation of our liability',
'Subject to the SRA Minimum Terms, and except where prohibited by law, our aggregate liability to you for losses arising from this retainer is **limited to £{{firm.liabilityCap}}** (or, if higher, the limit of our PI cover for this matter). We do not exclude liability for fraud, death or personal injury caused by our negligence, or any liability that cannot lawfully be excluded.',[]),
sec('storage','10. File storage and retention',
'On completion of your matter, we will close your file and store it (electronically and/or in hard copy) for a minimum period of **6 years** in accordance with **SRA rule 13.5**. After this period we may destroy the file confidentially without further notice. Original deeds and Wills are stored indefinitely unless you instruct otherwise.\n\nWe charge no fee for storage. We may charge a reasonable fee for retrieval, copying or production of files after closure.',[],true),
sec('dpa','11. Data protection',
'We process your personal data as **data controller** under the **UK GDPR** and the **Data Protection Act 2018**. Our processing is described in our Privacy Notice (available on request). You have rights of access, rectification, erasure (subject to our regulatory retention obligations) and to lodge a complaint with the **Information Commissioner\'s Office** (https://ico.org.uk).',[],true),
sec('signature','12. Acceptance',
'Please confirm your agreement to these terms and our enclosed Terms of Business by signing and returning the duplicate copy of this letter. By giving us instructions or making a payment on account, you will in any event be deemed to have accepted these terms.\n\nYours sincerely,\n\n\n**{{adviser.name}}**\n{{adviser.smcrRole}}  ·  for and on behalf of {{firm.name}}\n\n[SIGNATURE_BLOCK]',[])
]),
tplDef('terms-of-business','Terms of Business','all',[
sec('header','**{{firm.name}} · Terms of Business**','**Version: 1.0  ·  Effective from: {{today}}**\n\nThese Terms of Business apply to all retainers between {{firm.name}} ("we", "us", "our") and our clients ("you", "your"), and form part of every engagement letter we issue.',[],true),
sec('reg','1. Regulatory status',
'{{firm.name}} is a {{firm.entityType}} authorised and regulated by the **Solicitors Regulation Authority** (SRA No. {{firm.sraNo}}). Our COLP is {{firm.colp}} and our COFA is {{firm.cofa}}. Our principal place of business is {{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}. We are bound by the **SRA Code of Conduct 2019**, the **SRA Accounts Rules 2019** and the **SRA Standards and Regulations**.',[],true),
sec('hours','2. Hours and contact',
'Our office hours are 09:00 to 17:30 Monday to Friday, excluding public holidays. Out-of-hours communications will be addressed on the next working day. Please direct urgent matters to your responsible solicitor by telephone.',[]),
sec('fees','3. Fees, billing and payment terms',
'Fees are calculated by hourly rate, fixed fee, conditional fee agreement, damages-based agreement or as separately agreed. All fees are subject to VAT at the prevailing rate. **Invoices are payable within 30 days** of the invoice date. We may charge interest on overdue invoices at **4% above the Bank of England base rate**. We may decline further work, or exercise a lien over papers and money held, where fees are overdue.',[]),
sec('client-money','4. Client money',
'Money received from or on behalf of you will be held in our **client account** in accordance with the **SRA Accounts Rules 2019**. We will not use client money to pay our own bills without first sending you an invoice (or notification of costs incurred) and giving you reasonable opportunity to query it. Interest will be accounted for under our Interest Policy (clause 5).',[],true),
sec('interest','5. Interest policy',
'We will account to you for a fair sum of interest on client money held by us, in accordance with **SRA rule 7**. The rate paid will be that paid by our client account bank from time to time. We will not account for interest where the amount is less than **£20**, or where money is held for less than **8 weeks**, save in exceptional circumstances.',[],true),
sec('liability','6. Limitation of liability',
'Our aggregate liability to you arising from any retainer is limited to **£{{firm.liabilityCap}}**, or such higher amount agreed in writing in the engagement letter, subject always to the SRA Minimum Terms and Conditions of PI insurance. We do not limit liability for fraud, death or personal injury caused by our negligence, or any liability that cannot lawfully be excluded.',[]),
sec('confidentiality','7. Confidentiality and disclosure',
'We owe a duty of confidentiality to all clients. We may, however, be required to make disclosures to law enforcement or regulators under the **Proceeds of Crime Act 2002**, the **Money Laundering Regulations 2017** and other statutory regimes — in which case we may not be permitted to inform you of any such report.',[]),
sec('aml','8. Anti-money-laundering and CDD',
'We carry out **Customer Due Diligence** (CDD) on all clients under the **Money Laundering Regulations 2017** and **LSAG AML Guidance**. You agree to provide documentary evidence of identity and address, and information on source of funds and source of wealth, as we may reasonably require. We may decline or cease to act where CDD cannot be completed.',[],true),
sec('conflicts','9. Conflicts of interest',
'We carry out a conflict check before accepting instructions. Where a conflict (or significant risk of one) arises, we will not act for parties on both sides save in the narrow circumstances permitted by **SRA Code paragraph 6.2** (substantially common interest) or **paragraph 6.3** (competing for the same objective), and only with informed written consent.',[],true),
sec('storage','10. File retention',
'Closed files are retained for a minimum of **6 years** from closure (**SRA rule 13.5**). Original deeds, Wills and other instruments are stored indefinitely. Files are destroyed confidentially at the end of the retention period without further notice. Retrieval after closure may incur a reasonable administrative fee.',[],true),
sec('dpa','11. Data protection',
'We process personal data as data controller under the **UK GDPR** and **Data Protection Act 2018**. We hold and process personal data only for the purposes of the retainer, our regulatory obligations, fee collection, marketing (with consent) and the resolution of complaints and disputes. You have rights of access, rectification, erasure, restriction, portability, objection and complaint to the **ICO** (https://ico.org.uk).',[],true),
sec('equality','12. Equality and diversity',
'We provide services without discrimination on grounds of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, or sexual orientation, per **Equality Act 2010** and **SRA Code paragraph 1.1**. Reasonable adjustments will be made on request.',[],true),
sec('complaints','13. Complaints and the Legal Ombudsman',
'See the complaints clause in your engagement letter. The **Legal Ombudsman** is the independent body for complaints about legal services — PO Box 6167, Slough SL1 0EH · 0300 555 0333 · enquiries@legalombudsman.org.uk. The **SRA** handles complaints about professional conduct.',[],true),
sec('termination','14. Termination',
'You may terminate the retainer at any time by written notice. We may only terminate for good reason (non-payment, failure to instruct, breakdown of trust, or where continuing would breach the SRA Code). On termination, we will deliver up your papers (subject to our lien for unpaid fees) and render a final invoice for work done to that date.',[]),
sec('law','15. Governing law',
'These Terms of Business and any retainer are governed by **the law of England and Wales**, and the parties submit to the exclusive jurisdiction of the courts of England and Wales.',[]),
sec('signature','Signature','I have read and accept these Terms of Business.\n\n[SIGNATURE_BLOCK]',[])
]),
tplDef('costs-information','Costs Information and Updates','all',[
sec('header','**Costs Information · SRA Transparency Rules**','**Client:** {{client.title}} {{client.firstName}} {{client.lastName}}\n**Matter:** {{matter.title}}  ·  Ref {{matter.ref}}\n**Date:** {{today}}\n**Responsible solicitor:** {{adviser.name}} ({{adviser.smcrRole}})',[]),
sec('intro','1. Purpose',
'This document is provided in accordance with the **SRA Transparency Rules** and **SRA Code of Conduct paragraph 8.7** (best possible information about likely overall cost). It sets out our charges, our best estimate of total fees and disbursements, our charging basis and our timescales.',[],true),
sec('basis','2. Charging basis',
'Our charges for this matter are on the basis: **{{matter.feeArrangement}}**.\n\nHourly rate (if applicable): **£{{matter.hourlyRate}} per hour** (plus VAT at 20%), recorded in 6-minute units.\n\nFixed fee (if applicable): **£{{matter.fixedFee}}** (plus VAT and disbursements).\n\nOur best estimate of total fees for this matter is **£{{matter.estimatedFees}} plus VAT**. This is an estimate, not a quotation, and will be updated as the matter progresses.',[]),
sec('vat','3. VAT',
'VAT is charged on our fees, and on disbursements where VAT applies, at the prevailing rate (currently **20%**).',[]),
sec('disbursements','4. Typical disbursements',
'Disbursements are payments to third parties made on your behalf. Typical disbursements include:\n- Court issue fees and hearing fees\n- Counsel\'s fees\n- Expert fees (medical, surveying, accountancy etc.)\n- Search fees (HM Land Registry, Companies House, bankruptcy)\n- Process server fees\n- Travel costs at HMRC mileage rates\n\nWe will discuss material disbursements with you before incurring them.',[]),
sec('factors','5. Factors that may affect cost',
'Cost may increase if: the matter becomes contested or technically complex; new parties join; new issues are raised; documents need translation; expert evidence is required; the other side acts in an obstructive manner; the matter goes to trial.',[]),
sec('timescales','6. Timescales',
'A straightforward matter of this type typically takes **{{matter.typicalDurationText}}**. We will keep you updated at least every **6 weeks** and tell you promptly if the timescale changes materially.',[]),
sec('update','7. Costs updates',
'We will update this costs information in writing **at least every 6 months**, or whenever cumulative costs reach a further £1,000, or whenever there is a material change.',[],true),
sec('paying','8. Funding options',
'Depending on the matter, you may be eligible for: legal expenses insurance ("BTE"); a Conditional Fee Agreement; a Damages-Based Agreement; Trade Union funding; Legal Aid (limited categories only). Please discuss with your solicitor.',[])
]),
tplDef('cfa','Conditional Fee Agreement (CFA)','litigation',[
sec('header','**Conditional Fee Agreement** (LASPO-compliant)',
'**Solicitor:** {{firm.name}}, {{firm.registeredAddress.line1}}, {{firm.registeredAddress.postcode}} · SRA No. {{firm.sraNo}}\n**Client:** {{client.title}} {{client.firstName}} {{client.lastName}}, {{client.address.line1}}, {{client.address.postcode}}\n**Matter:** {{matter.title}} ({{matter.ref}})\n**Date:** {{today}}\n\nThis Agreement is a **Conditional Fee Agreement** ("CFA") within the meaning of s.58 **Courts and Legal Services Act 1990** (as amended by **LASPO 2012**). It complies with the **Conditional Fee Agreements Order 2013**.',[],true),
sec('what-covered','1. What is covered',
'This agreement covers all work reasonably done on your claim for: **{{matter.title}}**, including advice, drafting, issue of proceedings, disclosure, witness evidence, expert evidence, interim applications, settlement negotiation, and trial up to and including any first-instance hearing. It does NOT cover any appeal, enforcement or other steps unless a separate written agreement is made.',[]),
sec('win','2. Paying us if you win',
'If you **win**, you pay our base costs (hourly rate × time recorded), our disbursements, and a **success fee** of **{{matter.cfaSuccessFeePct}}% of our base costs**.\n\nThe success fee compensates us for the risk of receiving no payment if you lose. **It is capped at 100% of base costs (Article 3 of the 2013 Order), and capped at 25% of damages (excluding future-care and future-loss damages) in personal injury claims (Article 5)**.\n\nMost base costs will normally be recoverable from your opponent. The success fee is NOT recoverable — it is payable by you out of damages (subject to the cap).',[],true),
sec('lose','3. Paying us if you lose',
'If you **lose**, you do not pay our charges. However you may still be liable for:\n- Your own **disbursements** (unless covered by ATE insurance)\n- The **opponent\'s costs and disbursements**, if the court orders you to pay them (qualified one-way costs shifting may apply in personal injury claims under CPR 44.13)\n\nWe strongly recommend you consider **After-the-Event ("ATE") legal expenses insurance**. ATE premiums are NOT recoverable from the opponent (save in clinical negligence cases for the part of the premium relating to expert reports on liability/causation).',[]),
sec('cooling','4. Cancellation / cooling-off',
'You may cancel this agreement at any time by writing to us. If you cancel within **14 days** of signature, you owe us nothing. If you cancel later, we may charge you our base costs and disbursements for work done up to the date of cancellation.',[]),
sec('definitions','5. "Win" and "lose"',
'You "win" if your claim is finally decided in your favour, by court decision or by agreement, and you become entitled to recover damages or other monetary benefit (including any interim payment). You "lose" if the claim is discontinued, struck out, or finally dismissed without monetary recovery.',[]),
sec('terminate','6. Ending the agreement',
'**We may end this agreement** if you fail to give us proper instructions; reject our advice on reasonable settlement; behave in a way that makes it impossible for us to continue; become bankrupt; or die (subject to representation by your estate). On termination by us, we may charge base costs for work done.\n\n**You may end this agreement** at any time. If you end it without good reason after we have done work reasonably, we may charge base costs to that date. If you end it for good reason (such as our serious breach), you owe us nothing.',[]),
sec('sig','7. Signatures',
'I have read and understood this Conditional Fee Agreement, and I have been advised about alternative funding options (BTE, DBA, private retainer, legal aid where applicable) and the risks of litigation. I have been given a copy.\n\n[SIGNATURE_BLOCK]',[])
]),
tplDef('dba','Damages-Based Agreement (DBA)','litigation',[
sec('header','**Damages-Based Agreement** (DBA Regs 2013)',
'**Solicitor:** {{firm.name}} · SRA No. {{firm.sraNo}}\n**Client:** {{client.title}} {{client.firstName}} {{client.lastName}}\n**Matter:** {{matter.title}} ({{matter.ref}})\n**Date:** {{today}}\n\nThis is a **Damages-Based Agreement** ("DBA") within s.58AA **Courts and Legal Services Act 1990**, complying with the **Damages-Based Agreements Regulations 2013**.',[],true),
sec('claim','1. The claim',
'The claim to which this DBA relates is: **{{matter.title}}**. It covers all work reasonably necessary to bring or settle the claim up to and including first-instance judgment. Appeals are not covered unless a separate written DBA is made.',[]),
sec('payment','2. The payment',
'If the claim succeeds, you will pay us a "Payment" equal to **{{matter.cfaSuccessFeePct}}% of the financial benefit obtained**, **including VAT** ("the Payment").\n\nThe Payment is **capped as follows** by the 2013 Regulations:\n- Personal injury (at first instance): **maximum 25%** of damages, excluding damages for future pecuniary loss (reg. 4(2)(b))\n- Employment tribunal: **maximum 35%** of the sum ultimately recovered (reg. 7)\n- All other commercial / civil claims (at first instance): **maximum 50%** of the sums ultimately recovered (reg. 4(3))\n\nThe Payment **includes** our base costs, success fee element, counsel\'s fees, and VAT. It **does not** include disbursements which are payable separately.',[],true),
sec('costs-recovered','3. Costs recovered from the other side',
'If your opponent is ordered to pay costs, those costs will be paid to us and credited against the Payment due from you (the "indemnity principle" applies). You will only ever pay us the difference between the Payment and any costs recovered.',[]),
sec('lose','4. If the claim fails',
'If the claim does not succeed you will pay us **nothing** in respect of our fees. You may still be liable for your own disbursements (unless ATE insures them) and for any adverse costs order from the court (qualified one-way costs shifting may apply in PI).',[]),
sec('opt-out','5. Termination and opt-out',
'You may **terminate** this agreement at any time. If you terminate without good cause after work has been done, the 2013 Regulations require that the Payment be calculated on a hybrid basis or as fees and expenses incurred — refer to regs 4(1) and 8.',[]),
sec('alternatives','6. Alternative funding options considered',
'Before signing you should consider whether you have BTE insurance, would qualify for legal aid, are entitled to trade-union funding, or could fund the matter privately. We have discussed these with you.',[]),
sec('sig','7. Signatures',
'I confirm I understand the cap on the Payment, the risks of losing (including adverse costs), and the alternatives. I have been given a copy of this DBA.\n\n[SIGNATURE_BLOCK]',[])
]),
tplDef('advice-letter','Initial Advice Letter','all',[
sec('header','',
'**{{firm.name}}**  ·  SRA {{firm.sraNo}}\n\nFor: **{{client.title}} {{client.firstName}} {{client.lastName}}**\n{{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\nOur ref: {{matter.ref}}  ·  Date: {{today}}\n\nDear {{client.title}} {{client.lastName}},',[]),
sec('subject','**RE: {{matter.title}} — initial advice**',
'Thank you for instructing us in this matter. This letter sets out our preliminary advice based on the information you have given us. Where I have made assumptions I have flagged them. **If any of the facts below are wrong or incomplete, please tell me as soon as possible** — my advice depends on them.',[]),
sec('facts','1. Facts as I understand them',
'On {{ctx.factDate}}, {{ctx.factsNarrative}}\n\n[Adviser: replace this with the factual chronology. Be specific about dates, parties, sums, key documents and any oral exchanges. State the source of each material fact.]',[]),
sec('issues','2. The issues',
'The legal questions that arise on these facts are:\n\n1. {{ctx.issue1}}\n2. {{ctx.issue2}}\n3. {{ctx.issue3}}',[]),
sec('law','3. The law',
'{{ctx.lawSummary}}\n\n[Adviser: cite the controlling authorities — statute, regulation, decided cases — with proper neutral citations. Where the law is unsettled, say so.]',[]),
sec('advice','4. My advice',
'On the facts as understood, my advice is:\n\n{{ctx.advice}}\n\n**Strength of position:** {{ctx.strength}} (strong / arguable / weak — explain why).\n\nI have considered the alternative arguments and concluded that this position is the best one open to you because: {{ctx.bestBecause}}.',[]),
sec('action','5. Recommended action',
'I recommend that we now:\n\n1. {{ctx.action1}}\n2. {{ctx.action2}}\n3. {{ctx.action3}}\n\nThe **deadline** for action is **{{ctx.deadline}}**. If we do not act by that date, the consequence is: {{ctx.deadlineConsequence}}.',[]),
sec('costs','6. Costs',
'The likely cost of taking the recommended action is approximately **£{{ctx.actionCost}} plus VAT and disbursements**. Please refer to my separate Costs Information letter for the full charging basis.',[]),
sec('risks','7. Risks',
'I should specifically draw your attention to the following risks:\n\n- {{ctx.risk1}}\n- {{ctx.risk2}}\n- {{ctx.risk3}}\n\n[Adviser: be honest about adverse-costs exposure, limitation, evidence gaps, opponent\'s likely defences, and reputational issues.]',[]),
sec('next','8. Next steps',
'Please confirm your instructions to proceed by replying to this letter (email is fine). If you would prefer to discuss first, please call me on {{adviser.phone}} or email {{adviser.email}}.\n\nYours sincerely,\n\n\n**{{adviser.name}}**\n{{adviser.smcrRole}}  ·  {{firm.name}}',[])
]),
tplDef('letter-before-action','Letter Before Action','litigation',[
sec('header','',
'**{{firm.name}}**  ·  SRA {{firm.sraNo}}\n{{firm.registeredAddress.line1}}, {{firm.registeredAddress.city}}, {{firm.registeredAddress.postcode}}\n\nTo: **{{ctx.defendantName}}**\n{{ctx.defendantAddress}}\n\nOur ref: {{matter.ref}}  ·  Date: {{today}}\n\n**BY POST AND BY EMAIL**',[]),
sec('subject','**LETTER BEFORE ACTION — PRE-ACTION PROTOCOL**','**Proposed Claimant:** {{client.title}} {{client.firstName}} {{client.lastName}}\n**Proposed Defendant:** {{ctx.defendantName}}\n**Subject:** {{matter.title}}\n**Sum claimed:** £{{ctx.sumClaimed}} (plus interest and costs)',[]),
sec('purpose','1. Purpose of this letter',
'We act for {{client.firstName}} {{client.lastName}} ("our client"). This is a **Letter Before Action** sent in accordance with the **Practice Direction on Pre-Action Conduct and Protocols** (and the specific pre-action protocol applicable to this dispute, where one applies). Its purpose is to give you full notice of our client\'s claim and to enable matters to be resolved without recourse to court proceedings.',[],true),
sec('facts','2. The facts',
'The material facts on which our client\'s claim is based are as follows:\n\n{{ctx.factsNarrative}}',[]),
sec('basis','3. The legal basis',
'Our client\'s claim against you is in: **{{ctx.causeOfAction}}** (e.g. breach of contract, negligence, breach of statutory duty, debt, conversion, etc.). The applicable principles are summarised below:\n\n{{ctx.legalBasis}}',[]),
sec('loss','4. Loss and damage',
'As a result of your breach, our client has suffered the following loss:\n\n{{ctx.lossSchedule}}\n\n**Total claimed: £{{ctx.sumClaimed}}**, plus interest pursuant to s.35A Senior Courts Act 1981 (or s.69 County Courts Act 1984) from {{ctx.interestFrom}} until payment, and the costs of any proceedings.',[]),
sec('demand','5. Our client\'s position',
'Our client requires that you within **14 days** of the date of this letter:\n\n1. Pay the sum of **£{{ctx.sumClaimed}}** plus interest to date of payment, to this firm\'s client account (details on request); and\n2. Pay our client\'s legal costs of pursuing this matter to date (currently £{{ctx.costsToDate}} plus VAT); and\n3. Provide such undertakings or take such steps as set out in Schedule A annexed hereto.',[]),
sec('docs','6. Documents',
'In accordance with paragraph 6(c) of the Pre-Action Practice Direction, the key documents on which our client relies are listed at Schedule B and copies are enclosed. Please confirm receipt and, by way of pre-action disclosure, please provide copies of:\n\n{{ctx.docsRequested}}',[]),
sec('adr','7. Alternative dispute resolution',
'Our client is willing to consider Alternative Dispute Resolution including mediation, early neutral evaluation or without-prejudice settlement discussions. Please indicate within 14 days whether you are willing to engage in ADR, and if so, your preferred method.',[]),
sec('failure','8. Consequences of failure to respond',
'If you do not respond substantively within **14 days**, or fail to comply with the demand above within that period, our client reserves the right to commence proceedings without further notice. The court will be invited to draw appropriate inferences from your silence and to take any such conduct into account when making orders as to costs.',[]),
sec('insurance','9. Insurance / legal representation',
'We suggest you forward this letter to your insurers and/or seek independent legal advice immediately. Please give us the names and addresses of your insurers and your solicitors within 14 days.',[]),
sec('sign','','Yours faithfully,\n\n\n\n**{{firm.name}}**',[])
]),
tplDef('settlement','Settlement Agreement','all',[
sec('parties','**SETTLEMENT AGREEMENT**',
'**THIS AGREEMENT** is made on **{{today}}**\n\n**BETWEEN:**\n\n(1)  **{{client.firstName}} {{client.lastName}}** of {{client.address.line1}}, {{client.address.postcode}} ("**Party A**"); and\n\n(2)  **{{ctx.otherPartyName}}** of {{ctx.otherPartyAddress}} ("**Party B**")\n\n(together "the **Parties**").',[]),
sec('recitals','**RECITALS**',
'(A)  The Parties are in dispute in relation to **{{matter.title}}** (the "**Dispute**").\n\n(B)  The Parties wish to resolve the Dispute on the terms set out below, without admission of liability by either party.',[]),
sec('payment','1. Payment',
'Party B shall pay to Party A the sum of **£{{ctx.settlementSum}}** ("the **Settlement Sum**") in full and final settlement of all and any claims (whether actual, contingent, prospective or known) arising out of or in connection with the Dispute.\n\nThe Settlement Sum shall be paid in cleared funds to {{firm.name}} (acting as solicitors for Party A) by no later than **{{ctx.paymentDate}}** to the following account: account name {{firm.clientAccountName}}, sort code {{firm.clientAccountSort}}, account number {{firm.clientAccountNumber}}, reference {{matter.ref}}.',[]),
sec('release','2. Mutual release',
'Subject to receipt of the Settlement Sum, each Party releases and forever discharges the other Party and its successors, employees, officers, agents and assigns from any and all claims, demands, actions, suits and causes of action of any nature whatsoever, whether in contract, tort, statute, equity or otherwise, arising out of or in connection with the Dispute, save in respect of the enforcement of this Agreement itself.',[]),
sec('confidentiality','3. Confidentiality',
'The Parties shall keep the existence and terms of this Agreement confidential, save where disclosure is: required by law or by a competent regulator (including HMRC); made to professional advisers under a duty of confidentiality; or made to immediate family.',[]),
sec('no-admission','4. No admission',
'This Agreement is entered into without admission of liability by either Party.',[]),
sec('costs','5. Costs',
'Each Party shall bear its own legal costs in relation to the Dispute and this Agreement, save as expressly agreed otherwise.',[]),
sec('cot3','6. COT3 (if applicable)',
'**Where the Dispute concerns alleged employment claims**, this Agreement is intended to take effect as a **COT3** agreement reached with the assistance of an ACAS conciliator (or, alternatively, as a **Settlement Agreement** complying with s.203 Employment Rights Act 1996, in which case Party A has received independent legal advice on the terms and effect of this Agreement from {{adviser.name}} ({{firm.name}}, SRA {{firm.sraNo}}), whose PI insurance covers the giving of such advice). The relevant statutory conditions are satisfied.',[],true),
sec('entire','7. Entire agreement',
'This Agreement constitutes the entire agreement between the Parties in relation to the Dispute and supersedes all prior agreements, drafts, representations and understandings.',[]),
sec('law','8. Governing law and jurisdiction',
'This Agreement is governed by **the law of England and Wales**, and the Parties submit to the exclusive jurisdiction of the courts of England and Wales.',[]),
sec('sign','**EXECUTION**','**Signed for and on behalf of Party A:**\n\nName: ______________________________\nSignature: __________________________\nDate: ______________________________\n\n**Signed for and on behalf of Party B:**\n\nName: ______________________________\nSignature: __________________________\nDate: ______________________________',[])
]),
tplDef('file-closure','File-Closure / Retention Notice','all',[
sec('header','**File-Closure Notice**','**Client:** {{client.title}} {{client.firstName}} {{client.lastName}}\n**Matter:** {{matter.title}} ({{matter.ref}})\n**Closure date:** {{today}}',[]),
sec('summary','1. Outcome',
'We confirm that the above matter is now concluded. The final outcome is summarised as: **{{ctx.outcomeSummary}}**.',[]),
sec('papers','2. Your papers',
'We enclose / will return to you under separate cover the following original documents: {{ctx.originalDocsReturned}}.\n\nCopies of all key correspondence and documents will be retained on our file.',[]),
sec('storage','3. Retention',
'In accordance with **SRA rule 13.5** (closed files retention) we will store your closed file (paper and/or electronic) for a minimum of **6 years** from today\'s date. After **{{ctx.destroyDate}}** we may destroy the file confidentially without further notice. **Original deeds, Wills and other instruments are stored indefinitely** unless we have your written instructions otherwise.',[],true),
sec('charges','4. Retrieval after closure',
'There is no charge for storage. Reasonable administrative charges may apply for retrieval, copying or production of papers after closure.',[]),
sec('feedback','5. Feedback and complaints',
'Your feedback is welcome. If at any point you are not satisfied with the service we provided, you may complain (see the complaints procedure in the engagement letter, including referral to the **Legal Ombudsman** within 6 months of our final response).',[]),
sec('future','6. Future instructions',
'We would be pleased to act for you in any future matter. Please contact {{adviser.name}} on {{adviser.phone}} or {{adviser.email}}.\n\nYours sincerely,\n\n**{{adviser.name}}** · {{firm.name}}',[])
]),
tplDef('nwnf-info','No-Win-No-Fee Client Information Sheet','litigation',[
sec('header','**No-Win-No-Fee — Plain English Guide**','This sheet explains, in plain English, how a Conditional Fee Agreement (CFA) or Damages-Based Agreement (DBA) works. Please read it carefully **before** signing any funding agreement. Ask {{adviser.name}} if anything is unclear.',[]),
sec('what','1. What does "no win no fee" mean?',
'It means: **if you lose, you pay us no fees**. It does NOT mean you have no risk at all — you may still have to pay:\n- Your **own disbursements** (court fees, expert fees) unless they are insured\n- The **other side\'s costs** if the court orders you to pay them (in personal injury cases, "qualified one-way costs shifting" usually protects you, with exceptions)\n- Your own insurance premium for After-the-Event ("ATE") cover, if you take it out',[]),
sec('cfa','2. The CFA in particular',
'Under a CFA, **if you win**, you pay us our **base costs** (time × hourly rate) **plus a success fee** of up to 100% of those base costs. Most of the base costs are usually recoverable from the loser. The success fee is **NOT** recoverable from the loser — it comes out of your damages, capped at **25% of damages** (excluding future-care and future-loss damages) in personal injury cases.',[],true),
sec('dba','3. The DBA in particular',
'Under a DBA, **if you win**, our fee is calculated as a **percentage of your financial recovery**. Statutory caps apply:\n- **Personal injury (first instance): 25%**\n- **Employment Tribunal: 35%**\n- **Other civil claims: 50%**\n\nThese figures **include VAT**. Counsel\'s fees are typically included; disbursements are not.',[],true),
sec('ate','4. After-the-Event insurance',
'ATE insurance covers you against having to pay the other side\'s costs (and sometimes your own disbursements) if you lose. We can arrange a quotation if you wish.\n\n**Important:** since 1 April 2013 (LASPO), ATE premiums are no longer recoverable from the loser, **except** in clinical negligence cases for that part of the premium relating to expert reports on liability and causation.',[],true),
sec('alts','5. Other funding options',
'Before signing a CFA or DBA you should consider:\n- **Legal Expenses Insurance** ("BTE") — often included in home / motor insurance\n- **Legal Aid** — for limited categories (mainly family, public law and a few others)\n- **Trade Union funding**\n- **Private retainer** (pay-as-you-go)',[]),
sec('think','6. Take time',
'Do not sign on the day of your first meeting. Take this sheet home, read it, and discuss with anyone you wish. You have **14 days** to cancel after signing.',[])
]),
tplDef('vulnerable-client-note','Vulnerable Client Note (internal)','all',[
sec('header','**Internal File Note — Vulnerable Client Considerations**','**Client:** {{client.firstName}} {{client.lastName}} ({{client.id}})\n**Matter:** {{matter.ref}}\n**Author:** {{adviser.name}}\n**Date:** {{today}}\n\nThis is an internal note. It is not to be sent to the client.',[]),
sec('flag','1. Vulnerability flag',
'Vulnerable client flag set: **{{client.kyc.vulnerableCustomerFlag}}** ({{client.kyc.vulnerabilityCategory}}).\n\nKnown drivers / category: {{client.kyc.vulnerabilityNotes}}.',[]),
sec('capacity','2. Mental capacity (MCA 2005)',
'Under the **Mental Capacity Act 2005** every adult is presumed to have capacity unless the contrary is established. The four-stage test (s.3(1)) is whether the person can: (a) understand the information relevant to the decision; (b) retain it; (c) use or weigh it; and (d) communicate the decision. Capacity is **decision-specific** and **time-specific**.\n\nAssessment by {{adviser.name}} on {{today}}: {{ctx.capacityAssessment}}.\n\nIf capacity is in doubt, instruct an independent capacity assessor (psychiatrist, geriatrician, or solicitor specialising in capacity) before taking material instructions, especially for Wills, LPAs, large transactions, or litigation settlements.',[]),
sec('comm','3. Communication adjustments agreed',
'Adjustments to be made for this client:\n\n- Plain English used at all times; legal jargon explained or avoided\n- Meetings scheduled in {{ctx.preferredTimeOfDay}}\n- Allow extra time for instructions\n- Written follow-up of every meeting\n- Trusted third party may attend if client wishes (note: confidentiality must be maintained — third party present as a support, not as a substitute decision-maker)\n- Other: {{ctx.otherAdjustments}}',[]),
sec('safeguarding','4. Safeguarding / undue influence',
'Consider whether there is any indicator of undue influence, coercion, financial abuse or scam involvement. **If yes**, take instructions in private (without the third party), document carefully, and consider whether a report under: (a) safeguarding adults procedures (local authority); (b) Action Fraud; or (c) the Office of the Public Guardian (if relating to LPA misuse) is warranted. **NB SRA Code paragraph 3.4** — a solicitor must only act on instructions from the client themselves (or where authorised) and must satisfy themselves that the instructions are genuine.',[],true),
sec('review','5. Review',
'This assessment will be reviewed at each substantive meeting and on any material change of circumstances, and not less often than every **6 months** during the retainer.',[])
]),
tplDef('will-simple','Will (single testator, simple)','wills-probate',[
sec('header','**LAST WILL AND TESTAMENT**',
'**of**\n\n**{{client.title}} {{client.firstName}} {{client.middleName}} {{client.lastName}}**\n\nof {{client.address.line1}}, {{client.address.city}}, {{client.address.postcode}}\n\n**This template is a STARTING POINT only. A Will must be carefully tailored to the testator\'s circumstances and properly executed under section 9 of the Wills Act 1837.**',[],true),
sec('revoke','1. Revocation',
'I REVOKE all former Wills and testamentary dispositions made by me, and declare this to be my Last Will.',[],true),
sec('appointment','2. Appointment of executors',
'I APPOINT **{{ctx.executor1Name}}** of {{ctx.executor1Address}} and **{{ctx.executor2Name}}** of {{ctx.executor2Address}} jointly to be the executors and trustees of this my Will (together "my Trustees", which expression includes the trustees for the time being of this Will).',[]),
sec('guardian','3. Appointment of guardian (if minor children)',
'If at the date of my death any of my children is under 18 and there is no surviving parent with parental responsibility, I appoint **{{ctx.guardianName}}** of {{ctx.guardianAddress}} to be the guardian of such child(ren).',[]),
sec('specific','4. Specific legacies',
'I GIVE the following specific legacies free of inheritance tax and free of any expenses of delivery:\n\n{{ctx.specificLegacies}}',[]),
sec('pecuniary','5. Pecuniary legacies',
'I GIVE the following pecuniary legacies free of inheritance tax:\n\n{{ctx.pecuniaryLegacies}}',[]),
sec('residue','6. Residue',
'I GIVE all the residue of my estate (after payment of my debts, funeral and testamentary expenses and all legacies) **{{ctx.residueGift}}** (e.g. "to my spouse {{client.title}} ... absolutely, but if such gift fails then to my children in equal shares per stirpes contingent on their attaining 25").',[]),
sec('powers','7. Powers of my Trustees',
'My Trustees shall have all the powers conferred on trustees by statute and at general law, together with the powers set out in the **Standard Provisions and Special Provisions of the Society of Trust and Estate Practitioners (3rd Edition)** which are incorporated into this Will.',[],true),
sec('attestation','8. Attestation clause',
'**SIGNED** by me **{{client.title}} {{client.firstName}} {{client.middleName}} {{client.lastName}}** as my Last Will in the presence of us both being present at the same time who at his/her request and in his/her presence and in the presence of each other have hereunto subscribed our names as witnesses:\n\n\nSigned by Testator: __________________________ Date: __________\n\nWitness 1 — Name: __________________________ Signature: __________________________\nAddress: __________________________________________________ Occupation: ____________\n\nWitness 2 — Name: __________________________ Signature: __________________________\nAddress: __________________________________________________ Occupation: ____________\n\n**Witnesses must be 18+ and must NOT be a beneficiary or the spouse/civil partner of a beneficiary (Wills Act 1837, s.15).**',[],true)
]),
tplDef('lpa-pfa-info','LPA (Property & Financial Affairs) — drafting note','wills-probate',[
sec('header','**LPA — Property & Financial Affairs — drafting note**','This is an **informational note**, NOT the LPA itself. The LPA must be made on **Form LP1F** (or LP1H for Health & Welfare) prescribed by the **Office of the Public Guardian** (OPG) and signed in the prescribed order with the prescribed witnesses and certificate provider.\n\n**Reference:** Mental Capacity Act 2005; LPA Regulations 2007 (as amended).',[],true),
sec('donor','1. The donor',
'The Donor is **{{client.title}} {{client.firstName}} {{client.middleName}} {{client.lastName}}** of {{client.address.line1}}, {{client.address.postcode}}, born {{client.dob}}.\n\nThe Donor has been advised on the nature and effect of the LPA and confirms it is made freely.',[]),
sec('attorneys','2. The attorney(s)',
'**Attorney(s) appointed:**\n\n{{ctx.attorneysList}}\n\n**Appointment basis:** {{ctx.attorneyAppointmentBasis}} (jointly / jointly and severally / jointly for some decisions and jointly and severally for others — if the latter, list the decisions).\n\n**Replacement attorney(s):** {{ctx.replacementAttorneys}}',[]),
sec('when','3. When the LPA can be used',
'You must select **ONE** of the following on the LPA form:\n\n[  ] Attorneys can use this LPA **as soon as it is registered** with the OPG (with the Donor\'s consent while the Donor has capacity)\n\n[  ] Attorneys can only use this LPA **when the Donor does not have mental capacity** to make the relevant decision.\n\nSelected: **{{ctx.whenUsable}}**',[],true),
sec('preferences','4. Preferences and instructions',
'**Preferences** (guidance to the attorney, not binding): {{ctx.preferences}}\n\n**Instructions** (legally binding restrictions on the attorney): {{ctx.instructions}}\n\nBe careful with instructions — overly restrictive or inconsistent instructions may cause the OPG to sever them. Common safe instructions include investment scope, charitable-gift caps, and consultation requirements.',[]),
sec('certificate','5. Certificate provider',
'A certificate provider must confirm that the Donor understands the LPA and is not under undue pressure. Two options: (a) someone who has known the Donor personally for 2+ years (excluding family); or (b) someone with relevant professional skill (solicitor, GP). The certificate provider must complete page 10 of the LP1F.',[],true),
sec('register','6. Registration with OPG',
'The LPA must be **registered with the OPG before it can be used**. The current registration fee is **£82 per LPA** (2024/25 rate — verify before submission). Fee remissions and exemptions apply for low-income donors.\n\nRegistration typically takes **8–10 weeks** from receipt by the OPG. People to be notified ("named persons") must be notified before registration.',[],true),
sec('safeguards','7. Safeguards',
'- The Donor must have **mental capacity** at the time of execution (MCA 2005 s.2-s.3 test).\n- The Donor must not be under **undue influence**.\n- The LPA must be **signed in the correct order** (Donor → Certificate Provider → Attorney(s) → Replacement attorney(s)).\n- Attorneys are subject to the **fiduciary duties** under MCA 2005, must act in the donor\'s best interests (s.4) and may be held to account by the Court of Protection and OPG.',[],true)
]),
tplDef('s21','Section 21 Notice (Form 6A) — drafting note','landlord-tenant',[
sec('header','**Section 21 Notice — Form 6A drafting note**','This is a **drafting note**. The actual notice MUST be served on **prescribed Form 6A** (Assured Shorthold Tenancy Notices and Prescribed Requirements (England) Regulations 2015). Wales has separate provisions under the Renting Homes (Wales) Act 2016.\n\n**Significant statutory restrictions apply — see clause 4 below.**',[],true),
sec('parties','1. The parties',
'**Landlord:** {{client.title}} {{client.firstName}} {{client.lastName}} of {{client.address.line1}}, {{client.address.postcode}}\n\n**Tenant(s):** {{ctx.tenantNames}}\n\n**Property:** {{ctx.propertyAddress}}\n\n**Tenancy start date:** {{ctx.tenancyStartDate}}\n\n**Type of tenancy:** Assured Shorthold Tenancy (AST) under the Housing Act 1988.',[]),
sec('notice','2. Notice required',
'I/we, the landlord(s), give you notice under **section 21 of the Housing Act 1988** that I/we require possession of the dwelling-house known as **{{ctx.propertyAddress}}** after **{{ctx.possessionDate}}**.\n\nThe notice period must be **at least 2 months** (or longer if the tenancy is contractual periodic with a longer period). Following a notice expiry, possession proceedings must be **issued within 6 months** of the date the notice was given (or within 4 months of expiry, whichever is later — refer to s.21(4D) HA 1988).',[],true),
sec('reform','3. Reform — England (Renters\' Rights status)',
'**Important:** at the date of this template (June 2026), the abolition of section 21 ("no-fault evictions") has been the stated policy of successive UK governments and is subject to commencement of provisions in the Renters\' Rights legislation. **You MUST check the current commencement position before serving any notice.** Once s.21 is abolished, only the s.8 ground-based route will remain.',[],true),
sec('prerequisites','4. Statutory pre-conditions',
'A s.21 notice is INVALID unless all of the following are satisfied:\n\n1. **Deposit** (if taken) is held in a government-authorised TDP scheme AND the prescribed information was served on the tenant.\n2. The landlord has provided the tenant with: (a) a copy of the current **EPC** (rating E or above — MEES); (b) a current **gas safety certificate** (Gas Safety (Installation and Use) Regulations 1998); (c) the **"How to rent" booklet** (current government version).\n3. The property has **the correct licence** if in a selective / mandatory licensing area.\n4. No s.21 may be served in the **first 4 months** of the original tenancy.\n5. No "**retaliatory eviction**" — the notice is invalid if served within 6 months of the tenant making a written complaint about disrepair and the local authority serving an improvement / remedial notice (Deregulation Act 2015, s.33).',[],true),
sec('service','5. Service',
'Serve by personal delivery, first-class post, or in accordance with any service clause in the tenancy. Keep a dated copy and proof of service (certificate of posting, photo, witness statement).',[]),
sec('next','6. After expiry',
'If the tenant does not leave by the date in the notice, you must apply to the County Court for a **possession order** — either the **accelerated procedure** (CPR 55 Section II) where the s.21 conditions are clearly met, or the **standard procedure**. Bailiffs (or High Court enforcement officers, by transfer) carry out the warrant if needed.',[])
]),
tplDef('s8','Section 8 Notice (rent arrears) — drafting note','landlord-tenant',[
sec('header','**Section 8 Notice — Rent Arrears (Grounds 8, 10, 11) drafting note**','This is a drafting note. Serve on **prescribed Form 3** (Notice seeking possession of a property let on an AST). Statutory references: **Housing Act 1988 s.8 and Schedule 2**.',[],true),
sec('parties','1. The parties and the tenancy',
'**Landlord:** {{client.title}} {{client.firstName}} {{client.lastName}}\n**Tenant(s):** {{ctx.tenantNames}}\n**Property:** {{ctx.propertyAddress}}\n**Tenancy start date:** {{ctx.tenancyStartDate}}\n**Rent:** £{{ctx.rentAmount}} per {{ctx.rentPeriod}}',[]),
sec('grounds','2. Grounds relied upon',
'I/we intend to seek possession on the following grounds:\n\n- **Ground 8 (mandatory)** — at the date of service of this notice **AND** at the date of the hearing, at least **2 months\' rent arrears** are unpaid (where rent is paid monthly), OR at least 8 weeks where rent is paid weekly/fortnightly. If both dates are satisfied, the court MUST make a possession order.\n- **Ground 10 (discretionary)** — some rent is unpaid at the date of the notice and at the date of issue of proceedings.\n- **Ground 11 (discretionary)** — persistent delay in paying rent that has become lawfully due, whether or not in arrears at the date of issue.',[],true),
sec('arrears','3. Particulars of arrears',
'A schedule of rent arrears to date is annexed. As at {{today}} the arrears total **£{{ctx.arrearsTotal}}**.',[]),
sec('notice-period','4. Notice period',
'For grounds 8, 10 or 11 the notice period is **2 weeks**. After expiry, proceedings must be issued within **12 months** of the date of the notice.',[],true),
sec('reform','5. Recent reforms',
'**Check current law** — notice periods for Ground 8 were extended during the COVID period and reforms to the rent-arrears thresholds (and possible abolition of mandatory Ground 8 under reform legislation) have been under consultation. Verify the position immediately before service.',[],true),
sec('service','6. Service',
'Serve on every tenant by personal delivery, first-class post, or in accordance with any service clause in the tenancy. Keep proof of service.',[]),
sec('proceedings','7. After expiry',
'If arrears remain unpaid, issue a **claim for possession of property** in the County Court (Part 55 CPR), typically with money claim for arrears. The accelerated procedure is NOT available for s.8.',[])
])
];
async function seedTemplates(){
  for(const t of SEED_TEMPLATES){await idbPut('templates',t);}
  state.templates=await idbGetAll('templates');
}
/* ============================== SEED DEMO ============================== */
async function seedDemo(){
  const firmId='fm_'+uuid();
  state.firm={
    id:firmId,createdAt:now(),updatedAt:now(),
    name:'Patel Wealth Ltd',tradingName:'Patel Wealth Solicitors',
    entityType:'limited company',
    sraNo:'000000',colp:'Anjali Patel',cofa:'Anjali Patel',
    complaintsPartner:'Anjali Patel',
    fcaRefNo:'',companiesHouseNo:'',vatNumber:'',
    registeredAddress:{line1:'12 High St',line2:'',city:'London',postcode:'SW1A 1AA',country:'GB'},
    phone:'020 7000 0000',email:'mail@patelwealth.example',
    piInsurer:'Lockton Companies LLP',piPolicyNo:'PI-DEMO-001',piExpiresAt:Date.parse('2027-04-01'),piExpiryDateText:'1 April 2027',
    professionalBody:'',brandColor:'#8b1a1a',brandLogoDataUri:'',
    liabilityCap:'3,000,000',
    clientAccountName:'Patel Wealth Ltd Client Account',clientAccountSort:'00-00-00',clientAccountNumber:'00000000',
    setupCompletedAt:now()
  };
  await idbPut('firms',state.firm);
  const adviserId='ad_'+uuid();
  const adv={id:adviserId,firmId,createdAt:now(),updatedAt:now(),archivedAt:null,
    name:'Anjali Patel',email:'anjali@patelwealth.example',phone:'020 7000 0000',
    smcrRole:'partner',practicingCertNo:'000000',practicingCertExpiry:'2027-10-31',
    cpdHoursThisYear:14,cpdActivities:[],status:'active',startedAt:now(),leftAt:null
  };
  state.advisers.push(adv);await idbPut('advisers',adv);
  const clientId='cl_'+uuid();
  const cl={id:clientId,firmId,createdAt:now(),updatedAt:now(),archivedAt:null,
    title:'Mr',firstName:'Rajesh',middleName:'',lastName:'Singh',preferredName:'Raj',
    dob:'1978-02-14',gender:'male',nationality:'GB',countryOfResidence:'GB',
    nino:'AB123456C',utr:'',taxResidency:['GB'],
    email:'raj@example.com',phone:'+44 7700 900111',
    address:{line1:'4 Park Lane',line2:'',city:'London',region:'England',postcode:'W1K 1AA',country:'GB',since:'2018-01-01'},
    addressHistory:[],relationships:[],
    clientType:'individual',entityNumber:'',
    kyc:{status:'verified',riskGrade:'low',pepFlag:false,pepDetails:'',sanctionsStatus:'clear',sanctionsCheckedAt:now(),sanctionsCheckedBy:adviserId,
      sourceOfFunds:'earnings',sourceOfFundsNotes:'PAYE employment income',sourceOfWealth:'earnings',sourceOfWealthNotes:'',
      vulnerableCustomerFlag:false,vulnerabilityCategory:'',vulnerabilityNotes:'',
      documentsHeld:[],lastReviewAt:now(),nextReviewDue:null,
      cdd:{identityVerifiedMethod:'passport',addressVerifiedMethod:'utility',identityVerifiedAt:now(),identityVerifiedBy:adviserId,beneficialOwners:[],psc:[],sourceOfFundsForMatter:'earnings'}},
    suitability:{attitudeToRisk:4,capacityForLoss:'medium',knowledgeExperience:'medium',investmentHorizon:20,objectives:[],incomeNeeds:0,ethicalPreferences:'',lastReviewAt:null},
    adviserId,
    engagement:{startedAt:now(),type:'transactional',feeBasis:'hourly',feeAgreementHash:'',feeAgreementSignedAt:null,initialFee:0,ongoingFee:0,nextReviewDue:null},
    notes:[],links:{falladviserScenarios:[],fallpracticeFeeLedgerIds:[],fallpaperDocumentIds:[]}
  };
  state.clients.push(cl);await idbPut('clients',cl);
  const matterId='mt_'+uuid();
  const mt={id:matterId,firmId,clientId,ts:now(),updatedAt:now(),closedAt:null,
    ref:'M-2026-001',title:'Singh v Insurer — RTA quantum',
    practiceArea:'personal-injury',
    responsibleSolicitorId:adviserId,supervisingPartnerId:adviserId,
    feeArrangement:'conditional',hourlyRate:285,fixedFee:0,cfaSuccessFeePct:25,
    estimatedFees:8500,
    retainerScope:'Acting on the personal injury claim arising from the road traffic accident on 14 March 2026',
    retainerLimits:'Does not include any criminal proceedings or appeal beyond first instance',
    conflictCheckedAt:now(),conflictCheckedBy:adviserId,conflictStatus:'clear',conflictNotes:'',
    clientCareSentAt:null,status:'active',riskRating:'standard',
    outcomes:[],fileRefs:[],feeRecords:[],
    partyOpposing:'Drive-Safe Insurance Ltd',courtRef:'',
    limitationDate:Date.parse('2029-03-14'),
    nextHearingDate:null,nextStepDue:null,
    typicalDurationText:'12–24 months from issue to settlement or trial'
  };
  state.matters.push(mt);await idbPut('matters',mt);
  // demo engagement letter
  const tpl=SEED_TEMPLATES.find(t=>t.id==='engagement');
  const r=renderTemplate(tpl.id,clientId,matterId,{overrides:{}});
  const md=renderMarkdown(tpl,clientId,matterId,{overrides:{}});
  const doc={
    id:'dc_'+uuid(),
    clientId,matterId,templateId:tpl.id,
    version:tpl.version,
    title:'DEMO · Patel Wealth Ltd · overwrite me',
    html:r.html,markdown:md,
    sha256:await sha256(r.html),
    generatedAt:now(),generatedBy:adviserId,
    signed:false,signedAt:null,signatureHash:''
  };
  state.documents.push(doc);await idbPut('documents',doc);
  await auditLog('demo.seeded',{clientId,matterId,adviserId,reasoning:'Initial empty-state demo data (Marcus Osei rule).',payload:{firmId,clientId,matterId,docId:doc.id}});
}
/* ============================== TEMPLATE ENGINE ============================== */
function getCtx(clientId,matterId,extra){
  const client=state.clients.find(c=>c.id===clientId)||{address:{},kyc:{}};
  const matter=state.matters.find(m=>m.id===matterId)||{};
  const adviser=state.advisers.find(a=>a.id===(matter.responsibleSolicitorId||client.adviserId))||{};
  const supervisor=state.advisers.find(a=>a.id===matter.supervisingPartnerId)||adviser;
  const firm=state.firm||{registeredAddress:{}};
  const ctx={
    today:today(),
    client:client,matter:matter,adviser:adviser,supervisor:supervisor,firm:firm,
    docRef:'L-'+(new Date()).getFullYear()+'-'+(state.documents.length+1).toString().padStart(4,'0'),
    ctx:(extra&&extra.ctx)||{}
  };
  return ctx;
}
function fillBody(body,ctx){
  if(!body)return '';
  return body.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g,(m,path)=>{
    const v=get(ctx,path);
    if(v==null||v==='')return '<span class="placeholder-empty">{{'+path+'}}</span>';
    return esc(String(v));
  });
}
function mdToHtml(md){
  if(!md)return '';
  let s=esc(md);
  s=s.replace(/&lt;span class=&quot;placeholder-empty&quot;&gt;/g,'<span class="placeholder-empty">')
     .replace(/&lt;\/span&gt;/g,'</span>');
  s=s.replace(/\[SIGNATURE_BLOCK\]/g,'<div class="sig-block"><strong>Signed:</strong> ______________________________  <strong>Date:</strong> ____________<br><br><strong>Print name:</strong> ______________________________</div>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  const lines=s.split('\n');
  let out=[],inUL=false,inOL=false;
  for(let line of lines){
    if(/^\s*-\s+/.test(line)){
      if(!inUL){if(inOL){out.push('</ol>');inOL=false;}out.push('<ul>');inUL=true;}
      out.push('<li>'+line.replace(/^\s*-\s+/,'')+'</li>');
    }else if(/^\s*\d+\.\s+/.test(line)){
      if(!inOL){if(inUL){out.push('</ul>');inUL=false;}out.push('<ol>');inOL=true;}
      out.push('<li>'+line.replace(/^\s*\d+\.\s+/,'')+'</li>');
    }else{
      if(inUL){out.push('</ul>');inUL=false;}
      if(inOL){out.push('</ol>');inOL=false;}
      if(line.trim()==='')out.push('');
      else if(/^---$/.test(line.trim()))out.push('<hr>');
      else out.push('<p>'+line+'</p>');
    }
  }
  if(inUL)out.push('</ul>');
  if(inOL)out.push('</ol>');
  return out.join('\n');
}
function renderTemplate(tplId,clientId,matterId,extra){
  const tpl=state.templates.find(t=>t.id===tplId);
  if(!tpl)return {html:'<p>Template not found</p>',missing:[]};
  const ctx=getCtx(clientId,matterId,extra);
  const overrides=(extra&&extra.overrides)||{};
  const parts=[];
  const missing=[];
  for(const s of tpl.sections){
    const cust=overrides[s.id];
    const headingHtml=s.heading?mdToHtml(fillBody(s.heading,ctx)):'';
    if(cust!=null){
      parts.push(`<div class="section ${s.locked?'locked-clause':''}" data-sec="${esc(s.id)}">${headingHtml}<div class="editable" contenteditable="${s.locked?'false':'true'}" data-sec-body="${esc(s.id)}">${cust}</div></div>`);
    }else{
      const bodyHtml=mdToHtml(fillBody(s.body,ctx));
      for(const f of (s.requiredFields||[])){const v=get(ctx,f);if(v==null||v==='')missing.push({sec:s.id,field:f});}
      parts.push(`<div class="section ${s.locked?'locked-clause':''}" data-sec="${esc(s.id)}">${headingHtml}<div class="editable" contenteditable="${s.locked?'false':'true'}" data-sec-body="${esc(s.id)}">${bodyHtml}</div></div>`);
    }
  }
  return {html:parts.join('\n'),missing};
}
function renderMarkdown(tpl,clientId,matterId,extra){
  const ctx=getCtx(clientId,matterId,extra);
  const overrides=(extra&&extra.overrides)||{};
  const lines=[];
  lines.push('# '+tpl.name);lines.push('');
  for(const s of tpl.sections){
    if(s.heading){lines.push('## '+fillBodyMd(s.heading,ctx));lines.push('');}
    const body=overrides[s.id]!=null?stripHtml(overrides[s.id]):fillBodyMd(s.body,ctx);
    lines.push(body);lines.push('');
  }
  return lines.join('\n');
}
function fillBodyMd(body,ctx){
  if(!body)return '';
  return body.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g,(m,path)=>{
    const v=get(ctx,path);
    if(v==null||v==='')return '«'+path+'»';
    return String(v);
  });
}
function stripHtml(s){return String(s).replace(/<br\s*\/?>/g,'\n').replace(/<\/p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");}
function standaloneHtml(innerHtml,title){
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title||'Document')}</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 30px;color:#1a1611;line-height:1.65;background:#f3eee2}
h1{font-size:20px;border-bottom:1px solid #cfc7b3;padding-bottom:8px}
h2{font-size:15px;color:#5a1818;margin-top:18px}
h3{font-size:13px}
.locked-clause{padding:6px 10px;background:rgba(184,151,74,0.06);border-left:2px solid #b8974a;margin:6px 0}
.sig-block{margin-top:24px;padding:14px;border:1px dashed #cfc7b3}
.placeholder-empty{background:#ffe9b3;color:#8b1a1a;padding:0 4px}</style>
</head><body><div class="paper">${innerHtml}</div></body></html>`;
}
/* ============================== T0 RULES ============================== */
const T0_RULES=[
  {q:'When must the engagement letter be sent?',a:'Before, or as soon as practicable after, accepting the retainer. SRA Code paras 8.6 and 8.7 require you to give the client information about regulatory status, complaints, costs and the service you will provide at the outset.'},
  {q:'What do SRA Transparency Rules require on costs?',a:'For specified work types (residential conveyancing, probate (uncontested, of UK estate), immigration (excl. asylum), motoring offences (summary), employment tribunal claims, debt recovery up to £100k, licensing applications for business premises) the firm must publish prices, the basis of those prices, disbursements, and key information on the website. For all matters, para 8.7 still requires the best possible information about cost.'},
  {q:'What is the cap on a CFA success fee?',a:'100% of base costs (statutory cap, Article 3 of the Conditional Fee Agreements Order 2013). In personal injury cases there is an additional cap of 25% of damages (excluding future-care and future-loss damages) — Article 5.'},
  {q:'What is the cap on a DBA payment?',a:'25% of damages in personal injury (first instance), 35% in employment tribunal claims, 50% in all other civil/commercial claims (first instance). All caps INCLUDE VAT (DBA Regs 2013, regs 4 and 7).'},
  {q:'What are the client-care requirements?',a:'SRA Code paras 8.6–8.11: tell the client at the outset who is handling their matter, their status, supervisors; complaints right (LeO and SRA routes); pricing/costs information; regulatory information about the firm. Update these whenever materially changed.'},
  {q:'How does a client complain to the Legal Ombudsman?',a:'After exhausting the firm internal procedure (firm has 8 weeks to give a final response). Refer within 6 months of final response AND within 1 year of the act/omission (or within 1 year of when they reasonably should have known). LeO: PO Box 6167, Slough SL1 0EH · 0300 555 0333 · enquiries@legalombudsman.org.uk.'},
  {q:'What are the pre-action protocol limits?',a:'CPR Practice Direction on Pre-Action Conduct: exchange enough information to understand each other position, consider ADR, act proportionately. Typical reply periods in specific protocols range from 14 days (debt) to 4 months (clinical negligence response). A standard Letter Before Action conventionally gives 14 days for substantive response.'},
  {q:'How should we handle a vulnerable client?',a:'(1) Identify drivers — health, life event, resilience, capability. (2) Capacity test under MCA 2005 s.3 is decision-specific and time-specific; presume capacity. (3) Adjust communication: plain English, extra time, written follow-up, trusted-third-party support (not substitute). (4) Take instructions in private if undue influence suspected. (5) Document everything; review at every substantive meeting.'},
  {q:'What is the position on section 21 reform?',a:'Successive UK governments have committed to abolishing s.21 "no-fault" evictions for ASTs. As at June 2026, check the commencement position of the Renters\' Rights Act provisions — once commenced, only s.8 ground-based possession will be available. Wales already moved to the Renting Homes (Wales) Act 2016 model.'},
  {q:'What are the grounds for challenging a Will?',a:'(1) Lack of testamentary capacity (Banks v Goodfellow). (2) Lack of knowledge and approval. (3) Undue influence (high bar — actual influence, not just opportunity). (4) Forgery / fraud. (5) Improper execution under Wills Act 1837 s.9. (6) Revocation. Separately under the Inheritance (Provision for Family and Dependants) Act 1975 — claim for reasonable financial provision (not a challenge to the will itself).'},
  {q:'What is the LPA registration fee?',a:'£82 per LPA (one fee for Property & Financial Affairs, one for Health & Welfare) — Office of the Public Guardian 2024/25 rate (verify before submission, fees periodically updated). Remissions and exemptions are available for donors on low income or in receipt of certain means-tested benefits.'},
  {q:'When must ATE insurance be disclosed?',a:'Since 1 April 2013 (LASPO), ATE premiums are no longer recoverable from the losing opponent (except, in clinical negligence cases, the part of the premium relating to expert reports on liability and causation). The client must be told this clearly. CPR 44 requires costs budgeting/management which records insurance position. The client must also be advised on alternative funding options before signing any CFA or DBA (SRA Code para 8.7).'}
];
/* ============================== RENDER ============================== */
function render(){
  if(!state.ready){$('#app').innerHTML='<div class="empty">Loading…</div>';return;}
  $('#tabs').innerHTML=TABS.map(t=>`<button data-tab="${t.id}" class="${state.ui.tab===t.id?'active':''}"><span>${t.ico}</span> ${t.name}</button>`).join('');
  let html='<div class="disclaimer"><strong>Sovereign — research only.</strong> FallLegalPaper is a tool for SRA-regulated UK solicitors. It assists with matter management, CDD, document generation and SRA Accounts Rules tracking. It is not regulatory submission or legal opinion software. The firm COLP/COFA remain responsible. Client data never leaves the device unless exported.</div>';
  switch(state.ui.tab){
    case 'dashboard':html+=viewDashboard();break;
    case 'clients':html+=viewClients();break;
    case 'matters':html+=viewMatters();break;
    case 'generate':html+=viewGenerate();break;
    case 'documents':html+=viewDocuments();break;
    case 'templates':html+=viewTemplates();break;
    case 'audit':html+=viewAudit();break;
    case 't0':html+=viewT0();break;
    case 'chat':html+=viewChat();break;
    case 'firm':html+=viewFirm();break;
    case 'settings':html+=viewSettings();break;
  }
  $('#app').innerHTML=html;
}
function viewDashboard(){
  const liveMesh=Object.keys(meshSeen);
  return `
<div class="section-h"><h2>Dashboard</h2><div class="sub">v${VERSION} · prime ${PRIME} · ${state.documents.length} docs · ${state.clients.length} clients · ${state.matters.length} matters</div></div>
<div class="grid">
  <div class="card hot"><h3>Generate a document</h3><div class="meta">templates · ${state.templates.length}</div><div class="body">Choose a client + matter and a template to produce SRA-compliant paperwork.</div><div style="margin-top:10px"><button class="btn" data-action="go-generate">Generate →</button></div></div>
  <div class="card"><h3>Clients</h3><div class="meta">total · ${state.clients.length}</div><div class="body">${state.clients.slice(0,3).map(c=>esc(c.firstName+' '+c.lastName)).join(' · ')||'No clients yet'}</div><div style="margin-top:10px"><button class="btn ghost sm" data-tab="clients">Manage →</button></div></div>
  <div class="card"><h3>Matters</h3><div class="meta">active · ${state.matters.filter(m=>m.status==='active').length}</div><div class="body">${state.matters.slice(0,3).map(m=>esc(m.ref+' '+(m.title||''))).join('<br>')||'No matters yet'}</div><div style="margin-top:10px"><button class="btn ghost sm" data-tab="matters">Manage →</button></div></div>
  <div class="card"><h3>Audit chain</h3><div class="meta">entries · ${state.audit.length}</div><div class="body">SHA-256 chained, 6-year retention per SRA rule 13.5.</div><div style="margin-top:10px"><button class="btn ghost sm" data-tab="audit">Inspect →</button></div></div>
</div>
<div class="card" style="margin-top:14px">
  <h3>Bundle mesh <span class="meta">fall-law · prime ${PRIME}</span></h3>
  <div class="body">FallLegalPaper participates in the <strong>falllegal</strong> bundle via <code>BroadcastChannel('fall-law')</code> for client/matter sync, and <code>BroadcastChannel('fall-signal')</code> for the wider estate mesh.</div>
  <div class="bundle-mesh">
    ${['falllegal','falllegalonboard','falllegalpaper','falllegalpractice'].map(n=>{
      const live=liveMesh.includes(n);const self=n===TOOLNAME;
      const pr={falllegal:743,falllegalonboard:751,falllegalpaper:757,falllegalpractice:761}[n];
      return `<div class="mesh-node ${self?'self':''} ${live?'live':''}">${n}${self?' (self)':''}<div class="pr">prime ${pr}${live&&!self?' · live':''}</div></div>`;
    }).join('')}
  </div>
  <div style="margin-top:10px"><button class="btn ghost sm" data-action="resync">↻ sync.request</button></div>
</div>`;
}
function viewClients(){
  if(state.clients.length===0)return '<div class="section-h"><h2>Clients</h2><div class="actions"><button class="btn" data-action="client-new">+ new client</button></div></div><div class="empty"><p>No clients yet. Add one or wait for sync from <code>fall-law</code>.</p></div>';
  return `<div class="section-h"><h2>Clients</h2><div class="sub">${state.clients.length} records</div><div class="actions"><button class="btn" data-action="client-new">+ new client</button></div></div>
  <div class="grid">${state.clients.map(c=>`
    <div class="card">
      <h3>${esc((c.title||'')+' '+(c.firstName||'')+' '+(c.lastName||''))}</h3>
      <div class="meta">${esc(c.clientType||'individual')} · ${esc((c.kyc&&c.kyc.status)||'pending')}</div>
      <div class="body">${esc(c.email||'')} · ${esc(c.phone||'')}<br>${esc((c.address&&c.address.line1)||'')}, ${esc((c.address&&c.address.postcode)||'')}</div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn ghost sm" data-action="client-edit" data-id="${c.id}">edit</button>
        <button class="btn ghost sm" data-action="select-client-gen" data-id="${c.id}">→ generate</button>
        <button class="btn ghost sm" data-action="client-delete" data-id="${c.id}">archive</button>
      </div>
    </div>`).join('')}</div>`;
}
function viewMatters(){
  if(state.matters.length===0)return '<div class="section-h"><h2>Matters</h2><div class="actions"><button class="btn" data-action="matter-new">+ new matter</button></div></div><div class="empty"><p>No matters yet.</p></div>';
  return `<div class="section-h"><h2>Matters</h2><div class="sub">${state.matters.length} matters</div><div class="actions"><button class="btn" data-action="matter-new">+ new matter</button></div></div>
  <div class="grid">${state.matters.map(m=>{const cl=state.clients.find(c=>c.id===m.clientId);return `
    <div class="card">
      <h3>${esc(m.ref)} · ${esc(m.title||'')}</h3>
      <div class="meta">${esc(m.practiceArea)} · ${esc(m.feeArrangement)} · <span class="tag ${m.status==='active'?'green':'brass'}">${esc(m.status)}</span></div>
      <div class="body"><strong>Client:</strong> ${esc(cl?(cl.firstName+' '+cl.lastName):'—')}<br><strong>Est fees:</strong> £${esc(m.estimatedFees||0)}<br><strong>Conflict:</strong> ${esc(m.conflictStatus||'pending')}</div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn ghost sm" data-action="matter-edit" data-id="${m.id}">edit</button>
        <button class="btn ghost sm" data-action="select-matter-gen" data-id="${m.id}">→ generate</button>
        ${m.status!=='closed'?`<button class="btn ghost sm" data-action="matter-close" data-id="${m.id}">close</button>`:`<button class="btn ghost sm" data-action="matter-reopen" data-id="${m.id}">reopen</button>`}
      </div>
    </div>`;}).join('')}</div>`;
}
function viewGenerate(){
  const clientId=state.ui.selectedClientId||(state.clients[0]&&state.clients[0].id);
  const matterId=state.ui.selectedMatterId||(state.matters.find(m=>m.clientId===clientId)||{}).id;
  const tplId=state.ui.selectedTemplateId||(state.templates[0]&&state.templates[0].id);
  const preview=clientId&&tplId?renderTemplate(tplId,clientId,matterId,{overrides:state.ui.editorOverrides||{}}):{html:'<p style="padding:30px;color:#888">Choose client + template to preview</p>',missing:[]};
  return `<div class="section-h"><h2>Generate document</h2><div class="sub">live preview · inline edit · locked clauses ⛯</div></div>
<div class="paper-wrap">
  <div class="paper" id="paper">${preview.html}</div>
  <div class="side-panel">
    <h4>Client</h4>
    <select id="sel-client" data-bind-select="sel-client">${state.clients.map(c=>`<option value="${c.id}" ${c.id===clientId?'selected':''}>${esc((c.firstName||'')+' '+(c.lastName||''))}</option>`).join('')}</select>
    <h4 style="margin-top:12px">Matter</h4>
    <select id="sel-matter" data-bind-select="sel-matter">${[{id:'',ref:'(none)',title:''}].concat(state.matters.filter(m=>!clientId||m.clientId===clientId)).map(m=>`<option value="${m.id}" ${m.id===matterId?'selected':''}>${esc(m.ref?(m.ref+' · '+m.title):'(none)')}</option>`).join('')}</select>
    <h4 style="margin-top:14px">Template</h4>
    <div class="tpl-list">${state.templates.map(t=>`<div class="tpl-item ${t.id===tplId?'active':''}" data-pick-tpl="${t.id}">${esc(t.name)}<small>${esc(t.practiceArea)}</small></div>`).join('')}</div>
    <h4>Actions</h4>
    <div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn" data-action="doc-commit">⬇ commit document</button>
      <button class="btn ghost" data-action="doc-export-md">↓ markdown</button>
      <button class="btn ghost" data-action="doc-export-html">↓ html</button>
      <button class="btn ghost" data-action="doc-print">⎙ print / FallPDF</button>
      <button class="btn ghost" data-action="doc-reset-edits">↺ reset edits</button>
    </div>
    ${preview.missing&&preview.missing.length?`<h4 style="margin-top:12px;color:var(--amber)">Missing fields</h4><div style="font-size:11px;color:var(--cream-muted)">${preview.missing.slice(0,8).map(m=>esc(m.field)).join(' · ')}</div>`:''}
    <h4 style="margin-top:12px">Hint</h4>
    <div style="font-size:11px;color:var(--cream-muted)">Click any unlocked paragraph to edit. Locked regulatory clauses (LeO, SRA, retention) cannot be edited — they are padlocked ⛯. Use <span class="kbd">commit</span> to write a Document record into IDB.</div>
  </div>
</div>`;
}
function viewDocuments(){
  const f=state.ui.documentFilter;
  let docs=state.documents.slice();
  if(f.client)docs=docs.filter(d=>d.clientId===f.client);
  if(f.matter)docs=docs.filter(d=>d.matterId===f.matter);
  if(f.template)docs=docs.filter(d=>d.templateId===f.template);
  if(f.status==='signed')docs=docs.filter(d=>d.signed);
  if(f.status==='draft')docs=docs.filter(d=>!d.signed);
  return `<div class="section-h"><h2>Document library</h2><div class="sub">${docs.length} of ${state.documents.length} · sha-256 versioned</div></div>
<div class="card" style="margin-bottom:12px">
  <div class="row3">
    <div class="field"><label>Client</label><select data-bind-filter="client"><option value="">All</option>${state.clients.map(c=>`<option value="${c.id}" ${f.client===c.id?'selected':''}>${esc(c.firstName+' '+c.lastName)}</option>`).join('')}</select></div>
    <div class="field"><label>Matter</label><select data-bind-filter="matter"><option value="">All</option>${state.matters.map(m=>`<option value="${m.id}" ${f.matter===m.id?'selected':''}>${esc(m.ref)}</option>`).join('')}</select></div>
    <div class="field"><label>Template</label><select data-bind-filter="template"><option value="">All</option>${state.templates.map(t=>`<option value="${t.id}" ${f.template===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
  </div>
  <div class="field" style="margin-bottom:0"><label>Status</label><select data-bind-filter="status"><option value="">All</option><option value="draft" ${f.status==='draft'?'selected':''}>Draft</option><option value="signed" ${f.status==='signed'?'selected':''}>Signed</option></select></div>
</div>
${docs.length===0?'<div class="empty">No documents match the filter.</div>':`<table class="docs-table"><thead><tr><th>Title</th><th>Template</th><th>Client</th><th>Generated</th><th>Status</th><th>SHA</th><th></th></tr></thead><tbody>${docs.map(d=>{const cl=state.clients.find(c=>c.id===d.clientId);return `<tr><td>${esc(d.title||'(untitled)')}</td><td>${esc(d.templateId)} v${esc(d.version)}</td><td>${esc(cl?cl.firstName+' '+cl.lastName:'—')}</td><td>${fmtDT(d.generatedAt)}</td><td>${d.signed?'<span class="tag green">signed</span>':'<span class="tag brass">draft</span>'}</td><td><code style="font-size:10px;color:var(--cream-muted)">${esc((d.sha256||'').slice(0,8))}</code></td><td><button class="btn ghost sm" data-action="doc-view" data-id="${d.id}">view</button> <button class="btn ghost sm" data-action="doc-sign" data-id="${d.id}">${d.signed?'unsign':'sign'}</button> <button class="btn ghost sm" data-action="doc-delete" data-id="${d.id}">×</button></td></tr>`;}).join('')}</tbody></table>`}`;
}
function viewTemplates(){
  return `<div class="section-h"><h2>Templates</h2><div class="sub">${state.templates.length} templates · locked clauses padlocked ⛯</div><div class="actions"><button class="btn ghost sm" data-action="tpl-reseed">↻ reseed defaults</button><button class="btn" data-action="tpl-new">+ custom template</button></div></div>
<div class="grid">${state.templates.map(t=>`
  <div class="card">
    <h3>${esc(t.name)}</h3>
    <div class="meta">${esc(t.id)} · v${esc(t.version)} · ${esc(t.practiceArea)}</div>
    <div class="body">${t.sections.length} sections · ${t.sections.filter(s=>s.locked).length} locked clause(s)</div>
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn ghost sm" data-action="tpl-edit" data-id="${t.id}">edit</button>
      <button class="btn ghost sm" data-action="select-tpl-gen" data-id="${t.id}">→ generate</button>
      ${t.custom?`<button class="btn ghost sm" data-action="tpl-delete" data-id="${t.id}">×</button>`:''}
    </div>
  </div>`).join('')}</div>`;
}
function viewAudit(){
  const rows=state.audit.slice().reverse().slice(0,400);
  return `<div class="section-h"><h2>Audit chain</h2><div class="sub">${state.audit.length} entries · SHA-256 chained · 6yr retention (SRA 13.5)</div><div class="actions"><button class="btn ghost sm" data-action="audit-export">↓ export JSON</button><button class="btn ghost sm" data-action="audit-verify">verify chain</button></div></div>
${rows.length===0?'<div class="empty">No audit entries yet.</div>':`<div class="card" style="padding:0">${rows.map(e=>`<div class="audit-row"><div>#${e.i}</div><div>${fmtDT(e.ts)}</div><div><strong style="color:var(--cream)">${esc(e.action)}</strong>${e.reasoning?' · '+esc(e.reasoning):''}</div><div title="${esc(e.docHash)}">${esc((e.docHash||'').slice(0,8))}</div></div>`).join('')}</div>`}`;
}
function viewT0(){
  return `<div class="section-h"><h2>T0 rules <span class="sub" style="margin-left:8px">${T0_RULES.length} offline answers · no network</span></h2></div>
<div class="card"><div class="body">These are deterministic, offline-routed rules for the 12 most frequent regulatory queries. They do <strong>not</strong> require an LLM. The wider chat tab supports BYOK T3 (Anthropic).</div></div>
<div class="t0-rules">${T0_RULES.map((r,i)=>`<div class="t0-rule" data-t0="${i}"><strong>${esc(r.q)}</strong>${esc(r.a)}</div>`).join('')}</div>`;
}
function viewChat(){
  const tier=state.settings.anthropicKey?'T3 (Anthropic BYOK)':'T0 (offline rule routing only)';
  return `<div class="section-h"><h2>Chat</h2><div class="sub">${tier}</div></div>
<div class="card" style="margin-bottom:12px"><div class="body">Routes your question to T0 if it matches one of the 12 offline rules; otherwise to T3 (Anthropic) if an API key is set in Settings. No telemetry. Conversations are not persisted across sessions.</div></div>
<div id="chat-log" style="margin-bottom:12px">${state.ui.chatLog.map(m=>`<div class="chat-msg ${m.who}"><div class="who">${esc(m.who)} · ${esc(m.tier||'')}</div>${esc(m.text).replace(/\n/g,'<br>')}</div>`).join('')||'<div class="empty">Ask anything regulatory: "When must I send a CFA?", "DBA cap in PI?", "LeO referral period?"…</div>'}</div>
<div class="card"><div class="field" style="margin-bottom:8px"><label>Question</label><textarea id="chat-q" placeholder="ask about engagement timing, SRA Transparency, CFA caps, complaints, LBA, vulnerable clients…" rows="3"></textarea></div><button class="btn" data-action="chat-send">Ask →</button> <button class="btn ghost sm" data-action="chat-clear">Clear</button></div>`;
}
function viewFirm(){
  const f=state.firm||{registeredAddress:{}};
  return `<div class="section-h"><h2>Firm</h2><div class="sub">single firm record · synced via fall-law</div></div>
<div class="card">
  <div class="row2"><div class="field"><label>Firm name</label><input id="f-name" value="${esc(f.name||'')}"></div><div class="field"><label>Trading name</label><input id="f-tn" value="${esc(f.tradingName||'')}"></div></div>
  <div class="row3"><div class="field"><label>Entity type</label><input id="f-et" value="${esc(f.entityType||'')}"></div><div class="field"><label>SRA No.</label><input id="f-sra" value="${esc(f.sraNo||'')}"></div><div class="field"><label>Companies House</label><input id="f-ch" value="${esc(f.companiesHouseNo||'')}"></div></div>
  <div class="row2"><div class="field"><label>COLP</label><input id="f-colp" value="${esc(f.colp||'')}"></div><div class="field"><label>COFA</label><input id="f-cofa" value="${esc(f.cofa||'')}"></div></div>
  <div class="row2"><div class="field"><label>Complaints partner</label><input id="f-cp" value="${esc(f.complaintsPartner||'')}"></div><div class="field"><label>Liability cap (£)</label><input id="f-lc" value="${esc(f.liabilityCap||'3,000,000')}"></div></div>
  <div class="row3"><div class="field"><label>Phone</label><input id="f-ph" value="${esc(f.phone||'')}"></div><div class="field"><label>Email</label><input id="f-em" value="${esc(f.email||'')}"></div><div class="field"><label>VAT</label><input id="f-vat" value="${esc(f.vatNumber||'')}"></div></div>
  <h4 style="font-family:var(--serif);color:var(--brass);margin:10px 0 6px">Registered address</h4>
  <div class="row2"><div class="field"><label>Line 1</label><input id="f-l1" value="${esc((f.registeredAddress&&f.registeredAddress.line1)||'')}"></div><div class="field"><label>Line 2</label><input id="f-l2" value="${esc((f.registeredAddress&&f.registeredAddress.line2)||'')}"></div></div>
  <div class="row3"><div class="field"><label>City</label><input id="f-city" value="${esc((f.registeredAddress&&f.registeredAddress.city)||'')}"></div><div class="field"><label>Postcode</label><input id="f-pc" value="${esc((f.registeredAddress&&f.registeredAddress.postcode)||'')}"></div><div class="field"><label>Country</label><input id="f-co" value="${esc((f.registeredAddress&&f.registeredAddress.country)||'GB')}"></div></div>
  <h4 style="font-family:var(--serif);color:var(--brass);margin:10px 0 6px">PI insurance</h4>
  <div class="row3"><div class="field"><label>Insurer</label><input id="f-pii" value="${esc(f.piInsurer||'')}"></div><div class="field"><label>Policy No.</label><input id="f-pip" value="${esc(f.piPolicyNo||'')}"></div><div class="field"><label>Expiry (text)</label><input id="f-pix" value="${esc(f.piExpiryDateText||'')}"></div></div>
  <h4 style="font-family:var(--serif);color:var(--brass);margin:10px 0 6px">Client account</h4>
  <div class="row3"><div class="field"><label>Account name</label><input id="f-can" value="${esc(f.clientAccountName||'')}"></div><div class="field"><label>Sort code</label><input id="f-cas" value="${esc(f.clientAccountSort||'')}"></div><div class="field"><label>Account number</label><input id="f-cano" value="${esc(f.clientAccountNumber||'')}"></div></div>
  <div style="margin-top:12px"><button class="btn" data-action="firm-save">Save firm</button></div>
</div>`;
}
function viewSettings(){
  return `<div class="section-h"><h2>Settings</h2><div class="sub">sovereign · BYOK · no telemetry</div></div>
<div class="card">
  <div class="field"><label>Anthropic API key (T3 BYOK · never leaves device)</label><input id="s-key" type="password" placeholder="sk-ant-..." value="${esc(state.settings.anthropicKey||'')}"></div>
  <div class="field"><label><input type="checkbox" id="s-audit" ${state.settings.auditChain?'checked':''}> audit chain on every change</label></div>
  <div class="row2"><div class="field"><label>Custom brand name (forkable)</label><input id="s-bn" value="${esc(state.settings.customBrandName||'')}"></div><div class="field"><label>Custom brand colour</label><input id="s-bc" value="${esc(state.settings.customBrandColor||'')}" placeholder="#8b1a1a"></div></div>
  <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" data-action="settings-save">Save</button>
    <button class="btn ghost" data-action="export-all">Export all (JSON)</button>
    <button class="btn ghost" data-action="import-all">Import JSON</button>
    <button class="btn danger" data-action="wipe-all">⚠ wipe IDB</button>
  </div>
  <p style="margin-top:14px;font-size:11px;color:var(--cream-muted);font-family:var(--mono)">${TOOLNAME}@${VERSION} · prime ${PRIME} · schema ${SCHEMA_VERSION} · retention ${RETENTION_YEARS}yr</p>
</div>`;
}
/* ============================== ACTIONS ============================== */
function bindEvents(){
  document.addEventListener('click',async e=>{
    const tabBtn=e.target.closest('[data-tab]');
    if(tabBtn){state.ui.tab=tabBtn.dataset.tab;await persistUI();render();return;}
    const pick=e.target.closest('[data-pick-tpl]');
    if(pick){state.ui.selectedTemplateId=pick.dataset.pickTpl;state.ui.editorOverrides={};await persistUI();render();return;}
    const t0=e.target.closest('[data-t0]');
    if(t0){toast(T0_RULES[+t0.dataset.t0].a.slice(0,160));return;}
    const a=e.target.closest('[data-action]');
    if(!a)return;
    const act=a.dataset.action;
    const id=a.dataset.id;
    if(actions[act])await actions[act](a,id);
  });
  document.addEventListener('change',async e=>{
    const f=e.target.closest('[data-bind-filter]');
    if(f){state.ui.documentFilter[f.dataset.bindFilter]=f.value;await persistUI();render();return;}
    const s=e.target.closest('[data-bind-select]');
    if(s){
      if(s.dataset.bindSelect==='sel-client'){state.ui.selectedClientId=s.value;state.ui.selectedMatterId=null;state.ui.editorOverrides={};await persistUI();render();}
      else if(s.dataset.bindSelect==='sel-matter'){state.ui.selectedMatterId=s.value||null;state.ui.editorOverrides={};await persistUI();render();}
    }
  });
  document.addEventListener('input',e=>{
    const sb=e.target.closest('[data-sec-body]');
    if(sb){state.ui.editorOverrides=state.ui.editorOverrides||{};state.ui.editorOverrides[sb.dataset.secBody]=sb.innerHTML;}
  });
}
const actions={
  'go-generate':async()=>{state.ui.tab='generate';await persistUI();render();},
  'select-client-gen':async(_,id)=>{state.ui.selectedClientId=id;state.ui.tab='generate';state.ui.editorOverrides={};await persistUI();render();},
  'select-matter-gen':async(_,id)=>{const m=state.matters.find(x=>x.id===id);if(m){state.ui.selectedClientId=m.clientId;state.ui.selectedMatterId=id;}state.ui.tab='generate';state.ui.editorOverrides={};await persistUI();render();},
  'select-tpl-gen':async(_,id)=>{state.ui.selectedTemplateId=id;state.ui.tab='generate';state.ui.editorOverrides={};await persistUI();render();},
  'resync':async()=>{if(bcLaw){bcSend(bcLaw,'sync.request',{wants:['clients','advisers','matters','firm']});toast('sync.request broadcast');}else toast('mesh unavailable');},
  'client-new':async()=>{const id='cl_'+uuid();const c={id,firmId:(state.firm&&state.firm.id)||'',createdAt:now(),updatedAt:now(),archivedAt:null,title:'',firstName:'New',middleName:'',lastName:'Client',preferredName:'',dob:'',gender:'',nationality:'GB',countryOfResidence:'GB',nino:'',utr:'',taxResidency:['GB'],email:'',phone:'',address:{line1:'',line2:'',city:'',region:'England',postcode:'',country:'GB',since:''},addressHistory:[],relationships:[],clientType:'individual',entityNumber:'',kyc:{status:'pending',riskGrade:'low',pepFlag:false,pepDetails:'',sanctionsStatus:'not-checked',sanctionsCheckedAt:null,sanctionsCheckedBy:'',sourceOfFunds:'',sourceOfFundsNotes:'',sourceOfWealth:'',sourceOfWealthNotes:'',vulnerableCustomerFlag:false,vulnerabilityCategory:'',vulnerabilityNotes:'',documentsHeld:[],lastReviewAt:null,nextReviewDue:null,cdd:{identityVerifiedMethod:'',addressVerifiedMethod:'',identityVerifiedAt:null,identityVerifiedBy:'',beneficialOwners:[],psc:[],sourceOfFundsForMatter:''}},suitability:{attitudeToRisk:4,capacityForLoss:'medium',knowledgeExperience:'medium',investmentHorizon:0,objectives:[],incomeNeeds:0,ethicalPreferences:'',lastReviewAt:null},adviserId:(state.advisers[0]&&state.advisers[0].id)||'',engagement:{startedAt:now(),type:'transactional',feeBasis:'hourly',feeAgreementHash:'',feeAgreementSignedAt:null,initialFee:0,ongoingFee:0,nextReviewDue:null},notes:[],links:{falladviserScenarios:[],fallpracticeFeeLedgerIds:[],fallpaperDocumentIds:[]}};state.clients.push(c);await idbPut('clients',c);bcSend(bcLaw,'client.created',c);await auditLog('client.created',{clientId:id,reasoning:'New client',payload:{id}});toast('Client added — edit on Clients tab');render();},
  'client-edit':async(_,id)=>{const c=state.clients.find(x=>x.id===id);if(!c)return;const fn=prompt('First name',c.firstName)||c.firstName;const ln=prompt('Last name',c.lastName)||c.lastName;const em=prompt('Email',c.email||'')||c.email;c.firstName=fn;c.lastName=ln;c.email=em;c.updatedAt=now();await idbPut('clients',c);bcSend(bcLaw,'client.updated',c);await auditLog('client.updated',{clientId:id,reasoning:'Manual edit',payload:{id}});render();toast('Client saved');},
  'client-delete':async(_,id)=>{if(!confirm('Archive client?'))return;const c=state.clients.find(x=>x.id===id);if(!c)return;c.archivedAt=now();c.updatedAt=now();await idbPut('clients',c);state.clients=state.clients.filter(x=>x.id!==id);bcSend(bcLaw,'client.updated',c);await auditLog('client.archived',{clientId:id,reasoning:'Soft-archive',payload:{id}});render();toast('Client archived');},
  'matter-new':async()=>{if(state.clients.length===0){toast('Add a client first',1);return;}const clientId=state.ui.selectedClientId||state.clients[0].id;const id='mt_'+uuid();const ref='M-'+new Date().getFullYear()+'-'+(state.matters.length+1).toString().padStart(3,'0');const m={id,firmId:(state.firm&&state.firm.id)||'',clientId,ts:now(),updatedAt:now(),closedAt:null,ref,title:'New matter',practiceArea:'other',responsibleSolicitorId:(state.advisers[0]&&state.advisers[0].id)||'',supervisingPartnerId:(state.advisers[0]&&state.advisers[0].id)||'',feeArrangement:'hourly',hourlyRate:285,fixedFee:0,cfaSuccessFeePct:0,estimatedFees:0,retainerScope:'',retainerLimits:'',conflictCheckedAt:null,conflictCheckedBy:'',conflictStatus:'pending',conflictNotes:'',clientCareSentAt:null,status:'active',riskRating:'standard',outcomes:[],fileRefs:[],feeRecords:[],partyOpposing:'',courtRef:'',limitationDate:null,nextHearingDate:null,nextStepDue:null,typicalDurationText:''};state.matters.push(m);await idbPut('matters',m);bcSend(bcLaw,'matter.created',m);await auditLog('matter.created',{clientId,matterId:id,reasoning:'New matter',payload:{ref}});render();toast('Matter added');},
  'matter-edit':async(_,id)=>{const m=state.matters.find(x=>x.id===id);if(!m)return;const t=prompt('Matter title',m.title)||m.title;const r=prompt('Ref',m.ref)||m.ref;const sc=prompt('Retainer scope',m.retainerScope||'')||m.retainerScope;m.title=t;m.ref=r;m.retainerScope=sc;m.updatedAt=now();await idbPut('matters',m);bcSend(bcLaw,'matter.updated',m);await auditLog('matter.updated',{matterId:id,clientId:m.clientId,reasoning:'Manual edit',payload:{id}});render();toast('Matter saved');},
  'matter-close':async(_,id)=>{const m=state.matters.find(x=>x.id===id);if(!m)return;m.status='closed';m.closedAt=now();m.updatedAt=now();await idbPut('matters',m);bcSend(bcLaw,'matter.closed',m);await auditLog('matter.closed',{matterId:id,clientId:m.clientId,reasoning:'Closed',payload:{id}});render();},
  'matter-reopen':async(_,id)=>{const m=state.matters.find(x=>x.id===id);if(!m)return;m.status='active';m.closedAt=null;m.updatedAt=now();await idbPut('matters',m);bcSend(bcLaw,'matter.reopened',m);await auditLog('matter.reopened',{matterId:id,clientId:m.clientId,reasoning:'Reopened',payload:{id}});render();},
  'doc-commit':async()=>{
    const cid=state.ui.selectedClientId;const mid=state.ui.selectedMatterId;const tid=state.ui.selectedTemplateId;
    if(!cid||!tid){toast('Pick a client + template',1);return;}
    const tpl=state.templates.find(t=>t.id===tid);
    const r=renderTemplate(tid,cid,mid,{overrides:state.ui.editorOverrides||{}});
    const md=renderMarkdown(tpl,cid,mid,{overrides:state.ui.editorOverrides||{}});
    const sh=await sha256(r.html);
    const doc={id:'dc_'+uuid(),clientId:cid,matterId:mid||null,templateId:tid,version:tpl.version,title:tpl.name+' — '+today(),html:r.html,markdown:md,sha256:sh,generatedAt:now(),generatedBy:(state.advisers[0]&&state.advisers[0].id)||'',signed:false,signedAt:null,signatureHash:''};
    state.documents.unshift(doc);await idbPut('documents',doc);
    bcSend(bcLaw,'document.created',{id:doc.id,clientId:cid,matterId:mid,templateId:tid,sha256:sh,generatedAt:doc.generatedAt});
    await auditLog('document.created',{clientId:cid,matterId:mid,reasoning:'Generated '+tpl.name,payload:{id:doc.id,sha256:sh}});
    state.ui.editorOverrides={};
    toast('Document committed — sha '+sh.slice(0,8));render();
  },
  'doc-export-md':async()=>{
    const cid=state.ui.selectedClientId;const mid=state.ui.selectedMatterId;const tid=state.ui.selectedTemplateId;
    if(!cid||!tid)return toast('Pick a client + template',1);
    const tpl=state.templates.find(t=>t.id===tid);
    const md=renderMarkdown(tpl,cid,mid,{overrides:state.ui.editorOverrides||{}});
    download(md,'text/markdown',(tpl.id+'-'+today()+'.md').replace(/[^a-z0-9.\-]+/gi,'-'));
  },
  'doc-export-html':async()=>{
    const cid=state.ui.selectedClientId;const mid=state.ui.selectedMatterId;const tid=state.ui.selectedTemplateId;
    if(!cid||!tid)return toast('Pick a client + template',1);
    const tpl=state.templates.find(t=>t.id===tid);
    const r=renderTemplate(tid,cid,mid,{overrides:state.ui.editorOverrides||{}});
    download(standaloneHtml(r.html,tpl.name),'text/html',(tpl.id+'-'+today()+'.html').replace(/[^a-z0-9.\-]+/gi,'-'));
  },
  'doc-print':async()=>{
    const cid=state.ui.selectedClientId;const mid=state.ui.selectedMatterId;const tid=state.ui.selectedTemplateId;
    if(!cid||!tid)return toast('Pick a client + template',1);
    const tpl=state.templates.find(t=>t.id===tid);
    const r=renderTemplate(tid,cid,mid,{overrides:state.ui.editorOverrides||{}});
    const html=standaloneHtml(r.html,tpl.name);
  },
  'doc-reset-edits':async()=>{state.ui.editorOverrides={};await persistUI();render();toast('Edits reset');},
  'doc-sign':async(_,id)=>{const d=state.documents.find(x=>x.id===id);if(!d)return;if(d.signed){d.signed=false;d.signedAt=null;d.signatureHash='';}else{d.signed=true;d.signedAt=now();d.signatureHash=await sha256(d.html+'|signed:'+d.signedAt);}await idbPut('documents',d);await auditLog(d.signed?'document.signed':'document.unsigned',{clientId:d.clientId,matterId:d.matterId,reasoning:d.signed?'Marked signed':'Sign cleared',payload:{id,signatureHash:d.signatureHash}});render();toast(d.signed?'Signed':'Sign cleared');},
  'doc-delete':async(_,id)=>{if(!confirm('Delete document record?'))return;await idbDel('documents',id);state.documents=state.documents.filter(x=>x.id!==id);await auditLog('document.deleted',{reasoning:'User deletion',payload:{id}});render();},
  'tpl-reseed':async()=>{if(!confirm('Reseed default templates? Custom templates kept.'))return;for(const t of SEED_TEMPLATES){await idbPut('templates',t);}state.templates=await idbGetAll('templates');toast('Templates reseeded');render();},
  'tpl-new':async()=>{const n=prompt('Template name','Custom letter');if(!n)return;const t=tplDef('custom-'+uuid().slice(0,8),n,'other',[sec('body','**'+n+'**','{{client.firstName}} — write your template body here. Placeholders like {{firm.name}} {{matter.ref}} {{today}} interpolate automatically.',[])]);t.custom=true;await idbPut('templates',t);state.templates.push(t);await auditLog('template.created',{reasoning:'Custom template',payload:{id:t.id,name:n}});render();toast('Template created');},
  'tpl-edit':async(_,id)=>{const t=state.templates.find(x=>x.id===id);if(!t)return;const n=prompt('Template name',t.name);if(n){t.name=n;t.updatedAt=now();await idbPut('templates',t);await auditLog('template.updated',{reasoning:'Renamed',payload:{id}});render();}},
  'tpl-delete':async(_,id)=>{if(!confirm('Delete template?'))return;await idbDel('templates',id);state.templates=state.templates.filter(x=>x.id!==id);await auditLog('template.deleted',{reasoning:'User deletion',payload:{id}});render();},
  'firm-save':async()=>{
    const f=state.firm||{id:'fm_'+uuid(),createdAt:now(),registeredAddress:{}};
    f.name=$('#f-name').value;f.tradingName=$('#f-tn').value;f.entityType=$('#f-et').value;
    f.sraNo=$('#f-sra').value;f.companiesHouseNo=$('#f-ch').value;
    f.colp=$('#f-colp').value;f.cofa=$('#f-cofa').value;f.complaintsPartner=$('#f-cp').value;f.liabilityCap=$('#f-lc').value;
    f.phone=$('#f-ph').value;f.email=$('#f-em').value;f.vatNumber=$('#f-vat').value;
    f.registeredAddress={line1:$('#f-l1').value,line2:$('#f-l2').value,city:$('#f-city').value,postcode:$('#f-pc').value,country:$('#f-co').value};
    f.piInsurer=$('#f-pii').value;f.piPolicyNo=$('#f-pip').value;f.piExpiryDateText=$('#f-pix').value;
    f.clientAccountName=$('#f-can').value;f.clientAccountSort=$('#f-cas').value;f.clientAccountNumber=$('#f-cano').value;
    f.updatedAt=now();state.firm=f;await idbPut('firms',f);bcSend(bcLaw,'firm.updated',f);await auditLog('firm.updated',{reasoning:'Manual edit',payload:{id:f.id}});toast('Firm saved');render();
  },
  'settings-save':async()=>{state.settings.anthropicKey=$('#s-key').value;state.settings.auditChain=$('#s-audit').checked;state.settings.customBrandName=$('#s-bn').value;state.settings.customBrandColor=$('#s-bc').value;await persistSettings();toast('Settings saved');render();},
  'audit-export':async()=>{download(JSON.stringify(state.audit,null,2),'application/json','audit-'+TOOLNAME+'-'+today()+'.json');},
  'audit-verify':async()=>{let ok=true;let prev='GENESIS';for(const e of state.audit){const expected=await sha256(JSON.stringify({i:e.i,ts:e.ts,action:e.action,prevHash:prev,payload:e.payload}));if(expected!==e.docHash){ok=false;toast('Chain broken at #'+e.i,1);break;}prev=e.docHash;}if(ok)toast('Chain verified ('+state.audit.length+' entries)');},
  'export-all':async()=>{const dump={tool:TOOLNAME,version:VERSION,exportedAt:now(),firm:state.firm,advisers:state.advisers,clients:state.clients,matters:state.matters,documents:state.documents,templates:state.templates,audit:state.audit,settings:state.settings};download(JSON.stringify(dump,null,2),'application/json',TOOLNAME+'-export-'+today()+'.json');},
  'import-all':async()=>{const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.onchange=async()=>{const f=inp.files[0];if(!f)return;const txt=await f.text();try{const d=JSON.parse(txt);if(d.firm){state.firm=d.firm;await idbPut('firms',d.firm);}for(const arr of [['advisers','advisers'],['clients','clients'],['matters','matters'],['documents','documents'],['templates','templates']]){if(Array.isArray(d[arr[0]])){for(const x of d[arr[0]]){await idbPut(arr[1],x);}}}await loadAll();toast('Imported');render();}catch(e){toast('Import failed',1);}};inp.click();},
  'wipe-all':async()=>{if(!confirm('Wipe ALL IDB data? This cannot be undone.'))return;for(const s of STORES){const all=await idbGetAll(s);for(const x of all){await idbDel(s,x.id);}}state.firm=null;state.advisers=[];state.clients=[];state.matters=[];state.documents=[];state.templates=[];state.audit=[];await seedTemplates();toast('IDB wiped');render();},
  'chat-send':async()=>{
    const q=($('#chat-q')||{value:''}).value.trim();if(!q)return;
    state.ui.chatLog.push({who:'you',text:q,tier:''});
    const ql=q.toLowerCase();
    let matched=null;
    for(const r of T0_RULES){const k=r.q.toLowerCase();const ks=k.split(/[^a-z]+/).filter(w=>w.length>4);let hits=0;for(const w of ks){if(ql.includes(w))hits++;}if(hits>=2){matched=r;break;}}
    if(matched){state.ui.chatLog.push({who:'bot',text:matched.a,tier:'T0'});render();return;}
    if(!state.settings.anthropicKey){state.ui.chatLog.push({who:'bot',text:'No T0 rule matched. Set an Anthropic API key in Settings for T3 fallback.',tier:'T0'});render();return;}
    state.ui.chatLog.push({who:'bot',text:'…',tier:'T3'});render();
    try{
      const sys='You are a research assistant for an SRA-regulated UK solicitor firm. Answer concisely with statutory and rule references. Mark uncertainty explicitly. This is research only and not legal advice. Do not invent citations.';
      const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':state.settings.anthropicKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-3-5-sonnet-latest',max_tokens:800,system:sys,messages:[{role:'user',content:q}]})});
      const j=await res.json();const txt=(j&&j.content&&j.content[0]&&j.content[0].text)||('error: '+JSON.stringify(j).slice(0,300));
      state.ui.chatLog.pop();state.ui.chatLog.push({who:'bot',text:txt,tier:'T3'});render();
    }catch(e){state.ui.chatLog.pop();state.ui.chatLog.push({who:'bot',text:'T3 fetch failed: '+e.message,tier:'T3'});render();}
  },
  'chat-clear':async()=>{state.ui.chatLog=[];render();}
};
function download(content,mime,name){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),300);
}
/* ============================== BOOT ============================== */
(async function boot(){
  try{
    await loadAll();
    initMesh();
    bindEvents();
    render();
    console.log('%c'+TOOLNAME+' v'+VERSION+' · prime '+PRIME+' · sovereign · ready','color:#b8974a;font-weight:700');
  }catch(e){
    console.error(e);
  }
})();

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { TOOLNAME };
export { VERSION };
