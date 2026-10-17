# Deployment guide — HakimeRAD Teleradiology website

**Stack:** static HTML, CSS and vanilla JavaScript. No framework, no bundler, no server-side runtime.
**Repository root:** this directory (`site/templet-project`).
**Production domain:** `https://www.hakimerad.health.et`
**Production hosting:** Ethio Telecom shared hosting, administered through the **Plesk** control panel
(`https://myportal.ethiotelecom.et/`). Document root `httpdocs/`, Apache behind an nginx proxy. See §3.1.
**Remote:** `https://github.com/dawitmuluneh25-dev/templet-project.git`

**Release under this guide:** 56 files, 1,223,997 bytes (1.17 MiB). Built and verified 17 October 2026.

---

## 0. Topic map

Five things are true of this deployment, and four of them are counter-intuitive:

- The site is **static**. There is **no database, no `.env` file and no server-side runtime** —
  by construction, not by omission. §5.1 and §5.3 state this explicitly, because "no database"
  is the correct answer to a question the plan usually expects to have one.
- The build is a **fail-closed gate**: `npm run build` verifies first and only then writes
  `dist/`. One failing check writes nothing and exits 1. §2.
- Deployment is a **file copy** into `httpdocs/`. Nothing is compiled, migrated or installed
  on the server. §3.2, and the ordered runbook at §3.6.
- **`.htaccess` carries the HTTPS redirect, HSTS, the CSP, the cache policy and the 404 page**,
  and Plesk has one setting that disables all of it with no visible error. §3.1 — read it
  before §3.2.
- Domain, DNS, the TLS certificate and the mailbox are **manual owner actions in the Plesk
  panel**. §6.1 and §6.2. None of them were performed from this repository.

| What you asked for | Where it is |
|---|---|
| Production readiness | §2 (local gates) · §7 (post-deploy checks) · §9 (host-side failures) |
| Build | §2 — `npm run build`, `serve`, `smoke`, `lint`, `format:check`, `verify:live` |
| Configuration | §5.1 (`js/config.js`) · §4 and §3.4 (`.htaccess` and its Plesk equivalents) |
| File structure | §1 (what ships, what is withheld) · §1.1 (the full release tree) |
| **Database setup** | **§5.3 — not applicable. There is no database.** |
| **Environment variables** | **§5.1 — there is no `.env`.** The configuration surface is `js/config.js`; §5.2 is the checklist to work through before building |
| Hosting compatibility | §1.2 (what Plesk must provide) · §3.1 (the nginx proxy trap) · §9 (host-side failures) |
| Domain settings | §6.1 |
| SSL / TLS | §6.2 · §3.1 (why `.well-known/` has to survive a deploy) |
| Deployment instructions | §3 — and the ordered runbook at §3.6 |
| Rollback | §8 |

The bold rows are the two where the honest answer is "this does not apply". They are worth
reading before concluding that something has been left out.

---

## 1. What gets deployed

Only the files listed in `scripts/build.mjs` are deployable. `npm run build` writes them to `dist/` and prints an inventory.

| Deployed | Not deployed (present in the repo, deliberately excluded) | Why |
|---|---|---|
| 9 HTML pages + `404.html` | ~~`hakimerad_deploy.zip`~~ | **Deleted on 16 October 2026.** It was a stale 9 MB snapshot of an earlier revision of this same repo, and **37 of its 52 entries matched the prohibited-content patterns** — including the three `images/blog/*.png` files carrying a named hospital, a named clinician and a patient name with date of birth. Uploading it would have published prohibited imagery *alongside* the correct build. It is gone from the working tree; the blob remains in git history, so if this repository is ever cloned or mirrored, check it out of the archive only with care. See `MODERNIZATION_REPORT.md` §6 issue 1. |
| `css/`, `js/`, `fonts/` | `images/favicon web/` | The previous icon set. Its logogram was orange and blue, neither of which is in the brand palette. Superseded by the brand favicon set at the site root and in `images/`. |
| `images/` minus exclusions | `vidios/` | A 2.4 MB stock hero video. The hero now uses a brand-compliant poster; see `MODERNIZATION_REPORT.md` §6. |
| `robots.txt`, `sitemap.xml` | `photos/` | Unused portrait placeholders after the leadership section was removed. |
| `favicon.ico`, `favicon.svg`, `site.webmanifest` | `scripts/`, `*.md`, `package*.json` | Build and documentation files, not web assets. |
| `.htaccess` (Apache hosts only) | `node_modules/`, `dist/` | Not tracked. |

### 1.1 File structure of the release

`npm run build` writes a flat document root. This is the complete `dist/` tree as measured
on 17 October 2026 — **56 files, 1,223,997 bytes (1.17 MiB)**:

```text
dist/                             <- upload the CONTENTS of this folder, not the folder
├── index.html                    the 9 indexable pages, one <h1> each, all metadata checked
├── services.html
├── pricing.html
├── contact.html
├── about.html
├── blog.html
├── blog-post-1.html
├── blog-post-2.html
├── blog-post-3.html
├── 404.html                      served by ErrorDocument 404; noindex, no Open Graph tags
├── robots.txt
├── sitemap.xml                   9 canonical URLs, all on www.hakimerad.health.et
├── llms.txt                     2,524 B  plain-text summary for AI answer engines (llmstxt.org).
│                                            Every claim in it is one the pages already make
├── favicon.ico  favicon.svg      brand favicon set, mirrored into images/
├── site.webmanifest              PWA manifest; its MIME type is set in .htaccess
├── googlef76bff2c6a9dc71b.html   Google Search Console verification — do NOT rename or move
├── BUILD_INFO.txt                generated: build timestamp and file count only. It is served
│                                            publicly; safe to delete from httpdocs/ after upload
├── .htaccess                     the only server configuration that ships; see §3.1
├── css/
│   ├── style.css                 45,638 B  layout and components
│   ├── brand-layer.css           24,521 B  brand overrides, footer lockup, service notes
│   └── fonts.css                  1,035 B  @font-face for the self-hosted family
├── js/
│   ├── config.js                  5,716 B  the entire configuration surface (§5.1)
│   ├── main.js                   36,142 B  navigation, theme, forms, social links
│   └── theme-boot.js              1,302 B  dark-mode bootstrap. A separate file because the
│                                            CSP has no `script-src 'unsafe-inline'`
├── fonts/                        5 files  4 x IBM Plex Sans .woff2 + the OFL licence text
└── images/                      26 files
    ├── brand/                    10 files  logogram, wordmark and lockups, light + dark, PNG + SVG
    ├── blog/                      3 files  brand artwork for the three posts
    └── (root)                     13 files favicons, touch icons, hero posters, Open Graph image,
                                            and the WhatsApp contact QR (qr-whatsapp.svg)
```

Three things that are easy to get wrong:

- **Upload the contents of `dist/`.** `httpdocs/index.html` must be the home page.
  `httpdocs/dist/index.html` is a broken site that returns the host's default page.
- **`dist/` is disposable.** It is deleted and rewritten on every build and is not tracked by
  git. Never edit a file inside it — edit the source and rebuild.
- **`googlef76bff2c6a9dc71b.html` must keep its exact name.** Google Search Console verifies by
  fetching that path. Renaming it silently un-verifies the property.

### 1.2 Hosting environment requirements

What the site needs from the plan — and, just as importantly, what it does not.

| Requirement | Needed | Notes |
|---|---|---|
| **Static file serving** | **Yes** | The whole site is HTML, CSS, JS, fonts and images |
| **Apache reading `.htaccess`** | **Yes, strongly preferred** | Carries the HTTPS redirect, HSTS, the CSP, the cache policy, the MIME types and the 404 page. Plesk for Linux serves Apache behind an **nginx proxy** by default — §3.1 is the one setting that silently disables every one of those rules |
| `mod_rewrite`, `mod_headers`, `mod_expires`, `mod_mime`, `mod_deflate` | Preferred | Every rule is wrapped in `<IfModule>`, so a missing module disables that rule alone rather than returning 500 for the whole site |
| **TLS certificate** | **Yes** | Free Let's Encrypt through Plesk's **SSL It!** extension — §6.2 |
| **One working mailbox** | **Yes** | The enquiry form delivers through Web3Forms to the mailbox its key was registered against — §6 |
| Outbound access to `cdnjs.cloudflare.com` **from the visitor's browser** | Yes | The Font Awesome 6.5.2 stylesheet is fetched from cdnjs. It is the only third-party asset the site loads; everything else is same-origin |
| `Options -Indexes` overrides permitted | Ideally | Directory listing is switched off in `.htaccess`. If the plan refuses `Options` overrides the site returns **500** — the fix is in §9 |
| **Node.js on the server** | **No** | Node runs the build on *your* machine. `dist/` is plain files that the server never executes |
| **PHP** | **No** | There is no server-side code anywhere. Adding PHP would be a new feature, not a deployment step |
| **MySQL / MariaDB / PostgreSQL** | **No** | See §5.3 |
| **SSH, cron, Composer, npm on the server** | **No** | Nothing to install, schedule or run server-side |

**Disk and transfer.** The release is **1.17 MB across 56 files** — smaller than a single
photograph — so no realistic shared plan is constrained by it. Runtime page weight is
dominated by the hero poster and the two largest blog images.

**Outbound network the site depends on.** `cdnjs.cloudflare.com` for the icon stylesheet and
`api.web3forms.com` for form delivery. Nothing else. `fonts.googleapis.com` is deliberately
not used: IBM Plex Sans is self-hosted from `fonts/`, which removes that request class
entirely and is why the CSP can stay at `script-src 'self'`.

---

## 2. Local verification

```powershell
# from site/templet-project

# 1. Regenerate brand assets from the authoritative sources (only needed if the
#    brand assets change). Requires Python with Pillow and fontTools+brotli.
npm run assets

# 2. Run the checks and write dist/ — this is the gate, exit code 1 on failure.
npm run build

# 3. Serve the production build and check it in a browser.
npm run serve -- dist
# → http://localhost:4173/
npm run smoke            # in a second terminal: HTTP-level checks on that build
npm run lint             # 0 errors. The 16 warnings are all no-console, in scripts/
npm run format:check
```

Those three prove the site is correct as files and over HTTP. They do **not** prove
it renders correctly — none of them looks at a pixel. Before a release, also run
the rendered pass from the repository root (`hakimerad-team/`), which needs a
Chrome install:

```powershell
cd C:\Users\Administrator\Desktop\Business\hakimerad-team
node polish-review\qa-driver.mjs    # 40 runs: 10 pages x 2 viewports x 2 themes
node polish-review\wheel-check.mjs  # real wheel events on the mobile drawer
node polish-review\verify-after.mjs # findings, split by theme
```

`node polish-review\eol.mjs` checks the five files whose line endings matter
(`css/style.css` is CRLF; the rest are LF) — run it before and after a build.
`reverify.ps1` chains all of the above. `polish-review/` is outside
`site/templet-project` and is never deployed.

After the first deploy, and after every subsequent one, run the live check against the deployed origin. It
verifies TLS, the redirect chain, the security headers, the cache policy and the error page — and, critically,
whether the Apache configuration is reaching static files at all (§3.1):

```powershell
npm run verify:live
npm run verify:live -- https://www.hakimerad.health.et
```

To serve the working tree instead of the build output, run `npm run serve` with no argument.

The local server applies the same security headers as `.htaccess`, so a header mistake shows up locally rather than in production.

### What `npm run build` checks

| Check | Fails the build when |
|---|---|
| Asset references resolve | Any local `href`, `src`, `srcset` or CSS `url()` does not exist on disk |
| Claims and brand-word rules | A prohibited claim class or unapproved wordmark appears in a page (see `scripts/build.mjs` `PROHIBITED`) |
| Page structure and metadata | Not exactly one `<h1>`; duplicate `id`; `<img>` without `alt`; missing `lang`, description, canonical, Open Graph or Twitter tags; missing pre-launch qualifier; more than one skip link; non-standard footer entity line |
| Structured data parses | Any `application/ld+json` block is not valid JSON |
| No secrets in source | A private key, password or API secret pattern is found |

---

## 3. Deploy — Ethio Telecom / Plesk

Production is **shared hosting from Ethio Telecom, administered through Plesk**
(`https://myportal.ethiotelecom.et/`). Plesk for Linux serves sites with Apache and runs **nginx in front as a
proxy** by default. The default document root is `httpdocs/`.

### 3.1 Read this first — Plesk can silently disable `.htaccess`

Everything in `.htaccess` — the HTTPS redirect, the canonical-host collapse, HSTS, the CSP, the cache
lifetimes, `ErrorDocument 404`, `Options -Indexes` — depends on the request reaching Apache. Plesk has two
settings under **Websites & Domains → domain → Apache & nginx Settings → nginx settings** that can stop that:

| Plesk setting | Effect on this site |
|---|---|
| **Serve static files directly by nginx** | Any extension listed there is answered by nginx and **never reaches Apache**. Plesk's own documentation is explicit: requests for those files "do not pass through Apache handlers", which means "rewrite rules or `.htaccess` directives are not applied". |
| **Smart static files processing** | **Also bypasses Apache for static files — measured on this node, 16 October 2026.** The name, and Plesk's own description (which only warns that "only files served by Apache will have the expires header"), suggest something gentler than the setting above. What it actually does is answer from nginx any request whose path **exists on disk**, and proxy only what it cannot resolve. So `/`, `/css/style.css`, `/404.html`, the images and the fonts never reach Apache, while a rewritten path such as `/services` or a missing path (which Apache turns into the `ErrorDocument 404` response) still does. The site then returns **200 for every file and renders correctly while sending none of the `.htaccess` security headers — including the CSP**. §10.7 is the measurement. |

**This is the most likely way this deployment goes wrong quietly, and it is not hypothetical: it happened
here.** The site renders perfectly, every asset returns 200, `npm run smoke` against localhost still
passes — and the headers are simply gone in production. On 16 October 2026 the node was found in exactly
the state that causes it, and the live site spent a period with **no CSP at all**. See §10.7.

So:

1. **Before deploying**, confirm **Proxy mode** is selected, and that **both** **Serve static files directly
   by nginx** **and** **Smart static files processing** are **not** enabled. Clearing only the first is not
   enough. Leaving either one on means `.htaccess` is applied to some responses and not others, with no
   error anywhere to say so.
2. **After deploying**, run `npm run verify:live`. It fails if `/css/style.css` does not return the same
   header set as the HTML document, which is the signature of this failure.

   **Two signals that look like evidence and are not.** `Server: nginx` is normal under proxy mode — nginx
   is still the front end when Apache handles the request. And `X-Powered-By: PleskLin` is added by nginx
   *after* Apache has responded, so it is present either way; `.htaccess`'s `Header unset X-Powered-By` only
   removes Apache's own. What does discriminate:

   - **The CSP.** Request the home page and look for `content-security-policy`. If it is absent, Apache did
     not handle that response.
   - **The `ETag` format.** Apache writes `"<size>-<mtime>"` (`"72b4-65dea3a69b300"`); nginx serving the file
     itself writes `"<mtime>-<size>"` (`"6ad16f6c-72b4"`). The two numbers are the same, so only the order
     separates "Apache, through nginx" from "nginx, Apache never involved".

   Beware that a **missing** path proves nothing: the 404 is generated by Apache, so it carries the full
   header set even while every real file bypasses it. Compare a real, existing file — `/`, not the 404.
3. **If the setting cannot be changed** — some shared plans hide it — reproduce the configuration in Plesk
   instead of `.htaccess`, per §3.4.

### 3.2 Upload the build

```powershell
npm run build
```

A prebuilt archive for exactly this step is kept at
`hakimerad-team\deploy-release\hakimerad-site-2026-10-16.zip`. **Regenerate it after any source
change** — a stale archive is how a fixed defect reappears in production.

Then place the **contents** of `dist/` into the document root — `httpdocs/` unless it was changed under
Hosting Settings. Two things to get right:

- Upload the *contents*, not the `dist/` folder itself: `httpdocs/index.html` must be the home page.
- Do not delete what Plesk owns. `.well-known/` holds the ACME challenges used for certificate renewal —
  removing it breaks TLS renewal. Leave `cgi-bin/` and `mail/` alone too.

Three ways to get the files there:

| Method | Where | Notes |
|---|---|---|
| **File Manager** | Websites & Domains → domain → File Manager | Fine for the first upload: upload the archive, then extract it in place. |
| **FTP / SFTP** | Websites & Domains → FTP Access | Best for repeatable uploads. The account is the one Plesk created at subscription setup. |
| **Git** | Git in the domain's panel | See §3.3 — it needs care, because the build output is not committed. |

### 3.3 Deploying from the GitHub repository (optional)

`dist/` is not committed, so a plain Git pull would deploy the *source* tree rather than the site. Only use
Plesk's Git deployment if you also commit `dist/` or add a post-deploy action that builds it; otherwise
upload `dist/` directly per §3.2.

Plesk can add a remote repository and pull it manually or automatically on push via a webhook. **Do not**
point the deployment path at `httpdocs/` with a "remove all files" mode — that deletes `.well-known/` and
breaks TLS renewal.

### 3.4 If `.htaccess` cannot be used

When the host does not read `.htaccess` (nginx-only hosting, or the §3.1 setting cannot be changed),
reproduce each rule in the Plesk interface. **Nothing in the site itself needs to change.**

| `.htaccess` rule | Plesk equivalent |
|---|---|
| Security headers — HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` | **Apache & nginx Settings → Additional headers**, one `Name : Value` per line. The full set is in §4. |
| `AddType font/woff2`, `application/manifest+json`, `image/svg+xml` | **Apache & nginx Settings → MIME types** |
| `ErrorDocument 404 /404.html` | Plesk's custom error pages for Linux servers — see the Plesk documentation, *Setting Up Custom Error Pages on Linux Servers* |
| HTTPS and canonical-host redirects | Plesk's HTTPS-redirect setting under **Hosting Settings**, plus a **domain alias** for whichever hostname is not the primary domain on the plan — with Plesk's *Redirect with the HTTP 301 code* left off, because `.htaccess` owns the canonical-host redirect. §6.1 step 3 |
| `Expires` / `Cache-Control` | **Apache & nginx Settings → Expires**, with **response with Expires headers for static files only** selected |
| `Options -Indexes` | Not strictly needed — Apache returns 403 for a directory with no index file by default |

**Header caveat, per Plesk's documentation:** "If nginx is enabled, only files served by Apache will have
the expires header." The same constraint applies to the *Additional headers* list. This is exactly why §3.1
step 2 tests a static file and not just the home page.

### 3.5 Alternative targets

If the site is ever moved off Ethio Telecom, the build is unchanged. §4 has the header set to reproduce.
`.htaccess` is ignored by GitHub Pages, Netlify, Cloudflare Pages and Vercel, each of which needs its own
configuration file instead; for those, build command `npm run build`, publish directory `dist`. GitHub Pages
also serves from a subpath unless a custom domain is set — the site uses relative asset paths so it works,
but canonical URLs and `sitemap.xml` are absolute to `www.hakimerad.health.et` and must match wherever it is
actually served.

### 3.6 Consolidated runbook — first deploy

Work top to bottom. Steps 1–6 happen on your machine, 7–13 in the Plesk panel, 14–15 prove it
worked. **Nothing in this runbook has been executed for you, and nothing in this repository has
been deployed.**

#### Before you start — two facts to capture and one backup to take

1. **Confirm the plan and the document root.** Log in at `https://myportal.ethiotelecom.et/` and
   check that the subscription is **Plesk for Linux** — Plesk for Windows does not read
   `.htaccess` at all, and §3.4 becomes mandatory rather than optional. Confirm the document root
   under **Websites & Domains → Hosting Settings** is `httpdocs/`. Note the real path if it differs;
   step 7 depends on it.
2. **Take a backup now.** Websites & Domains → **Backup Manager** → *Back Up*. The existing
   `httpdocs/` has never been under version control, so this snapshot is the only copy of whatever
   is currently published. It is also the rollback artefact for §8.
3. **Settle the configuration** by working through §5.2. The one item that changes what you ship is
   the eight `social.*` values — with them empty the footer carries eight visible placeholders.

#### On your machine

4. **Reproduce the exact dependencies and gate the release.** Every step must exit 0:
   ```powershell
   cd site\templet-project
   npm ci                     # exactly the lockfile, not a floating install
   npm run build              # fail-closed gate; writes dist/ only if all six checks pass
   npm run lint               # 0 errors expected (16 no-console warnings, all in scripts/)
   npm run format:check       # "All matched files use Prettier code style!"
   ```
5. **Prove the build over HTTP before it goes near the host.**
   ```powershell
   npm run serve -- dist      # terminal 1  ->  http://localhost:4173/
   npm run smoke              # terminal 2  ->  18 checks
   ```
6. **Archive the build contents.** Zip the *contents* of `dist/`, not the folder — see §3.2. A
   ready archive is kept at `hakimerad-team\deploy-release\` for exactly this step; regenerate it
   after any source change rather than reusing it.

#### In the Plesk panel

7. **Fix the nginx setting first.** Websites & Domains → the domain → **Apache & nginx Settings** →
   *nginx settings*: select **Proxy mode**, and ensure **both** **Serve static files directly by nginx**
   and **Smart static files processing** are **not** enabled. Clearing only the first leaves the failure
   in place. Doing this *after* uploading invites the silent failure described in §3.1 — which is what
   happened on this node.
8. **Upload.** Websites & Domains → the domain → **File Manager** → open `httpdocs/` → upload the
   step-6 archive → **Extract Files** in place. Do not create an extra folder level.
9. **Do not let the upload remove Plesk's own directories.** `.well-known/` holds the ACME
   challenges that renew the certificate — deleting it breaks TLS renewal. Leave `cgi-bin/` and
   `mail/` alone as well. In particular, if you later add Git deployment, **never** choose
   "remove all files" against `httpdocs/` (§3.3).
10. **Make the second hostname a domain alias — and leave Plesk's own 301 switched off.**
    Websites & Domains → **Add Domain Alias** → enter whichever hostname is *not* the primary
    domain on this subscription: `www.hakimerad.health.et` if the primary is the bare apex, or
    `hakimerad.health.et` if the primary is `www`. Tick **Web service** and **Synchronize DNS
    zone with the primary domain**; leave **Mail service** off; and leave **Redirect with the
    HTTP 301 code** **unchecked**. `.htaccess` owns the canonical-host redirect and always sends
    the apex to `www`, so a Plesk 301 pointing the other way makes the two rules point at each
    other and the browser gives up with `ERR_TOO_MANY_REDIRECTS`. §6.1 step 3 has the table.
11. **Issue the certificate.** Websites & Domains → the domain → **SSL/TLS Certificates** →
    **SSL It!** → *Install* a free **Let's Encrypt** certificate covering both `www.hakimerad.health.et`
    and `hakimerad.health.et`, and enable automatic renewal. Detail in §6.2.
12. **Turn on the HTTPS redirect** under **Hosting Settings** if the panel offers it — it duplicates
    the `.htaccess` rule and gives a second line of defence if §3.1 goes the wrong way later.
13. **Create the mailbox** the form delivers to: **Mail → Create Email Address** → `info@hakimerad.health.et`.
    Confirm the address registered in Web3Forms is the same one (§5.1), or submissions will be
    rejected at the provider and never arrive.

#### Prove it

14. **Run the automated post-deploy checks.** This is the step that catches §3.1:
    ```powershell
    npm run verify:live -- https://www.hakimerad.health.et
    ```
    Rows 1–7 of §7 must pass. **If row 5 passes and row 6 fails, `.htaccess` is being bypassed —
    go back to step 7 before doing anything else.**
15. **Then work the browser rows.** §7 rows 8–19 need a real browser and cannot be checked by any
    script in this repository. Rows 10–13 in particular require a live form submission and a
    delivered email, and have never been exercised.
16. **Re-submit `sitemap.xml`** in Google Search Console once the canonical host is serving, and
    confirm the verification file from §1.1 is still reachable at its original path.

---

## 4. Security headers on other hosts

If the site is not served by Apache, reproduce these at the platform layer. `netlify.toml`-style example for a `_headers` file:

```text
/*
  Strict-Transport-Security: max-age=15552000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; media-src 'self'; form-action 'self' https://api.web3forms.com; connect-src 'self' https://api.web3forms.com; frame-src https://maps.google.com; base-uri 'self'; object-src 'none'; upgrade-insecure-requests
```

The CSP deliberately does **not** allow Google Fonts. IBM Plex Sans is self-hosted from `fonts/`, which removes that third-party request entirely. `cdnjs.cloudflare.com` is allowed for the Font Awesome stylesheet only.

Verify after deploying:

```powershell
curl.exe -sI https://www.hakimerad.health.et/ | Select-String -Pattern 'strict-transport|x-content-type|referrer-policy|content-security'
```

---

## 5. Configuration, environment variables and database

### 5.1 There is no `.env` — and where configuration actually lives

There is no server-side environment, no `.env` file, and no build-time variable substitution:
the build is a file copy, so there is no step at which an environment variable *could* be read.
Everything configurable lives in one file, in one place:

**`js/config.js`**

| Key | Purpose | Notes |
|---|---|---|
| `forms.endpoint` | Form delivery endpoint | `https://api.web3forms.com/submit` |
| `forms.accessKey` | Web3Forms **publishable** access key | Designed to be embedded in client markup; it authorises delivery to one mailbox and nothing else. Rotate it in the Web3Forms dashboard and update this single value if it is ever abused. |
| `heroVideo` | Optional self-hosted hero video URL | Empty by default. The hero uses the brand poster and enables the bundled video as a progressive enhancement on wide screens. |
| `social.*` | Official social profile URLs — one per platform | Eight keys: `whatsapp`, `facebook`, `x`, `telegram`, `linkedin`, `instagram`, `youtube`, `tiktok`. **All empty by default**, which renders each footer icon as a visible placeholder that cannot navigate. A value must be an absolute `https://` URL; a bare handle, a typo or a relative path is treated as "not supplied yet" and stays a placeholder. No profile URL is guessed anywhere in the code. When every key is filled the footer's "Links are being finalised." note removes itself. |

**Never place a real secret in this directory.** A static site cannot keep one: anything in `js/`, HTML or CSS is public by definition.

#### About the duplicated access key — do not "tidy" it away

The same publishable key is also present as a literal `value` on a hidden `access_key` input
inside each of the six forms that carry one. That duplication looks like a wart worth removing,
and it is not:

- **The hidden inputs are load-bearing.** They are what makes the form work with JavaScript
  disabled. With scripting off the browser performs a native form POST and Web3Forms returns its
  own confirmation page; without the input the submission arrives with no key and is rejected.
  `COMPATIBILITY.md` §4 records the no-JavaScript path as a deliberate strength, and it matters
  for the roughly 5% of this market on Opera Mini in data-saving mode, which executes no page
  JavaScript at all. Deleting the hidden inputs to let `js/config.js` inject the value would
  trade a cosmetic tidy-up for a silent loss of the site's only conversion path for those users.
- **So the key is rotated in two places, not one.** If it is ever abused, update `accessKey` in
  `js/config.js` **and** the six hidden inputs, then rebuild. A key rotated in only one place
  produces a form that fails for exactly one class of visitor — the hardest kind of bug to notice.

If the duplication is ever worth removing, the correct fix is a `<noscript>` fallback carrying
its own key rather than deleting the inputs outright.

### 5.2 Pre-deploy configuration checklist

Three decisions, all of them made **before** the build — `dist/` is a copy of the source, so
anything changed afterwards has to be changed again and rebuilt.

| # | Item | Default in the repository | What to do |
|---|---|---|---|
| 1 | **`social.whatsapp` … `social.pinterest`** (9 keys) | **Six filled, three empty** | The only item that changes what visitors see. Empty renders each footer icon as a visible placeholder that cannot navigate, is out of the tab order, and is announced as unavailable; the footer keeps its "Links are being finalised." note. Fill any subset with absolute `https://` URLs — each filled key becomes a real link with no markup change, and the note removes itself only when all nine are filled. http:// also passes validation. A bare handle or a typo stays a placeholder rather than shipping as a broken link. **No profile URL has been guessed anywhere in the code.** |
| 2 | **`forms.accessKey`** | A working Web3Forms publishable key | Confirm the mailbox it was registered against is the one you will create in §6.1. A key whose mailbox does not exist accepts the POST and drops the enquiry. **State, 17 October 2026: the key was rotated and now delivers to `dawitmuluneh25@gmail.com`.** The key belongs to the Web3Forms form "HakimeRAD Enquiry" (Free plan, 250 submissions/month). A second recipient was considered and declined — it needs the Pro-only `ccemail` field — so **do not add `ccemail` to the markup**. The intended recipient remains `admin@hakimerad.health.et`; it cannot be used yet because **inbound mail to the domain does not reach the mailbox platform** (see `MODERNIZATION_REPORT.md` §17). `Recipient Emails` is an editable, **non-Pro** field in the Web3Forms dashboard: once inbound mail works, change it there — the key stays the same and no file changes. The key is duplicated on a hidden `access_key` input in six pages; `scripts/build.mjs` now fails the build if any of them disagrees with `js/config.js`. |
| 3 | **`heroVideo`** | Empty | Leave empty. Setting it points the hero at a self-hosted video URL instead of the bundled poster. |

Verified for this release (17 October 2026): there are **nine** keys, not eight — `pinterest` was
added with the rest. **Six are filled** and resolve to live profiles owned by the business
(`facebook`, `x`, `linkedin`, `instagram`, `tiktok`, `pinterest`); **three remain empty**
(`whatsapp`, `telegram`, `youtube`) because no profile was confirmed for them. The footer therefore
ships six working links and three placeholders, and the "Links are being finalised." note is
present. That is a **deliberate, disclosed state**, not an oversight — see `MODERNIZATION_REPORT.md`
§6 issue 13 and §11.6.

### 5.3 Database — none is required, and why

**This deployment provisions no database of any kind, and creates no database user.** That is a
property of the architecture, not a step that was skipped.

The site never reads or writes persistent storage. There is no PHP, no server-side include, no
API route and no build-time data source: every page is a file that was written once and copied
to the host. The enquiry and newsletter forms do not store anything either — they POST to
Web3Forms, a third-party service, which forwards the submission by email to the mailbox the key
was registered against (§5.1). Submissions live in that mailbox and in the Web3Forms dashboard;
they are never held on this hosting plan.

What follows from that:

- **Do not create a MySQL database in Plesk for this site.** An unused database is an unused
  credential surface to secure, back up and eventually explain.
- **There is no schema, no seed data and no migration to run on the server** — and so none of the
  usual pre-deploy ordering constraints apply. Nothing has to exist before the files land.
- **Rollback is a file restore.** There is no data to roll back and no migration to reverse (§8).
- **A Plesk subscription created with a database already in it is harmless** — just leave it
  unused rather than deleting it, since some plans provision one as part of the package.

**What would change this.** Three plausible future requirements each introduce a database, and
each is a new feature rather than a deployment task:

| If you later want… | It needs | Consequence for this architecture |
|---|---|---|
| Submissions stored and searchable in your own system | A server-side endpoint (PHP on this same Plesk plan, or an external service) plus storage | New code, a new CSP `form-action`/`connect-src` entry, and a decision about the no-JavaScript fallback |
| To edit page content without a developer | A CMS or a static-site generator with a content store | Replaces the current hand-written HTML pages and the claims gate that checks them |
| Accounts, dashboards or per-tenant data | A database plus authentication | A different product, not a change to this site |

Until one of those is actually commissioned, the correct database configuration is **none**, and
the Plesk **Databases** screen is not part of this deployment.

---

## 6. Domain, DNS, TLS and email (manual, owner action)

All of these are performed in the Plesk panel or at the registrar. **None of them were done from this
repository.**

| Item | Where in Plesk | Status |
|---|---|---|
| DNS `A`/`CNAME` for `www.hakimerad.health.et` | DNS Settings, if the domain's nameservers point at Ethio Telecom | Confirm with the host |
| The second hostname — `www` **or** the apex, whichever is not the plan's primary domain | Add it as a **domain alias** (Websites & Domains → Add Domain Alias) and **leave Plesk's *Redirect with the HTTP 301 code* unchecked**. `.htaccess` owns the canonical-host redirect and always sends the apex to `www`; a Plesk 301 pointing the other way creates an infinite loop. §6.1 step 3 | Open |
| TLS certificate for `www` and the apex | SSL/TLS Certificates → **SSL It!** — the Let's Encrypt option issues and auto-renews a free certificate. Renewal needs `.well-known/` to stay reachable (see §3.2) | Open |
| `info@hakimerad.health.et` mailbox | Mail → Create Email Address. The enquiry-form specification assumes this mailbox receives submissions | Open |
| Form delivery mailbox | `js/config.js` holds the Web3Forms endpoint and its **publishable** key. That key only authorises delivery to the mailbox it was registered against, so the registered mailbox must be the live one | Confirm |
| Google Search Console | `googlef76bff2c6a9dc71b.html` is the verification file and must stay at the web root | Re-verify after the first deploy, then re-submit `sitemap.xml` |

### 6.1 Domain and DNS — step by step

**Step 0 — the canonical host is fixed, and it is `www`.** This is not a preference to be
revisited. 77 absolute references across the nine pages, every `rel="canonical"`, every `og:url`
and every entry in `sitemap.xml` name `https://www.hakimerad.health.et`. Serving the site on the
bare apex instead would require editing all nine pages, `sitemap.xml`, `robots.txt` and
`.htaccess` and rebuilding. The deployment assumes the domain serves on `www`.

1. **Find out where DNS is authoritative.** Either the nameservers already point at Ethio Telecom,
   in which case records are edited in Plesk under **Websites & Domains → the domain → DNS Settings**,
   or they point at a registrar or another provider, in which case the records are edited there and
   Plesk's DNS screen is inert. Check before editing; editing the wrong one changes nothing and
   looks like propagation delay.
2. **Point `www` at the hosting.** Create or correct the record for `www` — an `A` record to the
   hosting IP, or a `CNAME` to the hostname the plan provided. **Take the IP or target hostname from
   Ethio Telecom, not from this document** — it is plan-specific and nothing in this repository
   records it.
3. **Make the second hostname an alias rather than a second site — and leave Plesk's 301 off.**
   Websites & Domains → **Add Domain Alias** → enter the hostname that is *not* the primary domain
   on this subscription. The alias serves the same document root, so `.htaccess` collapsing the
   apex onto `www` is what produces the single 301 that §7 row 2 expects.

   **Only one layer may perform that redirect, and it must be the one that points at `www`.**
   `.htaccess` always sends the apex to `www`. If Plesk is meanwhile 301ing the alias in the
   opposite direction — `www` → apex, which is exactly what *Redirect with the HTTP 301 code*
   does when the **primary domain is the bare apex** and the alias is `www` — the two rules point
   at each other and the browser stops with `ERR_TOO_MANY_REDIRECTS`:

   | Primary domain on the plan | Alias to add | *Redirect with the HTTP 301 code* |
   |---|---|---|
   | `hakimerad.health.et` (bare apex) | `www.hakimerad.health.et` | **leave unchecked** — `.htaccess` already sends the apex to `www` |
   | `www.hakimerad.health.et` | `hakimerad.health.et` | either is safe; leaving it unchecked keeps one mechanism in charge |

   Tick **Web service**; tick **Synchronize DNS zone with the primary domain** if Plesk manages
   this domain's DNS; leave **Mail service** unchecked — mail on `www` is never wanted. A
   standalone 301 forwarder also works in place of the alias, but then two mechanisms are doing
   the same job and, as above, they can disagree.
4. **Do not enable mail on this domain unless mail is actually hosted here.** If the mailbox from
   §6.1 step 13 is on this plan, the `MX` records must resolve to it. If mail lives elsewhere —
   a Google Workspace or Microsoft 365 tenant, for example — leave `MX` alone. Turning on the Plesk
   mail service for a domain whose email is handled somewhere else silently breaks delivery, and it
   looks like a form failure rather than a DNS one.
5. **Confirm resolution before ordering a certificate**, because step 6.2 depends on it. The
   §7 rows are what actually verify this; do not treat the panel's green tick as proof.

### 6.2 SSL / TLS — step by step

1. **Order the certificate only after `www` resolves to this server.** Let's Encrypt validates by
   fetching a challenge file over HTTP from the live hostname. Issuing first and pointing DNS
   afterwards is the most common reason a first attempt fails.
2. **Cover both hostnames.** Websites & Domains → the domain → **SSL/TLS Certificates** → **SSL It!**
   → install a free **Let's Encrypt** certificate listing `www.hakimerad.health.et` **and**
   `hakimerad.health.et`. The apex needs its own coverage even though it only 301s — the TLS
   handshake completes before any redirect can happen, so a certificate valid for `www` only
   produces a browser warning on the apex.
3. **Turn on automatic renewal**, and leave the redirect setting for HTTPS enabled under
   **Hosting Settings**.
4. **Renewal depends on `/.well-known/acme-challenge/` remaining reachable.** Two things break it:
   a deploy that removes the directory, and the §3.1 nginx setting answering `/.well-known/`
   itself or rewriting it. Uploads therefore must never be done with a "remove all files" mode
   (§3.3), and §7's post-deploy checks should be run after every release rather than only the first.
5. **Read this before the first deploy — `includeSubDomains` in HSTS is the sharp edge.**
   `.htaccess` sends `Strict-Transport-Security: max-age=15552000; includeSubDomains`. That covers
   **every** subdomain of `hakimerad.health.et`, not just `www`. Once a browser has seen the header
   it will refuse plain HTTP to any subdomain it has visited for the next 180 days — including one
   that does not have a certificate or that only speaks HTTP, such as a legacy webmail host or a
   provider panel. If any such subdomain exists, **remove `includeSubDomains` from the header in
   `.htaccess` and rebuild before deploying**; the change is one token in one line. HSTS cannot be
   undone for the browsers that already saw it, only waited out.
6. **Raising the max-age is a separate, deliberate decision.** The `.htaccess` comment records the
   intent to go to `31536000` (one year) once HSTS preload is actually wanted. Preload submission is
   effectively permanent and is not something to enter by editing a constant in passing.
7. **Mixed content is already ruled out.** The site is same-origin apart from `cdnjs.cloudflare.com`
   and `api.web3forms.com`, both HTTPS, and the CSP carries `upgrade-insecure-requests`. The
   self-hosted font files are the reason there is no Google Fonts request to go wrong.
8. **Verify.** `npm run verify:live` covers the certificate and the redirect chain (§7 rows 1 and 2);
   the header set is rows 5 and 6. The independent `curl.exe` check is in §4.

---

## 7. Post-deploy verification checklist

Run these after every deploy. **Rows 1–7 are automated by `npm run verify:live` and must pass first** —
rows 8–19 exercise behaviour a static HTTP check cannot reach, and need a real browser.

| # | Check | Pass condition | How |
|---|---|---|---|
| 1 | `https://www.hakimerad.health.et/` loads over HTTPS | Valid certificate, no mixed-content warnings | `verify:live` |
| 2 | `http://` and the apex redirect | Single 301 to `https://www.hakimerad.health.et/` | `verify:live` |
| 3 | Every URL in `sitemap.xml` returns 200, **with its own content** | 9 URLs, all on the canonical host, and each page contains its expected marker — so a 200 cannot be a cached, stale or placeholder page | `verify:live` |
| 4 | A non-existent URL (e.g. `/nope`) | 404 rendered by the site's own error page, not the host default | `verify:live` |
| 5 | Security headers on the HTML document | HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` | `verify:live` |
| 6 | **Security headers on a static file** (`/css/style.css`) | Identical header set to the document. **If 5 passes and 6 fails, `.htaccess` is being bypassed — go to §3.1.** | `verify:live` |
| 7 | Directory listing off | `/css/` is not browsable | `verify:live` |
| 8 | Fonts | DevTools Network shows `IBMPlexSans-*.woff2` served from your own domain, and **no** request to `fonts.googleapis.com` | Browser |
| 9 | Icons | Font Awesome CSS returns 200 from cdnjs and the SRI check passes (no console integrity error) | Browser |
| 10 | Enquiry form, tagged: `/contact.html?utm_source=facebook&utm_medium=organic-social&utm_campaign=prelaunch&utm_content=w3-fb-07` | Submit a test enquiry; the delivered email shows all four UTM values plus `referrer` and `landing_page` | Browser |
| 11 | First-touch persistence | Open a tagged link, then in the same browser go to the site root and submit. The recorded source is still the tagged one | Browser |
| 12 | No parameters | Submitting from a clean session records `utm_source=direct`, `utm_medium=none` — never blank | Browser |
| 13 | `src_code` passthrough | `/contact.html?src_code=ref-wa-01` puts that value in the delivered email | Browser |
| 14 | Keyboard only | Tab reaches the skip link first; the enquiry form is completable; focus is always visible | Browser |
| 15 | Mobile 360 px | No horizontal scrolling on any page; selects and checkboxes usable | Browser |
| 16 | Reduced motion | With `prefers-reduced-motion: reduce`, the hero video does not autoplay | Browser |
| 17 | Theme toggle | Dark mode persists across pages and reloads | Browser |
| 18 | Compression | HTML and CSS are served gzip or brotli | `verify:live` reports it |
| 19 | **Social links** | All eight footer icons (WhatsApp, Facebook, X, Telegram, LinkedIn, Instagram, YouTube, TikTok) are live links to the real profiles, each with an accessible name, and the "Links are being finalised." note is gone. **If it is still there, `social.*` is still empty or is not an absolute `https://` URL** — see §5 | Browser — set `social.*` in `js/config.js` first, then rebuild |

If row 6 or 7 fails, fix §3.1 before anything else. Rows 10–13 depend on the enquiry form working, and the
CSP that may have stopped applying is one of the things that governs it.

**Two rows have been exercised locally and still need a live re-check.** The
rendered visual pass covered every page at 1440×900 and 390×844 in both themes,
so row 17 (theme toggle) is verified as working locally and persists across
navigation and reloads, and row 15 (mobile) found no horizontal scrolling at any
page at 390 px — noting that 390 px is wider than the 360 px row 15 specifies, so
the narrower case is still unverified. Row 16 (reduced motion) was also checked:
the hero video is present but does not autoplay and is paused. Rows 10–13 were
**not** exercised — they require a live submission. See
`polish-review/FINDINGS.md` §8 for the honest limits of that pass.

---

## 8. Rollback

The site is static and has no database, so rollback is a file restore — there is nothing to migrate back.

**Before the first deploy, back up what is already there.** Plesk's own backup (Websites & Domains →
Backup Manager) is the simplest way to capture the whole subscription, and it is worth doing because the
existing `httpdocs/` has never been under version control.

```powershell
# Keep the previous release as the rollback artefact. Rename rather than delete:
#   httpdocs/  ->  release-<date>/          (or download it first)
# then upload the new dist/ into a clean httpdocs/

# If you also track the site in git:
git revert --no-commit <bad-commit>; git commit -m "Roll back website release"
```

Restore by putting the previous release's files back into `httpdocs/`, then run `npm run verify:live` to
confirm the redirects and headers came back with them.

Nothing in this repository has been deployed, so no rollback is currently outstanding.

---

## 9. Troubleshooting on the host

Almost everything that goes wrong on shared hosting goes wrong in `.htaccess`, and the failure
modes are clustered — a single wrong setting produces symptoms that look unrelated.

| Symptom | Most likely cause | What to do |
|---|---|---|
| **The whole site returns 500** — every page, immediately | `Options -Indexes` was rejected. If the plan does not grant `Options` overrides, Apache fails the entire directory, not just directory listings | Comment out the `Options -Indexes` line in `.htaccess`, rebuild, redeploy. Listing protection is not lost: Apache already returns 403 for a directory with no index file. The same fix applies to any other directive named in the error log |
| 500 the moment the upload finishes, before any page has rendered | `.htaccess` was hand-edited on the server, or was saved with a UTF-8 BOM. Some Apache builds reject the BOM as the first bytes of the file | Re-upload `.htaccess` exactly as it is built in `dist/`. **Never edit it in the File Manager** — the panel's editor is the single most common source of a broken `.htaccess` |
| The site renders perfectly, but the HTTPS redirect, HSTS and the CSP are all missing | **§3.1** — nginx is serving static files directly, so Apache never sees the request | Fix the Plesk nginx settings, then re-run `verify:live` |
| Headers are present on the HTML document but absent on `/css/style.css` | The same setting, partially applied — some types routed past Apache | `verify:live` names this case explicitly |
| **`ERR_TOO_MANY_REDIRECTS`** in the browser, or `curl -sI` returning 301 after 301 | Two layers are redirecting in opposite directions: Plesk's alias ***Redirect with the HTTP 301 code*** is sending `www` → apex while `.htaccess` sends the apex → `www` | Open the alias's settings and **untick *Redirect with the HTTP 301 code***. Only `.htaccess` may own the canonical host. §6.1 step 3 |
| 404s render the host's default page, not the site's | `ErrorDocument` not honoured, or the request never reached Apache | §3.4 |
| Fonts fall back to a system sans-serif | The `.woff2` files did not upload, or CSP `font-src` is not reaching the response | Confirm `/fonts/IBMPlexSans-Regular.woff2` returns 200, then check the CSP header against §4 |
| **The site loads, but with no styling, no scripts and no images** | The archive was extracted with Windows backslash entry names, so `css/`, `js/`, `fonts/` and `images/` became files literally named `css\style.css` in the document root instead of directories | Confirm `httpdocs/css/style.css` exists as a real path. If it does not, re-extract the archive from `deploy-release/`, or upload `dist/` by FTP/SFTP instead — §3.2, and `MODERNIZATION_REPORT.md` §12.7 |
| Every page 404s except `/index.html` | The upload created a nested folder, so the home page is at `httpdocs/dist/index.html` | Move the contents up a level. §3.2 |
| `/services` 404s but `/services.html` works | `mod_rewrite` is inactive, so the extensionless-URL rule never applies | **Cosmetic — leave it.** Every internal link and every URL in `sitemap.xml` uses the `.html` form, so nothing is broken. Enable `mod_rewrite`, or ignore it |
| Icons render as empty boxes | cdnjs is blocked or the SRI hash mismatched — a mismatch raises a console integrity error | Confirm the Font Awesome stylesheet returns 200. **A hash mismatch means the CDN file changed; the fix is a version bump, never editing the hash in place** |
| Footer icons are visible but do nothing when clicked | Expected behaviour, not a fault — `social.*` is empty, so they are placeholders | §5.2 item 1 |
| "Links are being finalised." still appears after filling the URLs | At least one of the eight is not an absolute `http(s)://` URL, so it is still treated as "not supplied yet" | §5.2 item 1 |
| Submitting the enquiry form lands on an error page | The Web3Forms key was rotated, revoked, or the registered mailbox no longer exists | §5.1 |
| The form reports success but no email arrives | The mailbox registered against the key is not the live mailbox | §5.2 item 2 and §6.1 step 13 |
| The certificate stops renewing after a few months | `/.well-known/` was removed by a deploy | §6.2 step 4 |
| `/css/` shows a file listing | Both `Options -Indexes` and `mod_autoindex` are inactive | Confirm the module, or accept it — there is nothing sensitive in `css/` |

**Two things that look like faults and are not:**

- **`BUILD_INFO.txt` is publicly readable.** It is a build manifest — a timestamp and a file count
  — generated into `dist/` by `scripts/build.mjs`. It contains no credential and no content from
  the site. Delete it from `httpdocs/` after upload if you would rather it were not there; nothing
  reads it.
- **`404.html` has no Open Graph tags and carries `noindex`.** That is deliberate: an error page
  should never be indexed or shared as a preview.

**When a page serves but is stale**, check the cache headers rather than the upload. HTML is sent
`no-cache, must-revalidate` and CSS/JS for one day. A browser holding a day-old `style.css` after a
CSS change is the expected consequence of that policy, not a failed deploy.

---

## 10. Live deployment record — 16 October 2026

This is what the host actually looked like when the deployment was first exercised. It is a
measurement, not a plan. Re-verify with §7 before trusting any of it later.

### 10.1 The node

| | |
|---|---|
| **Plesk panel** | `https://lin6.ethiotelecom.et:8443/smb/web/view` |
| **Hosting node (lin6)** | `213.55.96.154` — ports 80, 443 and 8443 all open |
| **Document root** | `httpdocs/` on that node |
| **Certificate** | Let's Encrypt, `CN=hakimerad.health.et`, SAN `hakimerad.health.et` + `www.hakimerad.health.et` |

### 10.2 What was already correct

The application layer deployed cleanly. Verified by requesting the site from the node itself, with
`--resolve`, so DNS plays no part:

| Check | Result |
|---|---|
| `https://www.hakimerad.health.et/` | **200**, `<title>HakimeRAD Teleradiology \| Remote Radiology Reporting in Ethiopia</title>` |
| `/css/style.css`, `/js/main.js`, `/js/config.js` | **200, 200, 200** |
| `/robots.txt`, `/sitemap.xml`, `/site.webmanifest` | **200** |
| Nav lockup — `.logo-lockup-row` / `.logo-wordmark` | **1 / 1** |
| Floating theme switch — `.theme-float` | **1** |
| Social icons — `.social-icon` anchors | **8**, TikTok present |
| Font Awesome | **6.5.2** |
| `/BUILD_INFO.txt` | the **neutralised** version — no withheld-asset description |
| `http://` → `https://` redirect | **301**, correct |
| Apex → `www` collapse | **301**, correct |
| HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` | **all six present** |

That last row is the important one: **`.htaccess` is being honoured**, so nginx is in proxy mode and
§3.1 is already satisfied on this node.

### 10.3 The two faults, and which caused which

**Fault 1 — the A records point at a dead address.** `hakimerad.health.et` and
`www.hakimerad.health.et` both resolve to **`196.190.63.95`**. That address accepts no TCP connection
on any port tested (21, 22, 25, 53, 80, 443, 3306, 8443, 8880), has no PTR record, and a traceroute
dies inside Ethio Telecom's own backbone — the last responding hop is `10.180.46.242`, after which
every hop is silent. Ethio Telecom's network is otherwise reachable from the same machine:
`myportal.ethiotelecom.et` (213.55.96.129) answers on 80 and 443, `www.ethiotelecom.et` on 443, and
both nameservers answer on port 53.

**Fault 2 — the TLS certificate expired on 28 June 2026**, 110 days before this record was made.

**Fault 1 caused fault 2.** Let's Encrypt validates over HTTP at
`http://<domain>/.well-known/acme-challenge/…`. While the domain resolves to an address that cannot
be reached, that challenge can never succeed, so **renewal has been failing silently since June**.
The certificate that expired is itself a Let's Encrypt certificate issued 30 March 2026 with the
correct SAN — issuance worked once, and only renewal is broken. This is the dependency §6.2 step 4
warns about, arriving from the opposite direction.

### 10.4 The fix, in this order

1. **Repoint the A records.** Change `hakimerad.health.et` and `www.hakimerad.health.et` from
   `196.190.63.95` to **`213.55.96.154`**. `ftp.hakimerad.health.et` is a CNAME to the apex, so it
   follows automatically.

   The zone is served by `ns1.telecom.net.et` and `ns2.telecom.net.et`. **It is not editable in
   Plesk** — no domain on this subscription exposes a DNS Settings page — and it is not reachable
   from the WHMCS portal's normal menus either. It *is* editable through the portal's DNS module:
   **`https://myportal.ethiotelecom.et/index.php?m=racent_zdns`** → click the wrench icon on the
   domain → page heading `Edit Domain DNS` → edit the `@` and `www` A record **Value** fields in
   place → **Save Changes**. A successful save reports `Update DNS success.`

2. **Reissue the certificate — only after step 1.** Plesk → **SSL/TLS Certificates → SSL It! →
   Let's Encrypt**. It will fail while DNS still points at the dead address, which is exactly why it
   failed in June. Then confirm **auto-renewal is on**, or this recurs in 90 days.

3. Re-run §7. Nothing else is outstanding — the page, the assets and the headers are already right.

**Was anything lost?** No. Nothing in the deployment was wrong; the site simply could not be
reached, and the only two faults are DNS and the certificate. The site has been unreachable for at
least 110 days, so no visitor is known to have hit the certificate warning.

### 10.5 The domain alias question

Apex and `www` **both** answer correctly on the node — the apex with its 301 to `www`, `www` with a
200. The vhost therefore already covers both hostnames and no further alias is needed for the site
to work. The alias dialog in §6.1 step 3 remains the right way to make that explicit, and its rule
still holds: leave Plesk's *Redirect with the HTTP 301 code* unchecked, because `.htaccess` is
already doing that job correctly.

### 10.6 Resolution — applied and verified, 16 October 2026

Both faults were corrected the same day, from the account's own interfaces. No Ethio Telecom ticket
was needed.

**DNS.** The two A records were changed from `196.190.63.95` to `213.55.96.154` through the portal's
DNS module (`index.php?m=racent_zdns`, page heading `Edit Domain DNS`). The save reported
`Update DNS success.`, and both `ns1.telecom.net.et` and `ns2.telecom.net.et` then returned
`213.55.96.154` for the apex and for `www`. Every other record was left untouched. The zone's full
record set, captured before the change:

| Host | Type | Value | Priority | TTL |
|---|---|---|---|---|
| `@` | NS | `ns1.telecom.net.et.` | — | 86400 |
| `@` | NS | `ns2.telecom.net.et.` | — | 86400 |
| *(blank)* | A | **`213.55.96.154`** (was `196.190.63.95`) | — | 86400 |
| `www` | A | **`213.55.96.154`** (was `196.190.63.95`) | — | 86400 |
| `_dmarc` | TXT | `"v=DMARC1; p=reject"` | — | 86400 |
| *(blank)* | MX | `mail1.ethionet.et.` | 10 | 86400 |
| *(blank)* | MX | `mail2.ethionet.et.` | 10 | 86400 |
| *(blank)* | MX | `mail3.ethionet.et.` | 20 | 86400 |
| *(blank)* | MX | `mail4.ethionet.et.` | 20 | 86400 |
| `pop` | A | `213.55.96.132` | — | 86400 |
| `smtp` | A | `213.55.96.132` | — | 86400 |
| `pop3` | A | `213.55.96.132` | — | 86400 |
| `ftp` | CNAME | `hakimerad.health.et.` | — | 86400 |

**Certificate.** Let's Encrypt was reissued from SSL It! — `Reissue Certificate` → the free Let's
Encrypt option → `hakimerad.health.et` plus the `www` prefix → default HTTP-01 validation. Validation
succeeded on the first attempt, which independently proves the corrected A record was reaching
Let's Encrypt's resolvers. Domain and `www` prefix moved from `Not Secured` to `Secured`.

**Verified afterwards, with real certificate validation and no bypass:**

| Check | Result |
|---|---|
| Certificate | `CN=hakimerad.health.et`, issuer `Let's Encrypt YR2`, valid `2026-10-16` → **`2027-01-14`**, **not expired** |
| SAN | `hakimerad.health.et`, `www.hakimerad.health.et` |
| `https://www.hakimerad.health.et/` | **200**, `ssl_verify_result=0` — chain trusted and hostname matched |
| `https://hakimerad.health.et/` | **301** → `Location: https://www.hakimerad.health.et/`, `ssl_verify_result=0` |

**Propagation.** The old records carried a TTL of 86400, so cached copies linger for up to 24 hours.
At verification time `1.1.1.1` already returned the new value for both names; `8.8.8.8` had the new
apex but still served the old `www`. The authoritative servers were correct and Let's Encrypt
validated against them, so no further action is needed — stragglers expire on their own.

**Two standing risks to keep an eye on.** Renewal now depends on the A records staying correct, so
if the site ever becomes unreachable again expect the certificate to lapse within 90 days. And the
`_dmarc` record is `p=reject` with no SPF record visible in the zone, which would reject mail sent
*as* `@hakimerad.health.et` unless DKIM alignment is provided elsewhere. Worth confirming separately;
it does not affect the website or the enquiry form, which delivers through Web3Forms.

### 10.7 Second pass — full verification, and the fatal header fault it found (16 October 2026)

The first pass sampled the redirect and the certificate, and concluded from them that `.htaccess` was
being honoured (§10.2). That conclusion was **wrong, and it was unsafe**: it had been generalised from
responses Apache generates to the whole site. This pass tested every response and found that the live
site was serving **without its Content-Security-Policy**.

#### The fault

nginx was answering requests for any file that exists on disk, so those responses never reached Apache
and none of the `mod_headers` directives in `.htaccess` applied. The site looked perfect throughout —
200 on every file, correct rendering, correct title.

The evidence, before the fix:

| Request | Status | CSP | `X-Content-Type-Options` etc. | `ETag` (layer) |
|---|---|---|---|---|
| `GET /` | 200 | **absent** | **absent** | `"6ad16f6c-72b4"` → **nginx** |
| `GET /css/style.css` | 200 | **absent** | **absent** | `"b246-…"` → nginx |
| `GET /404.html` | 200 | **absent** | **absent** | nginx |
| `GET /services` (rewritten) | 200 | present | present | Apache |
| `GET /no-such-page` (404) | 404 | present | present | Apache |

Two things made this easy to misread, and both are recorded in §3.1 so they do not mislead again. The
`ETag` is the decisive tell: Apache writes `"<size>-<mtime>"`, nginx writes `"<mtime>-<size>"` — the same
two numbers in the opposite order. And the **404 carried the full header set while every real file did
not**, because a missing path is the one thing nginx cannot answer from disk.

#### The cause

**Smart static files processing** was enabled in *Apache & nginx Settings* — a Plesk default, and a
setting whose name and documentation describe only an `Expires` nuance. "Serve static files directly by
nginx" was already correctly **off**. Clearing the one setting was sufficient.

#### The fix

Plesk → Websites & Domains → `hakimerad.health.et` → **Apache & nginx Settings** →
uncheck **Smart static files processing** → **Apply**. The panel reported *"The settings were updated."*
After reloading the page: **Proxy mode** checked, **Serve static files directly by nginx** unchecked,
**Smart static files processing** unchecked, **Enable nginx caching** checked (unchanged). Nothing else on
the page was touched.

#### Verified after the fix

Every one of these now carries the full `.htaccess` set — HSTS `max-age=15552000; includeSubDomains`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and the CSP — and
Apache-format ETags: `/`, `/css/style.css`, `/js/main.js`, `/js/theme-boot.js`, `/robots.txt`, `/services`,
`/404.html`. Home page ETag moved from `"6ad16f6c-72b4"` to `"72b4-65dea3a69b300"` and
`Vary: Accept-Encoding` appeared, both independent confirmations that Apache now handles the response.

| Check | Result |
|---|---|
| **File placement** | All **53** HTTP-reachable deployed files fetched and SHA-256 compared with `dist/`: **0 mismatches**. `.htaccess` cannot be fetched (403 by design); the deployed copy measures 5.5 KB against 5,607 bytes locally |
| **Build identity** | live `index.html`, `css/style.css`, `js/main.js` byte-identical to `dist/` → the host runs the current build, i.e. the one carrying the §12.6 privacy fix |
| **All nine pages** | 200, including the three blog posts |
| **Redirects** | `http://` → `https://` **301**; apex → `www` **301**; both correct with query strings intact |
| **Custom 404** | `404` status, body byte-identical to `dist/404.html`, carries `noindex`. `ErrorDocument` works |
| **Canonical paths** | `/services` and `/pricing` (extensionless) return 200 through the `.htaccess` rewrite |
| **Directory listing** | `/images/` → **403**. `Options -Indexes` is in effect |
| **Withheld material** | `/images/blog/blog-ai-radiology.png`, `-rural-clinic.png`, `-workflow.png`, `/vidios/`, `/photos/`, `/images/favicon%20web/` → all **404**. Nothing that the build excludes is published |
| **Source tree** | `/.git/config` → **403** |
| **Supporting files** | `robots.txt` (allow-all, sitemap pointer), `sitemap.xml` (9 URLs, all on `www`), the Search Console token file and `site.webmanifest` all serve correctly |
| **Config** | deployed `js/config.js` carries the Web3Forms key; the contact page posts to `api.web3forms.com/submit`; `api.web3forms.com:443` reachable |
| **Certificate** | `CN=hakimerad.health.et`, issuer `Let's Encrypt YR2`, valid to **2027-01-14**, not expired, SAN covers apex + `www`; every request `ssl_verify_result=0`, no bypass |
| **DNS** | `8.8.8.8`, `1.1.1.1`, `ns1.telecom.net.et` and `ns2.telecom.net.et` all return **`213.55.96.154`** for apex and `www`. §10.6's partial-propagation caveat is settled |
| **Rendered check** | Live page rendered in headless Chrome (resolver pinned to the node): correct `<title>`, stylesheet applied, logogram SVG inline, **8** social placeholders with `aria-disabled="true"` and the *"Links are being finalised."* note, theme-switch control present, footer entity line correct, styled screenshot confirmed |
| **Panel state** | SSL It!: domain and `www` **Secured**, expiry `January 14, 2027`, auto-renewal on. **No database** ("Looks like there's nothing here"). Document root `httpdocs`. Preferred domain `www`, HTTPS redirect on. No error banner anywhere |

**Application startup, database and environment variables — all three are not applicable, and now
confirmed rather than assumed.** The site is 53 static files; nothing starts, so there is no runtime to
babysit. The Plesk **Databases** page is empty, which is correct for a static site. There is no `.env`:
the entire configuration surface is `js/config.js`, and the deployed copy is byte-identical to the built
one. PHP 8.3.35 (FPM served by nginx) is enabled on the domain and is unused by this site.

**A note on the DNS that misled the first probe from this workstation.** Plain `curl https://www…`
returned `code=000` while `--resolve` worked, because this machine's resolver cache still held the old,
dead `196.190.63.95`. `ipconfig /flushdns` cleared it and plain hostname requests then returned 200 with
`remote_ip=213.55.96.154`. The server was never at fault, and no other device was reconfigured.

#### Still open

| # | Item | Note |
|---|---|---|
| 1 | `hakimerad-site-2026-10-16.zip` (794.3 KB) is publicly downloadable from `httpdocs/` | Verified 200 at `/hakimerad-site-2026-10-16.zip`. It contains only files that are already public, so it discloses nothing — but a release archive does not belong in a document root. **Not deleted: removing a file from the host is an owner decision.** The canonical copy is in the repository at `hakimerad-team\deploy-release\` |
| 2 | **Two HSTS headers on every response** | nginx sends `max-age=15768000; includeSubDomains` (Plesk's own HSTS switch, on in SSL It!) and Apache sends `max-age=15552000; includeSubDomains`. Browsers act on the first, so it is not harmful, but the two values disagree. Pick one: Plesk's switch off (leaving `.htaccess` in control, per §6.2 step 5) or drop the `.htaccess` line. Both cover every subdomain for 180 days and cannot be withdrawn from a browser that has seen them |
| 3 | `X-Powered-By: PleskLin` is still sent | Added by nginx after Apache responds, so `.htaccess`'s `Header unset X-Powered-By` cannot remove it. Cosmetic |
| 4 | `support.`, `test.` and `*.hakimerad.health.et` are `Not Secured` | Outside the reissued certificate. Untouched |
| 5 | **No live enquiry was submitted** | Doing so sends a real email to the business mailbox, so it was not done. Markup, form action, endpoint and key are verified; acceptance criteria F1–F7 remain unexercised |
| 6 | Domain disk usage reads **17.1 MB** against a 1.13 MB release | Not explained by the document root, whose top-level listing is correct apart from the ZIP. Probably logs, `.trash` or Plesk accounting. Not investigated further |
| 7 | The eight social profile URLs are still placeholders | By design, awaiting the owner. §13 issue 13 |
| 8 | PHP 8.3.35 enabled but unused | Optional: disable it to reduce surface. Not required |
| 9 | `BUILD_INFO.txt` is served publicly | Harmless since §12.6 — timestamp and file count only. Safe to delete after upload if preferred |
| 10 | 19 commits ahead of `origin/main`, nothing pushed | Unchanged. The remote has not been touched |
