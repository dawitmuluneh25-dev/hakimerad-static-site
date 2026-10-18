/**
 * HakimeRAD measurement layer.
 *
 * WHAT THIS DOES
 * --------------
 * Loads Google Analytics 4 and records the five interactions that matter to a
 * pre-launch B2B service, without ever sending enquiry field values.
 *
 *   generate_lead     fired by js/main.js ONLY on the confirmed-success branch
 *                     of the enquiry form. Never on a rejected submission, a
 *                     validation failure or a network error.
 *   enquiry_start     first focus inside a validated form, once per page.
 *   contact_whatsapp  click on any WhatsApp route (footer icon or body link).
 *   social_click      click on a social profile icon in the footer.
 *   outbound_click    any other click that leaves the site.
 *
 * WHY IT IS DORMANT BY DEFAULT
 * ----------------------------
 * Unless `analytics.ga4Id` in js/config.js is a real measurement ID, this file
 * returns before it touches `document`. That is deliberate: the site must not
 * depend on a third-party script to function, and a wrong or empty ID must not
 * produce console noise or a blocked request on every page.
 *
 * PRIVACY POSTURE
 * ---------------
 * Consent Mode is set to deny storage for ads and analytics. In that state GA4
 * runs cookieless: it does not write an identifier to the device, which is why
 * the site carries no cookie banner. Do not change the consent default without
 * also changing /privacy.html and re-assessing whether a banner is required.
 *
 * No enquiry field is read by this file. `generate_lead` carries only the form
 * id and the page path.
 */
(function () {
  'use strict';

  var config = window.HAKIMERAD_CONFIG || {};
  var analyticsConfig = config.analytics || {};
  var provider = String(analyticsConfig.provider || '').toLowerCase();
  var measurementId = String(analyticsConfig.ga4Id || '').trim();

  /* A GA4 measurement ID is `G-` followed by at least six upper-case
   * alphanumerics. Anything else means "not configured yet", and the correct
   * behaviour is to do nothing at all rather than guess. */
  var VALID_GA4_ID = /^G-[A-Z0-9]{6,}$/;

  if (provider !== 'ga4' || !VALID_GA4_ID.test(measurementId)) {
    return;
  }

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  window.gtag = window.gtag || gtag;

  /* Deny storage before the first hit. This is what makes the deployment
   * cookieless, and it must be the first thing GA4 receives. */
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    anonymize_ip: true,
    send_page_view: true,
  });

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(script);

  var enquiryStarted = false;

  /**
   * Public entry point. Safe to call before or after DOM ready; it is a no-op
   * when analytics is dormant, so callers never need to guard it.
   */
  window.hakimeradTrack = function (name, params) {
    if (!name) {
      return;
    }
    window.gtag('event', name, params || {});
  };

  function isSameHost(url) {
    return url.hostname === window.location.hostname;
  }

  function networkFor(anchor) {
    var holder = anchor.closest ? anchor.closest('[data-social]') : null;
    if (holder && holder.getAttribute('data-social')) {
      return holder.getAttribute('data-social');
    }
    var href = anchor.getAttribute('href') || '';
    var match = href.match(/(?:wa\.me|whatsapp)\.?(?:com)?/i);
    return match ? 'whatsapp' : 'other';
  }

  function onClick(event) {
    var anchor = event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) {
      return;
    }

    var href = anchor.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') {
      return;
    }

    /* WhatsApp is classified first: it is the highest-intent route on the site
     * and must never be counted only as a generic outbound click. */
    if (/wa\.me|whatsapp\.com|api\.whatsapp/i.test(href)) {
      window.hakimeradTrack('contact_whatsapp', {
        link_url: href,
        page_location: window.location.pathname,
      });
      return;
    }

    if (anchor.closest && anchor.closest('.social-icons')) {
      window.hakimeradTrack('social_click', {
        network: networkFor(anchor),
        link_url: href,
        page_location: window.location.pathname,
      });
      return;
    }

    var url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }

    if (/^https?:$/.test(url.protocol) && !isSameHost(url)) {
      window.hakimeradTrack('outbound_click', {
        link_domain: url.hostname,
        link_url: href,
        page_location: window.location.pathname,
      });
    }
  }

  function onFirstInteraction(event) {
    if (enquiryStarted) {
      return;
    }
    var form = event.target.closest ? event.target.closest('form[data-validate]') : null;
    if (!form) {
      return;
    }
    enquiryStarted = true;
    window.hakimeradTrack('enquiry_start', {
      form_id: form.id || 'enquiry',
      page_location: window.location.pathname,
    });
  }

  /**
   * js/main.js dispatches this only after the form endpoint has confirmed
   * acceptance. Listening for an event rather than re-checking the DOM keeps the
   * success definition in exactly one place.
   */
  function onLead(event) {
    var detail = (event && event.detail) || {};
    window.hakimeradTrack('generate_lead', {
      form_id: detail.form_id || 'enquiry',
      page_location: window.location.pathname,
    });
  }

  function start() {
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFirstInteraction, true);
    document.addEventListener('hakimerad:lead', onLead);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
