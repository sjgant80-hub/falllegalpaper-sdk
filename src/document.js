// @ai-native-solutions/falllegalpaper-sdk · document.js · MIT
// Turn a template and a context into a finished document: HTML sections (with the fields still missing), Markdown,
// or a standalone printable HTML page. These take the template and context directly; the page builds its context
// from its stored clients, matters and firm.
// Every block marked LIFTED below appears in the FallLegalPaper page (https://sjgant80-hub.github.io/falllegalpaper/)
// byte for byte, minus the word `export`; scripts/parity.mjs fails the build if one stops doing so.

import { esc, toText, sectionsHtml, sectionsMarkdown } from './engine.js';
import { TEMPLATES } from './templates.js';

const byId = (idOrTpl) => (typeof idOrTpl === 'string' ? TEMPLATES.find((t) => t.id === idOrTpl) : idOrTpl);

/** A template by id, or undefined. */
export function templateById(id) { return TEMPLATES.find((t) => t.id === id); }

/** Templates for one practice area ('all' templates apply to every area and are included). */
export function templatesByArea(area) { return TEMPLATES.filter((t) => t.practiceArea === area || t.practiceArea === 'all'); }

/** Every {{path}} a template uses, in first-use order, so you know what context to supply. */
export function fieldsOf(idOrTpl) {
  const t = Object(byId(idOrTpl));
  const seen = [];
  for (const s of (Array.isArray(t.sections) ? t.sections : [])) {
    for (const m of String(s.heading + ' ' + s.body).matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g)) if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/** A context in the shape the templates read. Anything you leave out renders as a visible placeholder. */
export function buildContext(parts = {}) {
  const p = Object(parts);
  return {
    today: p.today ?? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    client: p.client ?? { address: {}, kyc: {} }, matter: p.matter ?? {}, adviser: p.adviser ?? {},
    supervisor: p.supervisor ?? p.adviser ?? {}, firm: p.firm ?? { registeredAddress: {} }, docRef: p.docRef ?? '', ctx: p.ctx ?? {},
  };
}

/** HTML sections for a template (by id or object), plus the required fields still missing. */
export function renderHtml(idOrTpl, ctx, overrides) {
  const t = byId(idOrTpl);
  if (!t) return { html: '<p>Template not found</p>', missing: [] };
  return sectionsHtml(t, ctx, overrides);
}

/** The document as Markdown; missing fields show as «path». */
export function renderMarkdown(idOrTpl, ctx, overrides) {
  const t = byId(idOrTpl);
  return t ? sectionsMarkdown(t, ctx, overrides) : '';
}

// LIFTED
export function standaloneHtml(innerHtml,title){
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title||'Document')}</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 30px;color:#1a1611;line-height:1.65;background:#f3eee2}
h1{font-size:20px;border-bottom:1px solid #cfc7b3;padding-bottom:8px}
h2{font-size:15px;color:#5a1818;margin-top:18px}
h3{font-size:13px}
.locked-clause{padding:6px 10px;background:rgba(184,151,74,0.06);border-left:2px solid #b8974a;margin:6px 0}
.sig-block{margin-top:24px;padding:14px;border:1px dashed #cfc7b3}
.placeholder-empty{background:#ffe9b3;color:#8b1a1a;padding:0 4px}</style>
</head><body><div class="paper">${toText(innerHtml)}</div>

</body></html>`;
}
