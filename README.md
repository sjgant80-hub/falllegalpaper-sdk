# FallLegalPaper SDK

**Live page, with a try-it panel, the API and the proof:** https://sjgant80-hub.github.io/falllegalpaper-sdk/

A JavaScript library with the document engine behind FallLegalPaper: 15 templates for SRA-regulated firms (engagement letter, terms of business, costs information, CFA, DBA, advice letter, letter before action, settlement, file closure, no-win-no-fee information, vulnerable client note, simple will, LPA information, and the section 8 possession note on Form 3A, with section 21 recorded as retired), the engine that fills them into HTML, Markdown or a printable page, and 12 offline answers on SRA and court rules.

It is the [FallLegalPaper](https://sjgant80-hub.github.io/falllegalpaper/) page's own code, as modules. The templates are drafting aids: a solicitor reviews every document before it goes out.

## Install

```bash
npm install github:sjgant80-hub/falllegalpaper-sdk
```

It is not on the npm registry; it installs from this repository. Pin a commit for production: `npm install github:sjgant80-hub/falllegalpaper-sdk#<commit>`.

## Use

```js
import { buildContext, renderHtml, renderMarkdown, fieldsOf, standaloneHtml } from '@ai-native-solutions/falllegalpaper-sdk';

fieldsOf('engagement');                     // the {{fields}} the template reads
const ctx = buildContext({ client: { title: 'Ms', firstName: 'Ada', lastName: 'Lovelace' } });
const { html, missing } = renderHtml('engagement', ctx);   // HTML sections + required fields still empty
const md = renderMarkdown('s8', ctx);                       // missing fields show as «path»
const printable = standaloneHtml(html, 'Engagement letter');
```

## API

| Export | What it does |
|---|---|
| `TEMPLATES · templateById · templatesByArea` | The 15 templates and lookups (an area's list includes the templates for every area). |
| `fieldsOf(template)` | Every {{path}} a template reads, in first-use order. |
| `buildContext({ client, matter, adviser, supervisor, firm, today, docRef, ctx })` | A context in the shape the templates read; anything left out shows as a placeholder. |
| `renderHtml(template, ctx, overrides?)` | { html, missing }: the sections as HTML, and the required fields still empty. |
| `renderMarkdown(template, ctx, overrides?)` | The document as Markdown. |
| `standaloneHtml(html, title)` | A complete, printable HTML page. |
| `matchT0(question) · T0_RULES` | The matching offline answer, or null; and the 12 answers. |
| `fillBody · fillBodyMd · mdToHtml · stripHtml · esc · toText · get · sec · sectionsHtml · sectionsMarkdown` | The engine's parts, for building your own templates. |

## How it is kept honest

- The engine, the 15 templates, the 12 answers and the printable page are lifted from the FallLegalPaper page byte for byte (only export added). The page itself now runs the same functions: its own document rendering and its chat matcher call them. scripts/parity.mjs fails the build if a single lifted block is missing from the published page.
- A template is a list of sections; each has a heading, a body with {{path}} placeholders and its required fields. Filling to HTML escapes every value and marks each empty field visibly; filling to Markdown leaves values raw and shows a missing field as «path».
- The page's small Markdown renderer handles bold, bullet and numbered lists (and switching between them), rules, blank lines and the signature block, and escapes everything else.
- An offline answer is chosen when two or more of its keywords appear in your question: the longer words of its own question (five letters or more) and its acronyms (CFA, DBA, LPA, ATE, SRA). Otherwise there is no answer, rather than a guess.
- Every branch of the engine is pinned by exact-output tests, and the mutation gate confirms each comparison is tested (24 of 24). The page's old engine and this one were compared on every template, empty and filled with HTML-special values, with and without overrides: 120 renders, none different.

Run it yourself: `npm test`, `npm run parity`, `npm run example`. CI runs the same, plus the mutation gate, on every push.

## Not included

- The page's client, matter and firm records, storage and AI chat: this is the engine and the templates.
- Any network or AI provider.

## Licence and supplier

MIT, © Simon Gant. Supplied by [AI Native Solutions](https://www.ai-nativesolutions.com); support is agreed per deployment.
