/**
 * HakimeRAD website runtime configuration.
 *
 * Everything the site needs to talk to an external service lives here, so the
 * endpoints and keys are configured in exactly one place instead of being
 * repeated across pages.
 *
 * ABOUT THE FORM KEY
 * ------------------
 * Web3Forms uses a *publishable* access key: it is designed to be embedded in
 * client-side markup and only authorises delivery to the mailbox it was
 * registered against. It is therefore not a credential in the "never commit
 * this" sense, and this repository has always contained it in the HTML.
 *
 * It is still a rotatable value. To change it:
 *   1. Rotate the key in the Web3Forms dashboard.
 *   2. Update `accessKey` below. Nothing else needs to change.
 *   3. Never add a *secret* (mailbox password, API secret, private key) to this
 *      file or to any other file in this directory - a static site cannot keep
 *      a secret, and anything placed here is public by definition.
 *
 * THIS KEY
 * --------
 * Belongs to the Web3Forms form "HakimeRAD Enquiry" (created 17 October 2026) on
 * the account dawitmuluneh25@gmail.com, which is also where submissions are
 * delivered. The intended recipient is admin@hakimerad.health.et, but inbound
 * mail to the domain does not currently reach the mailbox platform, so that
 * address cannot be verified. "Recipient Emails" is an editable, non-Pro setting
 * in the Web3Forms dashboard: changing it there takes effect immediately and
 * needs no change to this file - the key itself stays the same.
 *
 * The same value is duplicated as a literal on a hidden `access_key` input in
 * index.html, contact.html, blog.html and the three blog posts, so a no-JS
 * submission still works. Rotating the key means changing it in six HTML files
 * and here; scripts/build.mjs fails the build if they ever disagree.
 */
window.HAKIMERAD_CONFIG = {
  forms: {
    endpoint: 'https://api.web3forms.com/submit',
    accessKey: '70238117-5e04-4335-ae78-21153682b3b3',
  },

  /* Measurement.
   *
   * js/analytics.js reads this block and stays completely inert unless `ga4Id`
   * is a real GA4 measurement ID (G- followed by at least six characters).
   * Leaving it empty keeps the site unmeasured rather than half-measured, which
   * is the honest state until a property exists.
   *
   * To activate:
   *   1. Create a GA4 property + web data stream for https://dawitmuluneh25-dev.github.io/hakimerad-static-site
   *   2. Paste the measurement ID below.
   *   3. The deployed CSP must allow googletagmanager.com in script-src and
   *      google-analytics.com in connect-src, or the script is blocked silently.
   *      See the Content-Security-Policy line in .htaccess.
   *
   * Consent Mode denies storage, so GA4 runs cookieless and no banner is needed.
   * Changing that default requires changing /privacy.html too.
   */
  analytics: {
    provider: 'ga4',
    // GA4 property "HakimeRAD Teleradiology", web stream "HakimeRAD website",
    // created 18 October 2026 on dawitmuluneh25@gmail.com. The stream URL is
    // https://dawitmuluneh25-dev.github.io/hakimerad-static-site.
    ga4Id: 'G-K7EJWXR0M0',
  },

  /* Optional: set to a URL to self-host the hero video instead of relying on
   * the bundled file. Leave empty to use the bundled asset, or to keep the
   * brand poster as the hero background only. */
  heroVideo: '',

  /* Official social profiles.
   *
   * The footer renders one official brand icon per entry below, in this order.
   * While a value is empty that icon is a PLACEHOLDER: it is visible and the row
   * looks complete, but it cannot navigate, it is out of the tab order, and it is
   * announced as unavailable. No profile URL is guessed - a placeholder URL that
   * looks real is worse than no URL at all.
   *
   * Fill in a value and js/main.js turns that icon into a real link - href,
   * target, rel and an accessible name - with no markup change anywhere. Once
   * every entry is filled, the "Links are being finalised." note removes itself.
   *
   * A value must be an absolute http:// or https:// URL. Anything else (a bare
   * handle, a typo, a relative path) is treated as "not supplied yet" and stays
   * a placeholder rather than shipping as a broken link.
   *
   *   whatsapp   https://wa.me/<number>                     (or a wa.link short link)
   *   facebook   https://www.facebook.com/<page>
   *   x          https://x.com/<handle>
   *   telegram   https://t.me/<handle>
   *   linkedin   https://www.linkedin.com/company/<slug>
   *   instagram  https://www.instagram.com/<handle>
   *   youtube    https://www.youtube.com/@<handle>
   *   tiktok     https://www.tiktok.com/@<handle>
   *   pinterest  https://www.pinterest.com/<handle>
   */
  social: {
    whatsapp: 'https://wa.me/251906373154',
    // Verified 17 Oct 2026 in-browser. Real page, 6.1K followers, bio "Radiology
    // consultation anywhere, everywhere, anytime", and it already lists
    // 090 637 3154, hakimedrad@gmail.com and hakimerad.health.et - so it is the
    // brand's own page. The handle reads "hakimbooks" (a legacy page name) and
    // Facebook files it under "Entrepreneur" rather than a medical category. It is
    // the strongest channel by audience, by a wide margin.
    facebook: 'https://www.facebook.com/hakimbooks',
    // Verified 17 Oct 2026: @hakimedrad resolves to X account id 2111196197788479488,
    // the same account this project's X connector is authorised against. Note the
    // spelling - "hakimedrad", not "hakimerad". The latter is an unrelated 2013
    // account (id 309212376, display name "Hakim Merad") and must never be used.
    x: 'https://x.com/hakimedrad',
    telegram: 'https://t.me/hakimerad2026',
    // Verified 17 Oct 2026 in-browser. The trailing numeric suffix is REQUIRED:
    // the bare slug /in/hakimerad-radiologic-consultancy without it returns
    // LinkedIn's 404 page, so never shorten this URL. It is a personal-type /in/
    // profile standing in for a company page, not a /company/ page. If a proper
    // company page is created later, replace this value and update the note.
    linkedin: 'https://www.linkedin.com/in/hakimerad-radiologic-consultancy-8a5031390',
    // Verified 17 Oct 2026 in-browser: live profile, 3 followers, 0 posts.
    instagram: 'https://www.instagram.com/hakimedrad',
    // NOT SUPPLIED - no channel exists. Both /channel/hakimedrad and @hakimedrad
    // returned 404 on 17 Oct 2026, so no URL is invented here. Fill this in only
    // once a real channel URL is confirmed.
    youtube: '',
    // Verified 17 Oct 2026 in-browser: live account, 0 videos, 0 followers.
    tiktok: 'https://www.tiktok.com/@hakimedrad',
    // Verified 17 Oct 2026: the page title reads "Hakimedrad (hakimedrad)". A real
    // owned profile, though empty (0 pins).
    pinterest: 'https://www.pinterest.com/hakimedrad/',
  },
};
