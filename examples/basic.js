// examples/basic.js · draft an engagement letter and a section 8 note · run: node examples/basic.js
import { TEMPLATES, fieldsOf, buildContext, renderHtml, renderMarkdown, standaloneHtml, matchT0, VERSION } from '../src/index.js';

console.log('falllegalpaper-sdk v' + VERSION + ' · ' + TEMPLATES.length + ' templates');
const ctx = buildContext({
  today: '17 November 2026',
  client: { title: 'Ms', firstName: 'Ada', lastName: 'Lovelace', address: { line1: '1 High Street', postcode: 'AB1 2CD' } },
  firm: { name: 'Example LLP', registeredAddress: {} },
});
const { html, missing } = renderHtml('engagement', ctx);
console.log('engagement letter: ' + html.length + ' characters of HTML, ' + missing.length + ' required fields still to fill');
console.log('section 8 note needs: ' + fieldsOf('s8').join(', '));
const md = renderMarkdown('s8', ctx);
console.log(md.split('\n').slice(0, 3).join(' / '));
const page = standaloneHtml(html, 'Engagement letter');
console.log('printable page: ' + page.length + ' characters');
console.log('Q&A: ' + (matchT0('when must the engagement letter be sent?') || { a: 'none' }).a.slice(0, 120) + '…');
if (!html.includes('Lovelace') || !md.includes('Form 3A') || !page.startsWith('<!DOCTYPE html>')) { console.error('the example did not produce what it should'); process.exit(1); }
