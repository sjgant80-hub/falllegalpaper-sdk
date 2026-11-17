// @ai-native-solutions/falllegalpaper-sdk · qa.js · MIT
// The page's offline answers for solicitors (SRA rules, costs, CFAs and DBAs, limitation, possession, …) and the
// matcher the page uses: a rule answers when two or more of its question's longer words appear in yours.
// Every block marked LIFTED below appears in the FallLegalPaper page (https://sjgant80-hub.github.io/falllegalpaper/)
// byte for byte, minus the word `export`; scripts/parity.mjs fails the build if one stops doing so.

// LIFTED
export const T0_RULES=[
  {q:'When must the engagement letter be sent?',a:'Before, or as soon as practicable after, accepting the retainer. SRA Code paras 8.6 and 8.7 require you to give the client information about regulatory status, complaints, costs and the service you will provide at the outset.'},
  {q:'What do SRA Transparency Rules require on costs?',a:'For specified work types (residential conveyancing, probate (uncontested, of UK estate), immigration (excl. asylum), motoring offences (summary), employment tribunal claims, debt recovery up to £100k, licensing applications for business premises) the firm must publish prices, the basis of those prices, disbursements, and key information on the website. For all matters, para 8.7 still requires the best possible information about cost.'},
  {q:'What is the cap on a CFA success fee?',a:'100% of base costs (statutory cap, Article 3 of the Conditional Fee Agreements Order 2013). In personal injury cases there is an additional cap of 25% of damages (excluding future-care and future-loss damages) — Article 5.'},
  {q:'What is the cap on a DBA payment?',a:'25% of damages in personal injury (first instance), 35% in employment tribunal claims, 50% in all other civil/commercial claims (first instance). All caps INCLUDE VAT (DBA Regs 2013, regs 4 and 7).'},
  {q:'What are the client-care requirements?',a:'SRA Code paras 8.6–8.11: tell the client at the outset who is handling their matter, their status, supervisors; complaints right (LeO and SRA routes); pricing/costs information; regulatory information about the firm. Update these whenever materially changed.'},
  {q:'How does a client complain to the Legal Ombudsman?',a:'After exhausting the firm internal procedure (firm has 8 weeks to give a final response). Refer within 6 months of final response AND within 1 year of the act/omission (or within 1 year of when they reasonably should have known). LeO: PO Box 6167, Slough SL1 0EH · 0300 555 0333 · enquiries@legalombudsman.org.uk.'},
  {q:'What are the pre-action protocol limits?',a:'CPR Practice Direction on Pre-Action Conduct: exchange enough information to understand each other position, consider ADR, act proportionately. The defendant should reply within a reasonable time: 14 days in a straightforward case and no more than 3 months in a very complex one (PD Pre-Action Conduct para 6(b)). Specific protocols set their own periods: a debtor has 30 days to reply under the Debt Claims protocol; a clinical negligence response is due within 4 months.'},
  {q:'How should we handle a vulnerable client?',a:'(1) Identify drivers — health, life event, resilience, capability. (2) Capacity test under MCA 2005 s.3 is decision-specific and time-specific; presume capacity. (3) Adjust communication: plain English, extra time, written follow-up, trusted-third-party support (not substitute). (4) Take instructions in private if undue influence suspected. (5) Document everything; review at every substantive meeting.'},
  {q:'What is the position on section 21 reform?',a:'Section 21 "no-fault" possession was abolished for private tenancies in England on 1 May 2026 (Renters\' Rights Act 2025): every private tenancy became an assured periodic tenancy, and possession is now only on a section 8 ground, with a notice on Form 3A and a court order. Section 21 notices served before 1 May 2026 could usually be used for up to 6 months or until 31 July 2026, whichever was sooner. Wales had already moved to the Renting Homes (Wales) Act 2016 model.'},
  {q:'What are the grounds for challenging a Will?',a:'(1) Lack of testamentary capacity (Banks v Goodfellow). (2) Lack of knowledge and approval. (3) Undue influence (high bar — actual influence, not just opportunity). (4) Forgery / fraud. (5) Improper execution under Wills Act 1837 s.9. (6) Revocation. Separately under the Inheritance (Provision for Family and Dependants) Act 1975 — claim for reasonable financial provision (not a challenge to the will itself).'},
  {q:'What is the LPA registration fee?',a:'£92 per LPA (one fee for Property & Financial Affairs, one for Health & Welfare) — Office of the Public Guardian fee from 17 November 2025 (verify before submission, fees periodically updated). Remissions and exemptions are available for donors on low income or in receipt of certain means-tested benefits.'},
  {q:'When must ATE insurance be disclosed?',a:'Since 1 April 2013 (LASPO), ATE premiums are no longer recoverable from the losing opponent (except, in clinical negligence cases, the part of the premium relating to expert reports on liability and causation). The client must be told this clearly. CPR 44 requires costs budgeting/management which records insurance position. The client must also be advised on alternative funding options before signing any CFA or DBA (SRA Code para 8.7).'}
];

// LIFTED
export function matchT0(q) {
  const ql = (typeof q === 'string' ? q : '').toLowerCase();
  for (const r of T0_RULES) {
    const ks = r.q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4).concat((r.q.match(/\b[A-Z]{3,}\b/g) || []).map((w) => w.toLowerCase()));
    let hits = 0;
    for (const w of ks) { if (ql.includes(w)) hits++; }
    if (hits >= 2) return r;
  }
  return null;
}
