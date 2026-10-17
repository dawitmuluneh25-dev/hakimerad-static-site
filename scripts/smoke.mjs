#!/usr/bin/env node
/**
 * HTTP smoke test for a served build.
 *
 *   npm run serve -- dist          # in one terminal
 *   npm run smoke                  # in another
 *   npm run smoke -- http://localhost:4173
 *
 * This complements `npm run build`. The build gate reads files from disk; this
 * one exercises the served site over HTTP, so it also catches a wrong MIME type,
 * a route the static host would 404, and a referenced asset that exists in the
 * repository but was withheld from dist/.
 *
 * It is a static, non-interactive check. It cannot complete a form submission,
 * so the enquiry-form acceptance criteria F1-F7 in the marketing measurement
 * spec still need a real browser session — see MODERNIZATION_REPORT.md.
 */

const BASE = (process.argv[2] || process.env.SMOKE_BASE || 'http://localhost:4173').replace(
  /\/$/,
  ''
);

const PAGES = [
  ['index.html', ['HakimeRAD', 'Your Reliable Partner', 'targets, not guarantees']],
  ['services.html', ['Turnaround targets', 'Mammography', 'Echocardiography']],
  ['pricing.html', ['Engagement', 'enquiry', 'targets']],
  ['about.html', ['Hakimerad Medical Consultancy', 'targets']],
  ['contact.html', ['Institutional enquiry', 'No patient']],
  ['blog.html', ['Insights']],
  ['blog-post-1.html', ['HakimeRAD']],
  ['blog-post-2.html', ['targets, not guarantees']],
  ['blog-post-3.html', ['HakimeRAD']],
  ['404.html', ['HakimeRAD']],
];

/**
 * The error page is the one page that must NOT be indexable, so it carries
 * noindex instead of a canonical link and an Open Graph card. Every other page
 * needs both.
 */
const NOINDEX_PAGES = new Set(['404.html']);

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
}

async function get(pathOrUrl) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const res = await fetch(url, { redirect: 'manual' });
  const body = await res.text();
  return { url, res, body };
}

/**
 * Every local href/src/url() in a document, resolved to a site-root path.
 * `baseDir` is the directory the document itself was served from, so that a
 * CSS-relative url('../images/x.jpg') resolves the way a browser resolves it
 * rather than as a literal path with a '..' in it.
 */
function localRefs(doc, baseDir = '/') {
  const out = new Set();
  const push = raw => {
    const href = raw.trim();
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('data:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('//') ||
      /^https?:/i.test(href)
    ) {
      return;
    }
    try {
      out.add(new URL(href, `https://example.invalid${baseDir}`).pathname);
    } catch {
      /* not a resolvable URL — ignore */
    }
  };
  for (const m of doc.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) push(m[1]);
  for (const m of doc.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) push(m[1]);
  for (const m of doc.matchAll(/srcset\s*=\s*"([^"]+)"/g)) {
    for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]);
  }
  return [...out];
}

async function main() {
  console.log(`HakimeRAD smoke test against ${BASE}\n`);

  const assets = new Set();

  for (const [page, markers] of PAGES) {
    let page_res;
    try {
      page_res = await get(`/${page}`);
    } catch (err) {
      check(`${page} loads`, false, `request failed: ${err.message} — is the server running?`);
      continue;
    }

    const { res, body } = page_res;
    const problems = [];

    if (res.status !== 200) problems.push(`HTTP ${res.status}`);
    if (!/text\/html/.test(res.headers.get('content-type') || '')) {
      problems.push(`content-type ${res.headers.get('content-type')}`);
    }
    if (!/<title>\s*\S/.test(body)) problems.push('no <title>');
    const h1Count = (body.match(/<h1\b/g) || []).length;
    if (h1Count !== 1) problems.push(`${h1Count} <h1> elements`);
    if (NOINDEX_PAGES.has(page)) {
      if (!/name="robots"\s+content="noindex/.test(body)) problems.push('error page is indexable');
    } else {
      if (!/rel="canonical"/.test(body)) problems.push('no canonical link');
      if (!/property="og:title"/.test(body)) problems.push('no og:title');
    }
    for (const marker of markers) {
      if (!body.includes(marker)) problems.push(`missing marker: "${marker}"`);
    }
    for (const placeholder of ['TODO', 'Lorem ipsum', '{{', 'XXX', 'FIXME']) {
      if (body.includes(placeholder)) problems.push(`placeholder text: ${placeholder}`);
    }
    if (res.headers.get('x-content-type-options') !== 'nosniff') {
      problems.push('missing X-Content-Type-Options');
    }

    check(`${page} renders`, problems.length === 0, problems.join('; '));

    for (const ref of localRefs(body)) assets.add(ref);
  }

  // Assets referenced by the page body. CSS url() targets were already expanded.
  for (const css of ['/css/style.css', '/css/brand-layer.css', '/css/fonts.css']) {
    try {
      const { res, body } = await get(css);
      check(
        `${css} serves`,
        res.status === 200 && /text\/css/.test(res.headers.get('content-type') || ''),
        `HTTP ${res.status}, ${res.headers.get('content-type')}`
      );
      for (const ref of localRefs(body, '/css/')) assets.add(ref);
    } catch (err) {
      check(`${css} serves`, false, err.message);
    }
  }

  const missing = [];
  for (const ref of [...assets].sort()) {
    try {
      const { res } = await get(ref);
      if (res.status !== 200) missing.push(`${ref} -> HTTP ${res.status}`);
    } catch (err) {
      missing.push(`${ref} -> ${err.message}`);
    }
  }
  check(
    'no referenced asset is missing or withheld from dist/',
    missing.length === 0,
    missing.join('; ')
  );

  // Enquiry form: the required shape from measurement/02_enquiry_form_spec.md.
  const { body: contact } = await get('/contact.html');
  const FORM = {
    'organisation name': /id="organisation"/,
    'organisation type': /id="organisation_type"/,
    'city / region': /id="city_region"/,
    'modalities (multi-select)': /name="modalities\[\]"/,
    'where reporting hurts most': /id="reporting_pain"/,
    'your name': /id="name"/,
    'your role': /id="role"/,
    'work email or phone': /id="work_email"[\s\S]{0,400}id="work_phone"/,
    'authorised to discuss': /id="authorised"/,
    consent: /id="consent"/,
    'optional: monthly studies': /id="monthly_studies"/,
    'optional: priority mix': /id="priority_mix"/,
    'optional: pilot interest': /id="pilot_interest"/,
    'optional: free text': /id="notes"[^>]*maxlength="500"/,
    'honeypot, not an image CAPTCHA': /id="enquiry-gotcha"/,
    'src_code for off-site conversations': /id="src_code"/,
  };
  const absent = Object.entries(FORM)
    .filter(([, re]) => !re.test(contact))
    .map(([label]) => label);
  check('enquiry form has every specified field', absent.length === 0, absent.join('; '));

  const REQUIRED_HIDDEN = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'referrer',
    'landing_page',
    'submitted_at',
  ];
  const missingHidden = REQUIRED_HIDDEN.filter(
    n => !new RegExp(`type="hidden"\\s+name="${n}"`).test(contact)
  );
  check(
    'enquiry form carries every attribution field',
    missingHidden.length === 0,
    missingHidden.join('; ')
  );

  const FORBIDDEN_FORM = {
    'file upload field': /type="file"/,
    'patient name field': /name="patient/i,
    'date of birth field': /name="(?:dob|date_of_birth)/i,
    'pricing or budget field': /name="(?:price|budget|quote_amount)/i,
    'urgent-case toggle': /name="(?:urgent|emergency)"/i,
  };
  const present = Object.entries(FORBIDDEN_FORM)
    .filter(([, re]) => re.test(contact))
    .map(([label]) => label);
  check('enquiry form has no deliberately-absent field', present.length === 0, present.join('; '));

  /* Patterns that must never reach a served page. These are the unconditional
   * ones only; the sentence-level guarantee rule lives in scripts/build.mjs and
   * is deliberately not duplicated here, so the two gates cannot drift apart. */
  const FORBIDDEN_CONTENT = {
    'legal suffix PLC': /\bPLC\b/,
    'unapproved wordmark HakimeRad': /HakimeRad/,
    'named hospital': /(?:Black Lion|Jimma University|Adama University|St\.?\s?Paul)/i,
    'named clinician': /Dr\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  };
  /* Amended 17 Oct 2026, mirroring scripts/build.mjs: the company's own founder
   * may now be named. The approved name is removed before testing, so every
   * other individual remains a leak. Keep this list in step with
   * APPROVED_PRINCIPALS in scripts/build.mjs. Both forms are listed because a
   * partial mention ("Dr. Dawit Muluneh") must be scrubbed too, whereas
   * build.mjs matches the same way with a prefix test. */
  const APPROVED_PRINCIPALS = ['Dawit Muluneh Tadesse', 'Dawit Muluneh'];
  const leaks = [];
  for (const [page] of PAGES) {
    const { body } = await get(`/${page}`);
    const scrubbed = APPROVED_PRINCIPALS.reduce((text, name) => text.split(name).join(''), body);
    for (const [label, re] of Object.entries(FORBIDDEN_CONTENT)) {
      if (re.test(scrubbed)) leaks.push(`${page}: ${label}`);
    }
  }
  check(
    'no prohibited brand form or named third party is served',
    leaks.length === 0,
    leaks.join('; ')
  );

  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`);
  }

  console.log('');
  if (failures) {
    console.log(`${failures} check(s) failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Smoke test OK. ${results.length} checks passed against ${BASE}.`);
}

await main();
