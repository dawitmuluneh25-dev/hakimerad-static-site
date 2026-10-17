/* Apply the stored colour theme before the first paint.
 *
 * js/main.js is loaded at the end of <body>, so a dark-theme reload used to
 * paint the whole page in the light palette and only flip it once main.js had
 * run - a visible flash on every page load. This file is a blocking script in
 * <head>, so the theme is already decided when the first frame is drawn.
 *
 * It is an external file rather than an inline script because the deployed
 * Content-Security-Policy in .htaccess sets `script-src 'self'` with no
 * 'unsafe-inline', which would block an inline block.
 *
 * The class goes on <html>, not <body>: <body> does not exist yet when this
 * runs. Every dark rule in css/style.css and css/brand-layer.css is therefore
 * keyed on `html.theme-dark`, and js/main.js keeps that class in step when the
 * toggle is used.
 *
 * The logic mirrors js/main.js: only an explicit stored 'dark' selects dark.
 * No stored value, or an unreadable localStorage, means the light default.
 */
(function () {
  var stored = null;

  try {
    stored = window.localStorage.getItem('theme');
  } catch {
    /* Private mode, or storage disabled. Fall through to the light default. */
    stored = null;
  }

  if (stored === 'dark') {
    document.documentElement.classList.add('theme-dark');
  }
})();
