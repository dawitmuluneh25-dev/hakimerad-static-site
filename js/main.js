/**
 * HakimeRAD website behaviour.
 *
 * Rewritten during the October 2026 modernization. What changed and why:
 *
 *  - The previous version intercepted every form's submit event, cancelled it,
 *    waited 1.5s and printed "Your message has been sent successfully!" without
 *    sending anything. It now either really submits (progressively enhanced
 *    fetch to the configured endpoint) or lets the browser submit natively.
 *  - Dead code removed: pricing toggle, testimonial carousel and animated stats
 *    counter all targeted markup that no longer exists.
 *  - `initForms` was registered twice, binding two submit handlers per form.
 *  - `initSmoothScrolling` hijacked the skip link and injected fake
 *    `aria-describedby` text into every in-page link.
 *  - The hero video is now a progressive enhancement, not a 2.4 MB blocking
 *    download, and it is skipped for reduced-motion and small screens.
 *  - Everything respects `prefers-reduced-motion`.
 *
 * No third-party libraries are required.
 */

(function () {
  'use strict';

  var config = window.HAKIMERAD_CONFIG || {};
  var formsConfig = config.forms || {};

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /* ---------------------------------------------------------------------- *
   * Mobile navigation
   * ---------------------------------------------------------------------- */
  function initMobileMenu() {
    var button = document.querySelector('.mobile-menu-btn button');
    var nav = document.querySelector('header nav');

    if (!button || !nav) {
      return;
    }

    function setOpen(open) {
      nav.classList.toggle('active', open);
      document.body.classList.toggle('menu-open', open);
      /* The scrolling container is the root element, so hiding overflow on
       * <body> alone did not stop the page scrolling behind the open drawer.
       * Both are toggled, and the CSS locks both. */
      document.documentElement.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    button.addEventListener('click', function () {
      setOpen(button.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        setOpen(false);
      }
    });

    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('active')) {
        return;
      }
      if (!nav.contains(event.target) && !button.contains(event.target)) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('active')) {
        setOpen(false);
        button.focus();
      }
    });

    setOpen(false);
  }

  /* ---------------------------------------------------------------------- *
   * Header elevation on scroll
   * ---------------------------------------------------------------------- */
  function initHeaderScroll() {
    var header = document.querySelector('.header');
    if (!header) {
      return;
    }

    var ticking = false;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    }

    window.addEventListener(
      'scroll',
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );

    update();
  }

  /* ---------------------------------------------------------------------- *
   * Colour theme (light / dark), persisted and OS-aware
   * ---------------------------------------------------------------------- */
  function initThemeSwitcher() {
    var toggle = document.getElementById('checkbox');
    if (!toggle) {
      return;
    }

    var stored = null;
    try {
      stored = window.localStorage.getItem('theme');
    } catch {
      stored = null;
    }

    function apply(theme) {
      var dark = theme === 'dark';
      /* The dark palette is keyed on the root element so that js/theme-boot.js
       * can apply it from <head>, before the first paint. Both files must agree
       * on the class name and the element. */
      document.documentElement.classList.toggle('theme-dark', dark);
      toggle.checked = dark;
      toggle.setAttribute('aria-checked', dark ? 'true' : 'false');
    }

    apply(stored === 'dark' ? 'dark' : stored === 'light' ? 'light' : 'light');

    toggle.addEventListener('change', function () {
      var theme = toggle.checked ? 'dark' : 'light';
      apply(theme);
      try {
        window.localStorage.setItem('theme', theme);
      } catch {
        /* storage unavailable (private mode) - the toggle still works */
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Social links
   *
   * The footer renders one official brand icon per platform so the layout is
   * reviewable while the profiles are still being set up. Each icon stays inert
   * until js/config.js carries that platform's URL, at which point it is
   * upgraded in place to a real link. Nothing is guessed: an absent URL leaves
   * the icon as a non-interactive mark rather than pointing somewhere
   * plausible and wrong.
   * ---------------------------------------------------------------------- */
  var SOCIAL_LABELS = {
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    x: 'X',
    telegram: 'Telegram',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    pinterest: 'Pinterest',
  };

  function initSocialLinks() {
    var nodes = document.querySelectorAll('.social-icon[data-social]');
    if (!nodes.length) {
      return;
    }

    var social = config.social || {};
    var pending = 0;

    Array.prototype.forEach.call(nodes, function (node) {
      var key = node.getAttribute('data-social');
      var value = typeof social[key] === 'string' ? social[key].trim() : '';
      var label = SOCIAL_LABELS[key] || key;

      // Only an absolute http(s) URL becomes a destination. A bare handle, a
      // typo, a relative path or a stray javascript: value all count as "not
      // supplied yet", and "not supplied yet" is a placeholder, never a guess.
      var live = /^https?:\/\/\S+$/i.test(value);

      var link = document.createElement('a');
      link.className = node.className
        .replace(/\bis-pending\b/, '')
        .replace(/\s+/g, ' ')
        .trim();
      link.setAttribute('data-social', key);
      link.innerHTML = node.innerHTML;

      if (live) {
        link.setAttribute('href', value);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.setAttribute('aria-label', 'HakimeRAD on ' + label);
        // Matches the placeholder's tooltip so a hover gives the same cue in
        // both states, and the static title ("not published yet") never shows.
        link.setAttribute('title', 'HakimeRAD on ' + label);
      } else {
        // PLACEHOLDER. The icon is in place and the row reads as complete, but
        // there is no profile URL yet and none is invented: the placeholder
        // cannot navigate, it is out of the tab order, and it is announced as
        // unavailable rather than as a destination.
        pending += 1;
        link.className = (link.className + ' is-pending').trim();
        link.setAttribute('href', '#');
        link.setAttribute('role', 'link');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('aria-label', label + ' - link not yet published');
        link.setAttribute('title', label + ' - link not yet published');
        link.setAttribute('tabindex', '-1');
        link.addEventListener('click', function (event) {
          event.preventDefault();
        });
      }

      node.parentNode.replaceChild(link, node);
    });

    // The note only means something while at least one profile is missing.
    if (pending === 0) {
      var note = document.querySelector('[data-social-note]');
      if (note) {
        note.remove();
      }
    }
  }

  /* ---------------------------------------------------------------------- *
   * Hero video - enhancement only
   * ---------------------------------------------------------------------- */
  function initHeroVideo() {
    var video = document.getElementById('hero-video');
    if (!video) {
      return;
    }

    // No video is configured, so there is nothing to enhance and nothing to
    // request: the brand poster on .hero is the background. The element is left
    // in place, source-less and display:none, rather than given a bundled clip
    // that is deliberately excluded from dist/.
    if (!config.heroVideo) {
      video.removeAttribute('autoplay');
      return;
    }

    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var saveData = connection && connection.saveData === true;
    var wideEnough = window.matchMedia('(min-width: 992px)').matches;

    if (prefersReducedMotion() || saveData || !wideEnough) {
      video.removeAttribute('autoplay');
      return;
    }

    var source = video.querySelector('source');
    if (!source) {
      source = document.createElement('source');
      video.appendChild(source);
    }
    source.setAttribute('src', config.heroVideo);
    source.setAttribute('type', 'video/mp4');
    video.load();

    var hero = video.closest('.hero');
    if (hero) {
      hero.classList.add('is-video-ready');
    }

    var play = video.play();
    if (play && typeof play.catch === 'function') {
      play.catch(function () {
        // Autoplay refused (battery saver, data saver). The poster stands in.
        if (hero) {
          hero.classList.remove('is-video-ready');
        }
      });
    }
  }

  /* ---------------------------------------------------------------------- *
   * FAQ disclosure panels
   * ---------------------------------------------------------------------- */
  function initAccordions() {
    var items = document.querySelectorAll('.faq-item');

    Array.prototype.forEach.call(items, function (item) {
      var button = item.querySelector('.faq-toggle');
      var panel = item.querySelector('.faq-answer');

      if (!button || !panel) {
        return;
      }

      button.setAttribute('aria-expanded', 'false');

      function setOpen(open) {
        item.classList.toggle('active', open);
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      setOpen(false);

      button.addEventListener('click', function () {
        var willOpen = button.getAttribute('aria-expanded') !== 'true';

        Array.prototype.forEach.call(items, function (other) {
          if (other === item) {
            return;
          }
          var otherButton = other.querySelector('.faq-toggle');
          if (otherButton) {
            otherButton.setAttribute('aria-expanded', 'false');
            other.classList.remove('active');
          }
        });

        setOpen(willOpen);
      });
    });
  }

  /* ---------------------------------------------------------------------- *
   * Blog search + category filter, with a real empty state
   * ---------------------------------------------------------------------- */
  function initBlogFilters() {
    var searchInput = document.getElementById('blog-search');
    var categorySelect = document.getElementById('category-select');
    var cards = document.querySelectorAll('.blog-card');
    var emptyState = document.getElementById('blog-no-results');

    if (!searchInput || !categorySelect || cards.length === 0) {
      return;
    }

    function filter() {
      var term = searchInput.value.trim().toLowerCase();
      var category = categorySelect.value;
      var visible = 0;

      Array.prototype.forEach.call(cards, function (card) {
        var heading = card.querySelector('h3');
        var tag = card.querySelector('.blog-category');

        var haystack = [heading ? heading.textContent : '', card.textContent || '']
          .join(' ')
          .toLowerCase();

        var slug = tag ? tag.textContent.trim().toLowerCase().replace(/\s+/g, '-') : '';

        var matchesTerm = term === '' || haystack.indexOf(term) !== -1;
        var matchesCategory = category === 'all' || slug === category;

        var show = matchesTerm && matchesCategory;
        card.hidden = !show;
        if (show) {
          visible += 1;
        }
      });

      if (emptyState) {
        emptyState.classList.toggle('is-visible', visible === 0);
        emptyState.hidden = visible !== 0;
      }
    }

    searchInput.addEventListener('input', filter);
    categorySelect.addEventListener('change', filter);
    filter();
  }

  /* ---------------------------------------------------------------------- *
   * First-touch campaign attribution
   *
   * Implements section 4 of the enquiry-form specification: read the campaign
   * parameters on load, persist the FIRST touch in a first-party cookie and
   * localStorage for 90 days, and submit the stored first-touch set rather than
   * the current session's query string. A later tagged click must not overwrite
   * the original source.
   *
   * With no parameters at all the record reads direct / none - never blank and
   * never a fabricated source.
   * ---------------------------------------------------------------------- */
  var FIRST_TOUCH_KEY = 'hakimerad_ft';
  var FIRST_TOUCH_DAYS = 90;
  var CAMPAIGN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function readCookie(name) {
    var parts = document.cookie ? document.cookie.split(';') : [];
    for (var i = 0; i < parts.length; i += 1) {
      var pair = parts[i].trim().split('=');
      if (pair[0] === name) {
        return decodeURIComponent(pair.slice(1).join('='));
      }
    }
    return null;
  }

  function writeCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie =
      name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function readStorage(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable - the cookie still carries the value */
    }
  }

  /* URLSearchParams is absent in older and feature-phone browsers, and it was
   * constructed unguarded at the top of two init functions. Because the init
   * sequence is a plain list of calls, a throw there also skipped every init
   * that came after it - including the enquiry form. This returns an object
   * with the same .get() surface either way, so callers do not care. */
  function makeParams(search) {
    if (typeof window.URLSearchParams === 'function') {
      return new window.URLSearchParams(search);
    }

    var map = {};
    var q = search || '';
    if (q.charAt(0) === '?') {
      q = q.slice(1);
    }
    var pairs = q.split('&');
    for (var i = 0; i < pairs.length; i += 1) {
      if (!pairs[i]) {
        continue;
      }
      var eq = pairs[i].indexOf('=');
      var rawKey = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
      var rawValue = eq === -1 ? '' : pairs[i].slice(eq + 1);
      try {
        map[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
      } catch {
        /* A malformed escape sequence must not stop the enquiry form. */
      }
    }

    return {
      get: function (key) {
        return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
      },
    };
  }

  function initAttribution() {
    var params = makeParams(window.location.search);
    var stored = readStorage(FIRST_TOUCH_KEY);

    if (!stored) {
      var fromCookie = readCookie(FIRST_TOUCH_KEY);
      if (fromCookie) {
        try {
          stored = JSON.parse(fromCookie);
        } catch {
          stored = null;
        }
      }
    }

    if (!stored) {
      stored = {
        utm_source: params.get('utm_source') || 'direct',
        utm_medium: params.get('utm_medium') || 'none',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
        landing_page: window.location.pathname + window.location.search,
        captured_at: new Date().toISOString(),
      };
      writeStorage(FIRST_TOUCH_KEY, stored);
      writeCookie(FIRST_TOUCH_KEY, JSON.stringify(stored), FIRST_TOUCH_DAYS);
    }

    // Fill the hidden fields on every form that carries them.
    Array.prototype.forEach.call(document.querySelectorAll('form'), function (form) {
      CAMPAIGN_PARAMS.forEach(function (name) {
        var field = form.querySelector('input[name="' + name + '"]');
        if (field) {
          field.value =
            stored[name] ||
            (name === 'utm_source' ? 'direct' : name === 'utm_medium' ? 'none' : '');
        }
      });

      var landing = form.querySelector('input[name="landing_page"]');
      if (landing) {
        landing.value = stored.landing_page || '';
      }

      var srcCode = form.querySelector('input[name="src_code"]');
      if (srcCode) {
        // A responder can carry a Messenger ref or WhatsApp prefill code into
        // the form with ?src_code=...; otherwise it stays empty.
        srcCode.value = params.get('src_code') || '';
      }
    });
  }

  function stampSubmission(form) {
    var stamp = form.querySelector('input[name="submitted_at"]');
    if (stamp) {
      stamp.value = new Date().toISOString();
    }
    var referrer = form.querySelector('input[name="referrer"]');
    if (referrer) {
      referrer.value = document.referrer || 'direct';
    }
  }

  /* ---------------------------------------------------------------------- *
   * Prefill from a link: contact.html?service=… and the legacy ?plan=… links
   * ---------------------------------------------------------------------- */
  function initInquiryPrefill() {
    var form = document.getElementById('enquiryForm');
    if (!form) {
      return;
    }

    var params = makeParams(window.location.search);
    var service = params.get('service') || params.get('plan');
    if (!service) {
      return;
    }

    var painSelect = form.querySelector('#reporting_pain');
    var map = {
      'x-ray': 'turnaround',
      ct: 'turnaround',
      mri: 'subspecialty-access',
      ultrasound: 'turnaround',
      mammography: 'subspecialty-access',
      fluoroscopy: 'turnaround',
      echocardiography: 'turnaround',
      urgent: 'after-hours-cover',
      'after-hours': 'after-hours-cover',
      subspecialty: 'subspecialty-access',
      'second-opinion': 'subspecialty-access',
      'institutional-package': 'not-sure',
      'per-study': 'turnaround',
      integration: 'not-sure',
      'data-protection': 'not-sure',
    };

    if (painSelect && map[service]) {
      painSelect.value = map[service];
    }

    var notes = form.querySelector('#notes');
    if (notes && !notes.value) {
      var label = service.replace(/-/g, ' ').replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
      notes.value = 'Enquiry from the Services page about: ' + label + ' reporting.';
    }
  }

  /* ---------------------------------------------------------------------- *
   * Forms
   *
   * Two layers:
   *  1. Client-side validation that writes real, associated error messages.
   *  2. Submission. If the form has a real `action` and a configured key, it is
   *     submitted by fetch with visible progress, success and failure states.
   *     If anything is missing, the browser performs a normal form submission -
   *     we never fake a success message.
   * ---------------------------------------------------------------------- */
  function fieldLabel(input) {
    if (input.id) {
      var label = document.querySelector('label[for="' + input.id + '"]');
      if (label) {
        return label.textContent.replace(/\*/g, '').trim();
      }
    }
    return input.getAttribute('name') || 'This field';
  }

  function setFieldError(input, message) {
    var group = input.closest('.form-group') || input.parentNode;
    var existing = group.querySelector('.error-message[data-for="' + input.id + '"]');

    if (!message) {
      input.classList.remove('error');
      input.removeAttribute('aria-invalid');
      if (existing) {
        /* Un-merge the reference as well as the element. Removing the span but
         * leaving its id in aria-describedby leaves the field pointing at an
         * element that no longer exists, which is a broken ARIA reference and
         * would survive in the accessibility tree until the page was reloaded. */
        var remaining = (input.getAttribute('aria-describedby') || '')
          .split(/\s+/)
          .filter(function (id) {
            return id !== '' && id !== existing.id;
          });
        if (remaining.length) {
          input.setAttribute('aria-describedby', remaining.join(' '));
        } else {
          input.removeAttribute('aria-describedby');
        }
        existing.remove();
      }
      return;
    }

    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'error-message';
      existing.setAttribute('data-for', input.id);
      existing.id = input.id + '-error';
      group.appendChild(existing);
    }
    existing.textContent = message;

    /* Merge, never replace. Some fields already point at permanent help text
     * (for example #work_email -> #contact-rule). Overwriting aria-describedby
     * with the error id alone would drop that hint from the accessibility tree
     * for as long as the error is showing. */
    var described = (input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(function (id) {
        return id !== '' && id !== existing.id;
      });
    described.push(existing.id);
    input.setAttribute('aria-describedby', described.join(' '));
  }

  function validateField(input) {
    /* A checkbox reports its value attribute ("yes"), not its state, so the
     * generic required check below would pass on an unticked box. Required
     * checkboxes are checked against .checked instead. The consent box is the
     * only one on the site and it is the notice the page says submission is
     * conditional on, so it has to actually block the submit. */
    if (input.type === 'checkbox') {
      if (input.hasAttribute('required') && !input.checked) {
        setFieldError(input, 'Please tick this box before sending.');
        return false;
      }
      setFieldError(input, '');
      return true;
    }

    var value = (input.value || '').trim();

    if (input.hasAttribute('required') && value === '') {
      setFieldError(input, fieldLabel(input) + ' is required.');
      return false;
    }

    if (value !== '' && input.type === 'email') {
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      if (!valid) {
        setFieldError(input, 'Enter a valid email address, for example name@example.com.');
        return false;
      }
    }

    if (value !== '' && input.type === 'tel') {
      if (!/^[0-9+()\s-]{6,}$/.test(value)) {
        setFieldError(input, 'Enter a valid phone number, or leave the field empty.');
        return false;
      }
    }

    setFieldError(input, '');
    return true;
  }

  function validateGroup(form, name, message) {
    var boxes = form.querySelectorAll('input[name="' + name + '"]');
    if (boxes.length === 0) {
      return true;
    }

    var anyChecked = false;
    Array.prototype.forEach.call(boxes, function (box) {
      if (box.checked) {
        anyChecked = true;
      }
    });

    var group = boxes[0].closest('fieldset') || boxes[0].parentNode;
    var existing = group.querySelector('.error-message[data-group="' + name + '"]');

    if (anyChecked) {
      if (existing) {
        existing.remove();
      }
      return true;
    }

    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'error-message';
      existing.setAttribute('data-group', name);
      existing.setAttribute('role', 'alert');
      group.appendChild(existing);
    }
    existing.textContent = message;
    return false;
  }

  /**
   * "Work email or phone" — the specification deliberately does not make both
   * mandatory, so this is an at-least-one rule rather than a required pair.
   */
  function validateContactRule(form) {
    var email = form.querySelector('#work_email');
    var phone = form.querySelector('#work_phone');
    var rule = form.querySelector('#contact-rule');

    if (!email || !phone || !rule) {
      return true;
    }

    if ((email.value || '').trim() !== '' || (phone.value || '').trim() !== '') {
      rule.classList.remove('error-message');
      rule.textContent = 'Give us an email address or a phone number — one of the two is enough.';
      return true;
    }

    rule.classList.add('error-message');
    rule.textContent = 'Give us either an email address or a phone number so we can reply.';
    email.focus();
    return false;
  }

  function validateForm(form) {
    var fields = form.querySelectorAll('input:not([type="hidden"]), textarea, select');
    var firstInvalid = null;
    var valid = true;

    Array.prototype.forEach.call(fields, function (field) {
      if (field.type === 'submit' || field.type === 'button') {
        return;
      }
      if (!validateField(field)) {
        valid = false;
        if (!firstInvalid) {
          firstInvalid = field;
        }
      }
    });

    if (!validateGroup(form, 'modalities[]', 'Select at least one modality, or “None yet”.')) {
      valid = false;
      if (!firstInvalid) {
        firstInvalid = form.querySelector('input[name="modalities[]"]');
      }
    }

    if (!validateContactRule(form)) {
      valid = false;
    }

    if (firstInvalid) {
      firstInvalid.focus();
    }
    return valid;
  }

  function statusRegion(form) {
    var region = form.querySelector('.form-status');
    if (!region) {
      region = document.createElement('p');
      region.className = 'form-status';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      form.appendChild(region);
    }
    return region;
  }

  function setStatus(form, state, message) {
    var region = statusRegion(form);
    region.setAttribute('data-state', state);
    region.textContent = message;
  }

  /* The submit handler writes a form-level summary ("Please correct the
   * highlighted fields and try again."). That is a statement about the last
   * attempt, so it has to be withdrawn once the conditions it described no
   * longer hold - otherwise a visitor who has fixed every field is still told,
   * above the button, that something is wrong. */
  function clearStatusIfClean(form) {
    if (form.querySelector('.error, .error-message')) {
      return;
    }
    var region = form.querySelector('.form-status');
    if (region && region.getAttribute('data-state') === 'error') {
      region.setAttribute('data-state', 'idle');
      region.textContent = '';
    }
  }

  function initForm(form) {
    if (form.dataset.enhanced === 'true') {
      return;
    }
    form.dataset.enhanced = 'true';

    form.addEventListener('submit', function (event) {
      stampSubmission(form);

      if (!validateForm(form)) {
        event.preventDefault();
        setStatus(form, 'error', 'Please correct the highlighted fields and try again.');
        return;
      }

      var action = form.getAttribute('action');
      var key = formsConfig.accessKey || '';
      var endpoint = formsConfig.endpoint || action;
      var keyField = form.querySelector('input[name="access_key"]');

      // Any naive bot that fills the hidden field is rejected before we send.
      var honeypot = form.querySelector('input[name="_gotcha"]');
      if (honeypot && honeypot.value !== '') {
        event.preventDefault();
        setStatus(form, 'error', 'Submission rejected.');
        return;
      }

      // Without a real endpoint we must let the browser submit natively rather
      // than claim a success that did not happen.
      if (!action || !endpoint || !key || !keyField || typeof window.fetch !== 'function') {
        return;
      }

      event.preventDefault();

      var submit = form.querySelector('[type="submit"]');
      var originalText = submit ? submit.textContent : '';
      if (submit) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
        submit.textContent = 'Sending...';
      }
      setStatus(form, 'pending', 'Sending your message...');

      // The modalities group posts the same key several times; Object.fromEntries
      // would keep only the last one, so repeated keys are joined explicitly.
      var payload = {};
      new FormData(form).forEach(function (value, name) {
        if (name === '_gotcha') {
          return;
        }
        if (Object.prototype.hasOwnProperty.call(payload, name)) {
          payload[name] = payload[name] + ', ' + value;
        } else {
          payload[name] = value;
        }
      });
      payload.access_key = key;

      window
        .fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              return { ok: response.ok, body: body };
            });
        })
        .then(function (result) {
          if (result.ok && result.body && result.body.success !== false) {
            form.reset();
            setStatus(
              form,
              'success',
              'Thank you. Your message has been sent, and our team will respond to the address you provided.'
            );

            /* The conversion is confirmed only on this branch: the endpoint
             * accepted the submission. js/analytics.js listens for this single
             * event, so "what counts as a lead" is defined in one place rather
             * than inferred from the DOM. Measurement is never allowed to
             * break a real submission, hence the guard. */
            try {
              document.dispatchEvent(
                new CustomEvent('hakimerad:lead', {
                  detail: { form_id: form.id || 'enquiry' },
                })
              );
            } catch {
              /* Older browsers without CustomEvent: skip measurement. */
            }
          } else {
            /* The provider's own message ("Invalid access key", "This method is
             * not allowed") is about our configuration, not about anything the
             * visitor did, so it is not repeated back to them. The email
             * fallback is the actionable part. */
            setStatus(
              form,
              'error',
              'We could not send your message. Please email info@hakimerad.health.et instead.'
            );
          }
        })
        .catch(function () {
          setStatus(
            form,
            'error',
            'We could not reach the form service. Please check your connection, or email info@hakimerad.health.et.'
          );
        })
        .then(function () {
          if (submit) {
            submit.disabled = false;
            submit.removeAttribute('aria-busy');
            submit.textContent = originalText;
          }
        });
    });

    form.addEventListener(
      'blur',
      function (event) {
        var field = event.target;
        if (field.matches && field.matches('input, textarea, select')) {
          validateField(field);
          clearStatusIfClean(form);
        }
      },
      true
    );

    // Ticking the consent box clears its error immediately, rather than leaving
    // a stale "required" message on screen until the next blur.
    form.addEventListener('change', function (event) {
      var field = event.target;
      if (field.type === 'checkbox' && field.hasAttribute('required')) {
        validateField(field);
        clearStatusIfClean(form);
      }
    });
  }

  function initForms() {
    Array.prototype.forEach.call(document.querySelectorAll('form[data-validate]'), initForm);
  }

  /* ---------------------------------------------------------------------- *
   * In-page anchors: honour the fixed header, never hijack the skip link
   * ---------------------------------------------------------------------- */
  function initSmoothScrolling() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) {
        return;
      }

      var hash = link.getAttribute('href');
      if (!hash || hash === '#') {
        return;
      }

      var target = document.getElementById(hash.slice(1));
      if (!target) {
        return;
      }

      // Let the browser handle the skip link; moving focus there is the point.
      var isSkipLink = link.classList.contains('skip-link');

      if (prefersReducedMotion()) {
        if (!isSkipLink) {
          event.preventDefault();
          target.scrollIntoView();
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (!isSkipLink) {
        window.setTimeout(function () {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }, 350);
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Footer year
   * ---------------------------------------------------------------------- */
  function initFooterYear() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-current-year]'), function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------------------------------------------------------------------- *
   * Current page in the navigation
   * ---------------------------------------------------------------------- */
  function initActiveNavLink() {
    var page = window.location.pathname.split('/').pop() || 'index.html';

    Array.prototype.forEach.call(document.querySelectorAll('header nav a[href]'), function (link) {
      var href = link.getAttribute('href');

      if (href === page || (page === '' && href === 'index.html')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  function start() {
    /* Each initialiser runs inside its own guard. Previously they were a bare
     * sequence, so one throw - an unsupported constructor, say - stopped every
     * later initialiser, including the enquiry form. Failures are collected on
     * window.HakimeRADInitErrors for diagnosis rather than swallowed. */
    function safeInit(name, fn) {
      try {
        fn();
      } catch (err) {
        window.HakimeRADInitErrors = window.HakimeRADInitErrors || [];
        window.HakimeRADInitErrors.push({ name: name, error: String(err) });
      }
    }

    safeInit('initMobileMenu', initMobileMenu);
    safeInit('initHeaderScroll', initHeaderScroll);
    safeInit('initThemeSwitcher', initThemeSwitcher);
    safeInit('initSocialLinks', initSocialLinks);
    safeInit('initHeroVideo', initHeroVideo);
    safeInit('initAccordions', initAccordions);
    safeInit('initBlogFilters', initBlogFilters);
    safeInit('initAttribution', initAttribution);
    safeInit('initInquiryPrefill', initInquiryPrefill);
    safeInit('initForms', initForms);
    safeInit('initSmoothScrolling', initSmoothScrolling);
    safeInit('initFooterYear', initFooterYear);
    safeInit('initActiveNavLink', initActiveNavLink);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
