#!/usr/bin/env node
/**
 * Live post-deploy verification.
 *
 *   npm run verify:live
 *   npm run verify:live -- https://www.hakimerad.health.et
 *
 * `scripts/smoke.mjs` verifies a build that is being served locally. This one
 * verifies the site as the public actually reaches it: TLS, the redirect chain,
 * the response headers, the error document, and — most importantly — whether
 * the `.htaccess` rules are in force at all.
 *
 * That last point is not theoretical. The production host is Plesk, which runs
 * nginx in front of Apache. Plesk's "Serve static files directly by nginx"
 * option and its "Smart static files processing" mode can let nginx answer a
 * request before it ever reaches Apache, and each file extension listed there
 * is excluded from Apache entirely. When that happens the pages still look
 * completely normal while the HTTPS redirect, the security headers and the
 * cache lifetimes in `.htaccess` silently stop applying. Response headers are
 * the only place that failure is visible from outside, so they are probed on a
 * real static asset as well as on the HTML document.
 *
 * Read-only: it issues GET and HEAD requests and changes nothing.
 */

const DEFAULT_BASE = 'https://www.hakimerad.health.et';

const BASE = (process.argv[2] || process.env.VERIFY_BASE || DEFAULT_BASE).replace(/\/+$/, '');

const TIMEOUT_MS = 15000;

/**
 * The published pages, each paired with a distinctive string it must contain.
 * `sitemap.xml` is the authoritative list and is checked separately.
 *
 * The marker matters as much as the status code. A host can answer 200 with a
 * placeholder, a "coming soon" page or a cached error page, and a status check
 * alone would not notice. Every marker below is already asserted against the
 * served build by `scripts/smoke.mjs`, so a failure here means production is
 * serving something the build never did.
 */
const PAGE_MARKERS = {
  '/': 'HakimeRAD',
  '/services.html': 'Turnaround targets',
  '/pricing.html': 'Engagement',
  '/about.html': 'Hakimerad Medical Consultancy',
  '/contact.html': 'Institutional enquiry',
  '/blog.html': 'Insights',
  '/blog-post-1.html': 'HakimeRAD',
  '/blog-post-2.html': 'targets, not guarantees',
  '/blog-post-3.html': 'HakimeRAD',
};

/**
 * Headers `.htaccess` sets on every response via `Header always set`. If any of
 * these is missing from a static asset, the Apache configuration is not being
 * applied to that asset — which is how a Plesk nginx bypass presents itself.
 */
const REQUIRED_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
  'permissions-policy',
  'content-security-policy',
  'cross-origin-opener-policy',
];

const results = [];
let failures = 0;
let warnings = 0;

function check(name, ok, detail = '') {
  results.push({ level: ok ? 'PASS' : 'FAIL', name, detail });
  if (!ok) failures += 1;
}

function warn(name, ok, detail = '') {
  results.push({ level: ok ? 'PASS' : 'WARN', name, detail });
  if (!ok) warnings += 1;
}

function note(name, detail) {
  results.push({ level: 'INFO', name, detail });
}

function abs(pathOrUrl) {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`;
}

async function head(pathOrUrl, init = {}) {
  const url = abs(pathOrUrl);
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
}

async function getText(pathOrUrl) {
  const res = await head(pathOrUrl);
  return { res, body: await res.text() };
}

/** Compare URLs without caring about an implicit `/` or a default port. */
function normalise(value) {
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}${u.pathname || '/'}${u.search}`;
  } catch {
    return value;
  }
}

function joined(list) {
  return list.join(', ');
}

const baseUrl = new URL(BASE);
const HOST = baseUrl.host;
const IS_WWW = HOST.startsWith('www.');
const apexHost = IS_WWW ? HOST.slice(4) : HOST;
const wwwHost = IS_WWW ? HOST : `www.${HOST}`;

function report() {
  for (const r of results) {
    console.log(`  ${r.level.padEnd(4)}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`);
  }
  console.log('');

  if (failures) {
    console.log(
      `${failures} check(s) failed${warnings ? `, ${warnings} warning(s)` : ''}. ` +
        'See DEPLOYMENT.md §3.1 before retrying.'
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Live verification OK. ${results.length} checks against ${BASE}` +
      `${warnings ? ` (${warnings} warning(s))` : ''}.`
  );
}

async function main() {
  console.log(`HakimeRAD live verification against ${BASE}\n`);

  /* --- 1. The canonical origin answers over TLS -------------------------- */
  let home;
  try {
    home = await head('/');
  } catch (err) {
    check(
      `the canonical origin serves over HTTPS`,
      false,
      `${err.message} — check DNS, the certificate and whether the site is switched on`
    );
    report();
    return;
  }

  check(
    'the canonical origin serves over HTTPS',
    home.status === 200,
    home.status === 200
      ? `HTTP 200, TLS accepted for ${HOST}`
      : `HTTP ${home.status} (a 403 here often means the document root is empty)`
  );

  /* --- 2. http:// collapses onto the canonical https origin --------------- */
  const plain = `${BASE.replace(/^https:/, 'http:')}/`;
  try {
    const res = await head(plain);
    const location = res.headers.get('location') || '';
    const isRedirect = res.status >= 300 && res.status < 400;

    check(
      'http:// redirects to https://',
      isRedirect && normalise(location).startsWith('https://'),
      isRedirect ? `${res.status} -> ${location}` : `HTTP ${res.status} with no redirect`
    );
    warn(
      'the http:// redirect lands on the canonical host in one hop',
      normalise(location) === normalise(`${BASE}/`),
      location || 'no Location header'
    );
  } catch (err) {
    check('http:// redirects to https://', false, err.message);
  }

  /* --- 3. The other hostname collapses onto this one --------------------- */
  const otherHost = IS_WWW ? apexHost : wwwHost;
  try {
    const res = await head(`https://${otherHost}/`);
    const location = res.headers.get('location') || '';
    const isRedirect = res.status >= 300 && res.status < 400;

    check(
      `${otherHost} redirects to ${HOST}`,
      isRedirect && normalise(location).startsWith(BASE),
      isRedirect
        ? `${res.status} -> ${location}`
        : `HTTP ${res.status} with no redirect — both hostnames are serving the site, so canonical URLs and the sitemap disagree`
    );
  } catch (err) {
    check(`${otherHost} redirects to ${HOST}`, false, err.message);
  }

  /* --- 4. Every page answers 200 with its own content -------------------- */
  const pageProblems = [];
  for (const [page, marker] of Object.entries(PAGE_MARKERS)) {
    try {
      const { res, body } = await getText(page);
      if (res.status !== 200) {
        pageProblems.push(`${page} -> HTTP ${res.status}`);
      } else if (!body.includes(marker)) {
        pageProblems.push(
          `${page} -> HTTP 200 but no "${marker}": a placeholder, stale or error page is being served`
        );
      }
    } catch (err) {
      pageProblems.push(`${page} -> ${err.message}`);
    }
  }
  check(
    `all ${Object.keys(PAGE_MARKERS).length} published pages answer 200 with their own content`,
    pageProblems.length === 0,
    joined(pageProblems)
  );

  /* --- 5. sitemap.xml is complete and points at this host ---------------- */
  try {
    const { res, body } = await getText('/sitemap.xml');
    if (res.status !== 200) {
      check('sitemap.xml is served', false, `HTTP ${res.status}`);
    } else {
      const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);
      check('sitemap.xml lists site URLs', locs.length > 0, `${locs.length} <loc> entries`);

      const foreignHosts = [...new Set(locs.map(u => new URL(u).host))].filter(h => h !== HOST);
      warn(
        'every sitemap URL uses the canonical host',
        foreignHosts.length === 0,
        foreignHosts.length
          ? `sitemap points at ${joined(foreignHosts)} but the site is served from ${HOST}`
          : `all ${locs.length} URLs on ${HOST}`
      );

      const bad = [];
      for (const loc of locs) {
        const target = new URL(loc);
        const path = `${target.pathname}${target.search}`;
        try {
          const r = await head(path);
          if (r.status !== 200) bad.push(`${path} -> HTTP ${r.status}`);
        } catch (err) {
          bad.push(`${path} -> ${err.message}`);
        }
      }
      check('every URL in sitemap.xml answers 200', bad.length === 0, joined(bad));
    }
  } catch (err) {
    check('sitemap.xml is served', false, err.message);
  }

  /* --- 6. Security headers on the HTML document ------------------------- */
  const homeHeaders = home.headers;
  const missingOnHtml = REQUIRED_HEADERS.filter(h => !homeHeaders.get(h));
  check(
    'the HTML document carries every security header',
    missingOnHtml.length === 0,
    missingOnHtml.length
      ? `missing: ${joined(missingOnHtml)}`
      : `all ${REQUIRED_HEADERS.length} present`
  );

  const hsts = homeHeaders.get('strict-transport-security') || '';
  const maxAge = Number((hsts.match(/max-age=(\d+)/) || [])[1] || 0);
  warn(
    'HSTS is set for at least 180 days and covers subdomains',
    maxAge >= 15552000 && /includeSubDomains/i.test(hsts),
    hsts || 'no Strict-Transport-Security header'
  );

  const csp = homeHeaders.get('content-security-policy') || '';
  const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || '';
  check(
    "the CSP keeps script-src to 'self' and blocks plugins",
    /'self'/.test(scriptSrc) && !/unsafe-inline/.test(scriptSrc) && /object-src\s+'none'/.test(csp),
    csp || 'no Content-Security-Policy header'
  );

  /* --- 7. The .htaccess rules are in force on static files too ----------- */
  let css;
  try {
    css = await head('/css/style.css');
  } catch (err) {
    check('static assets are served', false, err.message);
  }

  if (css) {
    const cssHeaders = css.headers;
    const missingOnStatic = REQUIRED_HEADERS.filter(h => !cssHeaders.get(h));

    let detail;
    if (css.status !== 200) {
      detail = `HTTP ${css.status} for /css/style.css`;
    } else if (missingOnStatic.length) {
      detail =
        `missing on a static file: ${joined(missingOnStatic)}. ` +
        'If this is production, requests for static files are being answered before Apache sees them ' +
        '(Plesk "Serve static files directly by nginx") — see DEPLOYMENT.md §3.1.';
    } else {
      detail = 'the document and a static file return the same header set';
    }

    check(
      '/css/style.css carries the security headers (proves requests still reach Apache)',
      css.status === 200 && missingOnStatic.length === 0,
      detail
    );

    const cssCache = cssHeaders.get('cache-control') || '';
    warn(
      'the .htaccess cache lifetime applies to CSS (max-age=86400)',
      /max-age=86400/.test(cssCache),
      cssCache || 'no Cache-Control header'
    );
  }

  /* --- 7b. Diagnostic context for the check above ------------------------ */
  /* Plesk reports `Server: nginx` in proxy mode even when everything works,
   * so the header on its own proves nothing. It is still worth recording next
   * to the result, because `X-Powered-By` is a second, independent signal: the
   * .htaccess rule that unsets it only runs if Apache handled the response. */
  const server = home.headers.get('server') || '';
  const poweredBy = home.headers.get('x-powered-by') || '';
  note(
    'server identification',
    `${server || 'no Server header'}. ` +
      (poweredBy
        ? `X-Powered-By is exposed (${poweredBy}) — the .htaccess rule that unsets it is not applying. `
        : 'No X-Powered-By leak. ') +
      'nginx here is normal under Plesk proxy mode; the static-file check above is what decides whether Apache is being bypassed.'
  );

  /* --- 8. The .htaccess cache policy applies to HTML ---------------------- */
  const homeCache = homeHeaders.get('cache-control') || '';
  warn(
    'HTML is not cached, so a content change is visible immediately',
    /no-cache/.test(homeCache),
    homeCache || 'no Cache-Control header'
  );

  /* --- 9. The site's own error page, not the host's default -------------- */
  const missingPath = `/verify-live-${Date.now().toString(36)}`;
  try {
    const { res, body } = await getText(missingPath);
    const isOwnPage = /HakimeRAD/.test(body) && /name="robots"\s+content="noindex/.test(body);

    let detail;
    if (res.status !== 404) {
      detail = `HTTP ${res.status} — the host is not returning 404 for a missing page`;
    } else if (!isOwnPage) {
      detail = 'a 404 body that is not the site error page (the host default is being shown)';
    } else {
      detail = 'ErrorDocument 404 /404.html is in force';
    }

    check(
      `${missingPath} returns the site's own 404 page`,
      res.status === 404 && isOwnPage,
      detail
    );
  } catch (err) {
    check(`${missingPath} returns 404`, false, err.message);
  }

  /* --- 10. Directory listing is off (Options -Indexes) ------------------- */
  try {
    const res = await head('/css/');
    check(
      'directory listing is disabled',
      res.status !== 200,
      res.status === 200
        ? 'HTTP 200 — /css/ is browsable; Options -Indexes is not in force'
        : `HTTP ${res.status}`
    );
  } catch (err) {
    check('directory listing is disabled', false, err.message);
  }

  /* --- 11. Compression (informational) ---------------------------------- */
  try {
    const res = await head('/', { headers: { 'accept-encoding': 'gzip, deflate, br' } });
    const encoding = res.headers.get('content-encoding') || '';
    note(
      'compression',
      encoding
        ? `${encoding} on the HTML document`
        : 'no Content-Encoding reported — the host or a CDN may compress transparently; confirm in DevTools > Network'
    );
  } catch (err) {
    note('compression', `could not be determined: ${err.message}`);
  }

  report();
}

await main();
