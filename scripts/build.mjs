#!/usr/bin/env node
/**
 * Production build + verification gate for the HakimeRAD website.
 *
 * This is a static site with no bundler, so the "build" is:
 *   1. verify   - structural and brand/claims checks that must pass
 *   2. emit     - copy only deployable files into dist/
 *
 * Run with:  npm run build
 *
 * Exit code is non-zero if any check fails, so it can gate a deploy.
 */

import { mkdir, readFile, readdir, rm, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const PAGES = [
  'index.html',
  'services.html',
  'pricing.html',
  'contact.html',
  'about.html',
  'blog.html',
  'blog-post-1.html',
  'blog-post-2.html',
  'blog-post-3.html',
];

/**
 * The error page carries noindex and no Open Graph tags on purpose, so it is
 * deployed but excluded from the metadata checks that apply to indexable pages.
 */
const EXTRA_PAGES = ['404.html'];

/** Copied verbatim into dist/. */
const DEPLOY_FILES = [
  ...PAGES,
  ...EXTRA_PAGES,
  'robots.txt',
  'sitemap.xml',
  'favicon.ico',
  'favicon.svg',
  'site.webmanifest',
  'llms.txt',
  'googlef76bff2c6a9dc71b.html',
  '.htaccess',
];

const DEPLOY_DIRS = ['css', 'js', 'fonts', 'images'];

/**
 * Files that must NOT ship. Each is kept in the repository but withheld from
 * dist/, with the reason and the path to re-enable it recorded in
 * MODERNIZATION_REPORT.md §Known issues.
 *
 *   images/favicon web/  superseded by the brand favicon set
 *   vidios/              off-brand stock video, superseded by the brand poster
 *   photos/              unused placeholders
 *   the three blog PNGs  carry a named hospital, a named clinician, a visible
 *                        patient name and date of birth, recognisable people and
 *                        AI-analysis overlays — all prohibited by the evidence
 *                        register. They are referenced by no page; the blog now
 *                        uses the generated brand artwork.
 */
const EXCLUDE = [
  /images[\\/]favicon web[\\/]/,
  /vidios[\\/]/,
  /photos[\\/]/,
  /images[\\/]blog[\\/]blog-(?:ai-radiology|rural-clinic|workflow)\.png$/,
];

/**
 * The only individual who may be named on a published page.
 *
 * AMENDED 17 Oct 2026, on the owner's instruction. The evidence register's
 * blanket exclusion of "individual clinician names or credentials" is narrowed
 * to permit the company's own founder and principal only. The rule still fails
 * closed for everyone else: naming a reporting radiologist, or any other
 * person, remains a build failure. The founder's own professional
 * certification may be named (register §8 A-3, 17 Oct 2026), attributed to him
 * personally; the service itself still claims no certification,
 * accreditation, licence or registration of its own.
 */
const APPROVED_PRINCIPALS = ['Dawit Muluneh Tadesse'];

/**
 * Claim classes that must never appear on a published page. Drawn from the
 * marketing evidence register section 6. Each entry is [label, regex] with an
 * optional third element naming the principals that entry permits.
 *
 * The guarantee rule is checked separately by sentence, because writing
 * "these are targets, not guarantees" is required by the same register that
 * forbids claiming a guarantee. A word-level regex cannot tell the two apart.
 */
const PROHIBITED = [
  ['legal suffix "PLC"', /\bPLC\b/],
  ['unapproved wordmark "HakimeRad"', /HakimeRad(?!iology)/],
  ['unapproved wordmark "Hakim eRAD"', /Hakim\s+eRAD/],
  [
    'AI / automated-diagnosis claim',
    /\bAI[-\s](?:powered|assisted|augmented|enabled)\b|\bAI[- ](?:analysis|triage)\b/i,
  ],
  ['board-certification claim', /\bboard[-\s]certified\b/i],
  [
    'accreditation or certification claim',
    /\b(?:ISO|HIPAA|CE|FDA)\b[^.]{0,40}\b(?:compliant|certified|accredited)\b/i,
  ],
  ['published price or rate card', /(?:ETB|USD|\$|birr)\s?\d/i],
  [
    'named hospital or health bureau partner',
    /(?:Black Lion|Jimma University|Adama University|St\.?\s?Paul|SINA GRAND)\b/i,
  ],
  ['named individual clinician', /Dr\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+/, APPROVED_PRINCIPALS],
  ['patient identifier in content', /\b(?:Patient ID|DOB|date of birth)\b/i],
  ['internal pilot count', /\b4 facilities planned\b/i],
  ['stock clinical imagery or AI-generation artefact', /neural network overlay|AI-generated/i],
];

const GUARANTEE_FORM = /\bguarantee(?:d|s|ing)?\b/i;

/**
 * A guarantee-form is not a claim when it appears in a negated clause, in a
 * question, or as someone else's quoted word. The evidence register requires
 * the disclaimer "these are targets, not guarantees", so the disclaimer and the
 * prohibited claim share a vocabulary and a word-level regex cannot separate
 * them. These three allowances are the minimum that lets the required
 * disclaimers through; the check stays fail-closed for anything else.
 */
const NEGATED_GUARANTEE = /\b(?:not|no|never|without|rather than|instead of)\b|\?/i;

/* Third-party or definitional framing: the sentence is about someone else's
 * guarantee, or about the word itself, rather than about our own performance.
 * "Any provider quoting a hard guarantee on turnaround is either measuring
 * something different or planning to renegotiate." is the case this covers. */
const ATTRIBUTED_GUARANTEE =
  /\b(?:quot(?:e|es|ed|ing)|offer(?:s|ed|ing)?|promis(?:e|es|ed|ing)|claim(?:s|ed|ing)?|advertis\w+|the (?:word|phrase|term)|guarantee on|guarantees? (?:are|is) not)\b/i;

/**
 * Flags affirmative guarantee claims only.
 *
 * Whitespace is collapsed before the sentence split, so a line break inside a
 * sentence cannot hide the negation in the other half of it — that was a real
 * false positive: "…and we do not\n  describe any turnaround as guaranteed."
 * split into two fragments and the negation was stranded in the first.
 */
function checkGuaranteeClaims(rel, text, hits) {
  const sentences = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  /* Test the allowance near the guarantee-form, not anywhere in the sentence,
   * so a negation 200 characters away cannot vouch for a claim. */
  const WINDOW = 140;

  for (const sentence of sentences) {
    const m = GUARANTEE_FORM.exec(sentence);
    if (!m) continue;
    const from = Math.max(0, m.index - WINDOW);
    const to = Math.min(sentence.length, m.index + m[0].length + WINDOW);
    const near = sentence.slice(from, to);
    if (NEGATED_GUARANTEE.test(near)) continue;
    if (ATTRIBUTED_GUARANTEE.test(near)) continue;
    hits.push(`${rel}: [guarantee claim] "${sentence.slice(0, 160)}"`);
  }
}

const results = [];
let failures = 0;

function pass(name, detail = '') {
  results.push({ ok: true, name, detail });
}

function fail(name, detail = '') {
  failures += 1;
  results.push({ ok: false, name, detail });
}

function info(name, detail = '') {
  results.push({ ok: true, name, detail, info: true });
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

/* Dependency and output trees are never part of the site. Pruning them here,
 * at the one place every check gets its file list, is what stops an install
 * from changing what gets checked: adding `qrcode`/`jsqr` pulled in `pngjs`
 * with its HTML coverage report, and the page checks went from 9 pages to 34
 * without a single file of the site changing. Anything installed must never
 * be able to fail - or silently satisfy - a check about this site. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.cache']);

async function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, base)));
    } else {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

async function checkReferences() {
  const htmlFiles = (await collectFiles(ROOT)).filter(
    f => f.endsWith('.html') && !f.startsWith('dist/')
  );
  const cssFiles = (await collectFiles(path.join(ROOT, 'css'))).map(f => `css/${f}`);
  const missing = [];

  for (const rel of htmlFiles) {
    const html = await readFile(path.join(ROOT, rel), 'utf8');
    const refs = [];

    for (const m of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
      refs.push(m[1]);
    }
    for (const m of html.matchAll(/srcset\s*=\s*"([^"]+)"/g)) {
      for (const part of m[1].split(',')) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) refs.push(candidate);
      }
    }

    for (const raw of refs) {
      const href = raw.trim();
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('data:') ||
        /^https?:\/\//.test(href) ||
        href.startsWith('//')
      ) {
        continue;
      }
      const target = href.split('#')[0].split('?')[0];
      if (!target) continue;
      if (target.endsWith('/')) continue; // directory index
      if (!existsSync(path.join(ROOT, target))) {
        missing.push(`${rel} -> ${target}`);
      }
    }
  }

  for (const rel of cssFiles) {
    const css = await readFile(path.join(ROOT, rel), 'utf8');
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const href = m[1].trim();
      if (/^https?:|^data:/.test(href)) continue;
      const resolved = path.resolve(
        path.dirname(path.join(ROOT, rel)),
        href.split('#')[0].split('?')[0]
      );
      if (!existsSync(resolved)) {
        missing.push(`${rel} -> ${href}`);
      }
    }
  }

  if (missing.length) {
    fail(
      'asset references resolve',
      `${missing.length} broken reference(s):\n    ${missing.join('\n    ')}`
    );
  } else {
    pass('asset references resolve', 'every local href/src/url() resolves to a file on disk');
  }
}

async function checkClaims() {
  const htmlFiles = PAGES;
  const hits = [];

  for (const rel of htmlFiles) {
    const html = await readFile(path.join(ROOT, rel), 'utf8');
    // Ignore the brand-rule comment blocks and the form's own warning wording.
    const text = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

    for (const [label, re, allow] of PROHIBITED) {
      for (const m of text.matchAll(
        new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
      )) {
        /* An allowlisted principal is not a violation. The match carries the
         * title ("Dr. Dawit Muluneh"), so compare the name without it against
         * the approved full name - never against the page as a whole. */
        if (
          allow &&
          allow.some(name =>
            name.toLowerCase().includes(
              m[0]
                .replace(/^Dr\.?\s+/i, '')
                .trim()
                .toLowerCase()
            )
          )
        ) {
          continue;
        }
        const start = Math.max(0, m.index - 50);
        const context = text
          .slice(start, m.index + m[0].length + 50)
          .replace(/\s+/g, ' ')
          .trim();
        hits.push(`${rel}: [${label}] "${m[0]}" … ${context}`);
      }
    }

    checkGuaranteeClaims(rel, text, hits);
  }

  if (hits.length) {
    fail('claims and brand-word rules', `${hits.length} violation(s):\n    ${hits.join('\n    ')}`);
  } else {
    pass('claims and brand-word rules', 'no prohibited claim class or unapproved wordmark present');
  }
}

async function checkStructure() {
  const problems = [];

  for (const rel of PAGES) {
    const html = await readFile(path.join(ROOT, rel), 'utf8');

    const h1s = [...html.matchAll(/<h1[^>]*>/g)].length;
    if (h1s !== 1) {
      problems.push(`${rel}: expected exactly one <h1>, found ${h1s}`);
    }

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) {
      problems.push(`${rel}: duplicate id(s): ${[...new Set(dupes)].join(', ')}`);
    }

    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      if (!/\salt\s*=/.test(m[0])) {
        problems.push(`${rel}: <img> without alt: ${m[0].slice(0, 80)}`);
      }
    }

    if (!/<html lang="en">/.test(html)) {
      problems.push(`${rel}: missing or wrong lang attribute`);
    }

    for (const required of [
      'property="og:title"',
      'property="og:image"',
      'name="twitter:card"',
      'rel="canonical"',
      'name="description"',
    ]) {
      if (!html.includes(required)) {
        problems.push(`${rel}: missing ${required}`);
      }
    }

    if (!/pre-launch/i.test(html)) {
      problems.push(`${rel}: missing the mandatory pre-launch qualifier`);
    }

    if ((html.match(/class="skip-link"/g) || []).length !== 1) {
      problems.push(`${rel}: expected exactly one skip link`);
    }

    if (!html.includes('HakimeRAD Teleradiology — a service of Hakimerad Medical Consultancy')) {
      problems.push(`${rel}: footer entity line missing or non-standard`);
    }
  }

  if (problems.length) {
    fail(
      'page structure and metadata',
      `${problems.length} issue(s):\n    ${problems.join('\n    ')}`
    );
  } else {
    pass(
      'page structure and metadata',
      `${PAGES.length} pages: single h1, unique ids, alt text, OG/Twitter/canonical, qualifier, one skip link`
    );
  }
}

async function checkSecrets() {
  const suspects = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"]/i,
    /AKIA[0-9A-Z]{16}/,
    /ghp_[A-Za-z0-9]{20,}/,
  ];

  const candidates = (await collectFiles(ROOT)).filter(
    f => !f.startsWith('dist/') && !f.startsWith('.git/') && !f.startsWith('scripts/')
  );

  const hits = [];
  for (const rel of candidates) {
    if (!/\.(html|css|js|json|txt|xml|md|mjs)$/.test(rel)) continue;
    const body = await readFile(path.join(ROOT, rel), 'utf8');
    for (const re of suspects) {
      if (re.test(body)) hits.push(`${rel}: matches ${re}`);
    }
  }

  if (hits.length) {
    fail('no secrets in source', hits.join('; '));
  } else {
    pass('no secrets in source', 'no private keys, passwords or API secrets found');
  }
}

/* The Web3Forms key lives in two places by design: `js/config.js` (read by
 * main.js) and a literal `value` on a hidden `access_key` input in every page
 * that carries a form, so a no-JS submission still works. Duplication means they
 * can drift - rotate the key in one place and the other keeps submitting to a
 * key that no longer exists, which fails silently. This makes that impossible:
 * the build refuses to emit if any page disagrees with the config. */
async function checkFormKey() {
  const configRel = 'js/config.js';
  let configBody;
  try {
    configBody = await readFile(path.join(ROOT, configRel), 'utf8');
  } catch {
    fail('form access key is consistent', `${configRel} could not be read`);
    return;
  }

  const match = configBody.match(/accessKey:\s*'([^']+)'/);
  if (!match) {
    fail('form access key is consistent', 'no accessKey entry in js/config.js');
    return;
  }
  const canonical = match[1];

  const pages = (await collectFiles(ROOT)).filter(
    f => f.endsWith('.html') && !f.startsWith('dist/')
  );

  const mismatched = [];
  let carriers = 0;
  for (const rel of pages) {
    const body = await readFile(path.join(ROOT, rel), 'utf8');
    for (const m of body.matchAll(/<input[^>]*name="access_key"[^>]*value="([^"]*)"/g)) {
      carriers++;
      if (m[1] !== canonical) mismatched.push(`${rel}: ${m[1]}`);
    }
  }

  if (mismatched.length) {
    fail('form access key is consistent', `differs from ${configRel}: ${mismatched.join('; ')}`);
  } else {
    pass(
      'form access key is consistent',
      `${carriers} hidden input(s) across ${pages.length} page(s) match ${configRel}`
    );
  }
}

async function checkJsonLd() {
  const problems = [];
  for (const rel of PAGES) {
    const html = await readFile(path.join(ROOT, rel), 'utf8');
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(m[1]);
      } catch (error) {
        problems.push(`${rel}: invalid JSON-LD (${error.message})`);
      }
    }
  }
  if (problems.length) {
    fail('structured data parses', problems.join('; '));
  } else {
    pass('structured data parses', 'every ld+json block is valid JSON');
  }
}

/* ------------------------------------------------------------------ *
 * Emit
 * ------------------------------------------------------------------ */

async function emit() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  let copied = 0;

  for (const rel of DEPLOY_FILES) {
    const src = path.join(ROOT, rel);
    if (!existsSync(src)) continue;
    const dst = path.join(DIST, rel);
    await mkdir(path.dirname(dst), { recursive: true });
    await copyFile(src, dst);
    copied += 1;
  }

  for (const dir of DEPLOY_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const rel of await collectFiles(abs, ROOT)) {
      if (EXCLUDE.some(re => re.test(rel))) continue;
      const dst = path.join(DIST, rel);
      await mkdir(path.dirname(dst), { recursive: true });
      await copyFile(path.join(ROOT, rel), dst);
      copied += 1;
    }
  }

  /* BUILD_INFO.txt lands in a public document root, so it records only what is
   * safe to publish: when the build was made and how many files it holds.
   *
   * The exclusion *reasons* stay in MODERNIZATION_REPORT.md and in the EXCLUDE
   * comment above — neither of which is deployed, because `.md` is not in
   * DEPLOY_FILES. Describing withheld material inside a web-served file is itself
   * a disclosure: the previous version of this file told any visitor that
   * patient-identifiable imagery exists in the source repository. The operator
   * loses nothing, because the detail is one directory up in the repository.
   */
  await writeFile(
    path.join(DIST, 'BUILD_INFO.txt'),
    [
      'HakimeRAD website — production build',
      `built: ${new Date().toISOString()}`,
      `files: ${copied}`,
      '',
      'Some repository assets are deliberately not part of this build.',
      'The reasons are documented in MODERNIZATION_REPORT.md in the source',
      'repository, which is not published to this directory.',
      '',
    ].join('\n'),
    'utf8'
  );

  info('emit dist/', `${copied} files copied to dist/`);
}

/* ------------------------------------------------------------------ */

/**
 * Structural CSS check: balanced braces and terminated comments, with the line
 * number of the first problem.
 *
 * css/style.css is out of Prettier's formatting scope (see .prettierignore), so
 * it needs its own correctness gate. This catches a real defect that shipped in
 * the pre-existing stylesheet: a stray `:root {` left an unclosed block, which
 * nests the whole remainder of the file and silently drops rules that target
 * html itself, such as `html { font-size: 16px; scroll-behavior: smooth; }`.
 * No browser reports this. Prettier does, but only as a parse error.
 *
 * Braces inside quoted CSS values are not tracked separately; the project has no
 * `content: "…{…}"` declarations, and a false positive here is loud, not silent.
 */
async function checkCss() {
  const files = (await collectFiles(path.join(ROOT, 'css'))).map(f => `css/${f}`);
  const problems = [];

  for (const rel of files) {
    const css = await readFile(path.join(ROOT, rel), 'utf8');
    let depth = 0;
    let line = 1;
    let inComment = false;
    let firstUnmatched = null;

    for (let i = 0; i < css.length; i += 1) {
      const ch = css[i];
      if (ch === '\n') line += 1;

      if (inComment) {
        if (ch === '*' && css[i + 1] === '/') {
          inComment = false;
          i += 1;
        }
        continue;
      }
      if (ch === '/' && css[i + 1] === '*') {
        inComment = true;
        i += 1;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth < 0) {
          if (firstUnmatched === null) firstUnmatched = line;
          depth = 0;
        }
      }
    }

    if (inComment) problems.push(`${rel}: unterminated comment`);
    if (firstUnmatched !== null) problems.push(`${rel}:${firstUnmatched} unmatched closing brace`);
    if (depth > 0) problems.push(`${rel}: ${depth} unclosed block(s) at end of file`);
    if (inComment || firstUnmatched !== null || depth !== 0) {
      problems.push(`  re-check ${rel} with: npx prettier --check "${rel}"`);
    }
  }

  if (problems.length) {
    fail('stylesheets are structurally valid', problems.join('\n    '));
  } else {
    pass(
      'stylesheets are structurally valid',
      `${files.length} stylesheet(s): braces balanced, comments terminated`
    );
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log('HakimeRAD website build\n');

  await checkReferences();
  await checkCss();
  await checkClaims();
  await checkStructure();
  await checkJsonLd();
  await checkFormKey();
  await checkSecrets();

  for (const r of results) {
    const mark = r.info ? '·' : r.ok ? 'PASS' : 'FAIL';
    console.log(`  ${mark}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`);
  }

  if (failures > 0) {
    console.log(`\n${failures} check(s) failed. dist/ was not written.`);
    process.exitCode = 1;
    return;
  }

  console.log('');
  await emit();
  console.log('\nBuild OK.');
}

await main();
