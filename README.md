# HakimeRAD website

Marketing site for **HakimeRAD Teleradiology**, a service of Hakimerad Medical Consultancy.

Static HTML, CSS and vanilla JavaScript. No framework, no bundler, no server-side runtime and no third-party
JavaScript libraries.

---

## Quick start

```powershell
npm run build          # run the checks, then write dist/
npm run serve -- dist  # serve the production build on http://localhost:4173/
npm run smoke          # HTTP checks against that served build
```

To work on the source directly, `npm run serve` with no argument serves the working tree.

After deploying, verify the site the public actually reaches — TLS, the redirect chain, the security headers
and the error page:

```powershell
npm run verify:live
npm run verify:live -- https://www.hakimerad.health.et   # or another origin
```

Python is only needed to regenerate brand assets (`npm run assets`), not to build or serve the site.

---

## Pages

| File | Page |
|---|---|
| `index.html` | Home — value proposition, how it works, modalities, verified-fact strip, FAQ |
| `services.html` | Reporting services across seven modalities, process, turnaround targets |
| `pricing.html` | Engagement models (inquiry-only; no published price list) |
| `about.html` | Entity, mission, operating position, references |
| `blog.html` + `blog-post-1..3.html` | Insights |
| `contact.html` | Institutional enquiry form (see the field spec below) |
| `404.html` | Error page |
| `# Agent.md` | The modernization brief this work was executed against |

The visible navigation label for `pricing.html` is "Engagement" and for `blog.html` is "Insights". The filenames were
left unchanged on purpose — they are already published URLs.

---

## Project structure

```
.
├── index.html, services.html, pricing.html, about.html,
│   blog.html, blog-post-1..3.html, contact.html, 404.html
├── css/
│   ├── fonts.css        @font-face for the self-hosted IBM Plex Sans subsets
│   ├── style.css        the site's original stylesheet (components, layout, breakpoints)
│   └── brand-layer.css  brand system and quality layer added in the Oct 2026 modernization
├── js/
│   ├── config.js        the only place endpoints and the form key are configured
│   └── main.js          all site behaviour — no dependencies
├── fonts/               IBM Plex Sans woff2 subsets (Latin) + SIL OFL 1.1 licence
├── images/
│   ├── brand/           official lockups and wordmarks (svg + png)
│   ├── blog/            article header artwork
│   ├── og-hakimerad.jpg 1200x630 social card
│   ├── hero-poster.jpg  1920x1080 hero base layer
│   └── abstract-*.jpg   section artwork
├── scripts/
│   ├── build.mjs        verification checks + dist/ emission  (npm run build)
│   ├── build_assets.py  regenerates the brand asset set from the source brand files
│   ├── serve.mjs        zero-dependency local static server
│   ├── smoke.mjs        HTTP checks against a locally served build  (npm run smoke)
│   └── verify-live.mjs  post-deploy checks against the live site     (npm run verify:live)
├── .htaccess            Apache: HTTPS redirects, security headers, caching, compression
├── DEPLOYMENT.md        deploy, environment and post-deploy verification
└── MODERNIZATION_REPORT.md  what changed, why, and what is still open
```

---

## Content and claims rules

This site is bound by the project's brand and claims registers. Two consequences worth knowing before editing copy:

1. **Nothing unverified goes on the page.** No client names, no partner facilities, no certification or accreditation
   claims, no guarantee, no AI/automated-diagnosis claim, no individual clinician names other than the
   founder, and **no published price of any kind** — pricing is quoted per institution, at enquiry. There is no
   published rate card, no banded pricing and no price figure anywhere on the site, and `PROHIBITED` in
   `scripts/build.mjs` fails the build on any currency figure. Turnaround
   figures must always carry the word *target*.
2. **The pre-launch qualifier is mandatory.** Every page must state that availability and terms are confirmed at
   enquiry, and that the service works with institutions rather than individual patients.

`npm run build` enforces both — see `PROHIBITED` in `scripts/build.mjs`. If the build fails on a claims rule, the fix
is to correct the copy, not to relax the rule.

---

## The enquiry form

`contact.html` implements the project's enquiry-form specification:

- Required: organisation name, organisation type, city/region, modalities operated (multi-select), where reporting
  hurts most, your name, your role, an email **or** a phone number, authority to discuss an arrangement, consent.
- Optional: banded monthly volume, priority mix, pilot interest, free-text notes (max 500 characters).
- Deliberately absent: any file upload, any patient-identifiable field, any pricing field, any "urgent case" toggle,
  and any image-recognition CAPTCHA. Spam control is a honeypot field plus the provider's own rate limiting.
- Attribution: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landing_page`,
  `submitted_at` and `src_code` are captured as hidden fields. The **first touch** is stored in a first-party cookie
  and `localStorage` for 90 days and it is the stored set that is submitted, so a later tagged click cannot overwrite
  the original source. With no parameters at all the record reads `direct` / `none`.

Forms submit for real. There is no code path that fakes a success message.

---

## Accessibility notes

- One skip link per page, one `<h1>` per page, and a heading order that does not skip levels.
- The FAQ panels are a disclosure pattern: a `<button>` inside the heading, wired with `aria-expanded`.
- Focus is always visible via `:focus-visible`; the header nav uses plain semantic lists rather than ARIA menu roles.
- `prefers-reduced-motion` disables the hero video, smooth scrolling and entrance animations.

---

## Hosting

Production is **shared static hosting from Ethio Telecom, managed through the Plesk control panel**
(`https://myportal.ethiotelecom.et/`). The document root is `httpdocs/`; the *contents* of `dist/` go there.

Plesk serves sites with nginx in front of Apache, and Plesk has a setting that lets nginx answer for static
files without ever passing the request to Apache. If that setting is on for this domain, every rule in
`.htaccess` — the HTTPS redirect, the security headers, the cache lifetimes, the custom 404 — stops applying
while the pages continue to look completely normal. `npm run verify:live` exists to catch exactly that.
See `DEPLOYMENT.md` §3.1.

---

## Documentation

| Document | Covers |
|---|---|
| `DEPLOYMENT.md` | Deploy paths, security headers, configuration, post-deploy verification, rollback |
| `MODERNIZATION_REPORT.md` | Initial findings, changes made, source hierarchy, tests, known issues |
| `accessibility-report.md`, `responsiveness-report.md` | Historical reports from an earlier revision; superseded by `MODERNIZATION_REPORT.md` §7 |
