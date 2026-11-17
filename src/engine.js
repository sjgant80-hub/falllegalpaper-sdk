// @ai-native-solutions/falllegalpaper-sdk · engine.js · MIT · zero dependencies
// The template engine: placeholder filling (HTML-escaped or Markdown), the page's small Markdown-to-HTML renderer,
// and the two section renderers the page itself now delegates to.
// Every block marked LIFTED below appears in the FallLegalPaper page (https://sjgant80-hub.github.io/falllegalpaper/)
// byte for byte, minus the word `export`; scripts/parity.mjs fails the build if one stops doing so.


// LIFTED
export const esc = (s) => (s == null ? '' : toText(s)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// LIFTED
export function toText(v) { try { return String(v); } catch (_) { return ''; } }

// LIFTED
export function get(obj, path) { return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

// LIFTED
export function sec(id, heading, body, req, locked) { return { id, heading, body, requiredFields: req || [], locked: !!locked }; }

// LIFTED
export function fillBody(body, ctx) {
  if (!body) return '';
  return toText(body).replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (m, path) => {
    const v = get(ctx, path);
    if (v == null || v === '') return '<span class="placeholder-empty">{{' + path + '}}</span>';
    return esc(v);
  });
}

// LIFTED
export function mdToHtml(md) {
  if (!md) return '';
  let s = esc(md);
  s = s.replace(/&lt;span class=&quot;placeholder-empty&quot;&gt;/g, '<span class="placeholder-empty">')
    .replace(/&lt;\/span&gt;/g, '</span>');
  s = s.replace(/\[SIGNATURE_BLOCK\]/g, '<div class="sig-block"><strong>Signed:</strong> ______________________________  <strong>Date:</strong> ____________<br><br><strong>Print name:</strong> ______________________________</div>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = []; let inUL = false, inOL = false;
  for (const line of s.split('\n')) {
    if (/^\s*-\s+/.test(line)) {
      if (!inUL) { if (inOL) { out.push('</ol>'); inOL = false; } out.push('<ul>'); inUL = true; }
      out.push('<li>' + line.replace(/^\s*-\s+/, '') + '</li>');
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOL) { if (inUL) { out.push('</ul>'); inUL = false; } out.push('<ol>'); inOL = true; }
      out.push('<li>' + line.replace(/^\s*\d+\.\s+/, '') + '</li>');
    } else {
      if (inUL) { out.push('</ul>'); inUL = false; }
      if (inOL) { out.push('</ol>'); inOL = false; }
      if (line.trim() === '') out.push('');
      else if (/^---$/.test(line.trim())) out.push('<hr>');
      else out.push('<p>' + line + '</p>');
    }
  }
  if (inUL) out.push('</ul>');
  if (inOL) out.push('</ol>');
  return out.join('\n');
}

// LIFTED
export function fillBodyMd(body, ctx) {
  if (!body) return '';
  return toText(body).replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (m, path) => {
    const v = get(ctx, path);
    if (v == null || v === '') return '«' + path + '»';
    return toText(v);
  });
}

// LIFTED
export function stripHtml(s) { return toText(s).replace(/<br\s*\/?>/g, '\n').replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }

// LIFTED
export function sectionsHtml(tpl, ctx, overrides) {
  const ov = Object(overrides);
  const parts = [];
  const missing = [];
  for (const s of (Array.isArray(Object(tpl).sections) ? tpl.sections : [])) {
    const cust = ov[s.id];
    const headingHtml = s.heading ? mdToHtml(fillBody(s.heading, ctx)) : '';
    let bodyHtml = cust;
    if (cust == null) {
      bodyHtml = mdToHtml(fillBody(s.body, ctx));
      for (const f of (s.requiredFields || [])) { const v = get(ctx, f); if (v == null || v === '') missing.push({ sec: s.id, field: f }); }
    }
    parts.push(`<div class="section ${s.locked ? 'locked-clause' : ''}" data-sec="${esc(s.id)}">${headingHtml}<div class="editable" contenteditable="${s.locked ? 'false' : 'true'}" data-sec-body="${esc(s.id)}">${bodyHtml}</div></div>`);
  }
  return { html: parts.join('\n'), missing };
}

// LIFTED
export function sectionsMarkdown(tpl, ctx, overrides) {
  const ov = Object(overrides);
  const t = Object(tpl);
  const lines = ['# ' + t.name, ''];
  for (const s of (Array.isArray(t.sections) ? t.sections : [])) {
    if (s.heading) { lines.push('## ' + fillBodyMd(s.heading, ctx)); lines.push(''); }
    lines.push(ov[s.id] != null ? stripHtml(ov[s.id]) : fillBodyMd(s.body, ctx)); lines.push('');
  }
  return lines.join('\n');
}
