// test/sdk.test.js · node --test · exact outputs for every branch of the page's own template engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, get, sec, fillBody, mdToHtml, fillBodyMd, stripHtml, sectionsHtml, sectionsMarkdown,
  TEMPLATES, SEED_TEMPLATES, T0_RULES, matchT0,
  templateById, templatesByArea, fieldsOf, buildContext, renderHtml, renderMarkdown, standaloneHtml, VERSION,
} from '../src/index.js';

test('esc escapes the five HTML specials and treats null as empty', () => {
  assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  assert.equal(esc(null), ''); assert.equal(esc(undefined), ''); assert.equal(esc(0), '0');
});

test('get walks a dotted path and stops at null', () => {
  assert.equal(get({ a: { b: 1 } }, 'a.b'), 1);
  assert.equal(get({ a: null }, 'a.b'), undefined);
  assert.equal(get(null, 'a'), undefined);
  assert.equal(get({ 5: 'five' }, 5), 'five');
});

test('sec builds a section with defaults', () => {
  assert.deepEqual(sec('i', 'h', 'b'), { id: 'i', heading: 'h', body: 'b', requiredFields: [], locked: false });
  assert.deepEqual(sec('i', 'h', 'b', ['x'], 1), { id: 'i', heading: 'h', body: 'b', requiredFields: ['x'], locked: true });
});

test('fillBody escapes values and marks every missing or empty field', () => {
  assert.equal(fillBody('Hi {{a.b}}', { a: { b: '<x>' } }), 'Hi &lt;x&gt;');
  assert.equal(fillBody('{{a}}', {}), '<span class="placeholder-empty">{{a}}</span>');
  assert.equal(fillBody('{{a}}', { a: '' }), '<span class="placeholder-empty">{{a}}</span>');
  assert.equal(fillBody('{{a}}', { a: 0 }), '0');
  assert.equal(fillBody('', {}), ''); assert.equal(fillBody(null, {}), ''); assert.equal(fillBody(5, {}), '5');
});

test('fillBodyMd leaves values raw and shows missing fields as «path»', () => {
  assert.equal(fillBodyMd('Hi {{a}}', { a: '<x>' }), 'Hi <x>');
  assert.equal(fillBodyMd('{{a}}', {}), '«a»'); assert.equal(fillBodyMd('{{a}}', { a: '' }), '«a»');
  assert.equal(fillBodyMd('{{a}}', { a: 0 }), '0'); assert.equal(fillBodyMd('', {}), ''); assert.equal(fillBodyMd(null, {}), '');
});

test('mdToHtml: paragraphs, bold, both list kinds, switching between them, rules, blanks, signature', () => {
  assert.equal(mdToHtml(''), ''); assert.equal(mdToHtml(null), '');
  assert.equal(mdToHtml('**b** <i>'), '<p><strong>b</strong> &lt;i&gt;</p>');
  assert.equal(mdToHtml('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  assert.equal(mdToHtml('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
  assert.equal(mdToHtml('- a\n1. b'), '<ul>\n<li>a</li>\n</ul>\n<ol>\n<li>b</li>\n</ol>');
  assert.equal(mdToHtml('1. a\n- b'), '<ol>\n<li>a</li>\n</ol>\n<ul>\n<li>b</li>\n</ul>');
  assert.equal(mdToHtml('- a\ntext'), '<ul>\n<li>a</li>\n</ul>\n<p>text</p>');
  assert.equal(mdToHtml('1. a\ntext'), '<ol>\n<li>a</li>\n</ol>\n<p>text</p>');
  assert.equal(mdToHtml('a\n\n---\nb'), '<p>a</p>\n\n<hr>\n<p>b</p>');
  assert.equal(mdToHtml('   '), '');
  assert.match(mdToHtml('[SIGNATURE_BLOCK]'), /^<p><div class="sig-block"><strong>Signed:<\/strong>/);
  assert.equal(mdToHtml(fillBody('{{x}}', {})), '<p><span class="placeholder-empty">{{x}}</span></p>');
});

test('stripHtml turns markup back into text', () => {
  assert.equal(stripHtml('<p>a</p><br>b &amp; &lt;c&gt; &quot;d&quot; &#39;e&#39;'), 'a\n\nb & <c> "d" \'e\'');
  assert.equal(stripHtml(null), 'null');
});

const T = { name: 'T', sections: [sec('h', '**H** {{x}}', 'Body {{x}}', ['x'], true), sec('b', '', '{{y}}'), { id: 'c', heading: '', body: 'plain' }] };
test('sectionsHtml: locked and editable sections, headings, and the fields still missing', () => {
  const r = sectionsHtml(T, {});
  assert.deepEqual(r.missing, [{ sec: 'h', field: 'x' }]);
  assert.ok(r.html.includes('<div class="section locked-clause" data-sec="h">'));
  assert.ok(r.html.includes('contenteditable="false" data-sec-body="h"'));
  assert.ok(r.html.includes('<div class="section " data-sec="b"><div class="editable" contenteditable="true" data-sec-body="b">'));
  assert.ok(r.html.includes('<p><strong>H</strong> <span class="placeholder-empty">{{x}}</span></p>'));
  assert.equal(r.html.split('\n').filter((l) => l.startsWith('<div class="section')).length, 3);
  assert.deepEqual(sectionsHtml(T, { x: '' }).missing, [{ sec: 'h', field: 'x' }]);
  assert.deepEqual(sectionsHtml(T, { x: 0 }).missing, []);
  const ov = sectionsHtml(T, {}, { h: '<p>mine</p>' });
  assert.ok(ov.html.includes('data-sec-body="h"><p>mine</p></div>'));
  assert.deepEqual(ov.missing, []); // an overridden section is the solicitor's own text
  assert.deepEqual(sectionsHtml(null, {}), { html: '', missing: [] });
});

test('sectionsMarkdown: title, headings, bodies, and overrides as plain text', () => {
  assert.equal(sectionsMarkdown(T, { x: '1' }), '# T\n\n## **H** 1\n\nBody 1\n\n«y»\n\nplain\n');
  assert.equal(sectionsMarkdown(T, { x: '1' }, { h: '<p>Over</p>' }), '# T\n\n## **H** 1\n\nOver\n\n\n«y»\n\nplain\n');
  assert.equal(sectionsMarkdown(null), '# undefined\n');
});

test('matchT0: two longer words of a question pick its answer; one is not enough', () => {
  assert.equal(matchT0('when is the engagement letter due').q, 'When must the engagement letter be sent?');
  assert.equal(matchT0('ENGAGEMENT LETTER').q, 'When must the engagement letter be sent?');
  assert.equal(matchT0('engagement'), null);
  assert.equal(matchT0('when must it be sent'), null); // four-letter words do not count
  assert.equal(matchT0(''), null); assert.equal(matchT0(null), null); assert.equal(matchT0({ toLowerCase: () => 'engagement letter' }), null);
  for (const r of T0_RULES) assert.equal(matchT0(r.q), r, 'every answer is reachable by its own question: ' + r.q);
  assert.equal(matchT0('cfa success fee').q, 'What is the cap on a CFA success fee?'); // an acronym counts as a keyword
  assert.equal(matchT0('success'), null); assert.equal(matchT0('dba'), null);
  assert.equal(matchT0('lpa registration').q, 'What is the LPA registration fee?');
});

test('the templates: ids unique, every section well formed, the possession templates current', () => {
  assert.equal(TEMPLATES, SEED_TEMPLATES);
  assert.equal(TEMPLATES.length, 15);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(t.sections.length > 0, t.id);
    for (const s of t.sections) { assert.equal(typeof s.id, 'string'); assert.equal(typeof s.body, 'string'); assert.ok(Array.isArray(s.requiredFields)); }
  }
  const s21 = renderMarkdown('s21', buildContext({ today: 'x' }));
  assert.match(s21, /retired/); assert.match(s21, /31 July 2026/);
  const s8 = renderMarkdown('s8', buildContext({ today: 'x' }));
  for (const must of ['Form 3A', '3 months', '13 weeks', '4 weeks', '12 months']) assert.ok(s8.includes(must), must);
  assert.doesNotMatch(TEMPLATES.map((t) => JSON.stringify(t)).join(''), /TBA|Form 6A drafting/);
  assert.equal(T0_RULES.length, 12);
});

test('templateById, templatesByArea and fieldsOf', () => {
  assert.equal(templateById('s8').id, 's8'); assert.equal(templateById('nope'), undefined);
  const lt = templatesByArea('landlord-tenant');
  assert.ok(lt.some((t) => t.id === 's8') && lt.some((t) => t.practiceArea === 'all'));
  assert.ok(lt.every((t) => t.practiceArea === 'landlord-tenant' || t.practiceArea === 'all'));
  assert.equal(lt.length, TEMPLATES.filter((t) => t.practiceArea === 'landlord-tenant' || t.practiceArea === 'all').length);
  assert.ok(!lt.some((t) => t.practiceArea !== 'landlord-tenant' && t.practiceArea !== 'all'));
  assert.ok(TEMPLATES.length > lt.length);
  assert.deepEqual(fieldsOf('s8'), ['client.title', 'client.firstName', 'client.lastName', 'ctx.tenantNames', 'ctx.propertyAddress', 'ctx.tenancyStartDate', 'ctx.rentAmount', 'ctx.rentPeriod', 'today', 'ctx.arrearsTotal']);
  assert.deepEqual(fieldsOf({ sections: [{ heading: '{{a}}', body: '{{a}} {{b}}' }] }), ['a', 'b']);
  assert.deepEqual(fieldsOf(null), []); assert.deepEqual(fieldsOf('nope'), []);
});

test('buildContext, renderHtml, renderMarkdown, standaloneHtml', () => {
  const c = buildContext({ today: '1 Jan 2027', adviser: { name: 'A' } });
  assert.equal(c.today, '1 Jan 2027'); assert.equal(c.supervisor.name, 'A'); assert.deepEqual(c.client, { address: {}, kyc: {} });
  assert.deepEqual(c.firm, { registeredAddress: {} }); assert.equal(c.docRef, ''); assert.deepEqual(c.ctx, {});
  assert.equal(buildContext({ adviser: { name: 'A' }, supervisor: { name: 'S' } }).supervisor.name, 'S');
  assert.equal(typeof buildContext().today, 'string'); assert.ok(buildContext(null).today.length > 0);
  assert.deepEqual(renderHtml('nope', c), { html: '<p>Template not found</p>', missing: [] });
  assert.equal(renderHtml(T, {}).missing.length, 1);
  assert.ok(renderHtml('s8', buildContext({ client: { title: 'Ms', firstName: 'Ada', lastName: 'Lovelace' } })).html.includes('Ms Ada Lovelace'));
  assert.equal(renderMarkdown('nope', c), '');
  assert.ok(renderMarkdown(T, {}).startsWith('# T'));
  const page = standaloneHtml('<p>x</p>', '<T>');
  assert.ok(page.includes('<title>&lt;T&gt;</title>')); assert.ok(page.includes('<div class="paper"><p>x</p></div>'));
  assert.ok(standaloneHtml('x').includes('<title>Document</title>'));
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('garbage in: the engine never throws', () => {
  const bare = Object.create(null);
  const JUNK = [undefined, null, 0, 42, NaN, true, [], {}, bare, Symbol('s'), () => 1];
  for (const j of JUNK) {
    assert.equal(typeof esc(j), 'string');
    assert.equal(typeof fillBody(j, j), 'string'); assert.equal(typeof fillBodyMd(j, j), 'string');
    assert.equal(typeof mdToHtml(j), 'string'); assert.equal(typeof stripHtml(j), 'string');
    assert.equal(typeof standaloneHtml(j, j), 'string');
  }
  assert.equal(esc(bare), ''); assert.equal(stripHtml(bare), '');
  assert.equal(fillBody('{{a}}', { a: bare }), ''); assert.equal(fillBodyMd('{{a}}', { a: bare }), '');
  assert.ok(standaloneHtml(bare, 'T').includes('<div class="paper"></div>'));
});
