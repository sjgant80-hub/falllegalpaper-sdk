// @ai-native-solutions/falllegalpaper-sdk · the public surface · MIT · plain ESM · zero dependencies
// The FallLegalPaper page's own template engine, templates and offline answers as modules. No DOM, no network,
// no storage. Drafting aids for SRA-regulated firms: a solicitor reviews every document before it is sent.

export { esc, toText, get, sec, fillBody, mdToHtml, fillBodyMd, stripHtml, sectionsHtml, sectionsMarkdown } from './engine.js';
export { TEMPLATES, SEED_TEMPLATES } from './templates.js';
export { T0_RULES, matchT0 } from './qa.js';
export { templateById, templatesByArea, fieldsOf, buildContext, renderHtml, renderMarkdown, standaloneHtml } from './document.js';

export const VERSION = '1.1.0';
