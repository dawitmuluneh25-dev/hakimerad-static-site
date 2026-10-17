# Browser compatibility review — HakimeRAD website

**Date:** 15 October 2026
**Scope:** the ten published HTML pages, `css/style.css`, `css/brand-layer.css`, `css/fonts.css`, `js/main.js`, `js/config.js`
**Method:** static analysis of the shipped source. No browser was used and no page was rendered — every finding below is traceable to a specific line.

---

## 1. The set of browsers this is written for

The site is aimed at Ethiopian healthcare decision-makers, so the mobile mix is what matters most.

| Source | Finding |
|---|---|
| StatCounter, mobile, Ethiopia, Sep 2025 – Sep 2026 | Chrome **83.23%**, Opera **5.2%**, Safari **3.35%** |
| StatCounter, mobile, Ethiopia, Jul 2025 – Jul 2026 | Chrome **84.25%**, Opera **4.77%**, Safari **4.43%** |
| StatCounter, worldwide, Sep 2025 – Sep 2026 | Chrome 66.45%, Safari 18.2%, Edge 6.02% |

> **On the precision above.** These are the figures as published by StatCounter and surfaced by search; they are reproduced to the precision shown rather than rounded, so they can be checked directly against the source. The two Ethiopia rows use different 12-month windows, which is why they differ. Confirm them at the linked StatCounter page before relying on them for a decision — sample sizes for a single country can be small.

Two things follow:

1. **Chromium is the primary target by a wide margin.** Chrome 84 shipped in July 2020, so the overwhelming majority of this audience is on a browser far newer than any threshold discussed below.
2. **Opera appears at roughly 5%.** Opera's own browser is Chromium-based, but **Opera Mini in data-saving mode executes no page JavaScript at all** and is served a pre-rendered page. That single fact drove the most serious finding in this review.

Internet Explorer does not appear in the data. It is treated as out of scope, but note that several findings below would also have affected it.

## 2. Feature inventory — what the site does *not* use

The codebase is notably conservative, which is the main reason this review is short. A scan of all CSS and JS found **zero** uses of:

`:has()` · `:is()` · `:where()` · `clamp()` · `min()`/`max()` · `aspect-ratio` · `backdrop-filter` · `image-set()` · `color-mix()` · `@supports` · `@container` · `prefers-color-scheme` · `inset` · mask-image · logical properties (`padding-inline`, `margin-block`) · `conic-gradient` · `overflow: clip` · `scrollbar-gutter` · `text-wrap` · `:nth-child(… of …)`

On the JavaScript side there is **no** optional chaining, no nullish coalescing, no `async`/`await`, no `IntersectionObserver`, no `ResizeObserver`, no `flatMap`, no `replaceAll`, and no `structuredClone`. The authored code is ES5-style `var` and `function`, which is why the JS surface is small.

That matters beyond this document: the same conservatism is what keeps the site renderable on limited devices, and it should be preserved. In particular, **`:has()` and `color-mix()` should not be introduced** without re-running this review, because an unsupported selector in a shared selector list silently removes the whole rule for every other selector in it.

## 3. Findings

### F1 — With JavaScript off, the site had no navigation at all on mobile. **High. Fixed.**

`css/style.css` hides the mobile navigation by default and reveals it only through a class that JavaScript adds:

```css
nav { display: none; position: fixed; right: -300px; }
nav.active { display: block; right: 0; }
```

`.active` is applied by `initMobileMenu()` in `js/main.js`. With scripting unavailable, the navigation could never be opened below 992px — the header showed a menu button that did nothing. For the roughly 5% of this market on Opera Mini in data-saving mode, the site was effectively unnavigable.

**Fix.** A `<noscript>` block in the `<head>` of all ten pages restores the navigation as a static list on small screens and hides the now-useless menu button. It is CSS-only, so it is unaffected by the `script-src 'self'` CSP, and it does nothing in browsers that do run scripts.

### F2 — An unguarded constructor could break the enquiry form. **High. Fixed.**

`js/main.js` called `new URLSearchParams(window.location.search)` at the top of `initAttribution()` and again in `initInquiryPrefill()`, with no feature test and no guard. `URLSearchParams` is absent in older and feature-phone browsers.

The serious part was the init sequence, which was a bare list of calls:

```js
initMobileMenu();
initHeaderScroll();
initThemeSwitcher();
initHeroVideo();
initAccordions();
initBlogFilters();
initAttribution();     // throws here in an old browser
initInquiryPrefill();  // never runs
initForms();           // never runs - the enquiry form
```

Nothing isolated these calls, so a throw in `initAttribution()` skipped every initialiser after it — including the enquiry form, which is the entire conversion goal of the site. A missing attribution API should never cost the form.

**Fix.** Two changes:

- `makeParams()` returns an object with the same `.get()` surface whether or not `URLSearchParams` exists, falling back to hand-parsing the query string (tolerating a malformed escape sequence rather than throwing). Attribution now works on browsers that lack the API instead of failing on them.
- Every initialiser now runs through `safeInit(name, fn)`, which contains its own failure. Failures are recorded on `window.HakimeRADInitErrors` so they can be diagnosed in the field rather than being silently swallowed.

### F3 — `:focus-visible` grouped with `:focus` and `:hover` removed styles in browsers that lack it. **Medium. Fixed.**

CSS selector lists are **not** forgiving: if one selector in a comma-separated list is unrecognised, the entire rule is discarded. Four rules paired `:focus-visible` (Chrome 86+, Safari 15.4+, Firefox 85+) with a selector that older browsers *do* understand, so the older selector lost its styling too:

| Rule | What older browsers lost |
|---|---|
| `.skip-link:focus, .skip-link:focus-visible` | The skip link never became visible on focus — a keyboard-accessibility failure |
| `a.modality-item:hover, a.modality-item:focus-visible` | The hover state |
| `.logo-link:hover .logo-mark, .logo-link:focus-visible .logo-mark` | The logo mark's hover tint (introduced in the current pass) |
| `.theme-switch:focus-within .slider-theme, .theme-switch input:focus-visible + .slider-theme` | The toggle's focus ring via `:focus-within` |

**Fix.** Each pair is split into two separate rules, so an unsupported `:focus-visible` can no longer take an unrelated selector down with it. The standalone `:focus-visible` rules are unchanged — they are pure enhancement, and losing them is the intended behaviour.

### F4 — Flexbox `gap` is ignored by browsers older than Chrome 84 / Safari 14.1. **Medium. Accepted, documented.**

Nine components use `gap` in a `display: flex` container:

`.cta-buttons` · `.cta .cta-buttons` · `.social-icons` · `.blog-filters` · `.pagination` · `.checkbox-group` · `.modality-item` · `.checkbox-grid label` / `.consent-label` · `.faq-toggle`

Flexbox `gap` is supported in Chrome 84+, Edge 84+, Firefox 63+, Safari 14.1+ and iOS Safari 14.5+ ([caniuse: gap property for Flexbox](https://caniuse.com/flexbox-gap)). On anything older the property is ignored and those elements lose their spacing — most visibly `.cta-buttons`, where the two hero buttons would touch.

**Not changed, deliberately.** There is no reliable CSS feature test for flex `gap`: `@supports (gap: 1rem)` is *true* in Safari 10.1–14.0, because grid `gap` existed first, so a `@supports not (gap: …)` fallback would never fire where it is needed. The only workable fallback is margin-based spacing, and because it cannot be conditioned on support it would double the spacing in every modern browser — breaking the ~95% to accommodate the tail.

Given Chrome 84 is over six years old and chromium carries over 83% of this market, the exposure is small and the trade is the wrong way round. If the owner wants belt-and-braces coverage for `.cta-buttons` specifically, the clean remedy is a wrapping container with margins on the buttons instead of `gap` — a deliberate visual decision, not a silent fix.

### F5 — The sticky header lacked the WebKit prefix. **Low. Fixed.**

`header { position: sticky }` is correct for Safari 13 and later, but Safari 12 and earlier need `position: -webkit-sticky`. The prefixed value is now declared first, which those browsers read and later ones ignore.

### F6 — `loading="lazy"` and `fetchpriority` degrade rather than break. **Low. Documented, no change.**

Both are advisory hints. `loading="lazy"` reached Safari only in 16.4, and `fetchpriority` is Chrome 101+ / Safari 17.2+; browsers that do not understand them ignore them and load the image normally. `decoding="async"` is broadly supported and equally harmless when ignored. No user-visible failure is possible, so nothing was changed — but on older Safari the hero and below-fold images will load eagerly, so the performance gain is smaller there than the code implies.

## 4. What this review found to be *good*

Worth recording so it is not undone later:

- **The enquiry form works without JavaScript.** Both the contact form and the newsletter forms carry a real `action="https://api.web3forms.com/submit" method="POST"`. With scripting off — including Opera Mini — the browser performs a native form POST and Web3Forms returns its own confirmation page. The conversion path survives.
- **Self-hosted fonts remove a whole class of failure.** There is no Google Fonts request, so no third-party font fetch can fail or be blocked, and the `script-src 'self'` CSP stays tight.
- **`<picture>` and `srcset` are not used**, so there is no responsive-image selection logic to misbehave. The `sizes` attributes found by the scan are all `sizes="any"` on `favicon.ico` links — the standard idiom, not responsive images.
- **No CSS custom-property fallbacks are needed**: `var()` is supported by every browser that supports the rest of the design, and all custom properties referenced are declared (verified — no dangling `var(--…)`).

## 5. How to re-verify

The static checks in this document are reproducible:

```powershell
# from site/templet-project
npm run build          # fail-closed gate: asset refs, CSS structure, claims, page structure, JSON-LD, secrets
npm run smoke          # 18 HTTP checks against the served build
npm run lint           # eslint, 0 errors expected
npm run format:check   # prettier
```

None of these can detect a *browser* compatibility regression — they check structure and content, not rendering. Two manual checks are worth doing once the site is live, and both can be done without a special setup:

1. **JavaScript disabled** (Chrome DevTools → Settings → Debugger → Disable JavaScript): the mobile layout must still show a usable navigation, and the contact form must still submit.
2. **Flex `gap`** (DevTools → Rendering → emulate an older engine, or set a user-agent for Chrome 83): confirm whether `.cta-buttons` losing its spacing is acceptable, and if not, convert that one component to margin-based spacing.

## 6. Remaining limitations

- The audit is static. Real-device testing on Opera Mini and on an older Android WebView has **not** been performed, and cannot be from this environment.
- The findings above cover the reviewed files only. Any future addition of `:has()`, `color-mix()`, `@supports`, `IntersectionObserver` or `?.` should be re-checked against §2 before shipping, since that is exactly the direction that turns a compatibility margin into a defect.
- `HakimeRADInitErrors` is a diagnostic aid, not a reporting mechanism. If field diagnosis matters, it would need to be sent somewhere — which is a deliberate privacy decision, not a technical one.
